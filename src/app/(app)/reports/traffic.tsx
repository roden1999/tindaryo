import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { Button, Card, Page, Pill, ScreenState, SectionTitle } from '@/components/ui';
import { colors } from '@/constants/theme';
import { store } from '@/database/store';
import { useI18n } from '@/i18n';
import { getStoreHours } from '@/services/store-hours';
import type { TrafficReport, Weekday } from '@/types';
import { errorMessage, peso } from '@/utils/format';
import { analyzeTraffic } from '@/utils/traffic';
import { defaultStoreHours, formatStoreTime, WEEKDAY_NAMES, WEEKDAY_ORDER } from '@/utils/store-hours';

const emptyReport: TrafficReport = { periodDays: 56, weeksObserved: 8, totalTransactions: 0, activeDays: 0, confidence: 'learning', slots: [], busiest: [], quietest: [] };

export default function TrafficReportScreen() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [fdata, setData] = useState({ report: emptyReport, hours: defaultStoreHours(), selectedDay: new Date().getDay() as Weekday, loading: true, error: '' });

  const load = useCallback(async () => {
    setData((current) => ({ ...current, loading: true, error: '' }));
    try {
      const [hours, data] = await Promise.all([getStoreHours(), store.trafficData(56)]);
      const report = analyzeTraffic({ rawSlots: data.slots, hours, totalTransactions: data.totalTransactions, activeDays: data.activeDays, periodDays: data.periodDays });
      setData((current) => ({ ...current, hours, report, loading: false }));
    } catch (error) { setData((current) => ({ ...current, loading: false, error: errorMessage(error) })); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  if (fdata.loading) return <Page><ScreenState loading /></Page>;
  if (fdata.error) return <Page><ScreenState error={fdata.error} onRetry={load} /></Page>;
  if (!fdata.hours.configured) return <Page><Card style={styles.setupCard}><View style={styles.heroIcon}><AppIcon name="time-outline" size={28} color={colors.primary} /></View><Text style={styles.title}>{t('setHoursFirst')}</Text><Text style={styles.centerText}>{t('setHoursFirstInfo')}</Text><Button title={t('manageStoreHours')} onPress={() => router.push('/store-hours' as Href)} /></Card></Page>;

  const daySlots = fdata.report.slots.filter((slot) => slot.weekday === fdata.selectedDay);
  const maxTransactions = Math.max(1, ...daySlots.map((slot) => slot.averageTransactions));
  const confidenceTone = fdata.report.confidence === 'reliable' ? 'success' : fdata.report.confidence === 'early' ? 'warning' : 'neutral';

  return <Page>
    <Card style={styles.hero}>
      <View style={styles.heroTop}><View style={styles.heroIcon}><AppIcon name="bar-chart-outline" size={28} color={colors.primary} /></View><Pill label={t(`trafficConfidence${fdata.report.confidence === 'reliable' ? 'Reliable' : fdata.report.confidence === 'early' ? 'Early' : 'Learning'}`)} tone={confidenceTone} /></View>
      <Text style={styles.title}>{t('salesTraffic')}</Text>
      <Text style={styles.caption}>{t('salesTrafficInfo')}</Text>
      <View style={styles.metrics}><Metric value={String(fdata.report.totalTransactions)} label={t('salesAnalyzed')} /><Metric value={String(fdata.report.activeDays)} label={t('sellingDays')} /><Metric value="8" label={t('weeks')} /></View>
    </Card>

    {fdata.report.confidence === 'learning' ? <Card style={styles.learning}><AppIcon name="information-circle-outline" color={colors.warning} /><Text style={styles.learningText}>{t('trafficLearningInfo')}</Text></Card> : null}

    <SectionTitle>{t('hourlyPattern')}</SectionTitle>
    <View style={styles.days}>{WEEKDAY_ORDER.map((day) => <Pressable key={day} onPress={() => setData((current) => ({ ...current, selectedDay: day }))} style={[styles.dayChip, fdata.selectedDay === day && styles.dayChipActive]}><Text style={[styles.dayChipText, fdata.selectedDay === day && styles.dayChipTextActive]}>{WEEKDAY_NAMES[day].slice(0, 3)}</Text></Pressable>)}</View>
    {daySlots.length ? <Card style={styles.chart}>{daySlots.map((slot) => <View key={slot.hour} style={styles.hourRow}>
      <Text style={styles.hour}>{formatStoreTime(`${String(slot.hour).padStart(2, '0')}:00`, locale)}</Text>
      <View style={styles.barTrack}><View style={[styles.bar, { width: `${Math.max(slot.transactions ? 8 : 1, (slot.averageTransactions / maxTransactions) * 100)}%` }, slot.level === 'busy' && styles.busyBar, (slot.level === 'quiet' || slot.level === 'none') && styles.quietBar]} /></View>
      <View style={styles.hourValue}><Text style={styles.average}>{slot.averageTransactions.toFixed(1)}</Text><Text style={styles.perWeek}>{t('perWeek')}</Text></View>
    </View>)}</Card> : <Card><Text style={styles.centerText}>{t('closedAllDay')}</Text></Card>}

    <View style={styles.insightRow}>
      <InsightCard icon="flash-outline" title={t('busiestTime')} slot={fdata.report.busiest[0]} locale={locale} tone="busy" />
      <InsightCard icon="moon-outline" title={t('quietOpportunity')} slot={fdata.report.quietest[0]} locale={locale} tone="quiet" />
    </View>
    <Card style={styles.disclaimer}><AppIcon name="shield-checkmark-outline" color={colors.primary} /><Text style={styles.disclaimerText}>{t('trafficPrivacyInfo')}</Text></Card>
  </Page>;
}

const Metric = ({ value, label }: { value: string; label: string }) => <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
const InsightCard = ({ icon, title, slot, locale, tone }: { icon: Parameters<typeof AppIcon>[0]['name']; title: string; slot?: TrafficReport['busiest'][number]; locale: string; tone: 'busy' | 'quiet' }) => <Card style={styles.insightCard}><View style={[styles.insightIcon, tone === 'busy' ? styles.busyIcon : styles.quietIcon]}><AppIcon name={icon} color={tone === 'busy' ? colors.warning : colors.primary} /></View><Text style={styles.insightTitle}>{title}</Text>{slot ? <><Text style={styles.insightDay}>{WEEKDAY_NAMES[slot.weekday]}</Text><Text style={styles.insightTime}>{formatStoreTime(`${String(slot.hour).padStart(2, '0')}:00`, locale)}</Text><Text style={styles.insightMeta}>{slot.transactions} sales · {peso(slot.revenue)}</Text></> : <Text style={styles.insightMeta}>—</Text>}</Card>;

const styles = StyleSheet.create({
  hero: { gap: 9 }, heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heroIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' }, caption: { color: colors.muted, lineHeight: 19, fontSize: 12 },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 5 }, metric: { flex: 1, padding: 11, borderRadius: 14, backgroundColor: colors.background }, metricValue: { color: colors.text, fontSize: 20, fontWeight: '900' }, metricLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', marginTop: 2 },
  learning: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: colors.warningSoft }, learningText: { flex: 1, color: colors.warning, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  days: { flexDirection: 'row', gap: 5 }, dayChip: { flex: 1, minHeight: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary }, dayChipText: { color: colors.muted, fontWeight: '900', fontSize: 10 }, dayChipTextActive: { color: '#fff' },
  chart: { gap: 12 }, hourRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, hour: { width: 64, color: colors.text, fontSize: 11, fontWeight: '800' }, barTrack: { flex: 1, height: 9, overflow: 'hidden', borderRadius: 99, backgroundColor: colors.border }, bar: { height: '100%', borderRadius: 99, backgroundColor: colors.primary }, busyBar: { backgroundColor: colors.warning }, quietBar: { backgroundColor: '#9ABDB4' }, hourValue: { width: 40, alignItems: 'flex-end' }, average: { color: colors.text, fontSize: 11, fontWeight: '900' }, perWeek: { color: colors.muted, fontSize: 7 },
  insightRow: { flexDirection: 'row', gap: 10 }, insightCard: { flex: 1, minHeight: 175 }, insightIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 9 }, busyIcon: { backgroundColor: colors.warningSoft }, quietIcon: { backgroundColor: colors.primarySoft }, insightTitle: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 }, insightDay: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 8 }, insightTime: { color: colors.primary, fontSize: 16, fontWeight: '900', marginTop: 2 }, insightMeta: { color: colors.muted, fontSize: 10, marginTop: 5 },
  disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, disclaimerText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 }, setupCard: { alignItems: 'center', gap: 12, paddingVertical: 28 }, centerText: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
});
