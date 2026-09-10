import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultStoreHours, getStoreStatus, isHourScheduled, normalizeStoreHours } from '../src/utils/store-hours.ts';

test('unconfigured defaults do not pretend the store is open', () => {
  const status = getStoreStatus(defaultStoreHours(), new Date(2026, 7, 24, 10, 0));
  assert.equal(status.configured, false);
  assert.equal(status.isOpen, false);
});

test('configured daytime hours report the next closing time', () => {
  const hours = { ...defaultStoreHours(), configured: true };
  const status = getStoreStatus(hours, new Date(2026, 7, 24, 10, 0));
  assert.equal(status.isOpen, true);
  assert.equal(status.nextChangeKind, 'closes');
  assert.equal(status.nextChange?.getHours(), 21);
});

test('overnight opening continues into the following day', () => {
  const hours = defaultStoreHours();
  hours.configured = true;
  hours.days = hours.days.map((day) => day.day === 5 ? { ...day, opensAt: '18:00', closesAt: '02:00' } : day.day === 6 ? { ...day, enabled: false } : day);
  const saturdayMorning = new Date(2026, 7, 29, 1, 0);
  const status = getStoreStatus(hours, saturdayMorning);
  assert.equal(status.isOpen, true);
  assert.equal(status.overnight, true);
  assert.equal(status.nextChange?.getHours(), 2);
  assert.equal(isHourScheduled(hours, 6, 1), true);
  assert.equal(isHourScheduled(hours, 6, 3), false);
});

test('normalization rejects malformed times and fills every weekday', () => {
  const normalized = normalizeStoreHours({ configured: true, days: [{ day: 1, enabled: true, opensAt: 'bad', closesAt: '17:00' }] });
  assert.equal(normalized.days.length, 7);
  assert.equal(normalized.days.find((day) => day.day === 1)?.opensAt, '06:00');
});
