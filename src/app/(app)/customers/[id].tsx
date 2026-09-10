import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Field, Pill, ScreenState } from '@/components/ui';
import { OptionalDateField } from '@/components/optional-date-field';
import { colors } from '@/constants/theme';
import { store } from '@/database/store';
import { useI18n } from '@/i18n';
import type { CustomerDetail, PaymentMethod, Product } from '@/types';
import { errorMessage, peso, shortDate } from '@/utils/format';

export default function CustomerDetailScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const customerId = Number(id);
  const [view, setView] = useState({
    detail: null as CustomerDetail | null,
    products: [] as Product[],
    loading: true,
    submitting: false,
    busyTransactionId: 0,
    error: '',
    modal: '' as '' | 'payment' | 'debt',
    paymentAmount: '',
    paymentNote: '',
    paymentMethod: 'cash' as PaymentMethod,
    debtMode: 'product' as 'product' | 'cash',
    debtProductId: 0,
    debtQuantity: '1',
    cashAmount: '',
    cashNote: '',
    dueAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  });

  const load = useCallback(async () => {
    setView((current) => ({ ...current, loading: true, error: '' }));
    try {
      const [detail, products] = await Promise.all([store.customerDetail(customerId), store.products()]);
      setView((current) => ({ ...current, detail, products, loading: false, debtProductId: current.debtProductId || products[0]?.id || 0 }));
    } catch (error) {
      setView((current) => ({ ...current, loading: false, error: errorMessage(error) }));
    }
  }, [customerId]);

  useEffect(() => { void load(); }, [load]);
  const selectedProduct = useMemo(() => view.products.find((product) => product.id === view.debtProductId), [view.products, view.debtProductId]);

  const submitPayment = async () => {
    const amount = Number(view.paymentAmount);
    if (!(amount > 0)) return setView((current) => ({ ...current, error: 'Enter a payment amount.' }));
    if (amount > (view.detail?.customer.balance ?? 0)) return setView((current) => ({ ...current, error: 'Payment cannot be more than the current balance.' }));
    setView((current) => ({ ...current, submitting: true, error: '' }));
    try {
      await store.addPayment(customerId, amount, view.paymentNote.trim(), view.paymentMethod);
      setView((current) => ({ ...current, submitting: false, modal: '', paymentAmount: '', paymentNote: '' }));
      await load();
    } catch (error) { setView((current) => ({ ...current, submitting: false, error: errorMessage(error) })); }
  };

  const submitDebt = async () => {
    if (view.dueAt && !/^\d{4}-\d{2}-\d{2}$/.test(view.dueAt)) {
      setView((current) => ({ ...current, error: 'Use YYYY-MM-DD for the due date.' }));
      return;
    }
    setView((current) => ({ ...current, submitting: true, error: '' }));
    try {
      if (view.debtMode === 'product') {
        const quantity = Number.parseInt(view.debtQuantity, 10);
        if (!view.debtProductId || !Number.isInteger(quantity) || quantity <= 0) throw new Error('Choose a product and valid quantity.');
        if (quantity > (selectedProduct?.stock ?? 0)) throw new Error('Not enough stock for this quantity.');
        await store.addProductDebt(customerId, [{ productId: view.debtProductId, quantity }], view.dueAt || null);
      } else {
        const amount = Number(view.cashAmount);
        if (!(amount > 0)) throw new Error('Enter a cash amount.');
        await store.addCashDebt(customerId, amount, view.cashNote.trim(), view.dueAt || null);
      }
      setView((current) => ({ ...current, submitting: false, modal: '', debtQuantity: '1', cashAmount: '', cashNote: '' }));
      await load();
    } catch (error) { setView((current) => ({ ...current, submitting: false, error: errorMessage(error) })); }
  };

  const writeOff = (saleId: number) => Alert.alert(
    t('writeOffUtang'),
    t('writeOffUtangBody'),
    [
      { text: t('cancel'), style: 'cancel' },
      { text: t('writeOff'), style: 'destructive', onPress: async () => {
        setView((current) => ({ ...current, busyTransactionId: saleId, error: '' }));
        try { await store.writeOffDebt(saleId); await load(); }
        catch (error) { setView((current) => ({ ...current, error: errorMessage(error) })); }
        finally { setView((current) => ({ ...current, busyTransactionId: 0 })); }
      } },
    ],
  );

  const archiveCustomer = () => Alert.alert(t('archiveCustomer'), t('archiveCustomerBody'), [
    { text: t('cancel'), style: 'cancel' },
    { text: t('archive'), style: 'destructive', onPress: async () => {
      setView((current) => ({ ...current, submitting: true, error: '' }));
      try { await store.archiveCustomer(customerId); router.replace('/customers'); }
      catch (error) { setView((current) => ({ ...current, submitting: false, error: errorMessage(error) })); }
    } },
  ]);

  if (view.loading || !view.detail) return <SafeAreaView style={styles.safe}><ScreenState loading={view.loading} error={view.error} onRetry={load} /></SafeAreaView>;
  const customer = view.detail.customer;
  const paymentSuggestions = Array.from(new Set([customer.balance * 0.25, customer.balance * 0.5, customer.balance].map((amount) => Math.round(amount * 100) / 100))).filter((amount) => amount > 0);
  const shareReminder = () => Share.share({ message: `Hi ${customer.name}, friendly reminder from our store: your current utang balance is ${peso(customer.balance)}. Salamat po.` });
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.profile}><View style={styles.avatar}><Text style={styles.avatarText}>{customer.name.slice(0, 1).toUpperCase()}</Text></View><Text style={styles.name}>{customer.name}</Text><Text style={styles.balanceLabel}>{t('totalOutstanding')}</Text><Text style={[styles.balance, customer.balance === 0 && styles.paid]}>{peso(customer.balance)}</Text><View style={styles.actions}><View style={styles.action}><Button title={t('addUtang')} variant="secondary" onPress={() => setView((current) => ({ ...current, modal: 'debt', error: '' }))} /></View><View style={styles.action}><Button title={t('recordPayment')} disabled={customer.balance <= 0} onPress={() => setView((current) => ({ ...current, modal: 'payment', error: '' }))} /></View></View>{customer.balance > 0 ? <Button title={t('shareReminder')} variant="ghost" onPress={shareReminder} /> : <Button title={t('archiveCustomer')} variant="ghost" loading={view.submitting} onPress={archiveCustomer} />}</Card>
        {view.error && view.modal === '' ? <Text style={styles.error}>{view.error}</Text> : null}
        <Text style={styles.sectionTitle}>{t('ledgerHistory')}</Text>
        {view.detail.transactions.length === 0 ? <ScreenState empty={t('noTransactions')} /> : view.detail.transactions.map((transaction) => {
          const payment = transaction.kind === 'payment';
          return <Card key={`${transaction.kind}-${transaction.id}`} style={styles.transaction}><View style={[styles.txIcon, payment ? styles.paymentIcon : styles.debtIcon]}><Text>{payment ? '↓' : '↑'}</Text></View><View style={styles.txCopy}><View style={styles.txTitleRow}><Text style={styles.txTitle}>{transaction.description}</Text>{transaction.status === 'written_off' ? <Pill label={t('writtenOff')} tone="danger" /> : null}{transaction.overdue ? <Pill label="Overdue" tone="danger" /> : null}</View><Text style={styles.txDate}>{shortDate(transaction.createdAt)}{transaction.dueAt ? ` · Due ${transaction.dueAt}` : ''}</Text>{transaction.kind === 'sale' && transaction.status === 'unpaid' ? <Pressable disabled={view.busyTransactionId > 0} onPress={() => writeOff(transaction.id)} style={styles.writeOffButton}><Text style={styles.writeOffText}>{view.busyTransactionId === transaction.id ? t('working') : t('writeOff')}</Text></Pressable> : null}</View><Text style={[styles.txAmount, payment && styles.paymentAmount]}>{payment ? '−' : '+'}{peso(transaction.amount)}</Text></Card>;
        })}
      </ScrollView>

      <Modal visible={view.modal !== ''} transparent animationType="slide" onRequestClose={() => setView((current) => ({ ...current, modal: '', error: '' }))}>
        <Pressable style={styles.backdrop} onPress={() => setView((current) => ({ ...current, modal: '', error: '' }))} />
        <View style={styles.sheet}>
          {view.modal === 'payment' ? <><Text style={styles.sheetTitle}>{t('recordPayment')}</Text><Text style={styles.sheetCaption}>{t('balance')}: {peso(customer.balance)}</Text><View style={styles.partialInfo}><Text style={styles.partialInfoTitle}>{t('partialPayment')}</Text><Text style={styles.partialInfoText}>{t('partialPaymentHint')}</Text></View><Field label={t('amountPaid')} keyboardType="decimal-pad" placeholder="0.00" value={view.paymentAmount} onChangeText={(paymentAmount) => setView((current) => ({ ...current, paymentAmount, error: '' }))} /><View style={styles.paymentSuggestions}>{paymentSuggestions.map((amount, index) => <Pressable key={amount} onPress={() => setView((current) => ({ ...current, paymentAmount: amount.toFixed(2), error: '' }))} style={styles.paymentSuggestion}><Text style={styles.paymentSuggestionText}>{index === paymentSuggestions.length - 1 ? t('fullBalance') : peso(amount)}</Text></Pressable>)}</View><Field label={t('noteOptional')} placeholder="e.g. Partial payment" value={view.paymentNote} onChangeText={(paymentNote) => setView((current) => ({ ...current, paymentNote }))} /><Text style={styles.inputLabel}>{t('paymentMethod')}</Text><View style={styles.methods}>{(['cash', 'gcash', 'maya'] as const).map((method) => <Pressable key={method} onPress={() => setView((current) => ({ ...current, paymentMethod: method }))} style={[styles.method, view.paymentMethod === method && styles.methodActive]}><Text style={[styles.methodText, view.paymentMethod === method && styles.methodTextActive]}>{method.toUpperCase()}</Text></Pressable>)}</View>{view.error ? <Text style={styles.error}>{view.error}</Text> : null}<Button title={t('savePayment')} loading={view.submitting} onPress={submitPayment} /></> : (
            <><Text style={styles.sheetTitle}>{t('addUtang')}</Text><View style={styles.segment}><Pressable onPress={() => setView((current) => ({ ...current, debtMode: 'product', error: '' }))} style={[styles.segmentItem, view.debtMode === 'product' && styles.segmentActive]}><Text style={[styles.segmentText, view.debtMode === 'product' && styles.segmentTextActive]}>{t('product')}</Text></Pressable><Pressable onPress={() => setView((current) => ({ ...current, debtMode: 'cash', error: '' }))} style={[styles.segmentItem, view.debtMode === 'cash' && styles.segmentActive]}><Text style={[styles.segmentText, view.debtMode === 'cash' && styles.segmentTextActive]}>{t('cash')}</Text></Pressable></View>
            {view.debtMode === 'product' ? <><Text style={styles.inputLabel}>{t('chooseProduct')}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productOptions}>{view.products.map((product) => <Pressable key={product.id} onPress={() => setView((current) => ({ ...current, debtProductId: product.id }))} style={[styles.productOption, view.debtProductId === product.id && styles.productOptionActive]}><Text style={[styles.productOptionName, view.debtProductId === product.id && styles.productOptionNameActive]}>{product.productName}</Text><Text style={styles.productOptionMeta}>{peso(product.sellingPrice)} · {product.stock} {t('stock')}</Text></Pressable>)}</ScrollView><Field label={t('quantity')} keyboardType="number-pad" value={view.debtQuantity} onChangeText={(debtQuantity) => setView((current) => ({ ...current, debtQuantity }))} /></> : <><Field label={t('cashAmount')} keyboardType="decimal-pad" placeholder="0.00" value={view.cashAmount} onChangeText={(cashAmount) => setView((current) => ({ ...current, cashAmount }))} /><Field label={t('noteOptional')} placeholder="Reason or description" value={view.cashNote} onChangeText={(cashNote) => setView((current) => ({ ...current, cashNote }))} /></>}<OptionalDateField label={t('dueDateOptional')} value={view.dueAt} onChange={(dueAt) => setView((current) => ({ ...current, dueAt }))} />
            {view.error ? <Text style={styles.error}>{view.error}</Text> : null}<Button title={t('saveUtang')} loading={view.submitting} onPress={submitDebt} /></>
          )}
          <Button title="Cancel" variant="ghost" onPress={() => setView((current) => ({ ...current, modal: '', error: '' }))} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 34 },
  profile: { alignItems: 'center', gap: 8, paddingVertical: 22 },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryDark, fontSize: 29, fontWeight: '900' },
  name: { color: colors.text, fontSize: 23, fontWeight: '900' },
  balanceLabel: { color: colors.muted, fontWeight: '900', fontSize: 10, letterSpacing: 1, marginTop: 7 },
  balance: { color: colors.danger, fontSize: 31, fontWeight: '900' },
  paid: { color: colors.success },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  action: { flex: 1 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 8 },
  transaction: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  paymentIcon: { backgroundColor: colors.successSoft },
  debtIcon: { backgroundColor: colors.dangerSoft },
  txCopy: { flex: 1, gap: 4 },
  txTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  txTitle: { flexShrink: 1, color: colors.text, fontWeight: '800' },
  txDate: { color: colors.muted, fontSize: 11 },
  txAmount: { color: colors.danger, fontWeight: '900' },
  paymentAmount: { color: colors.success },
  writeOffButton: { alignSelf: 'flex-start', paddingVertical: 4, paddingRight: 8 },
  writeOffText: { color: colors.danger, fontSize: 12, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '83%', backgroundColor: colors.surface, padding: 20, paddingBottom: 56, gap: 13, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  sheetTitle: { color: colors.text, fontSize: 23, fontWeight: '900' },
  sheetCaption: { color: colors.muted, marginTop: -8 },
  segment: { flexDirection: 'row', borderRadius: 14, backgroundColor: colors.background, padding: 4 },
  segmentItem: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.muted, fontWeight: '800' },
  segmentTextActive: { color: '#fff' },
  inputLabel: { color: colors.text, fontWeight: '700', fontSize: 14 },
  productOptions: { gap: 8 },
  productOption: { width: 150, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  productOptionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  productOptionName: { color: colors.text, fontWeight: '800' },
  productOptionNameActive: { color: colors.primaryDark },
  productOptionMeta: { color: colors.muted, fontSize: 11, marginTop: 4 },
  error: { color: colors.danger, fontWeight: '600' },
  methods: { flexDirection: 'row', gap: 8 },
  method: { flex: 1, padding: 10, borderRadius: 11, alignItems: 'center', backgroundColor: colors.background },
  methodActive: { backgroundColor: colors.primary },
  methodText: { color: colors.muted, fontWeight: '900', fontSize: 11 },
  methodTextActive: { color: '#fff' },
  partialInfo: { padding: 13, gap: 3, borderRadius: 14, backgroundColor: colors.primarySoft },
  partialInfoTitle: { color: colors.primaryDark, fontWeight: '900' },
  partialInfoText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  paymentSuggestions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  paymentSuggestion: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 99, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  paymentSuggestionText: { color: colors.primaryDark, fontWeight: '800', fontSize: 12 },
});
