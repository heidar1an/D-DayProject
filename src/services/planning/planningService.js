/*
 * سرویس ماژول «برنامه‌ریزی و مدیریت» — تنها نقطهٔ تماس UI با داده.
 *
 * قرارداد این لایه عمداً شبیه یک API واقعی است: همهٔ متدها `async` هستند و
 * «پارامتر ورودی → پاسخ» می‌گیرند. برای وصل‌کردن بک‌اند کافی است بدنهٔ همین
 * متدها به `fetch` تغییر کند؛ هیچ کامپوننتی عوض نمی‌شود چون هیچ کامپوننتی
 * مستقیم سراغ `localStorage` نمی‌رود.
 *
 * سه نکتهٔ طراحی:
 *  ۱) «کاربر جاری» با `setViewer` تعیین می‌شود و همهٔ فهرست‌ها بر اساس سطح
 *     دسترسی او فیلتر می‌شوند (مدیر کل همه، مدیر واحد زیرمجموعه، عضو تیم فقط
 *     تسک‌های خودش).
 *  ۲) ساختار سازمانی، فهرست کاربران و پروژه‌ها از مخازن واقعی پروژه می‌آیند
 *     (`planningSources.js`) — نه از دادهٔ نمونه. هیچ تسک/رویداد/تراکنش/SOP
 *     پیش‌فرضی ساخته نمی‌شود؛ این‌ها را کاربر واقعی ثبت می‌کند.
 *  ۳) ارقام مالی از تراکنش‌های ثبت‌شده محاسبه می‌شوند؛ «پول ورودی» مجموع
 *     دریافتی‌ها، «سود ناخالص» درآمد منهای هزینهٔ مستقیم و «سود خالص» درآمد
 *     منهای همهٔ هزینه‌ها است.
 */

import {
  PLANNING_KEYS, clearAll, nowISO, read, readList, remove, slugCode, storageAvailable, subscribe, uid, usageBytes, write,
} from './planningStorage';
import {
  ACCESS_LEVELS, DEFAULT_PAYMENT_MODE, ORG_LEVELS, PAYMENT_MODES, PRIORITIES, TASK_STATUSES,
  TRANSACTION_KINDS, isOpenStatus, optionOf, priorityRank,
} from './planningTypes';
import { addDays, diffDays, isoDate, jalaliParts, parseISODate, todayJalali } from './jalali';
import {
  buildHolidays, defaultPlanningSettings, defaultReminderSettings, fetchAdmins,
  ownerForProject, projectsFromProducts, unitsFromProducts,
} from './planningSources';

/* ───────────────────────────── زیرساخت ───────────────────────────── */

const DELAY_MS = 80;

const settle = (value, ms = DELAY_MS) => new Promise((resolve) => {
  window.setTimeout(() => resolve(value), ms);
});

class PlanningError extends Error {
  constructor(message, fields = null) {
    super(message);
    this.name = 'PlanningError';
    this.fields = fields;
  }
}

export const isPlanningError = (error) => error?.name === 'PlanningError';

/* ───────────────────────────── راه‌اندازی ─────────────────────────────
 *
 * فقط ساختار واقعی پروژه نوشته می‌شود: واحدها، پروژه‌ها، تعطیلات رسمی و
 * تنظیمات پیش‌فرض. فهرست کاربران از API واقعی پر می‌شود (`ensureUsers`) و
 * هیچ محتوای نمونه‌ای — تسک، رویداد، ابلاغ، یادآوری، اعلان، تراکنش، SOP —
 * از پیش ساخته نمی‌شود.
 */

function bootstrapOnce() {
  if (read(PLANNING_KEYS.seeded, false)) return;

  const year = todayJalali().jy;
  const units = unitsFromProducts();

  write(PLANNING_KEYS.units, units);
  write(PLANNING_KEYS.projects, projectsFromProducts(units).map((project) => ({ ...project, ownerId: '' })));
  write(PLANNING_KEYS.holidays, buildHolidays([year - 1, year, year + 1]));
  write(PLANNING_KEYS.settings, defaultPlanningSettings);
  write(PLANNING_KEYS.seeded, true);
}

/* ───────────────────────────── کاربران واقعی ───────────────────────────── */

let usersRequest = null;

/*
 * فهرست کاربران از API پنل خوانده و در حافظهٔ ماژول کش می‌شود.
 *
 * اگر شبکه یا نشست مشکل داشته باشد — یا نقش کاربر مجوز `users.read` نداشته
 * باشد — همان فهرست ذخیره‌شدهٔ قبلی برگردانده می‌شود تا ماژول از کار نیفتد.
 * اگر هیچ فهرستی هم نباشد، دست‌کم خودِ کاربر جاری برمی‌گردد تا انتخاب مسئول و
 * ابلاغ در فرم‌ها بی‌گزینه نماند. درخواست‌های هم‌زمان با یک Promise مشترک
 * ادغام می‌شوند تا هر نمای باز، یک درخواست جدا نزند.
 */
async function ensureUsers({ refresh = false } = {}) {
  const cached = readList(PLANNING_KEYS.users);
  if (!refresh && cached.length) return cached;
  if (usersRequest) return usersRequest;

  const fallback = cached.length ? cached : [viewer];

  usersRequest = fetchAdmins()
    .then((rows) => {
      if (!rows.length) return fallback;
      write(PLANNING_KEYS.users, rows);
      return rows;
    })
    .catch(() => fallback)
    .finally(() => { usersRequest = null; });

  return usersRequest;
}


/* ───────────────────────────── کاربر جاری ───────────────────────────── */

/*
 * کاربر پیش‌فرض تا پیش از نشستن نشست واقعی.
 *
 * عمداً بی‌واحد است (`unitId: ''`): واحد واقعی کاربر از مجوزهای خودش استنتاج
 * می‌شود و گذاشتن یک شناسهٔ دستی این‌جا، عضویت ساختگی می‌ساخت.
 */
const GUEST = { id: 'viewer', name: 'کاربر پنل', role: 'مدیر کل', unitId: '', level: 'director', avatar: 'ک' };

let viewer = GUEST;

export function setViewer(next) {
  viewer = next ? { ...GUEST, ...next } : GUEST;
  return viewer;
}

export const getViewer = () => viewer;

function levelRank(level) {
  return optionOf(ORG_LEVELS, level)?.rank ?? 4;
}

const isDirector = () => levelRank(viewer.level) >= 4;
const isManager = () => levelRank(viewer.level) >= 3;

function unitIds() {
  const units = readList(PLANNING_KEYS.units);
  if (isDirector()) return units.map((unit) => unit.id);
  if (isManager()) {
    const own = units.filter((unit) => unit.id === viewer.unitId);
    const children = units.filter((unit) => unit.parentId === viewer.unitId);
    return [...own, ...children].map((unit) => unit.id);
  }
  return [viewer.unitId];
}

function taskVisible(task) {
  if (isDirector()) return true;
  if (isManager()) return unitIds().includes(task.unitId) || task.ownerId === viewer.id;
  return task.ownerId === viewer.id
    || (task.recipientIds ?? []).includes(viewer.id)
    || task.unitId === viewer.unitId;
}

/* فهرست کاربرانی که کاربر جاری می‌تواند به آن‌ها ابلاغ کند */
function assignableUsers(rows = readList(PLANNING_KEYS.users)) {
  if (isDirector()) return rows;
  if (isManager()) {
    const ids = new Set(unitIds());
    return rows.filter((user) => ids.has(user.unitId));
  }
  return rows.filter((user) => user.id === viewer.id);
}

/* ───────────────────────────── فعالیت‌ها ───────────────────────────── */

function logActivity(entry) {
  const rows = readList(PLANNING_KEYS.activity);
  const record = {
    id: uid('act'),
    actorId: viewer.id,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? '',
    targetTitle: entry.targetTitle ?? '',
    detail: entry.detail ?? '',
    at: nowISO(),
  };
  write(PLANNING_KEYS.activity, [record, ...rows].slice(0, 300));
  return record;
}

