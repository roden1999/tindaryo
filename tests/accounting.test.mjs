import assert from 'node:assert/strict';
import test from 'node:test';

import { cashBasisProfit, paidShare, recognizedCost, writtenOffCost } from '../src/utils/accounting.ts';

test('partial payment recognizes the same share of product cost', () => {
  assert.equal(paidShare(100, 25), 0.25);
  assert.equal(recognizedCost(60, 100, 25), 15);
  assert.equal(cashBasisProfit({ cashCollected: 25, recognizedProductCost: 15 }), 10);
});

test('later payments complete revenue and cost without double counting', () => {
  const firstCost = recognizedCost(60, 100, 25);
  const lifetimeCost = recognizedCost(60, 100, 100);
  assert.equal(firstCost, 15);
  assert.equal(lifetimeCost - firstCost, 45);
  assert.equal(cashBasisProfit({ cashCollected: 100, recognizedProductCost: lifetimeCost }), 40);
});

test('writing off a partially paid sale recognizes only the remaining exposure', () => {
  assert.equal(writtenOffCost(60, 100, 25), 45);
  assert.equal(cashBasisProfit({ cashCollected: 25, recognizedProductCost: 15, writtenOffLoss: 45 }), -35);
});

test('accounting helpers safely clamp overpayment and invalid negatives', () => {
  assert.equal(paidShare(100, 125), 1);
  assert.equal(writtenOffCost(60, 100, 125), 0);
  assert.equal(cashBasisProfit({ cashCollected: -1, recognizedProductCost: -1, expenses: -1 }), 0);
});
