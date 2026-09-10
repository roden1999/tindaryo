import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';
import { useI18n } from '@/i18n';

export default function AppLayout() {
  const { t } = useI18n();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '800' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="home" options={{ title: 'Tindaryo', headerShown: false }} />
      <Stack.Screen name="inventory/index" options={{ title: t('inventory') }} />
      <Stack.Screen name="inventory/new" options={{ title: t('addProduct') }} />
      <Stack.Screen name="inventory/[id]" options={{ title: t('editProduct') }} />
      <Stack.Screen name="sales/index" options={{ title: t('sales') }} />
      <Stack.Screen name="cart" options={{ title: t('newSale') }} />
      <Stack.Screen name="customers/index" options={{ title: t('utang') }} />
      <Stack.Screen name="customers/[id]" options={{ title: t('customerLedger') }} />
      <Stack.Screen name="reports/profit" options={{ title: t('profitLoss') }} />
      <Stack.Screen name="reports/traffic" options={{ title: t('salesTraffic') }} />
      <Stack.Screen name="restock/index" options={{ title: t('smartRestock') }} />
      <Stack.Screen name="restock/stock" options={{ title: t('restockInventory') }} />
      <Stack.Screen name="expenses/index" options={{ title: t('expensesCash') }} />
      <Stack.Screen name="settings" options={{ title: t('storeSettings') }} />
      <Stack.Screen name="store-hours" options={{ title: t('weeklyStoreHours') }} />
      <Stack.Screen name="help" options={{ title: t('helpPrivacy') }} />
    </Stack>
  );
}