function pushNotification(entry) {
  const rows = readList(PLANNING_KEYS.notifications);
  const record = {
    id: uid('n'),
    title: entry.title,
    body: entry.body ?? '',
    kind: entry.kind ?? 'system',
    priority: entry.priority ?? 'medium',
    at: nowISO(),
    read: false,
    linkView: entry.linkView ?? '',
    linkId: entry.linkId ?? '',
  };
  write(PLANNING_KEYS.notifications, [record, ...rows].slice(0, 200));
  return record;
}

/* ───────────────────────────── سازمان ───────────────────────────── */

/* مسئول هر واحد از میان کاربران واقعی همان واحد انتخاب می‌شود */
function decorateUnits(units, users) {
  return units.map((unit) => ({
    ...unit,
    headId: unit.headId || users.find((user) => user.unitId === unit.id && user.level !== 'member')?.id || '',
  }));
}

export const org = {
  async units() {
    const users = await ensureUsers();
    return settle(decorateUnits(readList(PLANNING_KEYS.units), users));
  },

  async users({ assignableOnly = false, refresh = false } = {}) {
    const rows = await ensureUsers({ refresh });
    return settle(assignableOnly ? assignableUsers(rows) : rows);
  },

  /* خواندن دوبارهٔ کاربران از API — برای دکمهٔ «تازه‌سازی» در تنظیمات */
  async refreshUsers() {
    return settle(await ensureUsers({ refresh: true }), 150);
  },

  async projects() {
    const users = await ensureUsers();
    const rows = readList(PLANNING_KEYS.projects);

    /* مسئول پروژه از روی دسترسی واقعی کاربران به همان محصول تعیین می‌شود */
    return settle(rows.map((row) => ({
      ...row,
      ownerId: row.ownerId || ownerForProject(users, row.id),
    })));
  },

  /* درخت واحدها برای نمایش سلسله‌مراتبی */
  async hierarchy() {
    const users = await ensureUsers();
    const units = decorateUnits(readList(PLANNING_KEYS.units), users);

    const build = (parentId) => units
      .filter((unit) => unit.parentId === parentId)
      .map((unit) => ({
        ...unit,
        head: users.find((user) => user.id === unit.headId) ?? null,
        members: users.filter((user) => user.unitId === unit.id),
        children: build(unit.id),
      }));

    return settle(build(null));
  },
};

/* ───────────────────────────── تقویم ───────────────────────────── */

function eventVisible(event) {
  if (isDirector()) return true;
  if (isManager()) return unitIds().includes(projectUnitOf(event.projectId)) || event.ownerId === viewer.id;
  return event.ownerId === viewer.id || (event.attendeeIds ?? []).includes(viewer.id);
}

function projectUnitOf(projectId) {
  if (!projectId) return '';
  const project = readList(PLANNING_KEYS.projects).find((row) => row.id === projectId);
  return project?.unitId ?? '';
}

export const calendar = {
  async holidays(year) {
    const rows = readList(PLANNING_KEYS.holidays);
    const scoped = year ? rows.filter((row) => row.jy === year) : rows;
    return settle(scoped);
  },

  async list(params = {}) {
    const rows = readList(PLANNING_KEYS.events).filter(eventVisible);

    const filtered = rows.filter((event) => {
      if (params.from && event.date < params.from) return false;
      if (params.to && event.date > params.to) return false;
      if (params.projectId && event.projectId !== params.projectId) return false;
      if (params.ownerId && event.ownerId !== params.ownerId) return false;
      if (params.type && event.type !== params.type) return false;
      if (params.priority && event.priority !== params.priority) return false;
      if (params.status && event.status !== params.status) return false;
      return true;
    });

    return settle(filtered);
  },

  async create(payload) {
    if (!String(payload.title ?? '').trim()) {
      throw new PlanningError('عنوان رویداد الزامی است', { title: 'عنوان را وارد کنید' });
    }
    if (!payload.date) {
      throw new PlanningError('تاریخ رویداد الزامی است', { date: 'تاریخ را انتخاب کنید' });
    }

    const rows = readList(PLANNING_KEYS.events);
    const record = {
      id: uid('e'),
      title: String(payload.title).trim(),
      description: payload.description ?? '',
      type: payload.type ?? 'meeting',
      date: payload.date,
      start: payload.start ?? '09:00',
      end: payload.end ?? '10:00',
      allDay: Boolean(payload.allDay),
      projectId: payload.projectId ?? null,
      ownerId: payload.ownerId ?? viewer.id,
      attendeeIds: payload.attendeeIds ?? [],
      priority: payload.priority ?? 'medium',
      status: payload.status ?? 'issued',
      location: payload.location ?? '',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };

    write(PLANNING_KEYS.events, [...rows, record]);
    logActivity({ action: 'ساخت رویداد', targetType: 'event', targetId: record.id, targetTitle: record.title, detail: 'رویداد تازه در تقویم ثبت شد' });
    return settle(record, 120);
  },

  async update(id, payload) {
    const rows = readList(PLANNING_KEYS.events);
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) throw new PlanningError('رویداد پیدا نشد');

    const next = { ...rows[index], ...payload, updatedAt: nowISO() };
    rows[index] = next;
    write(PLANNING_KEYS.events, rows);
    logActivity({ action: 'ویرایش رویداد', targetType: 'event', targetId: id, targetTitle: next.title, detail: 'جزئیات رویداد به‌روز شد' });
    return settle(next, 120);
  },

  async remove(id) {
    const rows = readList(PLANNING_KEYS.events);
    const target = rows.find((row) => row.id === id);
    write(PLANNING_KEYS.events, rows.filter((row) => row.id !== id));
    logActivity({ action: 'حذف رویداد', targetType: 'event', targetId: id, targetTitle: target?.title ?? '', detail: 'رویداد از تقویم برداشته شد' });
    return settle(true, 120);
  },

  /*
   * جابه‌جایی با کشیدن و رهاکردن.
   * انتقال به تاریخ گذشته بلاک است — درخواست کارفرما «جابه‌جایی در آینده» بود.
   */
  async move(id, { date, start, end } = {}) {
    const rows = readList(PLANNING_KEYS.events);
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) throw new PlanningError('رویداد پیدا نشد');

    if (date && date < isoDate(new Date())) {
      throw new PlanningError('انتقال به تاریخ گذشته مجاز نیست');
    }

    const next = {
      ...rows[index],
      date: date ?? rows[index].date,
      start: start ?? rows[index].start,
      end: end ?? rows[index].end,
      updatedAt: nowISO(),
    };

    rows[index] = next;
    write(PLANNING_KEYS.events, rows);
    logActivity({ action: 'جابه‌جایی رویداد', targetType: 'event', targetId: id, targetTitle: next.title, detail: `به تاریخ ${date} منتقل شد` });
    return settle(next, 120);
  },
};

/* ───────────────────────────── تسک‌ها ───────────────────────────── */

function sortTasks(rows, sort = 'due') {
  const copy = [...rows];
  if (sort === 'priority') copy.sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || a.dueDate.localeCompare(b.dueDate));
  else if (sort === 'progress') copy.sort((a, b) => b.progress - a.progress);
  else if (sort === 'created') copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  else copy.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return copy;
}

function isOverdue(task, todayIso) {
  return isOpenStatus(task.status) && task.dueDate && task.dueDate < todayIso;
}

