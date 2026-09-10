import { store } from '@/database/store';
import type { StoreHours } from '@/types';
import { defaultStoreHours, normalizeStoreHours } from '@/utils/store-hours';

const SETTINGS_KEY = 'store_hours_v1';

export const getStoreHours = async (): Promise<StoreHours> => {
  const saved = await store.getSetting(SETTINGS_KEY);
  if (!saved) return defaultStoreHours();
  try { return normalizeStoreHours(JSON.parse(saved)); }
  catch { return defaultStoreHours(); }
};

export const saveStoreHours = async (hours: StoreHours) => {
  const normalized = normalizeStoreHours({ ...hours, configured: true });
  await store.setSetting(SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
};
