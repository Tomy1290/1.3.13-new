import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image, View, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initializeNotifications, cancelAllNotifications } from '../src/utils/notifications';
import { scheduleCycleNotifications } from '../src/utils/cycleNotifications';
import { useAppStore } from "../src/store/useStore";

export default function RootLayout() {
  const theme = useAppStore((s) => s.theme);
  const barStyle = theme === "pink_vibrant" ? "light" : "dark";
  const bg = theme === 'pink_vibrant' ? '#1b0b12' : '#fde7ef';

  const [bootVisible, setBootVisible] = useState(true);
  useEffect(() => { const t = setTimeout(() => setBootVisible(false), 1200); return () => clearTimeout(t); }, []);

  useEffect(() => {
    (async () => {
      const initialized = await initializeNotifications();
      if (initialized) {
        const state = useAppStore.getState();
        await cancelAllNotifications(); // safety: clear any legacy schedules
        await scheduleCycleNotifications(state);
        // Do NOT schedule reminders at startup. They get scheduled by user actions only.
      }
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={barStyle as any} />
      <Stack screenOptions={{ headerShown: false }} />
      {bootVisible ? (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
          <Image source={require('../assets/images/icon.png')} style={{ width: 120, height: 120, resizeMode: 'contain' }} />
          <Text style={{ marginTop: 12, color: theme==='pink_vibrant' ? '#ffffff' : '#3a2f33' }}>created by Gugi</Text>
        </View>
      ) : null}
    </GestureHandlerRootView>
  );
}