export const tasks = {
  async list(params = {}) {
    const todayIso = isoDate(new Date());
    let rows = readList(PLANNING_KEYS.tasks).filter(taskVisible);

    rows = rows.filter((task) => {
      if (params.projectId && task.projectId !== params.projectId) return false;
      if (params.ownerId && task.ownerId !== params.ownerId) return false;
      if (params.unitId && task.unitId !== params.unitId) return false;
      if (params.status && task.status !== params.status) return false;
      if (params.priority && task.priority !== params.priority) return false;
      if (params.tag && !(task.tags ?? []).includes(params.tag)) return false;
      if (params.from && task.dueDate < params.from) return false;
      if (params.to && task.dueDate > params.to) return false;
      if (params.overdue && !isOverdue(task, todayIso)) return false;
      if (params.dueToday && task.dueDate !== todayIso) return false;
      if (params.search) {
        const needle = String(params.search).trim().toLowerCase();
        const haystack = [task.title, task.description, task.code, ...(task.tags ?? [])].join(' ').toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    rows = sortTasks(rows, params.sort);

    const total = rows.length;
    const perPage = params.perPage ?? 0;
    const page = params.page ?? 1;

    if (!perPage) return settle({ items: rows, total, page: 1, pages: 1, perPage: total });

    const start = (page - 1) * perPage;
    return settle({
      items: rows.slice(start, start + perPage),
      total,
      page,
      perPage,
      pages: Math.max(1, Math.ceil(total / perPage)),
    });
  },

  async get(id) {
    const task = readList(PLANNING_KEYS.tasks).find((row) => row.id === id);
    if (!task) throw new PlanningError('تسک پیدا نشد');
    return settle(task);
  },

  async create(payload) {
    const fields = {};
    if (!String(payload.title ?? '').trim()) fields.title = 'عنوان تسک الزامی است';
    if (!payload.ownerId) fields.ownerId = 'مسئول اصلی را انتخاب کنید';
    if (!payload.dueDate) fields.dueDate = 'تاریخ سررسید را انتخاب کنید';
    if (Object.keys(fields).length) throw new PlanningError('فرم کامل نیست', fields);

    const rows = readList(PLANNING_KEYS.tasks);
    const nextNumber = 1000 + rows.length + 1;

    const record = {
      id: uid('t'),
      code: `TSK-${nextNumber}`,
      title: String(payload.title).trim(),
      description: payload.description ?? '',
      projectId: payload.projectId ?? null,
      unitId: payload.unitId ?? readList(PLANNING_KEYS.users).find((user) => user.id === payload.ownerId)?.unitId ?? viewer.unitId,
      ownerId: payload.ownerId,
      recipientIds: payload.recipientIds ?? [],
      startDate: payload.startDate ?? isoDate(new Date()),
      dueDate: payload.dueDate,
      priority: payload.priority ?? 'medium',
      status: payload.status ?? 'draft',
      progress: Number(payload.progress) || 0,
      attachments: payload.attachments ?? [],
      tags: payload.tags ?? [],
      comments: [],
      history: [],
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };

    record.history = [{
      id: uid('act'),
      actorId: viewer.id,
      action: 'ساخت تسک',
      targetType: 'task',
      targetId: record.id,
      targetTitle: record.code,
      detail: `تسک «${record.title}» ساخته شد`,
      at: nowISO(),
    }];

    write(PLANNING_KEYS.tasks, [record, ...rows]);
    logActivity({ action: 'ساخت تسک', targetType: 'task', targetId: record.id, targetTitle: record.title, detail: record.code });
    return settle(record, 140);
  },

  async update(id, payload) {
    const rows = readList(PLANNING_KEYS.tasks);
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) throw new PlanningError('تسک پیدا نشد');

    const before = rows[index];
    const next = { ...before, ...payload, updatedAt: nowISO() };

    /* پیشرفت ۱۰۰٪ یعنی تسک تمام شده؛ وضعیت را خودکار هم‌گام می‌کنیم */
    if (Number(next.progress) >= 100 && isOpenStatus(next.status)) next.status = 'done';
    if (next.status === 'done' && Number(next.progress) < 100) next.progress = 100;

    next.history = [{
      id: uid('act'),
      actorId: viewer.id,
      action: 'ویرایش تسک',
      targetType: 'task',
      targetId: id,
      targetTitle: next.code,
      detail: describeChanges(before, next),
      at: nowISO(),
    }, ...(before.history ?? [])].slice(0, 40);

    rows[index] = next;
    write(PLANNING_KEYS.tasks, rows);
    logActivity({ action: 'ویرایش تسک', targetType: 'task', targetId: id, targetTitle: next.title, detail: describeChanges(before, next) });
    return settle(next, 120);
  },

  async setStatus(id, status) {
    return tasks.update(id, { status, ...(status === 'done' ? { progress: 100 } : {}) });
  },

  async remove(id) {
    const rows = readList(PLANNING_KEYS.tasks);
    const target = rows.find((row) => row.id === id);
    write(PLANNING_KEYS.tasks, rows.filter((row) => row.id !== id));
    write(PLANNING_KEYS.assignments, readList(PLANNING_KEYS.assignments).filter((row) => row.taskId !== id));
    write(PLANNING_KEYS.reminders, readList(PLANNING_KEYS.reminders).filter((row) => row.targetId !== id));
    logActivity({ action: 'حذف تسک', targetType: 'task', targetId: id, targetTitle: target?.title ?? '', detail: 'تسک و ابلاغ‌های مرتبط حذف شد' });
    return settle(true, 120);
  },

  async addComment(id, body) {
    const text = String(body ?? '').trim();
    if (!text) throw new PlanningError('متن کامنت خالی است', { body: 'متن کامنت را بنویسید' });

    const rows = readList(PLANNING_KEYS.tasks);
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) throw new PlanningError('تسک پیدا نشد');

    const comment = { id: uid('cm'), authorId: viewer.id, body: text, createdAt: nowISO() };
    rows[index] = {
      ...rows[index],
      comments: [...(rows[index].comments ?? []), comment],
      updatedAt: nowISO(),
    };
    write(PLANNING_KEYS.tasks, rows);
    logActivity({ action: 'ثبت کامنت', targetType: 'task', targetId: id, targetTitle: rows[index].title, detail: text.slice(0, 80) });
    return settle(comment, 100);
  },

  async addAttachment(id, attachment) {
    const rows = readList(PLANNING_KEYS.tasks);
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) throw new PlanningError('تسک پیدا نشد');

    const record = {
      id: uid('att'),
      name: attachment.name,
      url: attachment.url ?? '',
      size: Number(attachment.size) || 0,
      kind: attachment.kind ?? 'document',
      uploadedAt: nowISO(),
      uploadedBy: viewer.id,
    };

    rows[index] = { ...rows[index], attachments: [...(rows[index].attachments ?? []), record], updatedAt: nowISO() };
    write(PLANNING_KEYS.tasks, rows);
    logActivity({ action: 'افزودن پیوست', targetType: 'task', targetId: id, targetTitle: rows[index].title, detail: record.name });
    return settle(record, 100);
  },

  async removeAttachment(id, attachmentId) {
    const rows = readList(PLANNING_KEYS.tasks);
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) throw new PlanningError('تسک پیدا نشد');

    rows[index] = {
      ...rows[index],
      attachments: (rows[index].attachments ?? []).filter((row) => row.id !== attachmentId),
      updatedAt: nowISO(),
    };
    write(PLANNING_KEYS.tasks, rows);
    return settle(true, 100);
  },

  /* خلاصه‌های آماری برای داشبورد و نمای کلی */
  async stats() {
    const todayIso = isoDate(new Date());
    const rows = readList(PLANNING_KEYS.tasks).filter(taskVisible);

    const byStatus = TASK_STATUSES.map((status) => ({
      ...status,
      count: rows.filter((task) => task.status === status.value).length,
    }));

    const byPriority = PRIORITIES.map((priority) => ({
      ...priority,
      count: rows.filter((task) => task.priority === priority.value).length,
    }));

    return settle({
      total: rows.length,
      open: rows.filter((task) => isOpenStatus(task.status)).length,
      overdue: rows.filter((task) => isOverdue(task, todayIso)).length,
      dueToday: rows.filter((task) => task.dueDate === todayIso && isOpenStatus(task.status)).length,
      done: rows.filter((task) => task.status === 'done').length,
      averageProgress: rows.length ? Math.round(rows.reduce((sum, task) => sum + (task.progress ?? 0), 0) / rows.length) : 0,
      byStatus,
      byPriority,
    });
  },
};

function describeChanges(before, after) {
  const parts = [];
  if (before.status !== after.status) parts.push('وضعیت تغییر کرد');
  if (before.priority !== after.priority) parts.push('اولویت تغییر کرد');
  if (before.progress !== after.progress) parts.push(`پیشرفت ${after.progress}٪ ثبت شد`);
  if (before.ownerId !== after.ownerId) parts.push('مسئول اصلی عوض شد');
  if (before.dueDate !== after.dueDate) parts.push('سررسید جابه‌جا شد');
  return parts.length ? parts.join(' · ') : 'جزئیات به‌روز شد';
}

