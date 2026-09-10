import type { StoreHours, TrafficHour, TrafficRawSlot, TrafficReport, Weekday } from '@/types';

const timeToMinutes = (value: string) => {
  const [hour, minute] = value.split(':').map(Number);
  return Number.isInteger(hour) && Number.isInteger(minute) ? hour * 60 + minute : 0;
};

const isHourScheduled = (hours: StoreHours, weekday: Weekday, hour: number) => {
  const minute = hour * 60 + 30;
  const current = hours.days.find((item) => item.day === weekday);
  if (current?.enabled) {
    const opens = timeToMinutes(current.opensAt);
    const closes = timeToMinutes(current.closesAt);
    if (opens === closes || (closes > opens ? minute >= opens && minute < closes : minute >= opens)) return true;
  }
  const previous = hours.days.find((item) => item.day === ((weekday + 6) % 7));
  if (!previous?.enabled) return false;
  const opens = timeToMinutes(previous.opensAt);
  const closes = timeToMinutes(previous.closesAt);
  return closes < opens && minute < closes;
};

const percentile = (values: number[], ratio: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
};

export const analyzeTraffic = ({ rawSlots, hours, totalTransactions, activeDays, periodDays = 56 }: {
  rawSlots: TrafficRawSlot[];
  hours: StoreHours;
  totalTransactions: number;
  activeDays: number;
  periodDays?: number;
}): TrafficReport => {
  const weeksObserved = Math.max(1, periodDays / 7);
  const lookup = new Map(rawSlots.map((slot) => [`${slot.weekday}-${slot.hour}`, slot]));
  const slots: TrafficHour[] = [];
  for (let weekday = 0; weekday <= 6; weekday += 1) {
    for (let hour = 0; hour <= 23; hour += 1) {
      if (!isHourScheduled(hours, weekday as Weekday, hour)) continue;
      const raw = lookup.get(`${weekday}-${hour}`);
      slots.push({ weekday: weekday as Weekday, hour, transactions: raw?.transactions ?? 0, revenue: raw?.revenue ?? 0, averageTransactions: (raw?.transactions ?? 0) / weeksObserved, level: 'normal' });
    }
  }

  const positive = slots.map((slot) => slot.averageTransactions).filter((value) => value > 0);
  const busyThreshold = percentile(positive, 0.75);
  const quietThreshold = percentile(positive, 0.25);
  for (const slot of slots) {
    slot.level = slot.transactions === 0 ? 'none' : slot.averageTransactions >= busyThreshold ? 'busy' : slot.averageTransactions <= quietThreshold ? 'quiet' : 'normal';
  }

  const confidence = totalTransactions < 20 || activeDays < 7 ? 'learning' : totalTransactions < 50 || activeDays < 21 ? 'early' : 'reliable';
  const busiest = [...slots].filter((slot) => slot.transactions > 0).sort((a, b) => b.averageTransactions - a.averageTransactions || b.revenue - a.revenue).slice(0, 7);
  const quietest = [...slots].sort((a, b) => a.averageTransactions - b.averageTransactions || a.hour - b.hour).slice(0, 7);
  return { periodDays, weeksObserved, totalTransactions, activeDays, confidence, slots, busiest, quietest };
};
