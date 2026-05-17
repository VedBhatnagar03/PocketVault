import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getConfig } from './src/api/client';
import LoginScreen from './src/screens/LoginScreen';
import GalleryScreen from './src/screens/GalleryScreen';

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getConfig().then(cfg => {
      setAuthed(!!cfg);
      setChecking(false);
    });
  }, []);

  if (checking) return <View style={{ flex: 1, backgroundColor: '#0f0f0f' }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      {authed ? <GalleryScreen /> : <LoginScreen onLogin={() => setAuthed(true)} />}
    </GestureHandlerRootView>
  );
}