/* ───────────────────────────── ابلاغ ───────────────────────────── */

function assignmentVisible(assignment) {
  if (isDirector()) return true;
  if (isManager()) {
    const users = readList(PLANNING_KEYS.users);
    const ids = new Set(assignableUsers().map((user) => user.id));
    return assignment.issuedById === viewer.id
      || assignment.recipientIds.some((id) => ids.has(id))
      || assignment.unitIds.some((id) => unitIds().includes(id))
      || users.some((user) => user.id === assignment.issuedById && ids.has(user.id));
  }
  return assignment.recipientIds.includes(viewer.id);
}

export const assignments = {
  async list(params = {}) {
    const tasks = readList(PLANNING_KEYS.tasks);
    const users = readList(PLANNING_KEYS.users);
    const units = readList(PLANNING_KEYS.units);

    let rows = readList(PLANNING_KEYS.assignments).filter(assignmentVisible);

    rows = rows.filter((row) => {
      if (params.state && row.state !== params.state) return false;
      if (params.accessLevel && row.accessLevel !== params.accessLevel) return false;
      if (params.recipientId && !row.recipientIds.includes(params.recipientId)) return false;
      if (params.pending && row.state !== 'sent') return false;
      return true;
    });

    const enriched = rows.map((row) => {
      const task = tasks.find((item) => item.id === row.taskId) ?? null;
      return {
        ...row,
        task,
        issuer: users.find((user) => user.id === row.issuedById) ?? null,
        recipients: users.filter((user) => row.recipientIds.includes(user.id)),
        recipientUnits: units.filter((unit) => row.unitIds.includes(unit.id)),
      };
    }).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

    return settle(enriched);
  },

  async issue(payload) {
    const fields = {};
    if (!payload.taskId) fields.taskId = 'تسک را انتخاب کنید';
    if (!(payload.recipientIds ?? []).length && !(payload.unitIds ?? []).length) {
      fields.recipientIds = 'حداقل یک گیرنده یا واحد انتخاب کنید';
    }
    if (Object.keys(fields).length) throw new PlanningError('فرم ابلاغ کامل نیست', fields);

    const rows = readList(PLANNING_KEYS.assignments);
    const task = readList(PLANNING_KEYS.tasks).find((row) => row.id === payload.taskId);

    const record = {
      id: uid('as'),
      taskId: payload.taskId,
      recipientIds: payload.recipientIds ?? [],
      unitIds: payload.unitIds ?? [],
      accessLevel: payload.accessLevel ?? 'view',
      dueDate: payload.dueDate ?? task?.dueDate ?? isoDate(addDays(new Date(), 7)),
      requireReport: Boolean(payload.requireReport),
      reportCycle: payload.reportCycle ?? 'none',
      notifyInApp: payload.notifyInApp !== false,
      notifyEmail: Boolean(payload.notifyEmail),
      issuedById: viewer.id,
      issuedAt: nowISO(),
      state: 'sent',
      seenAt: '',
      respondedAt: '',
      returnNote: '',
      note: payload.note ?? '',
    };

    write(PLANNING_KEYS.assignments, [record, ...rows]);

    /* ابلاغ، وضعیت تسک پیش‌نویس را به «ابلاغ‌شده» می‌برد */
    if (task && task.status === 'draft') {
      const taskRows = readList(PLANNING_KEYS.tasks);
      const index = taskRows.findIndex((row) => row.id === task.id);
      if (index >= 0) {
        taskRows[index] = {
          ...taskRows[index],
          status: 'issued',
          dueDate: record.dueDate,
          recipientIds: Array.from(new Set([...(taskRows[index].recipientIds ?? []), ...record.recipientIds])),
          updatedAt: nowISO(),
        };
        write(PLANNING_KEYS.tasks, taskRows);
      }
    }

    if (record.notifyInApp) {
      pushNotification({
        title: `ابلاغ تازه: ${task?.title ?? 'تسک'}`,
        body: `سطح دسترسی «${optionOf(ACCESS_LEVELS, record.accessLevel)?.label ?? record.accessLevel}» تعیین شد.`,
        kind: 'assignment',
        priority: task?.priority ?? 'medium',
        linkView: 'assignments',
        linkId: record.id,
      });
    }

    logActivity({
      action: 'ابلاغ تسک',
      targetType: 'assignment',
      targetId: record.id,
      targetTitle: task?.title ?? '',
      detail: `به ${record.recipientIds.length} نفر و ${record.unitIds.length} واحد ابلاغ شد`,
    });

    return settle(record, 140);
  },

  async markSeen(id) {
    return updateAssignment(id, (row) => (row.seenAt ? row : { ...row, seenAt: nowISO(), state: row.state === 'sent' ? 'seen' : row.state }));
  },

  async accept(id) {
    const record = await updateAssignment(id, (row) => ({ ...row, state: 'accepted', seenAt: row.seenAt || nowISO(), respondedAt: nowISO(), returnNote: '' }));
    logActivity({ action: 'پذیرش ابلاغ', targetType: 'assignment', targetId: id, targetTitle: '', detail: 'تسک توسط گیرنده پذیرفته شد' });
    return record;
  },

  async reject(id, note) {
    const record = await updateAssignment(id, (row) => ({ ...row, state: 'rejected', respondedAt: nowISO(), returnNote: note ?? '' }));
    logActivity({ action: 'رد ابلاغ', targetType: 'assignment', targetId: id, targetTitle: '', detail: note || 'بدون توضیح' });
    return record;
  },

  async returnForFix(id, note) {
    const record = await updateAssignment(id, (row) => ({ ...row, state: 'returned', respondedAt: nowISO(), returnNote: note ?? '' }));
    pushNotification({
      title: 'تسک برای اصلاح بازگردانده شد',
      body: note || 'ابلاغ‌کننده درخواست اصلاح دارد.',
      kind: 'assignment',
      priority: 'high',
      linkView: 'assignments',
      linkId: id,
    });
    logActivity({ action: 'بازگرداندن ابلاغ', targetType: 'assignment', targetId: id, targetTitle: '', detail: note || 'درخواست اصلاح' });
    return record;
  },

  async remind(id) {
    const rows = readList(PLANNING_KEYS.assignments);
    const row = rows.find((item) => item.id === id);
    pushNotification({
      title: 'یادآوری ابلاغ',
      body: row?.note || 'مهلت انجام این ابلاغ نزدیک است.',
      kind: 'assignment',
      priority: 'high',
      linkView: 'assignments',
      linkId: id,
    });
    logActivity({ action: 'یادآوری ابلاغ', targetType: 'assignment', targetId: id, targetTitle: '', detail: 'اعلان داخلی برای گیرندگان ارسال شد' });
    return settle(true, 100);
  },
};

function updateAssignment(id, updater) {
  const rows = readList(PLANNING_KEYS.assignments);
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) return Promise.reject(new PlanningError('ابلاغ پیدا نشد'));
  rows[index] = updater(rows[index]);
  write(PLANNING_KEYS.assignments, rows);
  return settle(rows[index], 100);
}

/* ───────────────────────────── یادآوری و اعلان ───────────────────────────── */

