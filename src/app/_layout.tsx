import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { colors } from '@/constants/theme';
import { LanguageProvider } from '@/i18n';
import { syncNotificationSchedule } from '@/services/notifications';

export default function RootLayout() {
  return <LanguageProvider><RootNavigator /></LanguageProvider>;
}

function RootNavigator() {
  useEffect(() => {
    const refreshReminders = () => { void syncNotificationSchedule().catch(() => undefined); };
    refreshReminders();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') refreshReminders(); });
    return () => subscription.remove();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '800' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="setup" options={{ headerShown: false }} />
        <Stack.Screen name="unlock" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
