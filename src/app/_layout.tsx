import { isRunningInExpoGo } from 'expo';
import { type Href, router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

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

  useEffect(() => {
    if (Platform.OS === 'web' || isRunningInExpoGo()) return;
    let active = true;
    let remove: (() => void) | undefined;
    const openNotification = (notification: { request: { content: { data?: Record<string, unknown> } } }) => {
      const url = notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as Href);
    };
    void import('expo-notifications').then((Notifications) => {
      if (!active) return;
      const response = Notifications.getLastNotificationResponse();
      if (response?.notification) openNotification(response.notification);
      const subscription = Notifications.addNotificationResponseReceivedListener((next) => openNotification(next.notification));
      remove = () => subscription.remove();
    }).catch(() => undefined);
    return () => { active = false; remove?.(); };
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