export const reminders = {
  async list(params = {}) {
    let rows = readList(PLANNING_KEYS.reminders);

    /* عضو تیم فقط یادآوری‌های خودش را می‌بیند */
    if (!isManager()) rows = rows.filter((row) => row.userId === viewer.id);

    rows = rows.filter((row) => {
      if (params.recurrence && row.recurrence !== params.recurrence) return false;
      if (params.priority && row.priority !== params.priority) return false;
      if (params.targetType && row.targetType !== params.targetType) return false;
      if (params.enabled !== undefined && row.enabled !== params.enabled) return false;
      return true;
    });

    return settle(rows);
  },

  async create(payload) {
    if (!String(payload.title ?? '').trim()) {
      throw new PlanningError('عنوان یادآوری الزامی است', { title: 'عنوان را وارد کنید' });
    }

    const rows = readList(PLANNING_KEYS.reminders);
    const record = {
      id: uid('r'),
      title: String(payload.title).trim(),
      body: payload.body ?? '',
      targetType: payload.targetType ?? 'task',
      targetId: payload.targetId ?? '',
      offsetMinutes: Number(payload.offsetMinutes) || 0,
      recurrence: payload.recurrence ?? 'none',
      priority: payload.priority ?? 'medium',
      enabled: payload.enabled !== false,
      userId: payload.userId ?? viewer.id,
      createdAt: nowISO(),
    };

    write(PLANNING_KEYS.reminders, [record, ...rows]);
    logActivity({ action: 'ساخت یادآوری', targetType: 'reminder', targetId: record.id, targetTitle: record.title, detail: 'یادآوری تازه ثبت شد' });
    return settle(record, 120);
  },

  async update(id, payload) {
    const rows = readList(PLANNING_KEYS.reminders);
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) throw new PlanningError('یادآوری پیدا نشد');
    rows[index] = { ...rows[index], ...payload };
    write(PLANNING_KEYS.reminders, rows);
    return settle(rows[index], 100);
  },

  async toggle(id, enabled) {
    return reminders.update(id, { enabled });
  },

  async remove(id) {
    write(PLANNING_KEYS.reminders, readList(PLANNING_KEYS.reminders).filter((row) => row.id !== id));
    logActivity({ action: 'حذف یادآوری', targetType: 'reminder', targetId: id, targetTitle: '', detail: 'یادآوری حذف شد' });
    return settle(true, 100);
  },

  /*
   * ── اعلان‌ها ──
   *
   * دو دسته اعلان داریم:
   *   · ذخیره‌شده — همان‌هایی که سرویس ساخته و در حافظه نشسته‌اند.
   *   · خودکار    — از تسک‌های عقب‌افتاده «در لحظه» ساخته می‌شوند و ذخیره
   *                 نمی‌شوند، چون اگر ذخیره می‌شدند با هر تغییر سررسید، نسخهٔ
   *                 کهنه‌شان باقی می‌ماند.
   *
   * همین خودکاربودن، باگ شمارنده را می‌ساخت: `unreadCount` آن‌ها را می‌شمرد
   * ولی `markRead`/`markAllRead` چیزی برای علامت‌زدن پیدا نمی‌کردند؛ پس نشان
   * قرمز حتی بعد از خواندن همه، دست‌نخورده می‌ماند. حالا شناسهٔ اعلان‌های
   * خوانده‌شدهٔ خودکار در `dismissed` نگه داشته می‌شود و شمارنده همان را کم
   * می‌کند.
   */
  async notifications(params = {}) {
    const dismissed = new Set(readList(PLANNING_KEYS.dismissed));
    let rows = readList(PLANNING_KEYS.notifications);

    const overdue = readList(PLANNING_KEYS.tasks)
      .filter(taskVisible)
      .filter((task) => isOverdue(task, isoDate(new Date())));

    rows = rows.filter((row) => {
      if (params.kind && row.kind !== params.kind) return false;
      if (params.priority && row.priority !== params.priority) return false;
      if (params.unreadOnly && row.read) return false;
      return true;
    });

    if (!params.kind || params.kind === 'overdue') {
      const auto = overdue.map((task) => {
        const id = `auto-overdue-${task.id}`;
        return {
          id,
          title: `تسک عقب‌افتاده: ${task.title}`,
          body: `سررسید ${task.dueDate} گذشته و وضعیت «${optionOf(TASK_STATUSES, task.status)?.label}» است.`,
          kind: 'overdue',
          priority: 'critical',
          at: `${task.dueDate}T09:00:00.000Z`,
          read: dismissed.has(id),
          linkView: 'tasks',
          linkId: task.id,
          auto: true,
        };
      }).filter((item) => !params.unreadOnly || !item.read);

      rows = [...auto, ...rows];
    }

    rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return settle(rows);
  },

  async markRead(id) {
    /*
     * اعلان خودکار در حافظه نیست؛ به‌جای دست‌زدن به فهرست اعلان‌ها، شناسه‌اش را
     * در فهرست «خوانده‌شده‌های خودکار» ثبت می‌کنیم.
     */
    if (String(id).startsWith('auto-')) {
      const rows = readList(PLANNING_KEYS.dismissed);
      if (!rows.includes(id)) write(PLANNING_KEYS.dismissed, [...rows, id].slice(-500));
      return settle(true, 60);
    }

    const rows = readList(PLANNING_KEYS.notifications);
    const index = rows.findIndex((row) => row.id === id);
    if (index >= 0) {
      rows[index] = { ...rows[index], read: true };
      write(PLANNING_KEYS.notifications, rows);
    }
    return settle(true, 60);
  },

  async markAllRead() {
    write(
      PLANNING_KEYS.notifications,
      readList(PLANNING_KEYS.notifications).map((row) => ({ ...row, read: true })),
    );

    /* اعلان‌های خودکارِ همین لحظه هم خوانده‌شده حساب می‌شوند */
    const overdue = readList(PLANNING_KEYS.tasks)
      .filter(taskVisible)
      .filter((task) => isOverdue(task, isoDate(new Date())))
      .map((task) => `auto-overdue-${task.id}`);

    const merged = Array.from(new Set([...readList(PLANNING_KEYS.dismissed), ...overdue]));
    write(PLANNING_KEYS.dismissed, merged.slice(-500));

    return settle(true, 80);
  },

  async unreadCount() {
    const stored = readList(PLANNING_KEYS.notifications).filter((row) => !row.read).length;
    const dismissed = new Set(readList(PLANNING_KEYS.dismissed));
    const overdue = readList(PLANNING_KEYS.tasks)
      .filter(taskVisible)
      .filter((task) => isOverdue(task, isoDate(new Date())))
      .filter((task) => !dismissed.has(`auto-overdue-${task.id}`)).length;

    return settle(stored + overdue, 40);
  },

  /* یادآوری‌هایی که امروز باید فعال شوند (برای نمای کلی) */
  async dueToday() {
    const todayIso = isoDate(new Date());
    const rows = readList(PLANNING_KEYS.reminders).filter((row) => row.enabled);
    const tasks = readList(PLANNING_KEYS.tasks);

    const due = rows.filter((row) => {
      if (row.recurrence !== 'none') return true;
      const task = tasks.find((item) => item.id === row.targetId);
      if (!task) return false;
      const target = parseISODate(task.dueDate);
      if (!target) return false;
      const fire = addDays(target, -Math.floor(row.offsetMinutes / 1440));
      return isoDate(fire) <= todayIso;
    });

    return settle(due);
  },

  async settings() {
    const stored = read(PLANNING_KEYS.settings, null) ?? {};
    const reminderSettings = stored.reminderSettings ?? defaultReminderSettings;
    return settle(reminderSettings);
  },

  async saveSettings(patch) {
    const stored = read(PLANNING_KEYS.settings, {}) ?? {};
    const next = { ...defaultReminderSettings, ...(stored.reminderSettings ?? {}), ...patch };
    write(PLANNING_KEYS.settings, { ...stored, reminderSettings: next });
    logActivity({ action: 'ویرایش تنظیمات', targetType: 'settings', targetId: 'reminders', targetTitle: 'تنظیمات یادآوری', detail: 'تنظیمات شخصی به‌روز شد' });
    return settle(next, 100);
  },
};

/* ───────────────────────────── مالی ───────────────────────────── */

function summarize(rows) {
  const inflow = rows.filter((row) => row.kind === 'income').reduce((sum, row) => sum + row.amount, 0);
  const directCost = rows.filter((row) => row.kind === 'direct-cost').reduce((sum, row) => sum + row.amount, 0);
  const indirectCost = rows.filter((row) => row.kind === 'indirect-cost').reduce((sum, row) => sum + row.amount, 0);
  const expenses = directCost + indirectCost;
  const grossProfit = inflow - directCost;
  const netProfit = inflow - expenses;

  const months = new Set(rows.map((row) => {
    const parts = jalaliParts(row.date);
    return `${parts.jy}-${parts.jm}`;
  }));

  return {
    inflow,
    directCost,
    indirectCost,
    expenses,
    grossProfit,
    netProfit,
    margin: inflow ? (netProfit / inflow) * 100 : 0,
    transactions: rows.length,
    monthlyAverage: months.size ? Math.round(inflow / months.size) : 0,
    months: months.size,
  };
}

