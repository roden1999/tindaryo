import type { ProductImportPreview, ProductImportRow, ProductPayload } from '@/types';

const MAX_PRODUCT_ROWS = 500;

const headerAliases: Record<string, keyof ProductPayload> = {
  productname: 'productName',
  name: 'productName',
  barcode: 'barcode',
  costprice: 'costPrice',
  cost: 'costPrice',
  sellingprice: 'sellingPrice',
  price: 'sellingPrice',
  stock: 'stock',
  quantity: 'stock',
  category: 'category',
  unit: 'unit',
  expirydate: 'expiryDate',
  expirationdate: 'expiryDate',
  lowstockthreshold: 'lowStockThreshold',
  threshold: 'lowStockThreshold',
};

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[\s_-]+/g, '');

const parseCsvCells = (input: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];
    if (character === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error('The CSV has an unclosed quoted value.');
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
};

const numericValue = (value: string, label: string, errors: string[], integer = false) => {
  if (!value.trim()) {
    errors.push(`${label} is required`);
    return 0;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || (integer && !Number.isInteger(parsed))) {
    errors.push(`${label} must be ${integer ? 'a whole number' : 'a number'} of zero or more`);
    return 0;
  }
  return parsed;
};

const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export const parseProductCsv = (input: string, fileName = 'products.csv'): ProductImportPreview => {
  const matrix = parseCsvCells(input.replace(/^\uFEFF/, ''));
  if (matrix.length < 2) throw new Error('The CSV needs a header and at least one product row.');
  if (matrix.length - 1 > MAX_PRODUCT_ROWS) throw new Error(`Import up to ${MAX_PRODUCT_ROWS} products at a time.`);

  const headers = matrix[0].map((header) => headerAliases[normalizeHeader(header)] ?? null);
  for (const required of ['productName', 'costPrice', 'sellingPrice', 'stock'] as const) {
    if (!headers.includes(required)) throw new Error(`Missing required column: ${required}.`);
  }

  const rows = matrix.slice(1).map((cells, index): ProductImportRow => {
    const values: Partial<Record<keyof ProductPayload, string>> = {};
    headers.forEach((header, column) => { if (header) values[header] = cells[column]?.trim() ?? ''; });
    const errors: string[] = [];
    const productName = values.productName?.trim() ?? '';
    if (!productName) errors.push('Product name is required');
    const costPrice = numericValue(values.costPrice ?? '', 'Cost price', errors);
    const sellingPrice = numericValue(values.sellingPrice ?? '', 'Selling price', errors);
    if (sellingPrice <= 0) errors.push('Selling price must be greater than zero');
    const stock = numericValue(values.stock ?? '', 'Stock', errors, true);
    const thresholdText = values.lowStockThreshold?.trim();
    const lowStockThreshold = thresholdText ? numericValue(thresholdText, 'Low-stock threshold', errors, true) : 5;
    const expiryDate = values.expiryDate?.trim() || null;
    if (expiryDate && !validDate(expiryDate)) errors.push('Expiry date must be a real date in YYYY-MM-DD format');
    if (cells.length > headers.length && cells.slice(headers.length).some((value) => value.trim())) errors.push('Row has more values than the header');

    return {
      rowNumber: index + 2,
      product: errors.length ? null : {
        productName,
        barcode: values.barcode?.trim() || null,
        costPrice,
        sellingPrice,
        stock,
        category: values.category?.trim() || 'General',
        unit: values.unit?.trim() || 'piece',
        expiryDate,
        lowStockThreshold,
      },
      errors,
    };
  });

  return { fileName, rows, validCount: rows.filter((row) => row.product).length, errorCount: rows.filter((row) => !row.product).length };
};
