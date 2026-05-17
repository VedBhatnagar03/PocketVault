import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { saveConfig, apiFetch } from '../api/client';

export default function LoginScreen({ onLogin }) {
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('vault');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    const trimmed = host.trim().replace(/\/$/, '');
    if (!trimmed || !username || !password) {
      Alert.alert('Missing fields', 'Fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      await saveConfig(trimmed, username, password);
      const res = await apiFetch('/api/media');
      if (res) onLogin();
    } catch (e) {
      Alert.alert('Connection failed', 'Check your server URL and credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={s.logo}>Pocket<Text style={s.accent}>Vault</Text></Text>
      <Text style={s.sub}>Connect to your laptop server</Text>

      <TextInput
        style={s.input}
        placeholder="Server URL (e.g. http://100.x.x.x:8000)"
        placeholderTextColor="#555"
        value={host}
        onChangeText={setHost}
        autoCapitalize="none"
        keyboardType="url"
      />
      <TextInput
        style={s.input}
        placeholder="Username"
        placeholderTextColor="#555"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={s.input}
        placeholder="Password"
        placeholderTextColor="#555"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={s.btn} onPress={handleConnect} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Connect</Text>}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', padding: 28 },
  logo: { fontSize: 32, fontWeight: '700', color: '#e8e8e8', marginBottom: 6 },
  accent: { color: '#6c63ff' },
  sub: { color: '#888', marginBottom: 32, fontSize: 14 },
  input: {
    backgroundColor: '#1a1a1a', color: '#e8e8e8', borderRadius: 10,
    padding: 14, marginBottom: 14, fontSize: 15, borderWidth: 1, borderColor: '#2a2a2a',
  },
  btn: {
    backgroundColor: '#6c63ff', borderRadius: 10, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
