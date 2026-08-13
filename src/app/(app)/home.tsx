import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { Card, ScreenState, SectionTitle } from '@/components/ui';
import { colors, shadows } from '@/constants/theme';
import { store } from '@/database/store';
import { useI18n } from '@/i18n';
import type { Dashboard } from '@/types';
import { errorMessage, peso } from '@/utils/format';

const emptyDashboard: Dashboard = { todayRevenue: 0, todayProfit: 0, todaySaleCount: 0, lowStockCount: 0, totalUtang: 0, todayExpenses: 0, expiringCount: 0 };

const management = [
  { label: 'Inventory', description: 'Products and stock', icon: 'cube-outline' as const, color: '#3978C5', background: '#EAF2FC', route: '/inventory' as const },
  { label: 'Sales history', description: 'Receipts and totals', icon: 'receipt-outline' as const, color: '#8A5BB5', background: '#F2EBF9', route: '/sales' as const },
  { label: 'Profit / Loss', description: 'Understand earnings', icon: 'analytics-outline' as const, color: '#D17A22', background: '#FFF0DF', route: '/reports/profit' as const },
  { label: 'Smart Restock', description: 'Know what to buy', icon: 'trending-up-outline' as const, color: '#0B765E', background: '#DFF4EC', route: '/restock' as const },
  { label: 'Expenses & Cash', description: 'Daily cashflow', icon: 'wallet-outline' as const, color: '#B44B43', background: '#FCEBE8', route: '/expenses' as const },
];

