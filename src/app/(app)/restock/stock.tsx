import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarcodeScanner } from '@/components/barcode-scanner';
import { Button, Card, Field, ScreenState } from '@/components/ui';
import { colors } from '@/constants/theme';
import { store } from '@/database/store';
import { useI18n } from '@/i18n';
import type { Product } from '@/types';
import { errorMessage, peso } from '@/utils/format';

export default function RestockStockScreen() {
  const { t } = useI18n();
  const [fdata, setData] = useState({
    products: [] as Product[],
    selectedId: 0,
    search: '',
    mode: 'add' as 'add' | 'set',
    quantity: '',
    newCost: '',
    newSelling: '',
    scannerOpen: false,
    loading: true,
    saving: false,
    error: '',
  });
  useEffect(() => { store.products().then((products) => setData((current) => ({ ...current, products, selectedId: products[0]?.id || 0, loading: false }))).catch((error) => setData((current) => ({ ...current, loading: false, error: errorMessage(error) }))); }, []);
  const filtered = useMemo(() => fdata.products.filter((product) => product.productName.toLowerCase().includes(fdata.search.trim().toLowerCase()) || product.barcode?.includes(fdata.search.trim())), [fdata.products, fdata.search]);
  const selected = fdata.products.find((product) => product.id === fdata.selectedId);

  const save = async () => {
    const quantity = Number.parseInt(fdata.quantity, 10);
    if (!fdata.selectedId) return setData((current) => ({ ...current, error: 'Choose a product.' }));
    if (!Number.isInteger(quantity) || quantity < 0 || (fdata.mode === 'add' && quantity === 0)) return setData((current) => ({ ...current, error: fdata.mode === 'add' ? 'Enter how many items were received.' : 'Enter the physical stock count.' }));
    setData((current) => ({ ...current, saving: true, error: '' }));
    try {
      const response = await store.restock({ productId: fdata.selectedId, quantity, mode: fdata.mode, newCost: Number(fdata.newCost) || undefined, newSelling: Number(fdata.newSelling) || undefined });
      Alert.alert('Stock updated', response.message ?? `${selected?.productName} was updated.`);
      const products = await store.products();
      setData((current) => ({ ...current, products, quantity: '', newCost: '', newSelling: '', saving: false }));
    } catch (error) { setData((current) => ({ ...current, saving: false, error: errorMessage(error) })); }
  };

  const scan = (barcode: string) => {
    const product = fdata.products.find((item) => item.barcode === barcode);
    setData((current) => ({ ...current, scannerOpen: false, selectedId: product?.id ?? current.selectedId, error: product ? '' : 'Barcode not found in inventory.' }));
  };
  if (fdata.loading) return <SafeAreaView style={styles.safe}><ScreenState loading /></SafeAreaView>;
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <View style={styles.heading}><View><Text style={styles.title}>{t('chooseProduct')}</Text><Text style={styles.caption}>{t('productsAndStock')}</Text></View><View style={styles.scanButton}><Button title={t('scan')} variant="secondary" onPress={() => setData((current) => ({ ...current, scannerOpen: true }))} /></View></View>
          <TextInput style={styles.search} placeholder={t('inventory')} placeholderTextColor={colors.muted} value={fdata.search} onChangeText={(search) => setData((current) => ({ ...current, search }))} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.products}>{filtered.map((product) => <Pressable key={product.id} onPress={() => setData((current) => ({ ...current, selectedId: product.id }))} style={[styles.product, fdata.selectedId === product.id && styles.productActive]}><Text style={[styles.productName, fdata.selectedId === product.id && styles.productNameActive]}>{product.productName}</Text><Text style={styles.productMeta}>{product.stock} {t('stock')} · {peso(product.sellingPrice)}</Text></Pressable>)}</ScrollView>
        </Card>
        {selected ? <Card style={styles.card}><Text style={styles.title}>{selected.productName}</Text><View style={styles.currentRow}><View><Text style={styles.currentLabel}>{t('currentStock')}</Text><Text style={styles.currentValue}>{selected.stock}</Text></View><View><Text style={styles.currentLabel}>{t('costSelling')}</Text><Text style={styles.currentPrices}>{peso(selected.costPrice)} / {peso(selected.sellingPrice)}</Text></View></View><View style={styles.segment}><Pressable onPress={() => setData((current) => ({ ...current, mode: 'add', quantity: '', error: '' }))} style={[styles.segmentItem, fdata.mode === 'add' && styles.segmentActive]}><Text style={[styles.segmentText, fdata.mode === 'add' && styles.segmentTextActive]}>{t('addDelivery')}</Text></Pressable><Pressable onPress={() => setData((current) => ({ ...current, mode: 'set', quantity: '', error: '' }))} style={[styles.segmentItem, fdata.mode === 'set' && styles.segmentActive]}><Text style={[styles.segmentText, fdata.mode === 'set' && styles.segmentTextActive]}>{t('correctCount')}</Text></Pressable></View><Field label={t(fdata.mode === 'add' ? 'quantityReceived' : 'actualCount')} keyboardType="number-pad" placeholder="0" value={fdata.quantity} onChangeText={(quantity) => setData((current) => ({ ...current, quantity }))} />{fdata.mode === 'add' ? <View style={styles.priceRow}><View style={styles.half}><Field label={t('newCostOptional')} keyboardType="decimal-pad" placeholder={String(selected.costPrice)} value={fdata.newCost} onChangeText={(newCost) => setData((current) => ({ ...current, newCost }))} /></View><View style={styles.half}><Field label={t('newSellingOptional')} keyboardType="decimal-pad" placeholder={String(selected.sellingPrice)} value={fdata.newSelling} onChangeText={(newSelling) => setData((current) => ({ ...current, newSelling }))} /></View></View> : null}{fdata.error ? <Text style={styles.error}>{fdata.error}</Text> : null}<Button title={t('saveStock')} loading={fdata.saving} onPress={save} /></Card> : <ScreenState empty={t('noProductSelected')} />}
      </ScrollView>
      <BarcodeScanner visible={fdata.scannerOpen} onClose={() => setData((current) => ({ ...current, scannerOpen: false }))} onScanned={scan} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 15, paddingBottom: 34 },
  card: { gap: 15 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { color: colors.text, fontSize: 19, fontWeight: '900' },
  caption: { color: colors.muted, fontSize: 12, marginTop: 3 },
  scanButton: { width: 92 },
  search: { height: 48, borderRadius: 13, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, color: colors.text },
  products: { gap: 8 },
  product: { width: 155, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  productActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  productName: { color: colors.text, fontWeight: '800' },
  productNameActive: { color: colors.primaryDark },
  productMeta: { color: colors.muted, fontSize: 11, marginTop: 5 },
  currentRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: 14, padding: 14 },
  currentLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  currentValue: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 4 },
  currentPrices: { color: colors.text, fontWeight: '900', marginTop: 8 },
  segment: { flexDirection: 'row', borderRadius: 14, backgroundColor: colors.background, padding: 4 },
  segmentItem: { flex: 1, minHeight: 43, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.muted, fontWeight: '800' },
  segmentTextActive: { color: '#fff' },
  priceRow: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  error: { color: colors.danger, fontWeight: '600' },
});