function txInScope(row, { jy, jm, projectId, unitId, payment } = {}) {
  const parts = jalaliParts(row.date);
  if (!parts) return false;
  if (jy && parts.jy !== jy) return false;
  if (jm && parts.jm !== jm) return false;
  if (projectId && row.projectId !== projectId) return false;
  if (unitId && row.unitId !== unitId) return false;
  if (payment && (row.payment ?? DEFAULT_PAYMENT_MODE) !== payment) return false;
  return true;
}

/* تفکیک مبالغ بر اساس حالت پرداخت — برای کارت‌های خلاصه */
function paymentBreakdown(rows) {
  const total = { bank: 0, direct: 0 };
  const income = { bank: 0, direct: 0 };
  const expense = { bank: 0, direct: 0 };

  rows.forEach((row) => {
    const mode = row.payment === 'direct' ? 'direct' : 'bank';
    total[mode] += row.amount;
    if (row.kind === 'income') income[mode] += row.amount;
    else expense[mode] += row.amount;
  });

  return { total, income, expense };
}

/* اعتبارسنجی تراکنش — همان قواعدی که فرم ثبت دستی هم رعایت می‌کند */
function validateTransaction(payload) {
  const fields = {};
  const title = String(payload.title ?? '').trim();
  const amount = Number(payload.amount);

  if (!title) fields.title = 'عنوان تراکنش را وارد کنید';
  if (!Number.isFinite(amount) || amount <= 0) fields.amount = 'مبلغ باید عددی بزرگ‌تر از صفر باشد';
  if (!optionOf(TRANSACTION_KINDS, payload.kind)) fields.kind = 'نوع تراکنش را انتخاب کنید';
  if (!optionOf(PAYMENT_MODES, payload.payment)) fields.payment = 'حالت پرداخت را انتخاب کنید';
  if (!parseISODate(payload.date)) fields.date = 'تاریخ را انتخاب کنید';

  if (Object.keys(fields).length) {
    throw new PlanningError('اطلاعات تراکنش کامل نیست', fields);
  }

  return { title, amount: Math.round(amount) };
}