export default function HomeScreen() {
  const router = useRouter();
  const { formatLongDate, t, tr } = useI18n();
  const [view, setView] = useState({
    dashboard: emptyDashboard,
    storeName: 'My Store',
    lastBackupAt: null as string | null,
    loading: true,
    refreshing: false,
    error: '',
  });

  const load = useCallback(async (refreshing = false) => {
    setView((current) => ({ ...current, loading: !refreshing, refreshing, error: '' }));
    try {
      const [dashboard, profile, lastBackupAt] = await Promise.all([store.dashboard(), store.getStoreProfile(), store.getSetting('last_backup_at')]);
      setView((current) => ({ ...current, dashboard, storeName: profile.storeName, lastBackupAt, loading: false, refreshing: false }));
    } catch (error) {
      setView((current) => ({ ...current, loading: false, refreshing: false, error: errorMessage(error) }));
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  if (view.loading) return <SafeAreaView style={styles.safe}><ScreenState loading /></SafeAreaView>;

  const dateLabel = formatLongDate(new Date());
  const positive = view.dashboard.todayProfit >= 0;
  const backupAge = view.lastBackupAt ? Date.now() - new Date(view.lastBackupAt).getTime() : Number.POSITIVE_INFINITY;
  const backupIsDue = !Number.isFinite(backupAge) || backupAge > 7 * 86400000;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={view.refreshing} onRefresh={() => load(true)} colors={[colors.primary]} />}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image source={require('../../../assets/images/tindaryo-icon.png')} style={styles.brandMark} contentFit="cover" />
            <View><Text style={styles.brand}>Tindaryo</Text><Text style={styles.date}>{dateLabel}</Text></View>
          </View>
          <Pressable accessibilityLabel={t('openSettings')} onPress={() => router.push('/settings')} style={({ pressed }) => [styles.settings, pressed && styles.pressed]}><AppIcon name="settings-outline" color={colors.text} /></Pressable>
        </View>

        <View style={styles.storeRow}><View><Text style={styles.eyebrow}>{t('yourStore')}</Text><Text style={styles.storeName}>{view.storeName}</Text></View><View style={styles.offlinePill}><View style={styles.offlineDot} /><Text style={styles.offlineText}>{t('offlineReady')}</Text></View></View>

        {view.error ? <Card style={styles.errorCard}><AppIcon name="alert-circle-outline" color={colors.warning} /><Text style={styles.errorText}>{t('databaseRetry')}</Text></Card> : null}
        {backupIsDue ? <Pressable onPress={() => router.push('/settings')} style={styles.backupReminder}><AppIcon name="cloud-upload-outline" color={colors.warning} /><View style={styles.newSaleCopy}><Text style={styles.backupReminderTitle}>{t('backupReminder')}</Text><Text style={styles.backupReminderText}>{t('backupDue')}</Text></View><AppIcon name="chevron-forward" color={colors.warning} /></Pressable> : null}

        <Card style={styles.salesCard}>
          <View style={styles.salesTop}><View><Text style={styles.salesLabel}>{t('salesToday')}</Text><Text style={styles.salesAmount}>{peso(view.dashboard.todayRevenue)}</Text></View><View style={styles.salesIcon}><AppIcon name="wallet-outline" size={26} color="#fff" /></View></View>
          <View style={styles.salesDivider} />
          <View style={styles.salesFooter}><View><Text style={styles.footerLabel}>{t('profit')}</Text><Text style={[styles.footerValue, !positive && styles.loss]}>{positive ? '+' : '−'}{peso(Math.abs(view.dashboard.todayProfit))}</Text></View><View><Text style={styles.footerLabel}>{t('transactions')}</Text><Text style={styles.footerValue}>{view.dashboard.todaySaleCount}</Text></View></View>
        </Card>

        <Pressable onPress={() => router.push('/cart')} style={({ pressed }) => [styles.newSale, pressed && styles.pressed]}>
          <View style={styles.newSaleIcon}><AppIcon name="cart-outline" color="#fff" size={25} /></View>
          <View style={styles.newSaleCopy}><Text style={styles.newSaleTitle}>{t('startSale')}</Text><Text style={styles.newSaleText}>{t('startSaleCaption')}</Text></View>
          <AppIcon name="arrow-forward" color="#fff" />
        </Pressable>

        <View style={styles.alerts}>
          <Pressable onPress={() => router.push('/inventory')} style={({ pressed }) => [styles.alertCard, pressed && styles.pressed]}>
            <View style={[styles.alertIcon, styles.stockIcon]}><AppIcon name="alert-outline" color={colors.warning} /></View><Text style={styles.alertValue}>{view.dashboard.lowStockCount}</Text><Text style={styles.alertLabel}>{t('lowStockItems')}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/customers')} style={({ pressed }) => [styles.alertCard, pressed && styles.pressed]}>
            <View style={[styles.alertIcon, styles.utangIcon]}><AppIcon name="people-outline" color="#8A5BB5" /></View><Text numberOfLines={1} adjustsFontSizeToFit style={styles.alertValue}>{peso(view.dashboard.totalUtang)}</Text><Text style={styles.alertLabel}>{t('customerUtang')}</Text>
          </Pressable>
        </View>

        <SectionTitle>{t('quickActions')}</SectionTitle>
        <View style={styles.quickActions}>
          <QuickAction icon="add-circle-outline" label={t('addProductShort')} onPress={() => router.push('/inventory/new')} />
          <QuickAction icon="archive-outline" label={t('restock')} onPress={() => router.push('/restock/stock')} />
          <QuickAction icon="wallet-outline" label={t('expenses')} onPress={() => router.push('/expenses')} />
        </View>

        <SectionTitle>{t('manageStore')}</SectionTitle>
        <View style={styles.managementGrid}>
          {management.map((item) => (
            <Pressable key={item.label} onPress={() => router.push(item.route)} style={({ pressed }) => [styles.managementCard, pressed && styles.pressed]}>
              <View style={[styles.managementIcon, { backgroundColor: item.background }]}><AppIcon name={item.icon} color={item.color} size={24} /></View>
              <Text style={styles.managementLabel}>{tr(item.label)}</Text>
              <Text style={styles.managementDescription}>{tr(item.description)}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const QuickAction = ({ icon, label, onPress }: { icon: Parameters<typeof AppIcon>[0]['name']; label: string; onPress: () => void }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}><View style={styles.quickIcon}><AppIcon name={icon} color={colors.primary} /></View><Text style={styles.quickLabel}>{label}</Text></Pressable>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { gap: 17, padding: 17, paddingBottom: 38 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandMark: { width: 44, height: 44, borderRadius: 14 },
  brand: { color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  date: { color: colors.muted, fontSize: 11, marginTop: 2 },
  settings: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  storeRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: colors.primary, fontWeight: '900', fontSize: 10, letterSpacing: 1.2 },
  storeName: { color: colors.text, fontSize: 27, fontWeight: '900', letterSpacing: -0.8, marginTop: 3 },
  offlinePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99 },
  offlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  offlineText: { color: colors.primaryDark, fontSize: 11, fontWeight: '800' },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 12, backgroundColor: colors.warningSoft },
  errorText: { flex: 1, color: colors.warning, fontWeight: '700', fontSize: 12 },
  backupReminder: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: colors.warningSoft, backgroundColor: colors.warningSoft },
  backupReminderTitle: { color: colors.warning, fontWeight: '900', fontSize: 13 },
  backupReminderText: { color: colors.muted, fontSize: 11, marginTop: 2 },
  salesCard: { backgroundColor: colors.primaryDark, borderWidth: 0, padding: 20 },
  salesTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  salesLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  salesAmount: { color: '#fff', fontSize: 37, fontWeight: '900', letterSpacing: -1.2, marginTop: 6 },
  salesIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.13)' },
  salesDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.13)', marginVertical: 17 },
  salesFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  footerLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  footerValue: { color: '#B8F2D9', fontSize: 17, fontWeight: '900', marginTop: 4 },
  loss: { color: '#FFD3CF' },
  newSale: { minHeight: 74, borderRadius: 20, padding: 13, paddingRight: 18, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primary, ...shadows.card },
  newSaleIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  newSaleCopy: { flex: 1, gap: 3 },
  newSaleTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
  newSaleText: { color: 'rgba(255,255,255,0.72)', fontSize: 12 },
  alerts: { flexDirection: 'row', gap: 11 },
  alertCard: { flex: 1, minHeight: 126, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 14, ...shadows.card },
  alertIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stockIcon: { backgroundColor: colors.warningSoft },
  utangIcon: { backgroundColor: '#F2EBF9' },
  alertValue: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 10 },
  alertLabel: { color: colors.muted, fontSize: 11, marginTop: 3 },
  quickActions: { flexDirection: 'row', gap: 10 },
  quickAction: { flex: 1, alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 12 },
  quickIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  quickLabel: { color: colors.text, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  managementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  managementCard: { width: '48%', minHeight: 145, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 15, ...shadows.card },
  managementIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  managementLabel: { color: colors.text, fontSize: 15, fontWeight: '900' },
  managementDescription: { color: colors.muted, fontSize: 11, marginTop: 4 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
});
