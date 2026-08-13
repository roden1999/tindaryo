import { getLocales } from 'expo-localization';
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

import { store } from '@/database/store';
import { translate } from '@/i18n';
import type { AppLanguage, NotificationPreferences } from '@/types';

const SETTINGS_KEY = 'notification_preferences';
const OWNER = 'tindaryo-store-reminder';
const CHANNEL_ID = 'store-alerts';
const defaultPreferences: NotificationPreferences = { enabled: false, lowStock: true, expiry: true, overdue: true, hour: 8, minute: 0 };

let handlerConfigured = false;

const getModule = async () => {
  if (Platform.OS === 'web' || isRunningInExpoGo()) return null;
  const Notifications = await import('expo-notifications');
  if (!handlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
    });
    handlerConfigured = true;
  }
  return Notifications;
};

const getResolvedLanguage = async () => {
  const saved = (await store.getSetting('app_language')) as AppLanguage | null;
  if (saved === 'fil' || saved === 'ceb' || saved === 'en') return saved;
  const code = getLocales()[0]?.languageCode?.toLowerCase();
  return code === 'fil' || code === 'tl' ? 'fil' : code === 'ceb' ? 'ceb' : 'en';
};

const ensureChannel = async (Notifications: Awaited<ReturnType<typeof getModule>>) => {
  if (Platform.OS === 'android' && Notifications) {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Store reminders',
      description: 'Low stock, expiry, and overdue utang reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#0B765E',
    });
  }
};

const cancelOwnedReminders = async (Notifications: NonNullable<Awaited<ReturnType<typeof getModule>>>) => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled
    .filter((request) => request.content.data?.owner === OWNER)
    .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)));
};

export const getNotificationPreferences = async (): Promise<NotificationPreferences> => {
  const saved = await store.getSetting(SETTINGS_KEY);
  if (!saved) return defaultPreferences;
  try {
    const parsed = JSON.parse(saved) as Partial<NotificationPreferences>;
    return {
      enabled: Boolean(parsed.enabled),
      lowStock: parsed.lowStock !== false,
      expiry: parsed.expiry !== false,
      overdue: parsed.overdue !== false,
      hour: Number.isInteger(parsed.hour) && parsed.hour! >= 0 && parsed.hour! <= 23 ? parsed.hour! : 8,
      minute: Number.isInteger(parsed.minute) && parsed.minute! >= 0 && parsed.minute! <= 59 ? parsed.minute! : 0,
    };
  } catch {
    return defaultPreferences;
  }
};

export const getNotificationPermission = async () => {
  const Notifications = await getModule();
  if (!Notifications) return 'unavailable' as const;
  await ensureChannel(Notifications);
  const permission = await Notifications.getPermissionsAsync();
  return permission.granted ? 'granted' as const : permission.canAskAgain ? 'undetermined' as const : 'denied' as const;
};

export const requestNotificationPermission = async () => {
  const Notifications = await getModule();
  if (!Notifications) return false;
  await ensureChannel(Notifications);
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
};

export const syncNotificationSchedule = async (preferences?: NotificationPreferences) => {
  const current = preferences ?? await getNotificationPreferences();
  const Notifications = await getModule();
  if (!Notifications) return { scheduled: 0, available: false };
  await ensureChannel(Notifications);
  await cancelOwnedReminders(Notifications);
  if (!current.enabled || !(await Notifications.getPermissionsAsync()).granted) return { scheduled: 0, available: true };

  const [summary, language] = await Promise.all([store.notificationSummary(), getResolvedLanguage()]);
  const trigger = { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: current.hour, minute: current.minute, channelId: CHANNEL_ID } as const;
  const reminders = [
    current.lowStock && summary.lowStockCount > 0 ? { title: translate('notifLowTitle', language, { count: summary.lowStockCount }), body: translate('notifLowBody', language), url: '/inventory' } : null,
    current.expiry && summary.expiringCount > 0 ? { title: translate('notifExpiryTitle', language, { count: summary.expiringCount }), body: translate('notifExpiryBody', language), url: '/inventory' } : null,
    current.overdue && summary.overdueCount > 0 ? { title: translate('notifOverdueTitle', language, { count: summary.overdueCount }), body: translate('notifOverdueBody', language), url: '/customers' } : null,
  ].filter((reminder): reminder is { title: string; body: string; url: string } => Boolean(reminder));

  await Promise.all(reminders.map((reminder) => Notifications.scheduleNotificationAsync({
    content: { title: reminder.title, body: reminder.body, data: { owner: OWNER, url: reminder.url } },
    trigger,
  })));
  return { scheduled: reminders.length, available: true };
};

export const saveNotificationPreferences = async (preferences: NotificationPreferences) => {
  await store.setSetting(SETTINGS_KEY, JSON.stringify(preferences));
  return syncNotificationSchedule(preferences);
};

export const sendTestNotification = async () => {
  const Notifications = await getModule();
  if (!Notifications) throw new Error('Notifications are unavailable on this platform.');
  if (!(await requestNotificationPermission())) throw new Error('Notification permission was not granted.');
  const language = await getResolvedLanguage();
  await Notifications.scheduleNotificationAsync({
    content: { title: translate('notifTestTitle', language), body: translate('notifTestBody', language), data: { owner: OWNER } },
    trigger: null,
  });
};
