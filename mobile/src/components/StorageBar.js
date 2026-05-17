import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

function fmt(bytes) {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e3).toFixed(0)} KB`;
}

export default function StorageBar({ stats }) {
  if (!stats) return null;
  const vaultPct = Math.min((stats.vault / stats.total) * 100, 100);
  const usedPct = Math.min((stats.used / stats.total) * 100, 100);

  return (
    <View style={s.container}>
      <View style={s.row}>
        <Text style={s.label}>Vault: <Text style={s.accent}>{fmt(stats.vault)}</Text></Text>
        <Text style={s.label}>Free: <Text style={s.free}>{fmt(stats.free)}</Text></Text>
        <Text style={s.label}>Disk: {fmt(stats.total)}</Text>
      </View>
      <View style={s.track}>
        <View style={[s.barUsed, { width: `${usedPct}%` }]} />
        <View style={[s.barVault, { width: `${vaultPct}%` }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#111' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label: { color: '#888', fontSize: 11 },
  accent: { color: '#6c63ff' },
  free: { color: '#4caf50' },
  track: { height: 4, backgroundColor: '#2a2a2a', borderRadius: 2, overflow: 'hidden' },
  barUsed: { position: 'absolute', height: '100%', backgroundColor: '#333', borderRadius: 2 },
  barVault: { position: 'absolute', height: '100%', backgroundColor: '#6c63ff', borderRadius: 2 },
});
