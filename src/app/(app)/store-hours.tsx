import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { Button, Card, Page, ScreenState } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { getStoreHours, saveStoreHours } from '@/services/store-hours';
import { syncNotificationSchedule } from '@/services/notifications';
import type { StoreDayHours, StoreHours } from '@/types';
import { defaultStoreHours, formatStoreTime, minutesToTime, timeToMinutes, WEEKDAY_NAMES } from '@/utils/store-hours';
import { errorMessage } from '@/utils/format';

type PickerTarget = { day: StoreDayHours['day']; field: 'opensAt' | 'closesAt' } | null;

const timeDate = (value: string) => {
  const minutes = timeToMinutes(value) ?? 360;
  return new Date(2020, 0, 1, Math.floor(minutes / 60), minutes % 60);
};

export default function StoreHoursScreen() {
  const { t } = useI18n();
  const [fdata, setData] = useState({ hours: defaultStoreHours(), loading: true, saving: false, picker: null as PickerTarget, error: '' });

  useEffect(() => {
    getStoreHours()
      .then((hours) => setData((current) => ({ ...current, hours, loading: false })))
      .catch((error) => setData((current) => ({ ...current, loading: false, error: errorMessage(error) })));
  }, []);

  const updateDay = (day: StoreDayHours['day'], patch: Partial<StoreDayHours>) => setData((current) => ({
    ...current,
    hours: { ...current.hours, days: current.hours.days.map((item) => item.day === day ? { ...item, ...patch } : item) },
    error: '',
  }));

  const selectTime = (event: DateTimePickerEvent, selected?: Date) => {
    const target = fdata.picker;
    if (Platform.OS !== 'ios' || event.type === 'dismissed') setData((current) => ({ ...current, picker: null }));
    if (!target || event.type !== 'set' || !selected) return;
    updateDay(target.day, { [target.field]: minutesToTime(selected.getHours() * 60 + selected.getMinutes()) });
  };

  const copyMonday = (allDays: boolean) => {
    const monday = fdata.hours.days.find((item) => item.day === 1);
    if (!monday) return;
    setData((current) => ({
      ...current,
      hours: {
        ...current.hours,
        days: current.hours.days.map((item) => (allDays || (item.day >= 1 && item.day <= 5)) ? { ...item, enabled: monday.enabled, opensAt: monday.opensAt, closesAt: monday.closesAt } : item),
      },
    }));
  };

  const save = async () => {
    setData((current) => ({ ...current, saving: true, error: '' }));
    try {
      const hours = await saveStoreHours({ ...fdata.hours, configured: true } as StoreHours);
      await syncNotificationSchedule();
      setData((current) => ({ ...current, hours, saving: false }));
      Alert.alert(t('hoursSaved'), t('hoursSavedBody'));
    } catch (error) {
      setData((current) => ({ ...current, saving: false, error: errorMessage(error) }));
    }
  };

  if (fdata.loading) return <Page><ScreenState loading /></Page>;
  const selectedDay = fdata.picker ? fdata.hours.days.find((item) => item.day === fdata.picker?.day) : null;
  const selectedValue = fdata.picker && selectedDay ? selectedDay[fdata.picker.field] : '06:00';

  return (
    <Page>
      <Card style={styles.intro}>
        <View style={styles.introIcon}><AppIcon name="time-outline" size={25} color={colors.primary} /></View>
        <View style={styles.copy}><Text style={styles.title}>{t('weeklyStoreHours')}</Text><Text style={styles.caption}>{t('weeklyStoreHoursInfo')}</Text></View>
      </Card>
      {fdata.error ? <Text style={styles.error}>{fdata.error}</Text> : null}
      <View style={styles.copyActions}>
        <Pressable onPress={() => copyMonday(false)} style={styles.copyButton}><Text style={styles.copyText}>{t('copyMondayWeekdays')}</Text></Pressable>
        <Pressable onPress={() => copyMonday(true)} style={styles.copyButton}><Text style={styles.copyText}>{t('copyMondayAll')}</Text></Pressable>
      </View>
      {fdata.hours.days.map((day) => {
        const overnight = day.enabled && (timeToMinutes(day.closesAt) ?? 0) < (timeToMinutes(day.opensAt) ?? 0);
        return <Card key={day.day} style={[styles.dayCard, !day.enabled && styles.dayDisabled]}>
          <View style={styles.dayHeader}><View style={styles.copy}><Text style={styles.dayName}>{t(`weekday${WEEKDAY_NAMES[day.day]}` as keyof typeof import('@/i18n/translations').english)}</Text><Text style={styles.dayStatus}>{day.enabled ? overnight ? t('closesNextDay') : t('openForBusiness') : t('closedAllDay')}</Text></View><Switch value={day.enabled} onValueChange={(enabled) => updateDay(day.day, { enabled })} trackColor={{ false: colors.border, true: colors.primary }} /></View>
          {day.enabled ? <View style={styles.timeRow}>
            <TimeButton label={t('opensAt')} value={day.opensAt} onPress={() => setData((current) => ({ ...current, picker: { day: day.day, field: 'opensAt' } }))} onWebChange={(opensAt) => updateDay(day.day, { opensAt })} />
            <AppIcon name="arrow-forward" size={18} color={colors.muted} />
            <TimeButton label={t('closesAt')} value={day.closesAt} onPress={() => setData((current) => ({ ...current, picker: { day: day.day, field: 'closesAt' } }))} onWebChange={(closesAt) => updateDay(day.day, { closesAt })} />
          </View> : null}
        </Card>;
      })}
      {fdata.picker ? <View style={Platform.OS === 'ios' ? styles.iosPicker : undefined}>
        <DateTimePicker value={timeDate(selectedValue)} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={selectTime} />
        {Platform.OS === 'ios' ? <Button title={t('done')} variant="ghost" onPress={() => setData((current) => ({ ...current, picker: null }))} /> : null}
      </View> : null}
      <Button title={t('saveStoreHours')} loading={fdata.saving} onPress={save} />
      <Text style={styles.note}>{t('overnightHoursInfo')}</Text>
    </Page>
  );
}

