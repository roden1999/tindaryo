import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { Button, Card, Pill, ScreenState } from '@/components/ui';
import { colors } from '@/constants/theme';
import { store } from '@/database/store';
import { useI18n } from '@/i18n';
import type { Product } from '@/types';
import { errorMessage, peso } from '@/utils/format';

export default function InventoryScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [view, setView] = useState({ products: [] as Product[], search: '', loading: true, refreshing: false, error: '' });

  const load = useCallback(async (refreshing = false) => {
    setView((current) => ({ ...current, loading: !refreshing, refreshing, error: '' }));
    try {
      const products = await store.products();
      setView((current) => ({ ...current, products, loading: false, refreshing: false }));
    } catch (error) {
      setView((current) => ({ ...current, loading: false, refreshing: false, error: errorMessage(error) }));
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const filtered = useMemo(() => {
    const query = view.search.trim().toLowerCase();
    return query ? view.products.filter((product) => product.productName.toLowerCase().includes(query) || product.category.toLowerCase().includes(query) || product.barcode?.includes(query)) : view.products;
  }, [view.products, view.search]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.toolbar}>
        <View style={styles.searchWrap}><AppIcon name="search-outline" size={19} color={colors.muted} /><TextInput style={styles.search} placeholder={t('searchProductBarcode')} placeholderTextColor={colors.muted} value={view.search} onChangeText={(search) => setView((current) => ({ ...current, search }))} /></View>
        <View style={styles.add}><Button title="Add" icon={<AppIcon name="add" color="#fff" />} onPress={() => router.push('/inventory/new')} /></View>
      </View>
      {view.loading || view.error ? <ScreenState loading={view.loading} error={view.error} onRetry={load} /> : (
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={view.refreshing} onRefresh={() => load(true)} colors={[colors.primary]} />}>
          <View style={styles.summary}><Text style={styles.summaryText}>{filtered.length} product{filtered.length === 1 ? '' : 's'}</Text><Pressable onPress={() => router.push('/restock/stock')} style={styles.restockAction}><AppIcon name="archive-outline" size={16} color={colors.primary} /><Text style={styles.restockLink}>Restock</Text></Pressable></View>
          {filtered.length === 0 ? <ScreenState empty={t('noMatchingProducts')} /> : filtered.map((product) => {
            const low = product.stock <= product.lowStockThreshold;
            const expiring = Boolean(product.expiryDate && new Date(`${product.expiryDate}T23:59:59`).getTime() <= Date.now() + 30 * 86400000);
            return (
              <Pressable key={product.id} onPress={() => router.push({ pathname: '/inventory/[id]', params: { id: String(product.id) } })}>
                <Card style={styles.productCard}>
                  <View style={[styles.stockIcon, low && styles.stockIconLow]}><Text style={styles.stockNumber}>{product.stock}</Text><Text style={styles.stockWord}>{t('stock')}</Text></View>
                  <View style={styles.productCopy}>
                    <View style={styles.nameRow}><Text style={styles.productName}>{product.productName}</Text>{low ? <Pill label={t(product.stock === 0 ? 'out' : 'low')} tone="danger" /> : null}{expiring ? <Pill label={t('expiring')} tone="warning" /> : null}</View>
                    <Text style={styles.meta}>{product.category} · {product.unit} · {t('cost')} {peso(product.costPrice)}</Text>
                    <Text style={styles.price}>{peso(product.sellingPrice)}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Card>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  toolbar: { flexDirection: 'row', padding: 12, gap: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchWrap: { flex: 1, height: 50, borderRadius: 15, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center' },
  search: { flex: 1, height: 48, paddingHorizontal: 9, color: colors.text },
  add: { width: 88 },
  content: { padding: 16, gap: 12, paddingBottom: 34 },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryText: { color: colors.muted, fontWeight: '700' },
  restockAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  restockLink: { color: colors.primary, fontWeight: '800' },
  productCard: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13 },
  stockIcon: { width: 58, height: 58, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stockIconLow: { backgroundColor: colors.dangerSoft },
  stockNumber: { color: colors.text, fontSize: 20, fontWeight: '900' },
  stockWord: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  productCopy: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  productName: { flexShrink: 1, color: colors.text, fontWeight: '900', fontSize: 16 },
  meta: { color: colors.muted, fontSize: 12 },
  price: { color: colors.primary, fontWeight: '900', fontSize: 15 },
  chevron: { color: colors.muted, fontSize: 29 },
});