export const finance = {
  async summary(params = {}) {
    const rows = readList(PLANNING_KEYS.transactions);
    const year = params.jy ?? todayJalali().jy;
    const scoped = rows.filter((row) => txInScope(row, { jy: year, jm: params.jm, projectId: params.projectId, unitId: params.unitId, payment: params.payment }));
    return settle({ ...summarize(scoped), payments: paymentBreakdown(scoped) });
  },

  /* مقایسه با ماه یا سال قبل */
  async compare(params = {}) {
    const rows = readList(PLANNING_KEYS.transactions);
    const today = todayJalali();
    const jy = params.jy ?? today.jy;
    const jm = params.jm ?? null;

    const current = summarize(rows.filter((row) => txInScope(row, { jy, jm, projectId: params.projectId })));

    const previous = jm
      ? summarize(rows.filter((row) => txInScope(row, jm === 1 ? { jy: jy - 1, jm: 12 } : { jy, jm: jm - 1 }, { projectId: params.projectId })))
      : summarize(rows.filter((row) => txInScope(row, { jy: jy - 1, projectId: params.projectId })));

    const delta = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : 0);

    return settle({
      current,
      previous,
      label: jm ? 'ماه قبل' : 'سال قبل',
      delta: {
        inflow: delta(current.inflow, previous.inflow),
        grossProfit: delta(current.grossProfit, previous.grossProfit),
        netProfit: delta(current.netProfit, previous.netProfit),
        expenses: delta(current.expenses, previous.expenses),
        transactions: delta(current.transactions, previous.transactions),
        margin: current.margin - previous.margin,
      },
    });
  },

  /* سری ماهانه برای نمودارها + سری سال قبل */
  async series(params = {}) {
    const rows = readList(PLANNING_KEYS.transactions);
    const year = params.jy ?? todayJalali().jy;

    const build = (targetYear) => Array.from({ length: 12 }, (_, index) => {
      const jm = index + 1;
      const scoped = rows.filter((row) => txInScope(row, { jy: targetYear, jm, projectId: params.projectId }));
      const stats = summarize(scoped);
      return {
        jm,
        label: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'][index],
        short: ['فرو', 'ارد', 'خرد', 'تیر', 'مرد', 'شهر', 'مهر', 'آبا', 'آذر', 'دی', 'بهم', 'اسف'][index],
        income: stats.inflow,
        direct: stats.directCost,
        indirect: stats.indirectCost,
        gross: stats.grossProfit,
        net: stats.netProfit,
        count: stats.transactions,
      };
    });

    return settle({ year, months: build(year), previous: build(year - 1) });
  },

  async transactions(params = {}) {
    const rows = readList(PLANNING_KEYS.transactions);
    const year = params.jy ?? todayJalali().jy;

    const filtered = rows
      .filter((row) => txInScope(row, { jy: year, jm: params.jm, projectId: params.projectId, unitId: params.unitId, payment: params.payment }))
      .filter((row) => {
        if (params.kind && row.kind !== params.kind) return false;
        if (params.search) {
          const needle = String(params.search).toLowerCase();
          if (!`${row.title} ${row.code} ${row.party ?? ''} ${row.reference ?? ''}`.toLowerCase().includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    const projects = readList(PLANNING_KEYS.projects);

    return settle(filtered.map((row) => ({
      ...row,
      project: projects.find((project) => project.id === row.projectId) ?? null,
    })));
  },

  /*
   * ── ثبت دستی تراکنش ──
   *
   * تا وقتی درگاه پرداخت به پروژه وصل نشده، همهٔ ارقام مالی از ثبت دستی
   * می‌آیند: هزینه‌های مستقیم و غیرمستقیم را کاربر وارد می‌کند و دریافت‌ها هم
   * به همین شکل ثبت می‌شوند. کد تراکنش خودکار ساخته می‌شود و واحد سازمانی از
   * پروژهٔ انتخابی ارث می‌رسد تا گزارش واحدها درست بماند.
   */
  async create(payload) {
    const { title, amount } = validateTransaction(payload);

    const rows = readList(PLANNING_KEYS.transactions);
    const projects = readList(PLANNING_KEYS.projects);
    const project = projects.find((row) => row.id === payload.projectId) ?? null;

    const record = {
      id: uid('fin'),
      code: slugCode('FIN', rows.length + 1),
      title,
      kind: payload.kind,
      amount,
      date: isoDate(parseISODate(payload.date)),
      projectId: project?.id ?? '',
      unitId: payload.unitId || project?.unitId || viewer.unitId,
      payment: payload.payment,
      reference: String(payload.reference ?? '').trim(),
      party: String(payload.party ?? '').trim(),
      note: String(payload.note ?? '').trim(),
      createdBy: viewer.id,
      createdAt: nowISO(),
    };

    write(PLANNING_KEYS.transactions, [record, ...rows]);
    logActivity({
      action: 'ثبت تراکنش مالی',
      targetType: 'transaction',
      targetId: record.id,
      targetTitle: record.title,
      detail: `${optionOf(TRANSACTION_KINDS, record.kind)?.label} — ${record.amount.toLocaleString('en-US')} تومان (${optionOf(PAYMENT_MODES, record.payment)?.label})`,
    });
    return settle(record, 120);
  },

  async update(id, payload) {
    const rows = readList(PLANNING_KEYS.transactions);
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) throw new PlanningError('تراکنش پیدا نشد');

    const merged = { ...rows[index], ...payload };
    const { title, amount } = validateTransaction(merged);

    const projects = readList(PLANNING_KEYS.projects);
    const project = projects.find((row) => row.id === merged.projectId) ?? null;

    rows[index] = {
      ...merged,
      title,
      amount,
      date: isoDate(parseISODate(merged.date)),
      projectId: project?.id ?? '',
      unitId: merged.unitId || project?.unitId || rows[index].unitId,
      updatedAt: nowISO(),
    };

    write(PLANNING_KEYS.transactions, rows);
    logActivity({ action: 'ویرایش تراکنش مالی', targetType: 'transaction', targetId: id, targetTitle: rows[index].title, detail: 'اطلاعات تراکنش به‌روز شد' });
    return settle(rows[index], 120);
  },

  async remove(id) {
    const rows = readList(PLANNING_KEYS.transactions);
    const target = rows.find((row) => row.id === id) ?? null;
    write(PLANNING_KEYS.transactions, rows.filter((row) => row.id !== id));
    logActivity({ action: 'حذف تراکنش مالی', targetType: 'transaction', targetId: id, targetTitle: target?.title ?? '', detail: 'تراکنش حذف شد' });
    return settle(true, 100);
  },

  /* تفکیک درآمد/هزینه بر اساس پروژه */
  async byProject(params = {}) {
    const rows = readList(PLANNING_KEYS.transactions);
    const year = params.jy ?? todayJalali().jy;
    const projects = readList(PLANNING_KEYS.projects);

    const scoped = rows.filter((row) => txInScope(row, { jy: year }));

    const grouped = projects.map((project) => {
      const stats = summarize(scoped.filter((row) => row.projectId === project.id));
      return { project, ...stats };
    });

    const unassigned = summarize(scoped.filter((row) => !row.projectId));
    return settle({ rows: grouped, unassigned });
  },

  async years() {
    const rows = readList(PLANNING_KEYS.transactions);
    const years = Array.from(new Set(rows.map((row) => jalaliParts(row.date)?.jy).filter(Boolean)));
    return settle(years.sort((a, b) => b - a));
  },
};

/* ───────────────────────────── SOP ───────────────────────────── */

export const sop = {
  async list(params = {}) {
    const rows = readList(PLANNING_KEYS.sops);
    const units = readList(PLANNING_KEYS.units);
    const users = readList(PLANNING_KEYS.users);

    let filtered = rows.filter((row) => {
      if (params.status && row.status !== params.status) return false;
      if (params.unitId && row.unitId !== params.unitId) return false;
      if (params.reviewDue) {
        const next = parseISODate(row.nextReviewAt);
        if (!next || diffDays(next, new Date()) > 60) return false;
      }
      if (params.search) {
        const needle = String(params.search).toLowerCase();
        if (!`${row.title} ${row.code} ${row.purpose}`.toLowerCase().includes(needle)) return false;
      }
      return true;
    });

    filtered = filtered
      .map((row) => ({
        ...row,
        unit: units.find((unit) => unit.id === row.unitId) ?? null,
        author: users.find((user) => user.id === row.authorId) ?? null,
        reviewer: users.find((user) => user.id === row.reviewerId) ?? null,
        checklistDone: (row.checklist ?? []).filter((item) => item.done).length,
        checklistTotal: (row.checklist ?? []).length,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return settle(filtered);
  },

  async get(id) {
    const row = readList(PLANNING_KEYS.sops).find((item) => item.id === id);
    if (!row) throw new PlanningError('SOP پیدا نشد');
    const users = readList(PLANNING_KEYS.users);
    const units = readList(PLANNING_KEYS.units);
    return settle({
      ...row,
      unit: units.find((unit) => unit.id === row.unitId) ?? null,
      author: users.find((user) => user.id === row.authorId) ?? null,
      reviewer: users.find((user) => user.id === row.reviewerId) ?? null,
    });
  },

  async create(payload) {
    const fields = {};
    if (!String(payload.title ?? '').trim()) fields.title = 'عنوان SOP الزامی است';
    if (!String(payload.code ?? '').trim()) fields.code = 'کد SOP الزامی است';
    if (Object.keys(fields).length) throw new PlanningError('فرم کامل نیست', fields);

    const rows = readList(PLANNING_KEYS.sops);
    const record = {
      id: uid('s'),
      title: String(payload.title).trim(),
      code: String(payload.code).trim(),
      unitId: payload.unitId ?? viewer.unitId,
      authorId: payload.authorId ?? viewer.id,
      reviewerId: payload.reviewerId ?? viewer.id,
      version: payload.version ?? '۱٫۰',
      createdAt: nowISO(),
      updatedAt: nowISO(),
      nextReviewAt: payload.nextReviewAt ?? isoDate(addDays(new Date(), 365)),
      status: 'draft',
      purpose: payload.purpose ?? '',
      scope: payload.scope ?? '',
      responsibilities: payload.responsibilities ?? '',
      prerequisites: payload.prerequisites ?? '',
      body: payload.body ?? '',
      checklist: payload.checklist ?? [],
      kpis: payload.kpis ?? [],
      pitfalls: payload.pitfalls ?? '',
      attachments: payload.attachments ?? [],
      versions: [],
      comments: [],
      changeNote: 'ایجاد اولیه',
    };

    write(PLANNING_KEYS.sops, [record, ...rows]);
    logActivity({ action: 'ساخت SOP', targetType: 'sop', targetId: record.id, targetTitle: record.title, detail: record.code });
    return settle(record, 140);
  },

  /*
   * ویرایش SOP: نسخهٔ پیش از تغییر در `versions` بایگانی می‌شود تا «مشاهدهٔ
   * نسخه‌های قبلی» واقعاً کار کند و بازگردانی معنا داشته باشد.
   */
  async update(id, payload, { archive = true, changeNote = '' } = {}) {
    const rows = readList(PLANNING_KEYS.sops);
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) throw new PlanningError('SOP پیدا نشد');

    const before = rows[index];
    const next = { ...before, ...payload, updatedAt: nowISO() };

    if (archive && payload.body !== undefined && payload.body !== before.body) {
      next.versions = [{
        id: uid('sv'),
        version: before.version,
        savedAt: before.updatedAt,
        authorId: before.authorId,
        note: changeNote || 'نسخهٔ پیش از ویرایش',
        status: before.status,
        snapshot: before.body,
      }, ...(before.versions ?? [])].slice(0, 20);
      next.version = bumpVersion(before.version);
    }

    rows[index] = next;
    write(PLANNING_KEYS.sops, rows);
    logActivity({ action: 'ویرایش SOP', targetType: 'sop', targetId: id, targetTitle: next.title, detail: changeNote || 'محتوای SOP به‌روز شد' });
    return settle(next, 140);
  },

  /* ذخیرهٔ خودکار پیش‌نویس — بی‌صدا و بدون بایگانی نسخه */
  async saveDraft(id, payload) {
    const rows = readList(PLANNING_KEYS.sops);
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) throw new PlanningError('SOP پیدا نشد');
    rows[index] = { ...rows[index], ...payload, updatedAt: nowISO() };
    write(PLANNING_KEYS.sops, rows);
    return settle(rows[index], 40);
  },

  async submit(id) {
    const record = await sop.update(id, { status: 'review' }, { archive: false, changeNote: 'ارسال برای تأیید' });
    pushNotification({
      title: `SOP «${record.title}» برای تأیید ارسال شد`,
      body: 'نسخهٔ جاری در انتظار بازبینی ناظر است.',
      kind: 'approval',
      priority: 'medium',
      linkView: 'sop',
      linkId: id,
    });
    logActivity({ action: 'ارسال برای تأیید', targetType: 'sop', targetId: id, targetTitle: record.title, detail: 'وضعیت به «در حال بررسی» تغییر کرد' });
    return record;
  },

  async approve(id, note) {
    const record = await sop.update(id, { status: 'approved', changeNote: note || 'تأیید شد' }, { archive: false });
    pushNotification({
      title: `SOP «${record.title}» تأیید شد`,
      body: note || 'نسخهٔ جاری تأیید نهایی گرفت.',
      kind: 'approval',
      priority: 'medium',
      linkView: 'sop',
      linkId: id,
    });
    logActivity({ action: 'تأیید SOP', targetType: 'sop', targetId: id, targetTitle: record.title, detail: note || 'تأیید نهایی' });
    return record;
  },

  async requestFix(id, note) {
    const record = await sop.update(id, { status: 'draft', changeNote: note || 'درخواست اصلاح' }, { archive: false });
    pushNotification({
      title: `SOP «${record.title}» نیازمند اصلاح است`,
      body: note || 'ناظر درخواست اصلاح دارد.',
      kind: 'approval',
      priority: 'high',
      linkView: 'sop',
      linkId: id,
    });
    logActivity({ action: 'درخواست اصلاح SOP', targetType: 'sop', targetId: id, targetTitle: record.title, detail: note || '' });
    return record;
  },

  async obsolete(id, note) {
    return sop.update(id, { status: 'obsolete', changeNote: note || 'منسوخ شد' }, { archive: false });
  },

  async addComment(id, body) {
    const text = String(body ?? '').trim();
    if (!text) throw new PlanningError('متن پیشنهاد خالی است', { body: 'متن را بنویسید' });

    const rows = readList(PLANNING_KEYS.sops);
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) throw new PlanningError('SOP پیدا نشد');

    const comment = { id: uid('sc'), authorId: viewer.id, body: text, createdAt: nowISO() };
    rows[index] = { ...rows[index], comments: [...(rows[index].comments ?? []), comment], updatedAt: nowISO() };
    write(PLANNING_KEYS.sops, rows);
    return settle(comment, 100);
  },

  /* بازگردانی یک نسخهٔ قبلی — خودِ نسخهٔ جاری هم بایگانی می‌شود */
  async restore(id, versionId) {
    const rows = readList(PLANNING_KEYS.sops);
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) throw new PlanningError('SOP پیدا نشد');

    const row = rows[index];
    const version = (row.versions ?? []).find((item) => item.id === versionId);
    if (!version) throw new PlanningError('نسخه پیدا نشد');

    rows[index] = {
      ...row,
      body: version.snapshot,
      version: bumpVersion(version.version),
      updatedAt: nowISO(),
      versions: [{
        id: uid('sv'),
        version: row.version,
        savedAt: row.updatedAt,
        authorId: row.authorId,
        note: `پیش از بازگردانی به نسخهٔ ${version.version}`,
        status: row.status,
        snapshot: row.body,
      }, ...(row.versions ?? [])].slice(0, 20),
    };

    write(PLANNING_KEYS.sops, rows);
    logActivity({ action: 'بازگردانی نسخه', targetType: 'sop', targetId: id, targetTitle: row.title, detail: `بازگشت به نسخهٔ ${version.version}` });
    return settle(rows[index], 120);
  },

  async remove(id) {
    const row = readList(PLANNING_KEYS.sops).find((item) => item.id === id);
    write(PLANNING_KEYS.sops, readList(PLANNING_KEYS.sops).filter((item) => item.id !== id));
    logActivity({ action: 'حذف SOP', targetType: 'sop', targetId: id, targetTitle: row?.title ?? '', detail: 'سند حذف شد' });
    return settle(true, 120);
  },
};

function bumpVersion(version) {
  const digits = String(version ?? '۱٫۰')
    .replace(/[۰-۹]/g, (char) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(char)))
    .split('.');
  const major = Number(digits[0]) || 1;
  const minor = (Number(digits[1]) || 0) + 1;
  const fa = (value) => String(value).replace(/\d/g, (char) => '۰۱۲۳۴۵۶۷۸۹'[Number(char)]);
  return `${fa(major)}٫${fa(minor)}`;
}

