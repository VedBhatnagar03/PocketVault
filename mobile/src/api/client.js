import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'vault_config';

export async function getConfig() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function saveConfig(host, username, password) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ host, username, password }));
}

function authHeader(username, password) {
  const encoded = btoa(`${username}:${password}`);
  return { Authorization: `Basic ${encoded}` };
}

export async function apiFetch(path, options = {}) {
  const config = await getConfig();
  if (!config) throw new Error('Not configured');
  const { host, username, password } = config;
  const url = `${host}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...authHeader(username, password),
      ...(options.headers || {}),
    },
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

export async function uploadFiles(uris, folder = '', onProgress) {
  const config = await getConfig();
  if (!config) throw new Error('Not configured');
  const { host, username, password } = config;

  const form = new FormData();
  for (const uri of uris) {
    const name = uri.split('/').pop();
    const ext = name.split('.').pop().toLowerCase();
    const type = ['mp4', 'mov', 'm4v'].includes(ext) ? `video/${ext}` : `image/${ext}`;
    form.append('files', { uri, name, type });
  }
  if (folder) form.append('folder', folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${host}/api/upload`);
    xhr.setRequestHeader('Authorization', `Basic ${btoa(`${username}:${password}`)}`);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(new Error(`HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(form);
  });
}

export function mediaUrl(path, config) {
  return `${config.host}/api/media/file/${path}`;
}
