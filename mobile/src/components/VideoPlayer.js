import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

export default function VideoPlayer({ uri }) {
  return (
    <View style={s.container}>
      <Text style={s.icon}>🎬</Text>
      <Text style={s.msg}>Video playback requires the full build.</Text>
      <Text style={s.sub}>Coming once we build with Xcode.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { width: '100%', height: '80%', alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 48, marginBottom: 12 },
  msg: { color: '#e8e8e8', fontSize: 16, fontWeight: '600' },
  sub: { color: '#888', fontSize: 13, marginTop: 6 },
});
