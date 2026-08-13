import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { EncodingType, StorageAccessFramework, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { store } from '@/database/store';
import type { Sale } from '@/types';
import { peso, shortDate } from '@/utils/format';

const safeFile = (name: string) => {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  return file;
};

const shareFile = async (file: File, mimeType: string, dialogTitle: string) => {
  if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
};

export const shareBackup = async () => {
  const backup = await store.exportBackup();
  const date = new Date().toISOString().slice(0, 10);
  const file = safeFile(`tindaryo-backup-${date}.json`);
  file.write(JSON.stringify(backup));
  await shareFile(file, 'application/json', 'Save Tindaryo backup');
  await store.setSetting('last_backup_at', new Date().toISOString());
};

export const saveBackupToDevice = async () => {
  if (Platform.OS !== 'android') throw new Error('Choose Share backup, then Save to Files on this device.');
  const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) return false;
  const backup = await store.exportBackup();
  const date = new Date().toISOString().slice(0, 10);
  const fileUri = await StorageAccessFramework.createFileAsync(permission.directoryUri, `tindaryo-backup-${date}`, 'application/json');
  await StorageAccessFramework.writeAsStringAsync(fileUri, JSON.stringify(backup));
  await store.setSetting('last_backup_at', new Date().toISOString());
  return true;
};

export const restoreBackupFromPicker = async () => {
  const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/json'], copyToCacheDirectory: true });
  if (picked.canceled) return false;
  const file = new File(picked.assets[0].uri);
  await store.restoreBackup(JSON.parse(file.textSync()));
  return true;
};

export const shareSalesCsv = async () => {
  const csv = await store.salesCsv();
  const date = new Date().toISOString().slice(0, 10);
  const file = safeFile(`tindaryo-sales-${date}.csv`);
  file.write(csv);
  await shareFile(file, 'text/csv', 'Export Tindaryo sales');
};

export const shareProductCsvTemplate = async () => {
  const file = safeFile('tindaryo-product-import-template.csv');
  file.write([
    'product_name,barcode,cost_price,selling_price,stock,category,unit,expiry_date,low_stock_threshold',
    'Sardines 155g,4800012345678,20.00,28.00,12,Canned goods,can,2027-01-31,3',
  ].join('\n'));
  await shareFile(file, 'text/csv', 'Save Tindaryo product CSV template');
};

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const receiptHtml = (sale: Sale, storeName: string) => `
  <html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>body{font-family:Arial,sans-serif;color:#16231f;padding:28px}h1{margin:0;color:#0B765E}.muted{color:#6f7e78}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e7ece9}.total{font-size:22px;font-weight:800;margin-top:16px}.pill{display:inline-block;background:#DFF4EC;color:#075441;padding:6px 10px;border-radius:20px;font-weight:700}</style></head>
  <body><h1>${escapeHtml(storeName)}</h1><p class="muted">Tindaryo receipt #${sale.id} · ${escapeHtml(shortDate(sale.createdAt))}</p>
  ${sale.items.map((item) => `<div class="row"><span>${escapeHtml(item.description)} × ${item.quantity}</span><strong>${peso(item.lineTotal)}</strong></div>`).join('')}
  <div class="row total"><span>Total</span><span>${peso(sale.total)}</span></div>
  <p><span class="pill">${sale.payments.map((payment) => `${payment.method.toUpperCase()} ${peso(payment.amount)}`).join(' + ')}</span></p>
  ${sale.voided ? `<p style="color:#a13d35"><strong>REFUNDED:</strong> ${escapeHtml(sale.voidReason || '')}</p>` : ''}
  <p class="muted">Salamat po!</p></body></html>`;

export const shareReceiptPdf = async (sale: Sale, storeName: string) => {
  const printed = await Print.printToFileAsync({ html: receiptHtml(sale, storeName), base64: true });
  if (!printed.base64) throw new Error('The receipt PDF could not be created.');
  const shareableFile = safeFile(`tindaryo-receipt-${sale.id}.pdf`);
  await writeAsStringAsync(shareableFile.uri, printed.base64, { encoding: EncodingType.Base64 });
  await shareFile(shareableFile, 'application/pdf', `Receipt #${sale.id}`);
};

export const printReceipt = async (sale: Sale, storeName: string) => {
  await Print.printAsync({ html: receiptHtml(sale, storeName) });
};
