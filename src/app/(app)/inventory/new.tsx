import { useRouter } from 'expo-router';

import { ProductForm } from '@/components/product-form';
import { store } from '@/database/store';

export default function AddProductScreen() {
  const router = useRouter();
  return <ProductForm submitLabel="Save product" onSubmit={async (payload) => { await store.addProduct(payload); router.back(); }} />;
}
