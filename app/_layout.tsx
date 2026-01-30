import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Colors } from '../constants/Colors';

// Prevent the splash screen from auto-hiding before asset loading is complete.
try {
  SplashScreen.preventAutoHideAsync();
} catch (e) {
  console.warn('Error preventing auto hide splash screen:', e);
}

export default function RootLayout() {
  useEffect(() => {
    // Hide the splash screen after the component mounts.
    // We add a small delay or just call it directly depending on load requirements.
    // Also adding a safety timeout to ensure it always hides.
    const hideSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        console.warn('Error hiding splash screen:', e);
      }
    };

    hideSplash();

    // Safety timeout: Force hide after 3 seconds if for some reason above fails or hangs
    const timeout = setTimeout(hideSplash, 3000);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false, animation: 'fade' }} />
      </Stack>
    </View>
  );
}
