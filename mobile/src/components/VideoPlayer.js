import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export default function VideoPlayer({ uri }) {
  const player = useVideoPlayer(uri, p => {
    p.loop = false;
    p.play();
  });

  return (
    <View style={s.container}>
      <VideoView style={s.video} player={player} allowsFullscreen allowsPictureInPicture />
    </View>
  );
}

const s = StyleSheet.create({
  container: { width: '100%', height: '80%', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
});
