import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, SectionList, Image, TouchableOpacity, Text, StyleSheet,
  Dimensions, Alert, ActivityIndicator, RefreshControl, TextInput,
  Modal, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import {
  listMedia, deleteFile, getConfig, mediaUrl, uploadFiles,
  createFolder, getStorageStats, checkFileExists, authHeader,
} from '../api/client';
import Lightbox from '../components/Lightbox';
import StorageBar from '../components/StorageBar';

const NUM_COLS = 3;
const SIZE = Dimensions.get('window').width / NUM_COLS;

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'largest', label: 'Largest' },
  { key: 'name', label: 'A–Z' },
];

function formatMonth(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function groupByMonth(items) {
  const map = {};
  for (const item of items) {
    const key = formatMonth(item.modified);
    if (!map[key]) map[key] = [];
    map[key].push(item);
  }
  return Object.entries(map).map(([title, data]) => ({ title, data: [data] }));
}

function sortItems(items, sort) {
  const folders = items.filter(i => i.type === 'folder');
  const files = items.filter(i => i.type !== 'folder');
  const sorted = [...files].sort((a, b) => {
    if (sort === 'newest') return new Date(b.modified) - new Date(a.modified);
    if (sort === 'oldest') return new Date(a.modified) - new Date(b.modified);
    if (sort === 'largest') return (b.size || 0) - (a.size || 0);
    if (sort === 'name') return a.name.localeCompare(b.name);
    return 0;
  });
  return [...folders, ...sorted];
}

export default function GalleryScreen() {
  const [allItems, setAllItems] = useState([]);
  const [folder, setFolder] = useState('');
  const [folderStack, setFolderStack] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);

  const [tab, setTab] = useState('all'); // 'all' | 'photos' | 'videos'
  const [sort, setSort] = useState('newest');
  const [showSort, setShowSort] = useState(false);
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => { getConfig().then(setConfig); }, []);

  const load = useCallback(async (f = folder) => {
    try {
      const [data, s] = await Promise.all([listMedia(f), getStorageStats()]);
      setAllItems(data.items);
      setStats(s);
    } catch (e) {
      Alert.alert('Error', 'Could not load media.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [folder]);

  useEffect(() => { load(folder); }, [folder]);

  // Filtered + sorted items
  const visibleItems = useCallback(() => {
    let items = allItems;
    if (tab === 'photos') items = items.filter(i => i.type === 'image' || i.type === 'folder');
    if (tab === 'videos') items = items.filter(i => i.type === 'video' || i.type === 'folder');
    if (search) items = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    return sortItems(items, sort);
  }, [allItems, tab, sort, search]);

  // Only media files (no folders) for lightbox indexing
  const mediaItems = useCallback(() => visibleItems().filter(i => i.type !== 'folder'), [visibleItems]);

  function openFolder(item) {
    setFolderStack(s => [...s, folder]);
    setFolder(item.path);
    setLoading(true);
    setSelected(new Set());
    setSelectMode(false);
    setSearch('');
  }

  function goBack() {
    const prev = folderStack[folderStack.length - 1];
    setFolderStack(s => s.slice(0, -1));
    setFolder(prev);
    setLoading(true);
    setSelected(new Set());
    setSelectMode(false);
  }

  function toggleSelect(path) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }

  async function handleDeleteSelected() {
    Alert.alert('Delete', `Delete ${selected.size} item(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await Promise.all([...selected].map(p => deleteFile(p)));
            setSelected(new Set());
            setSelectMode(false);
            load(folder);
          } catch { Alert.alert('Error', 'Some files could not be deleted.'); }
        },
      },
    ]);
  }

  async function handleUpload() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (result.canceled) return;

    const uris = result.assets.map(a => a.uri);

    // Duplicate check
    const dupes = [];
    for (const uri of uris) {
      const name = uri.split('/').pop();
      const { exists } = await checkFileExists(name, folder);
      if (exists) dupes.push(name);
    }

    if (dupes.length > 0) {
      await new Promise(resolve =>
        Alert.alert(
          'Duplicates found',
          `${dupes.length} file(s) already exist on your vault:\n${dupes.slice(0, 3).join(', ')}${dupes.length > 3 ? '...' : ''}\n\nThey'll be saved with a unique suffix.`,
          [{ text: 'OK', onPress: resolve }]
        )
      );
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      await uploadFiles(
        uris,
        folder,
        setUploadProgress,
        (i, total, name) => setUploadLabel(name ? `${i + 1}/${total}: ${name}` : 'Done'),
      );
      load(folder);
    } catch (e) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setUploading(false);
      setUploadLabel('');
    }
  }

  async function handleDownload(item) {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to save to your camera roll.');
      return;
    }
    try {
      const url = mediaUrl(item.path, config);
      const dest = FileSystem.cacheDirectory + item.name;
      const headers = authHeader(config);
      await FileSystem.downloadAsync(url, dest, { headers });
      await MediaLibrary.saveToLibraryAsync(dest);
      Alert.alert('Saved', `${item.name} saved to your camera roll.`);
    } catch (e) {
      Alert.alert('Download failed', e.message);
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    try {
      await createFolder(newFolderName.trim(), folder);
      setNewFolderName('');
      setShowNewFolder(false);
      load(folder);
    } catch { Alert.alert('Error', 'Could not create folder.'); }
  }

  function openLightbox(item) {
    const idx = mediaItems().findIndex(i => i.path === item.path);
    if (idx !== -1) setLightboxIndex(idx);
  }

  function renderTile(item) {
    if (item.type === 'folder') {
      return (
        <TouchableOpacity
          key={item.path}
          style={[s.tile, s.folderTile]}
          onPress={() => openFolder(item)}
        >
          <Text style={s.folderIcon}>📁</Text>
          <Text style={s.folderName} numberOfLines={1}>{item.name}</Text>
        </TouchableOpacity>
      );
    }

    const url = config ? mediaUrl(item.path, config) : '';
    const hdrs = config ? authHeader(config) : {};
    const isSel = selected.has(item.path);

    return (
      <TouchableOpacity
        key={item.path}
        style={[s.tile, isSel && s.tileSelected]}
        onPress={() => selectMode ? toggleSelect(item.path) : openLightbox(item)}
        onLongPress={() => { setSelectMode(true); toggleSelect(item.path); }}
      >
        <Image source={{ uri: url, headers: hdrs }} style={s.thumb} />
        {item.type === 'video' && (
          <View style={s.videoBadge}><Text style={s.videoBadgeText}>▶</Text></View>
        )}
        {isSel && <View style={s.checkOverlay}><Text style={s.checkMark}>✓</Text></View>}
      </TouchableOpacity>
    );
  }

  function renderRow(rowItems) {
    return (
      <View style={s.row}>
        {rowItems.map(item => renderTile(item))}
        {/* Fill empty cells in last row */}
        {Array(NUM_COLS - rowItems.length).fill(null).map((_, i) => (
          <View key={`empty-${i}`} style={s.tile} />
        ))}
      </View>
    );
  }

  function chunkIntoRows(items) {
    const rows = [];
    for (let i = 0; i < items.length; i += NUM_COLS) rows.push(items.slice(i, i + NUM_COLS));
    return rows;
  }

  const items = visibleItems();
  const sections = groupByMonth(items.filter(i => i.type !== 'folder'));
  const folders = items.filter(i => i.type === 'folder');

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#6c63ff" /></View>;
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        {folderStack.length > 0 ? (
          <TouchableOpacity onPress={goBack}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        ) : (
          <Text style={s.logo}>Pocket<Text style={s.accent}>Vault</Text></Text>
        )}
        <View style={s.headerRight}>
          {selectMode ? (
            <>
              <TouchableOpacity style={s.iconBtn} onPress={() => { setSelectMode(false); setSelected(new Set()); }}>
                <Text style={s.iconBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.iconBtn, s.dangerBtn]} onPress={handleDeleteSelected} disabled={selected.size === 0}>
                <Text style={s.iconBtnText}>Delete {selected.size}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={s.iconBtn} onPress={() => setShowSort(true)}>
                <Text style={s.iconBtnText}>⇅ {SORT_OPTIONS.find(o => o.key === sort)?.label}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.iconBtn} onPress={() => setShowNewFolder(true)}>
                <Text style={s.iconBtnText}>📁+</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.iconBtn, s.accentBtn]} onPress={handleUpload} disabled={uploading}>
                <Text style={s.iconBtnText}>{uploading ? `${Math.round(uploadProgress * 100)}%` : '+ Upload'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Upload label */}
      {uploading && uploadLabel ? (
        <View style={s.uploadBanner}><Text style={s.uploadBannerText}>{uploadLabel}</Text></View>
      ) : null}

      {/* Storage bar */}
      <StorageBar stats={stats} />

      {/* Search */}
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          placeholder="Search files..."
          placeholderTextColor="#555"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {['all', 'photos', 'videos'].map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {items.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>📂</Text>
          <Text style={s.emptyText}>No media here yet.{'\n'}Tap Upload to add files.</Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(folder); }} tintColor="#6c63ff" />}
        >
          {/* Folders always at top */}
          {folders.length > 0 && (
            <View>
              <Text style={s.sectionHeader}>Folders</Text>
              {chunkIntoRows(folders).map((row, i) => <View key={i}>{renderRow(row)}</View>)}
            </View>
          )}

          {/* Media grouped by month */}
          {sections.map(section => (
            <View key={section.title}>
              <Text style={s.sectionHeader}>{section.title}</Text>
              {chunkIntoRows(section.data[0]).map((row, i) => <View key={i}>{renderRow(row)}</View>)}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          items={mediaItems()}
          startIndex={lightboxIndex}
          config={config}
          visible={lightboxIndex !== null}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* Sort modal */}
      <Modal visible={showSort} transparent animationType="slide" onRequestClose={() => setShowSort(false)}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setShowSort(false)}>
          <View style={s.sortSheet}>
            <Text style={s.sortTitle}>Sort by</Text>
            {SORT_OPTIONS.map(o => (
              <TouchableOpacity key={o.key} style={s.sortOption} onPress={() => { setSort(o.key); setShowSort(false); }}>
                <Text style={[s.sortOptionText, sort === o.key && s.sortActive]}>{o.label}</Text>
                {sort === o.key && <Text style={s.sortCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* New folder modal */}
      <Modal visible={showNewFolder} transparent animationType="fade" onRequestClose={() => setShowNewFolder(false)}>
        <View style={s.modalBg}>
          <View style={s.folderModal}>
            <Text style={s.sortTitle}>New Folder</Text>
            <TextInput
              style={s.folderInput}
              placeholder="Folder name"
              placeholderTextColor="#555"
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
              onSubmitEditing={handleCreateFolder}
            />
            <View style={s.folderModalBtns}>
              <TouchableOpacity style={s.iconBtn} onPress={() => { setShowNewFolder(false); setNewFolderName(''); }}>
                <Text style={s.iconBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.iconBtn, s.accentBtn]} onPress={handleCreateFolder}>
                <Text style={s.iconBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Long-press download option */}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0f0f' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 52, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#2a2a2a', backgroundColor: '#1a1a1a',
  },
  logo: { fontSize: 20, fontWeight: '700', color: '#e8e8e8' },
  accent: { color: '#6c63ff' },
  backText: { color: '#6c63ff', fontSize: 16 },
  headerRight: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  iconBtn: { backgroundColor: '#2a2a2a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  iconBtnText: { color: '#e8e8e8', fontSize: 12, fontWeight: '600' },
  accentBtn: { backgroundColor: '#6c63ff' },
  dangerBtn: { backgroundColor: '#c0392b' },
  uploadBanner: { backgroundColor: '#6c63ff22', padding: 6, alignItems: 'center' },
  uploadBannerText: { color: '#6c63ff', fontSize: 12 },
  searchRow: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#111' },
  searchInput: {
    backgroundColor: '#1a1a1a', color: '#e8e8e8', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, borderWidth: 1, borderColor: '#2a2a2a',
  },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#2a2a2a', backgroundColor: '#111' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#6c63ff' },
  tabText: { color: '#888', fontSize: 13 },
  tabTextActive: { color: '#6c63ff', fontWeight: '600' },
  sectionHeader: {
    color: '#888', fontSize: 12, fontWeight: '600',
    paddingHorizontal: 10, paddingTop: 12, paddingBottom: 4, backgroundColor: '#0f0f0f',
  },
  row: { flexDirection: 'row' },
  tile: { width: SIZE, height: SIZE, padding: 1 },
  tileSelected: { opacity: 0.6 },
  thumb: { width: '100%', height: '100%', backgroundColor: '#1a1a1a' },
  folderTile: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a' },
  folderIcon: { fontSize: 30 },
  folderName: { color: '#888', fontSize: 10, marginTop: 4, paddingHorizontal: 4 },
  videoBadge: {
    position: 'absolute', top: 5, left: 5,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: 2,
  },
  videoBadgeText: { color: '#fff', fontSize: 10 },
  checkOverlay: {
    position: 'absolute', inset: 0, backgroundColor: 'rgba(108,99,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 24, fontWeight: '700' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#888', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sortSheet: {
    backgroundColor: '#1a1a1a', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 20, paddingBottom: 36,
  },
  sortTitle: { color: '#e8e8e8', fontSize: 16, fontWeight: '700', marginBottom: 14 },
  sortOption: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  sortOptionText: { color: '#888', fontSize: 15 },
  sortActive: { color: '#6c63ff', fontWeight: '600' },
  sortCheck: { color: '#6c63ff', fontSize: 15 },
  folderModal: {
    backgroundColor: '#1a1a1a', borderRadius: 14, padding: 20,
    margin: 30, alignSelf: 'center', width: '85%',
  },
  folderInput: {
    backgroundColor: '#0f0f0f', color: '#e8e8e8', borderRadius: 8,
    padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 14,
  },
  folderModalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
