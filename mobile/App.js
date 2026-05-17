import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
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

  if (checking) return null;

  return (
    <>
      <StatusBar style="light" />
      {authed ? <GalleryScreen /> : <LoginScreen onLogin={() => setAuthed(true)} />}
    </>
  );
}
