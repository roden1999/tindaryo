import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { Button, Card, Field, ScreenState, SectionTitle } from '@/components/ui';
import { colors } from '@/constants/theme';
import { store } from '@/database/store';
import { useI18n } from '@/i18n';
import type { DaySummary, Expense, PaymentMethod } from '@/types';
import { errorMessage, peso, shortDate } from '@/utils/format';

const emptySummary: DaySummary = { cashSales: 0, gcashSales: 0, mayaSales: 0, cashExpenses: 0, digitalExpenses: 0, expectedCash: 0, revenue: 0, expenses: 0, netCashflow: 0 };

export default function ExpensesScreen() {
  const { t } = useI18n();
  const [view, setView] = useState({
    expenses: [] as Expense[],
    summary: emptySummary,
    loading: true,
    refreshing: false,
    modalOpen: false,
    saving: false,
    category: 'Supplies',
    amount: '',
    note: '',
    paymentMethod: 'cash' as PaymentMethod,
    error: '',
  });

  const load = useCallback(async (refreshing = false) => {
    setView((current) => ({ ...current, loading: !refreshing, refreshing, error: '' }));
    try {
      const [expenses, summary] = await Promise.all([store.expenses(), store.daySummary()]);
      setView((current) => ({ ...current, expenses, summary, loading: false, refreshing: false }));
    } catch (error) { setView((current) => ({ ...current, loading: false, refreshing: false, error: errorMessage(error) })); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const save = async () => {
    const amount = Number(view.amount);
    if (!(amount > 0)) return setView((current) => ({ ...current, error: 'Enter a valid expense amount.' }));
    setView((current) => ({ ...current, saving: true, error: '' }));
    try {
      await store.addExpense({ category: view.category, amount, note: view.note, paymentMethod: view.paymentMethod });
      setView((current) => ({ ...current, saving: false, modalOpen: false, amount: '', note: '' }));
      await load();
    } catch (error) { setView((current) => ({ ...current, saving: false, error: errorMessage(error) })); }
  };

  if (view.loading) return <SafeAreaView style={styles.safe}><ScreenState loading /></SafeAreaView>;
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={view.refreshing} onRefresh={() => load(true)} colors={[colors.primary]} />}>
        {view.error ? <Text style={styles.error}>{view.error}</Text> : null}
        <Card style={styles.cashCard}>
          <View style={styles.cashHeading}><View><Text style={styles.eyebrow}>{t('expectedCash')}</Text><Text style={styles.cashValue}>{peso(view.summary.expectedCash)}</Text></View><View style={styles.cashIcon}><AppIcon name="wallet-outline" color="#fff" /></View></View>
          <View style={styles.divider} />
          <View style={styles.summaryGrid}><Summary label={t('cashSales')} value={view.summary.cashSales} /><Summary label={t('cashExpenses')} value={-view.summary.cashExpenses} /><Summary label="GCash" value={view.summary.gcashSales} /><Summary label="Maya" value={view.summary.mayaSales} /></View>
        </Card>
        <Card style={styles.netCard}><View><Text style={styles.netLabel}>{t('netCashflow')}</Text><Text style={[styles.netValue, view.summary.netCashflow < 0 && styles.negative]}>{peso(view.summary.netCashflow)}</Text></View><Button title={t('addExpense')} icon={<AppIcon name="add" color="#fff" />} onPress={() => setView((current) => ({ ...current, modalOpen: true, error: '' }))} /></Card>
        <SectionTitle>{t('expenseHistory')}</SectionTitle>
        {view.expenses.length === 0 ? <ScreenState empty={t('noExpenses')} /> : view.expenses.map((expense) => <Card key={expense.id} style={styles.expense}><View style={styles.expenseIcon}><AppIcon name="arrow-up-outline" color={colors.danger} /></View><View style={styles.expenseCopy}><Text style={styles.expenseCategory}>{expense.category}</Text><Text style={styles.expenseMeta}>{shortDate(expense.createdAt)} · {expense.paymentMethod.toUpperCase()}{expense.note ? ` · ${expense.note}` : ''}</Text></View><Text style={styles.expenseAmount}>−{peso(expense.amount)}</Text></Card>)}
      </ScrollView>

      <Modal visible={view.modalOpen} transparent animationType="slide" onRequestClose={() => setView((current) => ({ ...current, modalOpen: false }))}>
        <Pressable style={styles.backdrop} onPress={() => setView((current) => ({ ...current, modalOpen: false }))} />
        <View style={styles.sheet}><Text style={styles.sheetTitle}>{t('recordExpense')}</Text><Text style={styles.caption}>{t('expenseInfo')}</Text><Field label={t('category')} placeholder="Supplies, utilities, delivery…" value={view.category} onChangeText={(category) => setView((current) => ({ ...current, category }))} /><Field label={t('amount')} keyboardType="decimal-pad" placeholder="0.00" value={view.amount} onChangeText={(amount) => setView((current) => ({ ...current, amount }))} /><Field label={t('noteOptional')} value={view.note} onChangeText={(note) => setView((current) => ({ ...current, note }))} /><Text style={styles.inputLabel}>{t('paidWith')}</Text><View style={styles.methods}>{(['cash', 'gcash', 'maya'] as const).map((method) => <Pressable key={method} onPress={() => setView((current) => ({ ...current, paymentMethod: method }))} style={[styles.method, view.paymentMethod === method && styles.methodActive]}><Text style={[styles.methodText, view.paymentMethod === method && styles.methodTextActive]}>{method.toUpperCase()}</Text></Pressable>)}</View>{view.error ? <Text style={styles.error}>{view.error}</Text> : null}<Button title={t('saveExpense')} loading={view.saving} onPress={save} /><Button title={t('cancel')} variant="ghost" onPress={() => setView((current) => ({ ...current, modalOpen: false, error: '' }))} /></View>
      </Modal>
    </SafeAreaView>
  );
}

const Summary = ({ label, value }: { label: string; value: number }) => <View style={styles.summary}><Text style={styles.summaryLabel}>{label}</Text><Text style={[styles.summaryValue, value < 0 && styles.negative]}>{value < 0 ? '−' : ''}{peso(Math.abs(value))}</Text></View>;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 38 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 12, fontWeight: '700' },
  cashCard: { backgroundColor: colors.primaryDark, borderWidth: 0, gap: 15 },
  cashHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  cashValue: { color: '#fff', fontSize: 34, fontWeight: '900', marginTop: 5 },
  cashIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.14)' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 13 },
  summary: { width: '50%' },
  summaryLabel: { color: 'rgba(255,255,255,0.58)', fontSize: 10, fontWeight: '800' },
  summaryValue: { color: '#fff', fontWeight: '900', marginTop: 3 },
  netCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  netLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  netValue: { color: colors.success, fontSize: 22, fontWeight: '900', marginTop: 4 },
  negative: { color: colors.danger },
  expense: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  expenseIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerSoft },
  expenseCopy: { flex: 1, gap: 4 },
  expenseCategory: { color: colors.text, fontWeight: '900' },
  expenseMeta: { color: colors.muted, fontSize: 11 },
  expenseAmount: { color: colors.danger, fontWeight: '900' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.surface, padding: 20, paddingBottom: 56, gap: 13, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  sheetTitle: { color: colors.text, fontSize: 23, fontWeight: '900' },
  caption: { color: colors.muted, lineHeight: 19 },
  inputLabel: { color: colors.text, fontWeight: '700', fontSize: 14 },
  methods: { flexDirection: 'row', gap: 8 },
  method: { flex: 1, alignItems: 'center', padding: 11, borderRadius: 12, backgroundColor: colors.background },
  methodActive: { backgroundColor: colors.primary },
  methodText: { color: colors.muted, fontWeight: '900', fontSize: 11 },
  methodTextActive: { color: '#fff' },
});
