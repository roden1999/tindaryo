import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultStoreHours } from '../src/utils/store-hours.ts';
import { analyzeTraffic } from '../src/utils/traffic.ts';

test('traffic analysis uses scheduled open hours and excludes closed slots', () => {
  const hours = defaultStoreHours();
  hours.configured = true;
  hours.days = hours.days.map((day) => day.day === 1 ? { ...day, opensAt: '08:00', closesAt: '12:00' } : { ...day, enabled: false });
  const report = analyzeTraffic({
    hours,
    totalTransactions: 64,
    activeDays: 28,
    rawSlots: [
      { weekday: 1, hour: 7, transactions: 20, revenue: 1000 },
      { weekday: 1, hour: 9, transactions: 16, revenue: 800 },
      { weekday: 1, hour: 11, transactions: 4, revenue: 200 },
    ],
  });
  assert.equal(report.slots.some((slot) => slot.hour === 7), false);
  assert.equal(report.slots.find((slot) => slot.hour === 9)?.averageTransactions, 2);
  assert.equal(report.busiest[0]?.hour, 9);
  assert.equal(report.confidence, 'reliable');
});

test('forecast remains in learning mode with too little history', () => {
  const hours = { ...defaultStoreHours(), configured: true };
  const report = analyzeTraffic({ hours, totalTransactions: 12, activeDays: 5, rawSlots: [] });
  assert.equal(report.confidence, 'learning');
  assert.ok(report.slots.every((slot) => slot.level === 'none'));
});
