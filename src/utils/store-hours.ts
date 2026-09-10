import type { StoreDayHours, StoreHours, StoreStatus, Weekday } from '@/types';

export const WEEKDAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const DEFAULT_OPEN = '06:00';
const DEFAULT_CLOSE = '21:00';

export const defaultStoreHours = (): StoreHours => ({
  version: 1,
  configured: false,
  days: WEEKDAY_ORDER.map((day) => ({ day, enabled: true, opensAt: DEFAULT_OPEN, closesAt: DEFAULT_CLOSE })),
});

export const timeToMinutes = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour * 60 + minute : null;
};

export const minutesToTime = (minutes: number) => {
  const safe = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};

export const normalizeStoreHours = (input: unknown): StoreHours => {
  const fallback = defaultStoreHours();
  if (!input || typeof input !== 'object') return fallback;
  const candidate = input as Partial<StoreHours>;
  if (!Array.isArray(candidate.days)) return fallback;

  const parsed = new Map<Weekday, StoreDayHours>();
  for (const value of candidate.days) {
    if (!value || typeof value !== 'object') continue;
    const day = Number((value as StoreDayHours).day) as Weekday;
    const opensAt = String((value as StoreDayHours).opensAt ?? '');
    const closesAt = String((value as StoreDayHours).closesAt ?? '');
    if (!Number.isInteger(day) || day < 0 || day > 6 || timeToMinutes(opensAt) === null || timeToMinutes(closesAt) === null) continue;
    parsed.set(day, { day, enabled: Boolean((value as StoreDayHours).enabled), opensAt, closesAt });
  }

  return {
    version: 1,
    configured: Boolean(candidate.configured),
    days: WEEKDAY_ORDER.map((day) => parsed.get(day) ?? fallback.days.find((item) => item.day === day)!),
  };
};

export const formatStoreTime = (value: string, locale?: string) => {
  const minutes = timeToMinutes(value);
  if (minutes === null) return value;
  const date = new Date(2020, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
};

const daySchedule = (hours: StoreHours, day: number) => hours.days.find((item) => item.day === day);
const atLocalMinutes = (date: Date, minutes: number, dayOffset = 0) => {
  const next = new Date(date);
  next.setDate(next.getDate() + dayOffset);
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return next;
};

export const isHourScheduled = (hours: StoreHours, weekday: Weekday, hour: number) => {
  const minute = hour * 60 + 30;
  const current = daySchedule(hours, weekday);
  if (current?.enabled) {
    const opens = timeToMinutes(current.opensAt)!;
    const closes = timeToMinutes(current.closesAt)!;
    if (opens === closes || (closes > opens ? minute >= opens && minute < closes : minute >= opens)) return true;
  }
  const previous = daySchedule(hours, ((weekday + 6) % 7) as Weekday);
  if (!previous?.enabled) return false;
  const previousOpen = timeToMinutes(previous.opensAt)!;
  const previousClose = timeToMinutes(previous.closesAt)!;
  return previousClose < previousOpen && minute < previousClose;
};

export const getStoreStatus = (hours: StoreHours, now = new Date()): StoreStatus => {
  if (!hours.configured) return { configured: false, isOpen: false, overnight: false, nextChange: null, nextChangeKind: null };
  const weekday = now.getDay() as Weekday;
  const minute = now.getHours() * 60 + now.getMinutes();
  const current = daySchedule(hours, weekday);
  const previous = daySchedule(hours, ((weekday + 6) % 7) as Weekday);

  if (previous?.enabled) {
    const opens = timeToMinutes(previous.opensAt)!;
    const closes = timeToMinutes(previous.closesAt)!;
    if (closes < opens && minute < closes) {
      return { configured: true, isOpen: true, overnight: true, nextChange: atLocalMinutes(now, closes), nextChangeKind: 'closes' };
    }
  }

  if (current?.enabled) {
    const opens = timeToMinutes(current.opensAt)!;
    const closes = timeToMinutes(current.closesAt)!;
    if (opens === closes) {
      return { configured: true, isOpen: true, overnight: true, nextChange: atLocalMinutes(now, opens, 1), nextChangeKind: 'closes' };
    }
    if (closes > opens && minute >= opens && minute < closes) {
      return { configured: true, isOpen: true, overnight: false, nextChange: atLocalMinutes(now, closes), nextChangeKind: 'closes' };
    }
    if (closes < opens && minute >= opens) {
      return { configured: true, isOpen: true, overnight: true, nextChange: atLocalMinutes(now, closes, 1), nextChangeKind: 'closes' };
    }
  }

  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    const schedule = daySchedule(hours, candidate.getDay());
    if (!schedule?.enabled) continue;
    const opens = timeToMinutes(schedule.opensAt)!;
    const opening = atLocalMinutes(now, opens, offset);
    if (opening.getTime() > now.getTime()) {
      return { configured: true, isOpen: false, overnight: false, nextChange: opening, nextChangeKind: 'opens' };
    }
  }
  return { configured: true, isOpen: false, overnight: false, nextChange: null, nextChangeKind: null };
};

export const nextDateForSlot = (weekday: Weekday, hour: number, from = new Date()) => {
  const next = new Date(from);
  const dayOffset = (weekday - from.getDay() + 7) % 7;
  next.setDate(from.getDate() + dayOffset);
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 7);
  return next;
};
