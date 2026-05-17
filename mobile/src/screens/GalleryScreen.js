import React, { useEffect, useState, useCallback } from 'react';
import {
  View, FlatList, Image, TouchableOpacity, Text, StyleSheet,
  Dimensions, Alert, ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { listMedia, deleteFile, getConfig, mediaUrl, uploadFiles, createFolder } from '../api/client';
import VideoPlayer from '../components/VideoPlayer';

const NUM_COLS = 3;
const SIZE = Dimensions.get('window').width / NUM_COLS;

export default function GalleryScreen() {
  const [items, setItems] = useState([]);
  const [folder, setFolder] = useState('');
  const [folderStack, setFolderStack] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => { getConfig().then(setConfig); }, []);

  const load = useCallback(async (f = folder) => {
    try {
      const data = await listMedia(f);
      setItems(data.items);
    } catch (e) {
      Alert.alert('Error', 'Could not load media.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [folder]);

  useEffect(() => { load(folder); }, [folder]);

  function openFolder(item) {
    setFolderStack(s => [...s, folder]);
    setFolder(item.path);
    setLoading(true);
  }

  function goBack() {
    const prev = folderStack[folderStack.length - 1];
    setFolderStack(s => s.slice(0, -1));
    setFolder(prev);
    setLoading(true);
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

    setUploading(true);
    setUploadProgress(0);
    try {
      const uris = result.assets.map(a => a.uri);
      await uploadFiles(uris, folder, setUploadProgress);
      load(folder);
    } catch (e) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(item) {
    Alert.alert('Delete', `Delete ${item.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteFile(item.path);
            load(folder);
          } catch { Alert.alert('Error', 'Could not delete.'); }
        },
      },
    ]);
  }

  function renderItem({ item }) {
    if (item.type === 'folder') {
      return (
        <TouchableOpacity style={[s.tile, s.folderTile]} onPress={() => openFolder(item)}>
          <Text style={s.folderIcon}>📁</Text>
          <Text style={s.folderName} numberOfLines={1}>{item.name}</Text>
        </TouchableOpacity>
      );
    }

    const url = config ? mediaUrl(item.path, config) : '';
    return (
      <TouchableOpacity style={s.tile} onPress={() => setLightbox(item)} onLongPress={() => handleDelete(item)}>
        <Image source={{ uri: url }} style={s.thumb} />
        {item.type === 'video' && (
          <View style={s.videoBadge}><Text style={s.videoBadgeText}>▶</Text></View>
        )}
      </TouchableOpacity>
    );
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#6c63ff" /></View>;
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        {folderStack.length > 0 ? (
          <TouchableOpacity onPress={goBack} style={s.backBtn}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
        ) : (
          <Text style={s.logo}>Pocket<Text style={s.accent}>Vault</Text></Text>
        )}
        <TouchableOpacity style={s.uploadBtn} onPress={handleUpload} disabled={uploading}>
          <Text style={s.uploadText}>{uploading ? `${Math.round(uploadProgress * 100)}%` : '+ Upload'}</Text>
        </TouchableOpacity>
      </View>

      {/* Grid */}
      {items.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>📂</Text>
          <Text style={s.emptyText}>No media here yet.{'\n'}Tap Upload to add files.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.path}
          numColumns={NUM_COLS}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(folder); }} tintColor="#6c63ff" />}
        />
      )}

      {/* Lightbox */}
      <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
        <View style={s.lightbox}>
          <TouchableOpacity style={s.closeBtn} onPress={() => setLightbox(null)}>
            <Text style={s.closeText}>✕</Text>
          </TouchableOpacity>
          {lightbox && config && (
            lightbox.type === 'image'
              ? <Image source={{ uri: mediaUrl(lightbox.path, config) }} style={s.fullImg} resizeMode="contain" />
              : <VideoPlayer uri={mediaUrl(lightbox.path, config)} />
          )}
          {lightbox && <Text style={s.lightboxName}>{lightbox.name}</Text>}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0f0f' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: '#2a2a2a',
    backgroundColor: '#1a1a1a',
  },
  logo: { fontSize: 20, fontWeight: '700', color: '#e8e8e8' },
  accent: { color: '#6c63ff' },
  backBtn: { padding: 4 },
  backText: { color: '#6c63ff', fontSize: 16 },
  uploadBtn: { backgroundColor: '#6c63ff', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  uploadText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  tile: { width: SIZE, height: SIZE, padding: 1 },
  thumb: { width: '100%', height: '100%', backgroundColor: '#1a1a1a' },
  folderTile: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a' },
  folderIcon: { fontSize: 32 },
  folderName: { color: '#888', fontSize: 11, marginTop: 4, paddingHorizontal: 4 },
  videoBadge: {
    position: 'absolute', top: 5, left: 5,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: 3,
  },
  videoBadgeText: { color: '#fff', fontSize: 10 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#888', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center' },
  closeBtn: { position: 'absolute', top: 52, right: 20, backgroundColor: '#1a1a1a', borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 16 },
  fullImg: { width: '100%', height: '80%' },
  lightboxName: { color: '#888', fontSize: 13, marginTop: 12 },
});
