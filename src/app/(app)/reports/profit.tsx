import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { Card, ScreenState } from '@/components/ui';
import { colors } from '@/constants/theme';
import { store } from '@/database/store';
import { useI18n } from '@/i18n';
import type { ProfitSummary } from '@/types';
import { errorMessage, peso } from '@/utils/format';

const emptySummary: ProfitSummary = { revenue: 0, cost: 0, grossProfit: 0, expenses: 0, writtenOffLoss: 0, netProfit: 0, outstanding: 0, itemsSold: 0, saleCount: 0 };

export default function ProfitScreen() {
  const { t } = useI18n();
  const [view, setView] = useState({ summary: emptySummary, loading: true, refreshing: false, error: '' });
  const load = useCallback(async (refreshing = false) => {
    setView((current) => ({ ...current, loading: !refreshing, refreshing, error: '' }));
    try {
      const summary = await store.profit();
      setView({ summary, loading: false, refreshing: false, error: '' });
    } catch (error) { setView((current) => ({ ...current, loading: false, refreshing: false, error: errorMessage(error) })); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (view.loading || view.error) return <SafeAreaView style={styles.safe}><ScreenState loading={view.loading} error={view.error} onRetry={load} /></SafeAreaView>;
  const positive = view.summary.netProfit >= 0;
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={view.refreshing} onRefresh={() => load(true)} colors={[colors.primary]} />}>
        <Card style={[styles.hero, !positive && styles.heroLoss]}><Text style={styles.heroLabel}>{positive ? 'NET PROFIT (TUBO)' : 'NET LOSS (LUGI)'}</Text><Text style={styles.heroValue}>{peso(Math.abs(view.summary.netProfit))}</Text></Card>
        <Card style={styles.breakdown}>
          <Text style={styles.cardTitle}>{t('profitBreakdown')}</Text>
          <Row label={t('grossSales')} value={peso(view.summary.revenue)} />
          <Row label={t('goodsCost')} value={`− ${peso(view.summary.cost)}`} muted />
          <View style={styles.divider} />
          <Row label={t('grossProfit')} value={peso(view.summary.grossProfit)} bold />
          <Row label={t('recordedExpenses')} value={`− ${peso(view.summary.expenses)}`} danger={view.summary.expenses > 0} />
          <Row label={t('writtenOffUtang')} value={`− ${peso(view.summary.writtenOffLoss)}`} danger={view.summary.writtenOffLoss > 0} />
          <View style={styles.divider} />
          <Row label={t('netProfit')} value={peso(view.summary.netProfit)} bold danger={!positive} />
        </Card>
        <View style={styles.stats}>
          <Card style={styles.stat}><View style={styles.statIcon}><AppIcon name="people-outline" size={19} color="#8A5BB5" /></View><Text numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>{peso(view.summary.outstanding)}</Text><Text style={styles.statLabel}>{t('utangUnpaid')}</Text></Card>
          <Card style={styles.stat}><View style={styles.statIcon}><AppIcon name="cube-outline" size={19} color="#3978C5" /></View><Text style={styles.statValue}>{view.summary.itemsSold}</Text><Text style={styles.statLabel}>{t('itemsSold')}</Text></Card>
          <Card style={styles.stat}><View style={styles.statIcon}><AppIcon name="receipt-outline" size={19} color={colors.primary} /></View><Text style={styles.statValue}>{view.summary.saleCount}</Text><Text style={styles.statLabel}>{t('paidSales')}</Text></Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const Row = ({ label, value, bold = false, muted = false, danger = false }: { label: string; value: string; bold?: boolean; muted?: boolean; danger?: boolean }) => <View style={styles.row}><Text style={[styles.rowLabel, bold && styles.bold, muted && styles.muted]}>{label}</Text><Text style={[styles.rowValue, bold && styles.bold, muted && styles.muted, danger && styles.danger]}>{value}</Text></View>;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 34 },
  hero: { backgroundColor: colors.primary, borderWidth: 0, minHeight: 170, alignItems: 'center', justifyContent: 'center' },
  heroLoss: { backgroundColor: '#7A302D' },
  heroLabel: { color: 'rgba(255,255,255,0.75)', fontWeight: '900', letterSpacing: 1.1 },
  heroValue: { color: '#fff', fontSize: 40, fontWeight: '900', marginTop: 9 },
  breakdown: { gap: 14 },
  cardTitle: { color: colors.text, fontSize: 19, fontWeight: '900', marginBottom: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { flex: 1, color: colors.text },
  rowValue: { color: colors.text, fontWeight: '700' },
  bold: { fontWeight: '900', fontSize: 16 },
  muted: { color: colors.muted },
  danger: { color: colors.danger },
  divider: { height: 1, backgroundColor: colors.border },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 12, gap: 4 },
  statIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 5 },
  statLabel: { color: colors.muted, fontSize: 11 },
});
