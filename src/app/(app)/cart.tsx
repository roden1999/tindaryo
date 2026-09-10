import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { OptionalDateField } from '@/components/optional-date-field';
import { Button, Card, Field, ScreenState } from '@/components/ui';
import { colors } from '@/constants/theme';
import { store } from '@/database/store';
import { useI18n } from '@/i18n';
import { syncNotificationSchedule } from '@/services/notifications';
import type { CartLine, Customer, PaymentMethod, Product } from '@/types';
import { errorMessage, peso } from '@/utils/format';

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [view, setView] = useState({
    products: [] as Product[],
    topProducts: [] as Product[],
    customers: [] as Customer[],
    quantities: {} as Record<number, number>,
    search: '',
    loading: true,
    checkoutLoading: false,
    error: '',
    scannerOpen: false,
    scannedProduct: null as Product | null,
    scannedQuantity: '1',
    customerOpen: false,
    customerSearch: '',
    paymentOpen: false,
    cashReceived: '',
    paymentMode: 'cash' as PaymentMethod | 'split',
    utangMode: 'full' as 'full' | 'partial',
    partialAmount: '',
    partialMethod: 'cash' as PaymentMethod,
    cashPart: '',
    gcashPart: '',
    mayaPart: '',
    dueAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  });

  useEffect(() => {
    Promise.all([store.products(), store.topProducts(), store.customers()])
      .then(([products, topProducts, customers]) => setView((current) => ({ ...current, products, topProducts, customers, loading: false })))
      .catch((error) => setView((current) => ({ ...current, loading: false, error: errorMessage(error) })));
  }, []);

  const cart = useMemo(() => Object.entries(view.quantities).filter(([, quantity]) => quantity > 0).map(([productId, quantity]) => ({ productId: Number(productId), quantity })), [view.quantities]);
  const total = cart.reduce((sum, line) => sum + (view.products.find((product) => product.id === line.productId)?.sellingPrice ?? 0) * line.quantity, 0);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const filtered = view.products.filter((product) => {
    const query = view.search.trim().toLowerCase();
    return !query || product.productName.toLowerCase().includes(query) || product.barcode?.includes(query);
  });

  const changeQuantity = (product: Product, change: number) => setView((current) => {
    const next = Math.max(0, Math.min(product.stock, (current.quantities[product.id] ?? 0) + change));
    return { ...current, quantities: { ...current.quantities, [product.id]: next } };
  });

  const addScanned = (barcode: string) => {
    const product = view.products.find((item) => item.barcode === barcode);
    if (!product) {
      setView((current) => ({ ...current, scannerOpen: false }));
      Alert.alert('Barcode not found', 'Add this product to inventory first.');
      return;
    }
    if (product.stock <= 0) {
      setView((current) => ({ ...current, scannerOpen: false }));
      Alert.alert(t('outOfStock'), t('scannedOutOfStock'));
      return;
    }
    setView((current) => ({ ...current, scannerOpen: false, scannedProduct: product, scannedQuantity: '1', error: '' }));
  };

  const addScannedQuantity = () => {
    const product = view.scannedProduct;
    const quantity = Number.parseInt(view.scannedQuantity, 10);
    if (!product || !Number.isInteger(quantity) || quantity <= 0) {
      setView((current) => ({ ...current, error: t('enterValidQuantity') }));
      return;
    }
    const currentQuantity = view.quantities[product.id] ?? 0;
    if (currentQuantity + quantity > product.stock) {
      setView((current) => ({ ...current, error: t('quantityExceedsStock') }));
      return;
    }
    setView((current) => ({ ...current, scannedProduct: null, scannedQuantity: '1', error: '', quantities: { ...current.quantities, [product.id]: currentQuantity + quantity } }));
  };

  const complete = async (mode: 'paid' | 'utang' | 'partial', customerId?: number, payments: { method: PaymentMethod; amount: number }[] = []) => {
    if (!cart.length) return;
    if (mode !== 'paid' && view.dueAt && !/^\d{4}-\d{2}-\d{2}$/.test(view.dueAt)) {
      setView((current) => ({ ...current, error: 'Use YYYY-MM-DD for the due date.' }));
      return;
    }
    if (mode === 'partial') {
      const paidNow = payments.reduce((sum, payment) => sum + payment.amount, 0);
      if (!(paidNow > 0) || paidNow >= total) {
        setView((current) => ({ ...current, error: t('partialAmountError') }));
        return;
      }
    }
    setView((current) => ({ ...current, checkoutLoading: true, customerOpen: false, error: '' }));
    try {
      const response = mode === 'paid'
        ? await store.checkoutPaid(cart as CartLine[], payments)
        : mode === 'partial'
          ? await store.checkoutPartial(cart as CartLine[], customerId!, payments, view.dueAt || null)
          : await store.addProductDebt(customerId!, cart as CartLine[], view.dueAt || null);
      void syncNotificationSchedule().catch(() => undefined);
      setView((current) => ({ ...current, paymentOpen: false }));
      Alert.alert(mode === 'paid' ? 'Sale complete' : mode === 'partial' ? t('partialSaleRecorded') : 'Utang recorded', response.message, [{ text: 'Done', onPress: () => router.replace('/home') }]);
    } catch (error) {
      setView((current) => ({ ...current, checkoutLoading: false, error: errorMessage(error) }));
    }
  };

  if (view.loading) return <SafeAreaView style={styles.safe}><ScreenState loading /></SafeAreaView>;
  const cashReceived = Number(view.cashReceived || 0);
  const change = Math.max(0, cashReceived - total);
  const cashSuggestions = Array.from(new Set([total, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100])).filter((amount) => amount >= total);
  const splitAmounts = { cash: Number(view.cashPart || 0), gcash: Number(view.gcashPart || 0), maya: Number(view.mayaPart || 0) };
  const splitTotal = splitAmounts.cash + splitAmounts.gcash + splitAmounts.maya;
  const paymentReady = view.paymentMode === 'cash' ? cashReceived >= total : view.paymentMode === 'split' ? Math.abs(splitTotal - total) < 0.01 : true;
  const paymentBreakdown = view.paymentMode === 'split'
    ? (Object.entries(splitAmounts).filter(([, amount]) => amount > 0).map(([method, amount]) => ({ method: method as PaymentMethod, amount })))
    : [{ method: view.paymentMode, amount: total }];
  const partialAmount = Number(view.partialAmount || 0);
  const partialReady = partialAmount > 0 && partialAmount < total;
  const partialPayment = [{ method: view.partialMethod, amount: partialAmount }];
  const customerQuery = view.customerSearch.trim().toLowerCase();
  const filteredCustomers = view.customers.filter((customer) => !customerQuery || customer.name.toLowerCase().includes(customerQuery));
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.searchRow}><View style={styles.searchWrap}><AppIcon name="search-outline" size={19} color={colors.muted} /><TextInput style={styles.search} placeholder={t('searchProducts')} placeholderTextColor={colors.muted} value={view.search} onChangeText={(search) => setView((current) => ({ ...current, search }))} /></View><Pressable style={styles.scan} onPress={() => setView((current) => ({ ...current, scannerOpen: true }))}><AppIcon name="barcode-outline" color={colors.primary} /><Text style={styles.scanText}>{t('scan')}</Text></Pressable></View>
      <ScrollView contentContainerStyle={styles.content}>
        {view.error ? <Text style={styles.error}>{view.error}</Text> : null}
        {!view.search && view.topProducts.length ? <View style={styles.quickSell}><Text style={styles.quickSellTitle}>{t('quickSell')}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickSellRow}>{view.topProducts.map((product) => <Pressable key={product.id} disabled={product.stock <= 0} onPress={() => changeQuantity(product, 1)} style={styles.quickProduct}><Text numberOfLines={1} style={styles.quickProductName}>{product.productName}</Text><Text style={styles.quickProductPrice}>{peso(product.sellingPrice)}</Text><Text style={styles.quickProductStock}>{product.stock} {t('stock')}</Text></Pressable>)}</ScrollView></View> : null}
        {filtered.length === 0 ? <ScreenState empty="No products found" /> : filtered.map((product) => {
          const quantity = view.quantities[product.id] ?? 0;
          return (
            <Card key={product.id} style={[styles.product, product.stock === 0 && styles.disabledProduct]}>
              <View style={styles.productCopy}><Text style={styles.productName}>{product.productName}</Text><Text style={styles.productMeta}>{peso(product.sellingPrice)} · {product.stock} in stock</Text></View>
              <View style={styles.stepper}><Pressable disabled={quantity === 0} onPress={() => changeQuantity(product, -1)} style={styles.stepButton}><Text style={styles.stepText}>−</Text></Pressable><Text style={styles.quantity}>{quantity}</Text><Pressable disabled={quantity >= product.stock} onPress={() => changeQuantity(product, 1)} style={styles.stepButton}><Text style={styles.stepText}>+</Text></Pressable></View>
            </Card>
          );
        })}
      </ScrollView>
      <View style={styles.checkout}>
        <View style={styles.totalRow}><Text style={styles.count}>{count} item{count === 1 ? '' : 's'}</Text><Text style={styles.total}>{peso(total)}</Text></View>
        <View style={styles.checkoutButtons}><View style={styles.checkoutThird}><Button title={t('utang')} variant="secondary" disabled={!cart.length} onPress={() => setView((current) => ({ ...current, customerOpen: true, customerSearch: '', utangMode: 'full', error: '' }))} /></View><View style={styles.checkoutThird}><Button title={t('partial')} variant="secondary" disabled={!cart.length} onPress={() => setView((current) => ({ ...current, customerOpen: true, customerSearch: '', utangMode: 'partial', partialAmount: (total / 2).toFixed(2), partialMethod: 'cash', error: '' }))} /></View><View style={styles.checkoutThird}><Button title={t('paid')} disabled={!cart.length} onPress={() => setView((current) => ({ ...current, paymentOpen: true, paymentMode: 'cash', cashReceived: total.toFixed(2), cashPart: total.toFixed(2), gcashPart: '', mayaPart: '', error: '' }))} /></View></View>
      </View>

      <Modal visible={view.paymentOpen} transparent animationType="slide" onRequestClose={() => setView((current) => ({ ...current, paymentOpen: false }))}>
        <Pressable style={styles.backdrop} onPress={() => setView((current) => ({ ...current, paymentOpen: false }))} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) + 8 }]}>
          <View style={styles.paymentHeader}><View style={styles.paymentIcon}><AppIcon name="cash-outline" color={colors.primary} size={26} /></View><View><Text style={styles.sheetTitle}>{t('cashPayment')}</Text><Text style={styles.sheetCaption}>{t('cashReceived')}</Text></View></View>
          <View style={styles.amountDue}><Text style={styles.amountDueLabel}>{t('amountDue')}</Text><Text style={styles.amountDueValue}>{peso(total)}</Text></View>
          <View style={styles.paymentModes}>{(['cash', 'gcash', 'maya', 'split'] as const).map((method) => <Pressable key={method} onPress={() => setView((current) => ({ ...current, paymentMode: method }))} style={[styles.paymentMode, view.paymentMode === method && styles.paymentModeActive]}><Text style={[styles.paymentModeText, view.paymentMode === method && styles.paymentModeTextActive]}>{method === 'gcash' ? 'GCash' : method === 'maya' ? 'Maya' : method === 'split' ? 'Split' : 'Cash'}</Text></Pressable>)}</View>
          {view.paymentMode === 'cash' ? <><Field label={t('cashReceived')} keyboardType="decimal-pad" placeholder="0.00" value={view.cashReceived} onChangeText={(cashReceivedValue) => setView((current) => ({ ...current, cashReceived: cashReceivedValue }))} /><View style={styles.cashSuggestions}>{cashSuggestions.map((amount) => <Pressable key={amount} onPress={() => setView((current) => ({ ...current, cashReceived: amount.toFixed(2) }))} style={styles.cashChip}><Text style={styles.cashChipText}>{amount === total ? 'Exact' : peso(amount)}</Text></Pressable>)}</View><View style={[styles.changeBox, cashReceived < total && styles.changeBoxPending]}><Text style={styles.changeLabel}>{cashReceived >= total ? t('change') : t('remaining')}</Text><Text style={[styles.changeValue, cashReceived < total && styles.changePending]}>{peso(cashReceived >= total ? change : total - cashReceived)}</Text></View></> : null}
          {view.paymentMode === 'gcash' || view.paymentMode === 'maya' ? <View style={styles.digitalNotice}><AppIcon name="phone-portrait-outline" color={colors.primary} /><Text style={styles.digitalText}>Confirm the {view.paymentMode === 'gcash' ? 'GCash' : 'Maya'} payment on the customer’s phone before completing the sale.</Text></View> : null}
          {view.paymentMode === 'split' ? <><View style={styles.splitRow}><View style={styles.splitField}><Field label="Cash" keyboardType="decimal-pad" value={view.cashPart} onChangeText={(cashPart) => setView((current) => ({ ...current, cashPart }))} /></View><View style={styles.splitField}><Field label="GCash" keyboardType="decimal-pad" value={view.gcashPart} onChangeText={(gcashPart) => setView((current) => ({ ...current, gcashPart }))} /></View><View style={styles.splitField}><Field label="Maya" keyboardType="decimal-pad" value={view.mayaPart} onChangeText={(mayaPart) => setView((current) => ({ ...current, mayaPart }))} /></View></View><View style={[styles.changeBox, !paymentReady && styles.changeBoxPending]}><Text style={styles.changeLabel}>{t('remaining')}</Text><Text style={[styles.changeValue, !paymentReady && styles.changePending]}>{peso(Math.abs(total - splitTotal))}</Text></View></> : null}
          <Button title="Complete sale" loading={view.checkoutLoading} disabled={!paymentReady} icon={<AppIcon name="checkmark-circle-outline" color="#fff" />} onPress={() => complete('paid', undefined, paymentBreakdown)} />
          <Button title="Cancel" variant="ghost" onPress={() => setView((current) => ({ ...current, paymentOpen: false }))} />
        </View>
      </Modal>

      <Modal visible={view.customerOpen} transparent animationType="slide" onRequestClose={() => setView((current) => ({ ...current, customerOpen: false }))}>
        <Pressable style={styles.backdrop} onPress={() => setView((current) => ({ ...current, customerOpen: false }))} />
        <View style={[styles.sheet, styles.customerSheet]}>
          <View style={styles.customerHeader}>
            <View style={styles.customerHeaderCopy}>
              <Text style={styles.sheetTitle}>{view.utangMode === 'partial' ? t('partialSale') : t('selectCustomer')}</Text>
              <Text style={styles.sheetCaption}>{view.utangMode === 'partial' ? t('partialSaleHint') : t('chargeUtang')}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('cancel')} hitSlop={10} onPress={() => setView((current) => ({ ...current, customerOpen: false, customerSearch: '' }))} style={styles.customerClose}>
              <AppIcon name="close" size={24} color={colors.primaryDark} />
            </Pressable>
          </View>
          {view.utangMode === 'partial' ? <><Field label={t('paidNow')} keyboardType="decimal-pad" placeholder="0.00" value={view.partialAmount} onChangeText={(partialAmountValue) => setView((current) => ({ ...current, partialAmount: partialAmountValue, error: '' }))} /><View style={styles.paymentModes}>{(['cash', 'gcash', 'maya'] as const).map((method) => <Pressable key={method} onPress={() => setView((current) => ({ ...current, partialMethod: method }))} style={[styles.paymentMode, view.partialMethod === method && styles.paymentModeActive]}><Text style={[styles.paymentModeText, view.partialMethod === method && styles.paymentModeTextActive]}>{method === 'gcash' ? 'GCash' : method === 'maya' ? 'Maya' : 'Cash'}</Text></Pressable>)}</View><View style={[styles.changeBox, !partialReady && styles.changeBoxPending]}><Text style={styles.changeLabel}>{t('remainingUtang')}</Text><Text style={[styles.changeValue, !partialReady && styles.changePending]}>{peso(Math.max(0, total - partialAmount))}</Text></View></> : null}
          <OptionalDateField label={t('dueDateOptional')} value={view.dueAt} onChange={(dueAt) => setView((current) => ({ ...current, dueAt, error: '' }))} />
          {view.error ? <Text style={styles.error}>{view.error}</Text> : null}
          <Text style={styles.customerPrompt}>{t('chooseCustomerToCharge')}</Text>
          <View style={styles.customerSearch}>
            <AppIcon name="search-outline" size={19} color={colors.muted} />
            <TextInput autoCapitalize="words" autoCorrect={false} placeholder={t('searchCustomers')} placeholderTextColor={colors.muted} value={view.customerSearch} onChangeText={(customerSearch) => setView((current) => ({ ...current, customerSearch }))} style={styles.customerSearchInput} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.customerList}>
            {view.customers.length === 0 ? <Text style={styles.emptyCustomers}>{t('noCustomersCart')}</Text> : filteredCustomers.length === 0 ? <Text style={styles.emptyCustomers}>{t('noCustomers')}</Text> : filteredCustomers.map((customer) => <Pressable key={customer.id} disabled={view.utangMode === 'partial' && !partialReady} style={[styles.customer, view.utangMode === 'partial' && !partialReady && styles.disabledCustomer]} onPress={() => complete(view.utangMode === 'partial' ? 'partial' : 'utang', customer.id, view.utangMode === 'partial' ? partialPayment : [])}><View><Text style={styles.customerName}>{customer.name}</Text><Text style={styles.customerBalance}>{t('outstandingBalance')} {peso(customer.balance)}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}
          </ScrollView>
        </View>
      </Modal>
      <Modal visible={Boolean(view.scannedProduct)} transparent animationType="slide" onRequestClose={() => setView((current) => ({ ...current, scannedProduct: null, error: '' }))}>
        <Pressable style={styles.backdrop} onPress={() => setView((current) => ({ ...current, scannedProduct: null, error: '' }))} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) + 8 }]}>
          <View style={styles.scanQuantityHeader}><View style={styles.paymentIcon}><AppIcon name="barcode-outline" color={colors.primary} size={26} /></View><View style={styles.scanQuantityCopy}><Text style={styles.sheetTitle}>{t('itemScanned')}</Text><Text style={styles.sheetCaption}>{view.scannedProduct?.productName}</Text></View></View>
          <View style={styles.scanSummary}><Text style={styles.scanSummaryText}>{peso(view.scannedProduct?.sellingPrice ?? 0)}</Text><Text style={styles.scanStock}>{t('availableStock')}: {view.scannedProduct?.stock ?? 0}</Text></View>
          <Field label={t('quantityToAdd')} keyboardType="number-pad" autoFocus selectTextOnFocus value={view.scannedQuantity} onChangeText={(scannedQuantity) => setView((current) => ({ ...current, scannedQuantity: scannedQuantity.replace(/\D/g, ''), error: '' }))} onSubmitEditing={addScannedQuantity} />
          <View style={styles.quantitySuggestions}>{[1, 2, 3, 6, 12].filter((quantity) => quantity <= (view.scannedProduct?.stock ?? 0)).map((quantity) => <Pressable key={quantity} onPress={() => setView((current) => ({ ...current, scannedQuantity: String(quantity), error: '' }))} style={[styles.quantityChip, view.scannedQuantity === String(quantity) && styles.quantityChipActive]}><Text style={[styles.quantityChipText, view.scannedQuantity === String(quantity) && styles.quantityChipTextActive]}>{quantity}</Text></Pressable>)}</View>
          {(view.quantities[view.scannedProduct?.id ?? 0] ?? 0) > 0 ? <Text style={styles.cartHint}>{t('alreadyInCart')}: {view.quantities[view.scannedProduct?.id ?? 0]}</Text> : null}
          {view.error ? <Text style={styles.error}>{view.error}</Text> : null}
          <Button title={t('addToCart')} icon={<AppIcon name="cart-outline" color="#fff" />} onPress={addScannedQuantity} />
          <Button title={t('scanAnother')} variant="secondary" onPress={() => setView((current) => ({ ...current, scannedProduct: null, scannerOpen: true, error: '' }))} />
          <Button title={t('cancel')} variant="ghost" onPress={() => setView((current) => ({ ...current, scannedProduct: null, error: '' }))} />
        </View>
      </Modal>
      <BarcodeScanner visible={view.scannerOpen} onClose={() => setView((current) => ({ ...current, scannerOpen: false }))} onScanned={addScanned} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  searchRow: { flexDirection: 'row', gap: 10, padding: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchWrap: { flex: 1, height: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 15, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background },
  search: { flex: 1, height: 48, paddingHorizontal: 9, color: colors.text },
  scan: { height: 50, borderRadius: 15, paddingHorizontal: 14, backgroundColor: colors.primarySoft, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  scanText: { color: colors.primaryDark, fontWeight: '900' },
  content: { padding: 14, gap: 10, paddingBottom: 20 },
  quickSell: { gap: 9, marginBottom: 3 },
  quickSellTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  quickSellRow: { gap: 9 },
  quickProduct: { width: 132, borderRadius: 16, padding: 12, backgroundColor: colors.primarySoft, gap: 4 },
  quickProductName: { color: colors.primaryDark, fontWeight: '900' },
  quickProductPrice: { color: colors.primary, fontWeight: '900' },
  quickProductStock: { color: colors.muted, fontSize: 10 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 12, fontWeight: '700' },
  product: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  disabledProduct: { opacity: 0.48 },
  productCopy: { flex: 1, gap: 4 },
  productName: { color: colors.text, fontWeight: '900', fontSize: 15 },
  productMeta: { color: colors.muted, fontSize: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepButton: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.primaryDark, fontSize: 21, fontWeight: '900' },
  quantity: { width: 24, color: colors.text, textAlign: 'center', fontWeight: '900', fontSize: 16 },
  checkout: { backgroundColor: colors.surface, padding: 14, gap: 12, borderTopWidth: 1, borderTopColor: colors.border },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { color: colors.muted, fontWeight: '700' },
  total: { color: colors.text, fontSize: 25, fontWeight: '900' },
  checkoutButtons: { flexDirection: 'row', gap: 10 },
  checkoutThird: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '70%', backgroundColor: colors.surface, padding: 20, gap: 10, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  sheetTitle: { color: colors.text, fontSize: 23, fontWeight: '900' },
  sheetCaption: { color: colors.muted, marginBottom: 6 },
  customerList: { flexGrow: 0 },
  customerSheet: { maxHeight: '88%', paddingBottom: 28 },
  customerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  customerHeaderCopy: { flex: 1 },
  customerClose: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  customerPrompt: { color: colors.text, fontWeight: '900', marginTop: 2 },
  customerSearch: { height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background },
  customerSearchInput: { flex: 1, height: 46, paddingHorizontal: 9, color: colors.text },
  disabledCustomer: { opacity: 0.4 },
  customer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border },
  customerName: { color: colors.text, fontSize: 16, fontWeight: '900' },
  customerBalance: { color: colors.muted, fontSize: 12, marginTop: 3 },
  chevron: { color: colors.primary, fontSize: 28 },
  emptyCustomers: { color: colors.muted, textAlign: 'center', padding: 30, lineHeight: 21 },
  paymentHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  paymentModes: { flexDirection: 'row', gap: 6, backgroundColor: colors.background, padding: 4, borderRadius: 14 },
  paymentMode: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 11 },
  paymentModeActive: { backgroundColor: colors.primary },
  paymentModeText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  paymentModeTextActive: { color: '#fff' },
  paymentIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  amountDue: { alignItems: 'center', borderRadius: 18, padding: 17, backgroundColor: colors.primaryDark },
  amountDueLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  amountDueValue: { color: '#fff', fontSize: 31, fontWeight: '900', marginTop: 4 },
  cashSuggestions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  cashChip: { backgroundColor: colors.primarySoft, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 99 },
  cashChipText: { color: colors.primaryDark, fontWeight: '800', fontSize: 12 },
  changeBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.successSoft, borderRadius: 15, padding: 14 },
  changeBoxPending: { backgroundColor: colors.warningSoft },
  changeLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  changeValue: { color: colors.success, fontSize: 21, fontWeight: '900' },
  changePending: { color: colors.warning },
  digitalNotice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, backgroundColor: colors.primarySoft },
  digitalText: { flex: 1, color: colors.primaryDark, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  splitRow: { flexDirection: 'row', gap: 7 },
  splitField: { flex: 1 },
  scanQuantityHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scanQuantityCopy: { flex: 1 },
  scanSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, borderRadius: 14, backgroundColor: colors.primarySoft },
  scanSummaryText: { color: colors.primaryDark, fontSize: 19, fontWeight: '900' },
  scanStock: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  quantitySuggestions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  quantityChip: { minWidth: 43, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 99, alignItems: 'center', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  quantityChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  quantityChipText: { color: colors.text, fontWeight: '900' },
  quantityChipTextActive: { color: '#fff' },
  cartHint: { color: colors.muted, fontSize: 12, fontWeight: '700' },
});
