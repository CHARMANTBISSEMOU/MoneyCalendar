import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import 'react-native-reanimated';
import * as Updates from 'expo-updates';
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

async function checkForOTAUpdate() {
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      Alert.alert(
        'Mise à jour disponible',
        'Une nouvelle version a été téléchargée. L\'application va redémarrer.',
        [{ text: 'OK', onPress: () => Updates.reloadAsync() }]
      );
    }
  } catch (e) {
    log.info('Updates', 'Erreur OTA (ignorée en dev)', { error: String(e) });
  }
}

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

    // Check for OTA updates on startup (only in production builds)
    if (!__DEV__) {
      checkForOTAUpdate();
    }
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

