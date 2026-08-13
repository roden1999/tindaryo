import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { colors } from '@/constants/theme';
import { useI18n } from '@/i18n';

const fromValue = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  const parsed = year && month && day ? new Date(year, month - 1, day) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const toValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const OptionalDateField = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => {
  const { t } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectDate = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== 'ios' || event.type === 'dismissed') setPickerOpen(false);
    if (event.type === 'set' && selected) onChange(toValue(selected));
  };

  if (Platform.OS === 'web') {
    return <View style={styles.group}><Text style={styles.label}>{label}</Text><View style={styles.row}><TextInput style={styles.webInput} placeholder="YYYY-MM-DD" value={value} onChangeText={onChange} /><Pressable accessibilityLabel={t('clearDate')} disabled={!value} onPress={() => onChange('')} style={[styles.clear, !value && styles.disabled]}><AppIcon name="close-circle-outline" size={20} color={colors.muted} /></Pressable></View></View>;
  }

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={() => setPickerOpen(true)} style={styles.dateButton}>
          <AppIcon name="calendar-outline" size={20} color={colors.primary} />
          <Text style={[styles.dateText, !value && styles.placeholder]}>{value ? fromValue(value).toLocaleDateString() : t('selectDate')}</Text>
        </Pressable>
        <Pressable accessibilityLabel={t('clearDate')} disabled={!value} onPress={() => onChange('')} style={[styles.clear, !value && styles.disabled]}>
          <AppIcon name="close-circle-outline" size={21} color={value ? colors.danger : colors.muted} />
        </Pressable>
      </View>
      {pickerOpen ? <View style={Platform.OS === 'ios' ? styles.iosPicker : undefined}>
        <DateTimePicker value={fromValue(value)} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={selectDate} />
        {Platform.OS === 'ios' ? <Pressable onPress={() => setPickerOpen(false)} style={styles.done}><Text style={styles.doneText}>{t('done')}</Text></Pressable> : null}
      </View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  group: { gap: 7 },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dateButton: { flex: 1, minHeight: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  placeholder: { color: colors.muted, fontWeight: '400' },
  clear: { width: 48, height: 50, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  iosPicker: { borderRadius: 15, overflow: 'hidden', backgroundColor: colors.surface },
  done: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 10 },
  doneText: { color: colors.primary, fontWeight: '900' },
  webInput: { flex: 1, minHeight: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.surface, color: colors.text },
});
