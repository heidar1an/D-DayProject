import { fetchGreenPathBundle } from './src/services/greenPath/greenPathService.js';

const snapshot = await fetchGreenPathBundle({ id: 'period-smoke', profile: { university: 'Test', term: 4 } }, { now: new Date('2026-09-17T08:00:00.000Z') });
if (!snapshot.needsOnboarding) throw new Error('fresh user must require onboarding');
console.log('profile', JSON.stringify(snapshot.academicProfile), 'year', snapshot.yearPlan.startDate, snapshot.yearPlan.endDate, snapshot.yearPlan.monthCount);
if (snapshot.yearPlan.months.length < 12) throw new Error(`year plan months=${snapshot.yearPlan.months.length}`);
if (snapshot.yearPlan.weeks.length < 50) throw new Error(`year plan weeks=${snapshot.yearPlan.weeks.length}`);
if (!snapshot.calendarEvents.length) throw new Error('calendar projection empty');
const sourceIds = new Set(snapshot.calendarEvents.map((event) => event.sourceId));
if (sourceIds.size < 2) throw new Error('calendar sources not separated');
console.log(JSON.stringify({ onboarding: snapshot.needsOnboarding, months: snapshot.yearPlan.months.length, weeks: snapshot.yearPlan.weeks.length, calendarEvents: snapshot.calendarEvents.length, sourceIds: [...sourceIds].slice(0, 8) }));
