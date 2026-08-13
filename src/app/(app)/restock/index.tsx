import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { Button, Card, Pill, ScreenState } from '@/components/ui';
import { colors } from '@/constants/theme';
import { store } from '@/database/store';
import { useI18n } from '@/i18n';
import type { RestockItem } from '@/types';
import { errorMessage } from '@/utils/format';

const urgency = {
  out: { labelKey: 'restockNow' as const, tone: 'danger' as const, icon: 'close-circle-outline' as const, color: colors.danger },
  critical: { labelKey: 'critical' as const, tone: 'danger' as const, icon: 'warning-outline' as const, color: colors.danger },
  low: { labelKey: 'low' as const, tone: 'warning' as const, icon: 'alert-outline' as const, color: colors.warning },
  ok: { labelKey: 'healthy' as const, tone: 'success' as const, icon: 'checkmark-circle-outline' as const, color: colors.success },
  no_data: { labelKey: 'noSalesData' as const, tone: 'neutral' as const, icon: 'remove-circle-outline' as const, color: colors.muted },
};

export default function RestockReportScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [view, setView] = useState({ items: [] as RestockItem[], loading: true, refreshing: false, error: '' });
  const load = useCallback(async (refreshing = false) => {
    setView((current) => ({ ...current, loading: !refreshing, refreshing, error: '' }));
    try { const items = await store.restockReport(); setView({ items, loading: false, refreshing: false, error: '' }); }
    catch (error) { setView((current) => ({ ...current, loading: false, refreshing: false, error: errorMessage(error) })); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (view.loading || view.error) return <SafeAreaView style={styles.safe}><ScreenState loading={view.loading} error={view.error} onRetry={load} /></SafeAreaView>;
  const urgentCount = view.items.filter((item) => ['out', 'critical', 'low'].includes(item.urgency)).length;
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={view.refreshing} onRefresh={() => load(true)} colors={[colors.primary]} />}>
        <Card style={styles.summary}><View><Text style={styles.summaryLabel}>{t('needsAttention')}</Text><Text style={styles.summaryValue}>{t('productsCount', { count: urgentCount })}</Text><Text style={styles.summaryText}>{t('forecastInfo')}</Text></View><View style={styles.restockButton}><Button title={t('restock')} onPress={() => router.push('/restock/stock')} /></View></Card>
        {view.items.length === 0 ? <ScreenState empty={t('noProductsForecast')} /> : view.items.map((item) => {
          const status = urgency[item.urgency];
          const estimate = item.daysLeft === null ? t('noEstimate') : item.stock === 0 ? t('outOfStock') : t('daysLeft', { count: item.daysLeft });
          return <Card key={item.id} style={styles.item}><View style={styles.icon}><AppIcon name={status.icon} color={status.color} /></View><View style={styles.copy}><View style={styles.titleRow}><Text style={styles.name}>{item.productName}</Text><Pill label={t(status.labelKey)} tone={status.tone} /></View><Text style={styles.estimate}>{estimate}</Text><Text style={styles.meta}>{t('inStock', { count: item.stock })} · {t('soldInThirtyDays', { count: item.soldLast30 })} · {t('soldPerDay', { count: item.velocity })}</Text></View></Card>;
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 34 },
  summary: { backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  summaryValue: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 3 },
  summaryText: { color: colors.muted, fontSize: 11, marginTop: 4 },
  restockButton: { width: 100 },
  item: { flexDirection: 'row', gap: 12, padding: 13 },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  copy: { flex: 1, gap: 5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '900' },
  estimate: { color: colors.text, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 16 },
});
