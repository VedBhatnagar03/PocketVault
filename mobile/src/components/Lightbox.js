import React, { useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions, Image } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, runOnJS,
} from 'react-native-reanimated';
import VideoPlayer from './VideoPlayer';

const { width: W, height: H } = Dimensions.get('window');

function ZoomableImage({ uri, headers }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate(e => { scale.value = savedScale.value * e.scale; })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        offsetX.value = withSpring(0);
        offsetY.value = withSpring(0);
        savedScale.value = 1;
        savedX.value = 0;
        savedY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate(e => {
      if (scale.value > 1) {
        offsetX.value = savedX.value + e.translationX;
        offsetY.value = savedY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedX.value = offsetX.value;
      savedY.value = offsetY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        offsetX.value = withSpring(0);
        offsetY.value = withSpring(0);
        savedScale.value = 1;
        savedX.value = 0;
        savedY.value = 0;
      } else {
        scale.value = withSpring(2.5);
        savedScale.value = 2.5;
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.Image
        source={{ uri, headers }}
        style={[s.fullImg, animStyle]}
        resizeMode="contain"
      />
    </GestureDetector>
  );
}

export default function Lightbox({ items, startIndex, config, visible, onClose }) {
  const translateX = useSharedValue(0);
  const currentIndex = useSharedValue(startIndex);

  useEffect(() => {
    currentIndex.value = startIndex;
    translateX.value = -startIndex * W;
  }, [startIndex, visible]);

  function goTo(index) {
    'worklet';
    if (index < 0 || index >= items.length) return;
    currentIndex.value = index;
    translateX.value = withSpring(-index * W, { damping: 20 });
  }

  const swipe = Gesture.Pan()
    .onEnd(e => {
      if (e.translationX < -50) goTo(currentIndex.value + 1);
      else if (e.translationX > 50) goTo(currentIndex.value - 1);
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: W * items.length,
  }));

  const headers = config ? { Authorization: `Basic ${btoa(`${config.username}:${config.password}`)}` } : {};

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.container}>
        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <Text style={s.closeText}>✕</Text>
        </TouchableOpacity>

        <GestureDetector gesture={swipe}>
          <Animated.View style={[s.strip, animStyle]}>
            {items.map((item, i) => (
              <View key={item.path} style={s.slide}>
                {item.type === 'image'
                  ? <ZoomableImage uri={`${config?.host}/api/media/file/${item.path}`} headers={headers} />
                  : <VideoPlayer uri={`${config?.host}/api/media/file/${item.path}`} />
                }
              </View>
            ))}
          </Animated.View>
        </GestureDetector>

        <Text style={s.name} numberOfLines={1}>
          {items[startIndex]?.name}
        </Text>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(0,0,0,0.97)', justifyContent: 'center' },
  closeBtn: {
    position: 'absolute', top: 52, right: 20, zIndex: 10,
    backgroundColor: '#1a1a1a', borderRadius: 20,
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 16 },
  strip: { flexDirection: 'row', height: H },
  slide: { width: W, height: H, alignItems: 'center', justifyContent: 'center' },
  fullImg: { width: W, height: H * 0.8 },
  name: {
    position: 'absolute', bottom: 40, left: 0, right: 0,
    color: '#888', fontSize: 13, textAlign: 'center', paddingHorizontal: 20,
  },
});
