import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'vault_config';

export async function getConfig() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function saveConfig(host, username, password) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ host, username, password }));
}

export function authHeader(config) {
  return { Authorization: `Basic ${btoa(`${config.username}:${config.password}`)}` };
}

export async function apiFetch(path, options = {}) {
  const config = await getConfig();
  if (!config) throw new Error('Not configured');
  const res = await fetch(`${config.host}${path}`, {
    ...options,
    headers: { ...authHeader(config), ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

export async function listMedia(folder = '') {
  const params = folder ? `?folder=${encodeURIComponent(folder)}` : '';
  const res = await apiFetch(`/api/media${params}`);
  return res.json();
}

export async function deleteFile(path) {
  await apiFetch(`/api/media/file/${path}`, { method: 'DELETE' });
}

export async function createFolder(name, parent = '') {
  const params = new URLSearchParams({ name });
  if (parent) params.append('parent', parent);
  const res = await apiFetch(`/api/folder?${params}`, { method: 'POST' });
  return res.json();
}

export async function getStorageStats() {
  const res = await apiFetch('/api/media/stats');
  return res.json();
}

export async function checkFileExists(name, folder = '') {
  const params = new URLSearchParams({ name });
  if (folder) params.append('folder', folder);
  const res = await apiFetch(`/api/media/exists?${params}`);
  return res.json();
}

export async function uploadFiles(uris, folder = '', onProgress, onFileProgress) {
  const config = await getConfig();
  if (!config) throw new Error('Not configured');
  const { host } = config;

  const results = { uploaded: [], skipped: [] };

  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i];
    const name = uri.split('/').pop();

    if (onFileProgress) onFileProgress(i, uris.length, name);

    const form = new FormData();
    const ext = name.split('.').pop().toLowerCase();
    const type = ['mp4', 'mov', 'm4v'].includes(ext) ? `video/${ext}` : `image/${ext}`;
    form.append('files', { uri, name, type });
    if (folder) form.append('folder', folder);

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${host}/api/upload`);
      xhr.setRequestHeader('Authorization', authHeader(config).Authorization);
      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable) {
          onProgress((i + e.loaded / e.total) / uris.length);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          results.uploaded.push(...data.uploaded);
          resolve();
        } else reject(new Error(`HTTP ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(form);
    });
  }

  if (onFileProgress) onFileProgress(uris.length, uris.length, '');
  return results;
}

export function mediaUrl(path, config) {
  return `${config.host}/api/media/file/${path}`;
}
