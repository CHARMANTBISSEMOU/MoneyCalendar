import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import { initDB } from '@/services/db';
import { log } from '@/utils/logger';
import Constants from 'expo-constants';
import { theme } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

const AppTheme = {
  dark: false,
  colors: {
    primary: theme.primary,
    background: theme.background,
    card: theme.card,
    text: theme.text,
    border: theme.border,
    notification: theme.primary,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium: { fontFamily: 'System', fontWeight: '500' as const },
    bold: { fontFamily: 'System', fontWeight: '700' as const },
    heavy: { fontFamily: 'System', fontWeight: '800' as const },
  },
};

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    log.info('App', 'Démarrage MoneyCalendar (local)', {
      platform: Platform.OS,
      expoVersion: Constants.expoVersion,
    });
    initDB();
  }, []);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <ThemeProvider value={AppTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add-expense" options={{ presentation: 'modal' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </ThemeProvider>
  );
}
