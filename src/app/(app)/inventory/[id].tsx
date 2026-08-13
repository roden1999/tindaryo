import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductForm } from '@/components/product-form';
import { ScreenState } from '@/components/ui';
import { store } from '@/database/store';
import { useI18n } from '@/i18n';
import type { Product } from '@/types';
import { errorMessage } from '@/utils/format';

export default function EditProductScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [view, setView] = useState({ product: null as Product | null, loading: true, error: '' });

  useEffect(() => {
    store.products().then((products) => {
      const product = products.find((item) => item.id === Number(id)) ?? null;
      setView({ product, loading: false, error: product ? '' : 'Product not found.' });
    }).catch((error) => setView({ product: null, loading: false, error: errorMessage(error) }));
  }, [id]);

  if (view.loading || view.error || !view.product) return <SafeAreaView style={{ flex: 1 }}><ScreenState loading={view.loading} error={view.error} /></SafeAreaView>;
  const archive = () => Alert.alert(t('archiveProduct'), t('archiveProductBody'), [
    { text: t('cancel'), style: 'cancel' },
    { text: t('archive'), style: 'destructive', onPress: async () => {
      try { await store.archiveProduct(view.product!.id); router.replace('/inventory'); }
      catch (error) { Alert.alert(t('couldNotLoad'), errorMessage(error)); }
    } },
  ]);
  return <ProductForm product={view.product} submitLabel="Save changes" archiveAction={{ title: t('archiveProduct'), disabled: view.product.stock > 0, onPress: archive }} onSubmit={async (payload) => { await store.updateProduct({ ...view.product!, ...payload }); router.back(); }} />;
}