/* ───────────────────────────── فعالیت و تنظیمات ───────────────────────────── */

export const activity = {
  async list({ limit = 30, targetType } = {}) {
    const users = readList(PLANNING_KEYS.users);
    const rows = readList(PLANNING_KEYS.activity)
      .filter((row) => !targetType || row.targetType === targetType)
      .slice(0, limit)
      .map((row) => ({ ...row, actor: users.find((user) => user.id === row.actorId) ?? null }));
    return settle(rows);
  },
};

export const settings = {
  async get() {
    const stored = read(PLANNING_KEYS.settings, null) ?? {};
    return settle({ ...defaultPlanningSettings, ...stored });
  },

  async save(patch) {
    const stored = read(PLANNING_KEYS.settings, {}) ?? {};
    const next = { ...defaultPlanningSettings, ...stored, ...patch };
    write(PLANNING_KEYS.settings, next);
    return settle(next, 100);
  },

  async usage() {
    const rows = readList(PLANNING_KEYS.transactions);
    return settle({
      bytes: usageBytes(),
      persistent: storageAvailable(),
      counts: {
        tasks: readList(PLANNING_KEYS.tasks).length,
        events: readList(PLANNING_KEYS.events).length,
        assignments: readList(PLANNING_KEYS.assignments).length,
        reminders: readList(PLANNING_KEYS.reminders).length,
        notifications: readList(PLANNING_KEYS.notifications).length,
        transactions: rows.length,
        sops: readList(PLANNING_KEYS.sops).length,
      },
    });
  },

  /*
   * پاک‌کردن دادهٔ ماژول.
   *
   * فقط دادهٔ «محتوایی» پاک می‌شود؛ ساختار واقعی پروژه (واحدها، پروژه‌ها،
   * تعطیلات رسمی) و تنظیمات دست‌نخورده می‌ماند، وگرنه کاربر بعد از پاک‌کردن با
   * ماژولی بی‌ساختار روبه‌رو می‌شد. کاربران هم دوباره از API خوانده می‌شوند.
   */
  async clear() {
    [
      PLANNING_KEYS.tasks, PLANNING_KEYS.events, PLANNING_KEYS.assignments,
      PLANNING_KEYS.reminders, PLANNING_KEYS.notifications, PLANNING_KEYS.dismissed,
      PLANNING_KEYS.transactions, PLANNING_KEYS.sops, PLANNING_KEYS.activity,
    ].forEach((key) => remove(key));

    return settle(true, 200);
  },

  /* بازگشت کامل به حالت نخست — ساختار واقعی هم از نو ساخته می‌شود */
  async reset() {
    clearAll();
    bootstrapOnce();
    await ensureUsers({ refresh: true });
    return settle(true, 200);
  },
};

/* ───────────────────────────── نمای کلی ───────────────────────────── */

export const overview = {
  async summary() {
    const todayIso = isoDate(new Date());
    const visibleTasks = readList(PLANNING_KEYS.tasks).filter(taskVisible);
    const users = readList(PLANNING_KEYS.users);

    const decorate = (task) => ({ ...task, owner: users.find((user) => user.id === task.ownerId) ?? null });

    const todayTasks = visibleTasks.filter((task) => task.dueDate === todayIso && isOpenStatus(task.status)).map(decorate);
    const overdue = visibleTasks.filter((task) => isOverdue(task, todayIso)).map(decorate);

    const events = readList(PLANNING_KEYS.events)
      .filter(eventVisible)
      .filter((event) => event.date >= todayIso)
      .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
      .slice(0, 6);

    const pendingAssignments = (await assignments.list({ pending: true })).slice(0, 5);

    const reminderRows = readList(PLANNING_KEYS.reminders).filter((row) => row.enabled && row.userId === viewer.id);
    const notifications = await reminders.notifications({ unreadOnly: true });

    const year = todayJalali().jy;
    const financial = summarize(readList(PLANNING_KEYS.transactions).filter((row) => txInScope(row, { jy: year })));
    const financialCompare = await finance.compare({ jy: year });

    const feed = (await activity.list({ limit: 8 }));
    const stats = await tasks.stats();

    return settle({
      today: todayIso,
      todayTasks,
      overdue,
      events,
      pendingAssignments,
      reminders: reminderRows,
      notifications,
      financial,
      financialCompare,
      feed,
      stats,
    }, 120);
  },
};

/* ───────────────────────────── راه‌اندازی ───────────────────────────── */

bootstrapOnce();

export { PLANNING_KEYS, subscribe, storageAvailable };

export const planning = {
  setViewer, getViewer, org, calendar, tasks, assignments, reminders, finance, sop, activity, settings, overview,
};

export default planning;
