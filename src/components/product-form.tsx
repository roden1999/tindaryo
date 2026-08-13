import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BarcodeScanner } from '@/components/barcode-scanner';
import { OptionalDateField } from '@/components/optional-date-field';
import { Button, Card, Field, Page } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useI18n } from '@/i18n';
import type { Product, ProductPayload } from '@/types';
import { errorMessage } from '@/utils/format';

export const ProductForm = ({
  product,
  onSubmit,
  submitLabel,
  archiveAction,
}: {
  product?: Product;
  onSubmit: (payload: ProductPayload) => Promise<void>;
  submitLabel: string;
  archiveAction?: { title: string; disabled?: boolean; onPress: () => void };
}) => {
  const { t } = useI18n();
  const [fdata, setData] = useState({
    productName: product?.productName ?? '',
    barcode: product?.barcode ?? '',
    costPrice: product ? String(product.costPrice) : '',
    sellingPrice: product ? String(product.sellingPrice) : '',
    stock: product ? String(product.stock) : '0',
    category: product?.category ?? 'General',
    unit: product?.unit ?? 'piece',
    expiryDate: product?.expiryDate ?? '',
    lowStockThreshold: String(product?.lowStockThreshold ?? 5),
    scannerOpen: false,
    loading: false,
    error: '',
  });

  const submit = async () => {
    const costPrice = Number(fdata.costPrice);
    const sellingPrice = Number(fdata.sellingPrice);
    const stock = Number.parseInt(fdata.stock, 10);
    const lowStockThreshold = Number.parseInt(fdata.lowStockThreshold, 10);
    if (!fdata.productName.trim()) return setData((current) => ({ ...current, error: 'Product name is required.' }));
    if (!(costPrice >= 0) || !(sellingPrice > 0)) return setData((current) => ({ ...current, error: 'Enter valid cost and selling prices.' }));
    if (!Number.isInteger(stock) || stock < 0) return setData((current) => ({ ...current, error: 'Stock must be a whole number of zero or more.' }));
    if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) return setData((current) => ({ ...current, error: 'Low-stock alert level must be zero or more.' }));
    if (fdata.expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(fdata.expiryDate)) return setData((current) => ({ ...current, error: 'Use YYYY-MM-DD for the expiry date.' }));
    setData((current) => ({ ...current, loading: true, error: '' }));
    try {
      await onSubmit({
        productName: fdata.productName.trim(),
        barcode: fdata.barcode.trim() || null,
        costPrice,
        sellingPrice,
        stock,
        category: fdata.category.trim() || 'General',
        unit: fdata.unit.trim() || 'piece',
        expiryDate: fdata.expiryDate || null,
        lowStockThreshold,
      });
    } catch (error) {
      setData((current) => ({ ...current, loading: false, error: errorMessage(error) }));
    }
  };

  const margin = Number(fdata.sellingPrice || 0) - Number(fdata.costPrice || 0);
  return (
    <>
      <Page>
        <Card style={styles.form}>
          <Field label="Product name" placeholder="e.g. Sardines 155g" value={fdata.productName} onChangeText={(productName) => setData((current) => ({ ...current, productName }))} />
          <View style={styles.barcodeRow}>
            <View style={styles.barcodeField}><Field label="Barcode (optional)" placeholder="Scan or type" value={fdata.barcode} onChangeText={(barcode) => setData((current) => ({ ...current, barcode }))} /></View>
            <View style={styles.scanButton}><Button title="Scan" variant="secondary" onPress={() => setData((current) => ({ ...current, scannerOpen: true }))} /></View>
          </View>
          <View style={styles.row}>
            <View style={styles.half}><Field label="Cost price" placeholder="0.00" keyboardType="decimal-pad" value={fdata.costPrice} onChangeText={(costPrice) => setData((current) => ({ ...current, costPrice }))} /></View>
            <View style={styles.half}><Field label="Selling price" placeholder="0.00" keyboardType="decimal-pad" value={fdata.sellingPrice} onChangeText={(sellingPrice) => setData((current) => ({ ...current, sellingPrice }))} /></View>
          </View>
          <View style={styles.row}>
            <View style={styles.half}><Field label="Category" placeholder="e.g. Canned goods" value={fdata.category} onChangeText={(category) => setData((current) => ({ ...current, category }))} /></View>
            <View style={styles.half}><Field label="Unit" placeholder="piece, sachet, bottle" value={fdata.unit} onChangeText={(unit) => setData((current) => ({ ...current, unit }))} /></View>
          </View>
          <View style={styles.row}>
            <View style={styles.half}><OptionalDateField label={t('expiryOptional')} value={fdata.expiryDate} onChange={(expiryDate) => setData((current) => ({ ...current, expiryDate }))} /></View>
            <View style={styles.half}><Field label="Low-stock alert" keyboardType="number-pad" value={fdata.lowStockThreshold} onChangeText={(lowStockThreshold) => setData((current) => ({ ...current, lowStockThreshold }))} /></View>
          </View>
          {!product ? <Field label="Opening stock" placeholder="0" keyboardType="number-pad" value={fdata.stock} onChangeText={(stock) => setData((current) => ({ ...current, stock }))} /> : null}
          <View style={styles.marginBox}><Text style={styles.marginLabel}>{t('profitPerPiece')}</Text><Text style={[styles.marginValue, margin < 0 && styles.negative]}>₱{margin.toFixed(2)}</Text></View>
          {fdata.error ? <Text style={styles.error}>{fdata.error}</Text> : null}
          <Button title={submitLabel} loading={fdata.loading} onPress={submit} />
          {archiveAction ? <Button title={archiveAction.title} variant="danger" disabled={archiveAction.disabled} onPress={archiveAction.onPress} /> : null}
        </Card>
      </Page>
      <BarcodeScanner visible={fdata.scannerOpen} onClose={() => setData((current) => ({ ...current, scannerOpen: false }))} onScanned={(barcode) => setData((current) => ({ ...current, barcode, scannerOpen: false }))} />
    </>
  );
};

const styles = StyleSheet.create({
  form: { gap: 16 },
  barcodeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  barcodeField: { flex: 1 },
  scanButton: { width: 94 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  marginBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 13, backgroundColor: colors.primarySoft, padding: 14 },
  marginLabel: { color: colors.primaryDark, fontWeight: '700' },
  marginValue: { color: colors.success, fontWeight: '900', fontSize: 17 },
  negative: { color: colors.danger },
  error: { color: colors.danger, fontWeight: '600' },
});
