import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { Button, Card, Pill, ScreenState } from '@/components/ui';
import { colors } from '@/constants/theme';
import { store } from '@/database/store';
import { useI18n } from '@/i18n';
import type { Sale } from '@/types';
import { printReceipt, shareReceiptPdf, shareSalesCsv } from '@/services/export';
import { errorMessage, peso, shortDate } from '@/utils/format';

export default function SalesScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [view, setView] = useState({ sales: [] as Sale[], storeName: 'My Store', loading: true, refreshing: false, busyId: 0, confirmRefundId: 0, exporting: false, error: '' });

  const load = useCallback(async (refreshing = false) => {
    setView((current) => ({ ...current, loading: !refreshing, refreshing, error: '' }));
    try {
      const [sales, profile] = await Promise.all([store.sales(), store.getStoreProfile()]);
      setView((current) => ({ ...current, sales, storeName: profile.storeName, loading: false, refreshing: false }));
    } catch (error) {
      setView((current) => ({ ...current, loading: false, refreshing: false, error: errorMessage(error) }));
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const total = view.sales.reduce((sum, sale) => sum + (sale.voided ? 0 : sale.total), 0);

  const runReceiptAction = async (action: () => Promise<void>) => {
    setView((current) => ({ ...current, error: '' }));
    try { await action(); }
    catch (error) { setView((current) => ({ ...current, error: errorMessage(error) })); }
  };

  const refund = async () => {
    const saleId = view.confirmRefundId;
    if (!saleId) return;
    setView((current) => ({ ...current, busyId: saleId, confirmRefundId: 0, error: '' }));
    try { await store.voidSale(saleId, 'Customer return'); await load(); }
    catch (error) { setView((current) => ({ ...current, busyId: 0, error: errorMessage(error) })); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.toolbar}><View><Text style={styles.toolbarLabel}>{t('netPaidSales')}</Text><Text style={styles.toolbarTotal}>{peso(total)}</Text></View><View style={styles.toolbarActions}><Pressable accessibilityLabel={t('exportSales')} style={styles.exportButton} onPress={async () => { setView((current) => ({ ...current, exporting: true, error: '' })); try { await shareSalesCsv(); } catch (error) { setView((current) => ({ ...current, error: errorMessage(error) })); } finally { setView((current) => ({ ...current, exporting: false })); } }}><AppIcon name={view.exporting ? 'hourglass-outline' : 'download-outline'} color={colors.primary} /></Pressable><View style={styles.newButton}><Button title={`+ ${t('newSale')}`} onPress={() => router.push('/cart')} /></View></View></View>
      {view.loading || view.error ? <ScreenState loading={view.loading} error={view.error} onRetry={load} /> : (
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={view.refreshing} onRefresh={() => load(true)} colors={[colors.primary]} />}>
          {view.sales.length === 0 ? <ScreenState empty={t('noPaidSales')} /> : view.sales.map((sale) => (
            <Card key={sale.id} style={[styles.receipt, sale.voided && styles.refundedReceipt]}>
              <View style={styles.receiptHeader}><View><View style={styles.titleRow}><Text style={styles.receiptNumber}>Receipt #{sale.id}</Text>{sale.voided ? <Pill label={t('refunded')} tone="danger" /> : null}</View><Text style={styles.date}>{shortDate(sale.createdAt)}</Text></View><Text style={[styles.receiptTotal, sale.voided && styles.refundedTotal]}>{peso(sale.total)}</Text></View>
              <View style={styles.line} />
              {sale.items.map((item) => <View key={item.id} style={styles.itemRow}><Text style={styles.itemName}>{item.description} ×{item.quantity}</Text><Text style={styles.itemTotal}>{peso(item.lineTotal)}</Text></View>)}
              <View style={styles.paymentRow}>{sale.payments.map((payment) => <Pill key={`${sale.id}-${payment.method}`} label={`${payment.method.toUpperCase()} ${peso(payment.amount)}`} tone="success" />)}</View>
              <View style={styles.receiptActions}><Pressable style={styles.smallAction} onPress={() => runReceiptAction(() => shareReceiptPdf(sale, view.storeName))}><AppIcon name="share-outline" size={17} color={colors.primary} /><Text style={styles.smallActionText}>PDF</Text></Pressable><Pressable style={styles.smallAction} onPress={() => runReceiptAction(() => printReceipt(sale, view.storeName))}><AppIcon name="print-outline" size={17} color={colors.primary} /><Text style={styles.smallActionText}>{t('print')}</Text></Pressable>{!sale.voided ? <Pressable disabled={view.busyId === sale.id} style={[styles.smallAction, styles.refundAction]} onPress={() => setView((current) => ({ ...current, confirmRefundId: sale.id }))}><AppIcon name="return-up-back-outline" size={17} color={colors.danger} /><Text style={styles.refundText}>{view.busyId === sale.id ? 'Working…' : t('refund')}</Text></Pressable> : null}</View>
            </Card>
          ))}
        </ScrollView>
      )}
      <Modal visible={view.confirmRefundId > 0} transparent animationType="fade" onRequestClose={() => setView((current) => ({ ...current, confirmRefundId: 0 }))}>
        <Pressable style={styles.backdrop} onPress={() => setView((current) => ({ ...current, confirmRefundId: 0 }))} />
        <View style={styles.confirmSheet}><Text style={styles.confirmTitle}>{t('refundSaleQuestion')}</Text><Text style={styles.confirmCopy}>{t('refundInfo')}</Text><Button title={t('refundSale')} variant="danger" onPress={refund} /><Button title={t('cancel')} variant="ghost" onPress={() => setView((current) => ({ ...current, confirmRefundId: 0 }))} /></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  toolbar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toolbarLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  toolbarTotal: { color: colors.text, fontSize: 23, fontWeight: '900', marginTop: 2 },
  newButton: { width: 124 },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exportButton: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  content: { padding: 16, gap: 12, paddingBottom: 34 },
  receipt: { gap: 12 },
  refundedReceipt: { opacity: 0.7 },
  receiptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  receiptNumber: { color: colors.text, fontSize: 16, fontWeight: '900' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  date: { color: colors.muted, fontSize: 12, marginTop: 3 },
  receiptTotal: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  refundedTotal: { color: colors.danger, textDecorationLine: 'line-through' },
  line: { height: 1, backgroundColor: colors.border },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  itemName: { flex: 1, color: colors.muted },
  itemTotal: { color: colors.text, fontWeight: '700' },
  paymentRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  receiptActions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 11 },
  smallAction: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 11 },
  smallActionText: { color: colors.primaryDark, fontWeight: '800', fontSize: 12 },
  refundAction: { marginLeft: 'auto', backgroundColor: colors.dangerSoft },
  refundText: { color: colors.danger, fontWeight: '800', fontSize: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)' },
  confirmSheet: { backgroundColor: colors.surface, padding: 20, gap: 12, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  confirmTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  confirmCopy: { color: colors.muted, lineHeight: 20, marginBottom: 4 },
});
