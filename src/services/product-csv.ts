import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { store } from '@/database/store';
import { parseProductCsv } from '@/services/product-csv-parser';
import type { ProductImportPreview, ProductImportRow } from '@/types';

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export const pickProductCsv = async (): Promise<ProductImportPreview | null> => {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (asset.size && asset.size > MAX_FILE_BYTES) throw new Error('Choose a CSV smaller than 2 MB.');
  const preview = parseProductCsv(new File(asset.uri).textSync(), asset.name);
  const existingBarcodes = new Set((await store.products()).map((product) => product.barcode).filter(Boolean));
  const fileBarcodes = new Set<string>();
  const rows = preview.rows.map((row): ProductImportRow => {
    if (!row.product?.barcode) return row;
    const barcode = row.product.barcode;
    const conflict = existingBarcodes.has(barcode)
      ? 'Barcode already exists in inventory'
      : fileBarcodes.has(barcode)
        ? 'Barcode is duplicated in this CSV'
        : '';
    fileBarcodes.add(barcode);
    return conflict ? { ...row, product: null, errors: [...row.errors, conflict] } : row;
  });
  return { ...preview, rows, validCount: rows.filter((row) => row.product).length, errorCount: rows.filter((row) => !row.product).length };
};

export const importProductPreview = async (preview: ProductImportPreview) => {
  const products = preview.rows.flatMap((row) => row.product ? [row.product] : []);
  return store.importProducts(products);
};

export { parseProductCsv } from '@/services/product-csv-parser';
