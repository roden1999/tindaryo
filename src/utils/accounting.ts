const nonNegative = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;

export const paidShare = (saleTotal: number, paidAmount: number) => {
  const total = nonNegative(saleTotal);
  if (total === 0) return 0;
  return Math.min(1, nonNegative(paidAmount) / total);
};

export const recognizedCost = (saleCost: number, saleTotal: number, paidAmount: number) =>
  nonNegative(saleCost) * paidShare(saleTotal, paidAmount);

export const writtenOffCost = (saleCost: number, saleTotal: number, paidAmount: number) =>
  nonNegative(saleCost) * (1 - paidShare(saleTotal, paidAmount));

export const cashBasisProfit = ({
  cashCollected,
  recognizedProductCost,
  writtenOffLoss = 0,
  expenses = 0,
}: {
  cashCollected: number;
  recognizedProductCost: number;
  writtenOffLoss?: number;
  expenses?: number;
}) => nonNegative(cashCollected) - nonNegative(recognizedProductCost) - nonNegative(writtenOffLoss) - nonNegative(expenses);
