import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fetchGreenPathBundle } from './src/services/greenPath/greenPathService.js';
import { GreenPathOverview } from './src/layout/dashboard/greenPath/GreenPathViews.jsx';
import GreenPathCalendar from './src/layout/dashboard/greenPath/GreenPathCalendar.jsx';
import { GreenPathYearView } from './src/layout/dashboard/greenPath/GreenPathPeriodViews.jsx';

const snapshot = await fetchGreenPathBundle({ id: 'render-user', profile: { university: 'Test', term: 4 } }, { now: new Date('2026-09-17T08:00:00.000Z') });
const noop = () => {};
const overview = renderToStaticMarkup(React.createElement(GreenPathOverview, { snapshot, onOpenOnboarding: noop, onOpenCourse: noop, onOpenTask: noop, onComplete: noop, onFocus: noop, onOpenResource: noop, onReschedule: noop, onOpenPhase: noop }));
const year = renderToStaticMarkup(React.createElement(GreenPathYearView, { snapshot, onOpenMonth: noop, onOpenCalendar: noop }));
const calendar = renderToStaticMarkup(React.createElement(GreenPathCalendar, { snapshot, month: snapshot.yearPlan.months[0].startDate.slice(0, 7), onMonthChange: noop, onSelectDate: noop, onSourceChange: noop, onOpenEvent: noop }));
for (const [name, markup] of [['overview', overview], ['year', year], ['calendar', calendar]]) {
  if (!markup || markup.length < 500) throw new Error(`${name} render too short`);
  console.log(`${name}: ${markup.length}`);
}
if (!overview.includes('مسیر تو تا مقصد')) throw new Error('overview heading missing');
if (!year.includes('نقشهٔ یک‌ساله')) throw new Error('year heading missing');
if (!calendar.includes('تقویم مسیر سبز')) throw new Error('calendar heading missing');