const TimeButton = ({ label, value, onPress, onWebChange }: { label: string; value: string; onPress: () => void; onWebChange: (value: string) => void }) => (
  <View style={styles.timeGroup}><Text style={styles.timeLabel}>{label}</Text>{Platform.OS === 'web'
    ? <TextInput accessibilityLabel={label} value={value} placeholder="HH:MM" onChangeText={onWebChange} style={styles.webTime} />
    : <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${formatStoreTime(value)}`} onPress={onPress} style={styles.timeButton}><AppIcon name="time-outline" size={18} color={colors.primary} /><Text style={styles.timeValue}>{formatStoreTime(value)}</Text></Pressable>}
  </View>
);

const styles = StyleSheet.create({
  intro: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  introIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  title: { color: colors.text, fontSize: 19, fontWeight: '900' },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 12, fontWeight: '700' },
  copyActions: { flexDirection: 'row', gap: 9 },
  copyButton: { flex: 1, minHeight: 42, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  copyText: { color: colors.primaryDark, fontSize: 11, fontWeight: '900', textAlign: 'center' },
  dayCard: { gap: 13, padding: 14 },
  dayDisabled: { opacity: 0.72 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayName: { color: colors.text, fontSize: 16, fontWeight: '900' },
  dayStatus: { color: colors.muted, fontSize: 11, marginTop: 2 },
  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  timeGroup: { flex: 1, gap: 6 },
  timeLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  timeButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.background },
  timeValue: { color: colors.text, fontSize: 14, fontWeight: '800' },
  webTime: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, color: colors.text, backgroundColor: colors.background },
  iosPicker: { backgroundColor: colors.surface, borderRadius: 18, padding: 8 },
  note: { color: colors.muted, textAlign: 'center', fontSize: 11, lineHeight: 17, paddingHorizontal: 12 },
});
