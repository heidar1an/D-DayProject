import { aggregateHeartSeries, startOfDay, toDayKey } from './heartSeries';

async function loadDays() {
  const response = await fetch('/api/users/hearts', { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('heart-stats-unavailable');
  const { awards = [] } = await response.json();
  const days = {};
  for (const award of awards) {
    const date = new Date(award.awardedAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = toDayKey(date);
    days[key] = (days[key] ?? 0) + 1;
  }
  return days;
}

export async function fetchHeartSeries({ range = 'daily' } = {}) {
  const days = await loadDays();
  return {
    ...aggregateHeartSeries(days, range),
    allTimeTotal: Object.values(days).reduce((sum, count) => sum + count, 0),
  };
}

export async function fetchHeartSummary() {
  const days = await loadDays();
  const today = startOfDay(new Date());
  let streak = 0;
  const cursor = new Date(today);
  while (days[toDayKey(cursor)] > 0) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return {
    today: days[toDayKey(today)] ?? 0,
    total: Object.values(days).reduce((sum, count) => sum + count, 0),
    streak,
  };
}
