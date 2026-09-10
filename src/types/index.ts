export type MutationResult = {
  success: boolean;
  message: string;
};

export type Product = {
  id: number;
  productName: string;
  barcode: string | null;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  category: string;
  unit: string;
  expiryDate: string | null;
  lowStockThreshold: number;
};

export type ProductPayload = Omit<Product, 'id'>;

export type ProductImportRow = {
  rowNumber: number;
  product: ProductPayload | null;
  errors: string[];
};

export type ProductImportPreview = {
  fileName: string;
  rows: ProductImportRow[];
  validCount: number;
  errorCount: number;
};

export type AppLanguage = 'system' | 'en' | 'fil' | 'ceb';

export type NotificationPreferences = {
  enabled: boolean;
  lowStock: boolean;
  expiry: boolean;
  overdue: boolean;
  busyForecast: boolean;
  quietForecast: boolean;
  hour: number;
  minute: number;
};

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type StoreDayHours = {
  day: Weekday;
  enabled: boolean;
  opensAt: string;
  closesAt: string;
};

export type StoreHours = {
  version: 1;
  configured: boolean;
  days: StoreDayHours[];
};

export type StoreStatus = {
  configured: boolean;
  isOpen: boolean;
  overnight: boolean;
  nextChange: Date | null;
  nextChangeKind: 'opens' | 'closes' | null;
};

export type TrafficRawSlot = {
  weekday: Weekday;
  hour: number;
  transactions: number;
  revenue: number;
};

export type TrafficLevel = 'none' | 'quiet' | 'normal' | 'busy';

export type TrafficHour = TrafficRawSlot & {
  averageTransactions: number;
  level: TrafficLevel;
};

export type TrafficReport = {
  periodDays: number;
  weeksObserved: number;
  totalTransactions: number;
  activeDays: number;
  confidence: 'learning' | 'early' | 'reliable';
  slots: TrafficHour[];
  busiest: TrafficHour[];
  quietest: TrafficHour[];
};

export type NotificationSummary = {
  lowStockCount: number;
  expiringCount: number;
  overdueCount: number;
};

export type SaleItem = {
  id: number;
  productId: number | null;
  description: string;
  quantity: number;
  costEach: number;
  priceEach: number;
  lineTotal: number;
};

export type Sale = {
  id: number;
  customerId: number | null;
  total: number;
  status: string;
  createdAt: string;
  dueAt: string | null;
  voided: boolean;
  voidReason: string | null;
  payments: SalePayment[];
  items: SaleItem[];
};

export type PaymentMethod = 'cash' | 'gcash' | 'maya';

export type SalePayment = {
  method: PaymentMethod;
  amount: number;
};

export type Customer = {
  id: number;
  name: string;
  balance: number;
  overdueCount: number;
};

export type UtangTransaction = {
  id: number;
  kind: 'sale' | 'payment';
  description: string;
  amount: number;
  status: string;
  createdAt: string;
  dueAt: string | null;
  overdue: boolean;
};

export type CustomerDetail = {
  customer: Customer;
  transactions: UtangTransaction[];
};

export type RestockItem = {
  id: number;
  productName: string;
  stock: number;
  soldLast30: number;
  velocity: number;
  daysLeft: number | null;
  urgency: 'out' | 'critical' | 'low' | 'ok' | 'no_data';
};

export type Dashboard = {
  todayRevenue: number;
  todayProfit: number;
  todaySaleCount: number;
  lowStockCount: number;
  totalUtang: number;
  todayExpenses: number;
  expiringCount: number;
};

export type ProfitSummary = {
  revenue: number;
  cost: number;
  grossProfit: number;
  expenses: number;
  writtenOffLoss: number;
  netProfit: number;
  outstanding: number;
  itemsSold: number;
  saleCount: number;
};

export type CartLine = {
  productId: number;
  quantity: number;
};

export type Expense = {
  id: number;
  category: string;
  amount: number;
  note: string | null;
  paymentMethod: PaymentMethod;
  createdAt: string;
};

export type DaySummary = {
  cashSales: number;
  gcashSales: number;
  mayaSales: number;
  cashExpenses: number;
  digitalExpenses: number;
  expectedCash: number;
  revenue: number;
  expenses: number;
  netCashflow: number;
};
