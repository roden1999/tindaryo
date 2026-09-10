import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Field, Pill, ScreenState } from '@/components/ui';
import { colors } from '@/constants/theme';
import { store } from '@/database/store';
import { useI18n } from '@/i18n';
import type { Customer } from '@/types';
import { errorMessage, peso } from '@/utils/format';

export default function CustomersScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [view, setView] = useState({ customers: [] as Customer[], search: '', name: '', loading: true, refreshing: false, saving: false, addOpen: false, error: '' });

  const load = useCallback(async (refreshing = false) => {
    setView((current) => ({ ...current, loading: !refreshing, refreshing, error: '' }));
    try {
      const customers = await store.customers();
      setView((current) => ({ ...current, customers, loading: false, refreshing: false }));
    } catch (error) {
      setView((current) => ({ ...current, loading: false, refreshing: false, error: errorMessage(error) }));
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const filtered = useMemo(() => view.customers.filter((customer) => customer.name.toLowerCase().includes(view.search.trim().toLowerCase())), [view.customers, view.search]);
  const total = view.customers.reduce((sum, customer) => sum + customer.balance, 0);

  const addCustomer = async () => {
    if (!view.name.trim()) return setView((current) => ({ ...current, error: 'Customer name is required.' }));
    setView((current) => ({ ...current, saving: true, error: '' }));
    try {
      await store.addCustomer(view.name.trim());
      setView((current) => ({ ...current, saving: false, addOpen: false, name: '' }));
      await load();
    } catch (error) {
      setView((current) => ({ ...current, saving: false, error: errorMessage(error) }));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.hero}><View><Text style={styles.heroLabel}>{t('totalOutstanding')}</Text><Text style={styles.heroValue}>{peso(total)}</Text></View><View style={styles.addButton}><Button title={`+ ${t('addCustomer')}`} onPress={() => setView((current) => ({ ...current, addOpen: true, error: '' }))} /></View></View>
      <View style={styles.searchWrap}><TextInput style={styles.search} placeholder={t('searchCustomers')} placeholderTextColor={colors.muted} value={view.search} onChangeText={(search) => setView((current) => ({ ...current, search }))} /></View>
      {view.loading || (view.error && !view.addOpen) ? <ScreenState loading={view.loading} error={view.error} onRetry={load} /> : (
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={view.refreshing} onRefresh={() => load(true)} colors={[colors.primary]} />}>
          {filtered.length === 0 ? <ScreenState empty={t('noCustomers')} /> : filtered.map((customer) => (
            <Pressable key={customer.id} onPress={() => router.push({ pathname: '/customers/[id]', params: { id: String(customer.id) } })}>
              <Card style={styles.customerCard}><View style={styles.avatar}><Text style={styles.avatarText}>{customer.name.slice(0, 1).toUpperCase()}</Text></View><View style={styles.customerCopy}><View style={styles.nameRow}><Text style={styles.customerName}>{customer.name}</Text>{customer.overdueCount > 0 ? <Pill label={`${customer.overdueCount} overdue`} tone="danger" /> : null}</View><Text style={styles.balanceLabel}>{t(customer.balance > 0 ? 'outstandingBalance' : 'noBalance')}</Text></View><Text style={[styles.balance, customer.balance === 0 && styles.zero]}>{peso(customer.balance)}</Text><Text style={styles.chevron}>›</Text></Card>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Modal visible={view.addOpen} transparent animationType="slide" onRequestClose={() => setView((current) => ({ ...current, addOpen: false }))}>
        <Pressable style={styles.backdrop} onPress={() => setView((current) => ({ ...current, addOpen: false }))} />
        <View style={styles.sheet}><Text style={styles.sheetTitle}>{t('addCustomer')}</Text><Text style={styles.sheetCaption}>{t('createLedger')}</Text><Field label={t('customerName')} placeholder={t('fullName')} autoFocus value={view.name} onChangeText={(name) => setView((current) => ({ ...current, name }))} onSubmitEditing={addCustomer} />{view.error ? <Text style={styles.error}>{view.error}</Text> : null}<Button title={t('saveCustomer')} loading={view.saving} onPress={addCustomer} /><Button title={t('cancel')} variant="ghost" onPress={() => setView((current) => ({ ...current, addOpen: false }))} /></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  hero: { backgroundColor: colors.primary, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  heroValue: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 3 },
  addButton: { width: 126 },
  searchWrap: { padding: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  search: { height: 48, borderRadius: 14, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, color: colors.text },
  content: { padding: 16, gap: 11, paddingBottom: 34 },
  customerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryDark, fontSize: 20, fontWeight: '900' },
  customerCopy: { flex: 1, gap: 3 },
  customerName: { color: colors.text, fontSize: 16, fontWeight: '900' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  balanceLabel: { color: colors.muted, fontSize: 12 },
  balance: { color: colors.danger, fontWeight: '900' },
  zero: { color: colors.success },
  chevron: { color: colors.muted, fontSize: 27 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.surface, padding: 22, paddingBottom: 56, gap: 14, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  sheetTitle: { color: colors.text, fontSize: 23, fontWeight: '900' },
  sheetCaption: { color: colors.muted, marginTop: -8 },
  error: { color: colors.danger, fontWeight: '600' },
});
