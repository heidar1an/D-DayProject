/*
 * تقویم محتوایی — چه چیزی، کِی، روی کدام پلتفرم.
 *
 * سه نما: ماهانه، هفتگی، روزانه. جابه‌جایی با کشیدن و رها کردن انجام می‌شود و
 * مستقیم `scheduleContent` را صدا می‌زند، پس همان قاعدهٔ سرور اعمال می‌شود:
 * تاریخ باید معتبر باشد و وضعیت به «زمان‌بندی‌شده» می‌رود.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { mediaCenter } from '../../../../services/admin/adminService';
import { Button, useToast } from '../../adminShared';
import { IconChevron, IconClock } from '../../adminIcons';
import {
  DataTable, DebouncedInput, Empty, ErrorBlock, Panel, Picker, Pill, SectionTitle,
  SkeletonCards, STATUS_LABEL, STATUS_TONE, addDays, clockTime, dayStamp, faDate,
  labelOf, parseDay, relativeTime, toFa, useLoader,
} from '../mediaKit';

const DOW = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];

/* شنبه = ۰ در تقویم ایرانی؛ `getDay()` یک‌شنبه را ۰ می‌دهد */
const faDow = (date) => (date.getDay() + 1) % 7;

/* رنگ نوار کنار هر چیپ بر اساس وضعیت */
const CHIP_COLOR = {
  draft: '#8a8a8a',
  review: '#e0b45c',
  approved: '#61d192',
  scheduled: '#5b8cc7',
  publishing: '#937fcd',
  published: '#61d192',
  failed: '#ef9196',
  cancelled: '#7c7c7c',
  archived: '#7c7c7c',
};

export default function CalendarSection({ config, intent, clearIntent, openTab }) {
  const notify = useToast();
  const [view, setView] = useState('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [status, setStatus] = useState('all');
  const [platform, setPlatform] = useState('all');
  const [search, setSearch] = useState('');
  const [dragId, setDragId] = useState(null);
  const [dropKey, setDropKey] = useState(null);
  const [busy, setBusy] = useState(false);

  const bounds = useMemo(() => {
    if (view === 'day') return { from: dayStamp(anchor), to: dayStamp(anchor) };
    if (view === 'week') {
      const start = addDays(anchor, -faDow(anchor));
      return { from: dayStamp(start), to: dayStamp(addDays(start, 6)) };
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { from: dayStamp(addDays(first, -faDow(first))), to: dayStamp(addDays(last, 6 - faDow(last))) };
  }, [view, anchor]);

  const { data, loading, error, reload } = useLoader(
    () => mediaCenter.calendar({ from: bounds.from, to: bounds.to }),
    [bounds.from, bounds.to],
  );

  /*
   * اگر از جست‌وجوی مرکزی روی یک محتوا کلیک شده باشد، این تب فقط برای دیدن
   * تقویم است؛ خودِ محتوا در تب «مدیریت محتوا» باز می‌شود.
   */
  useEffect(() => {
    if (intent?.action !== 'open') return;
    openTab('content', intent);
    clearIntent?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.nonce]);

  const items = useMemo(() => {
    const rows = data?.items ?? [];
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== 'all' && row.status !== status) return false;
      if (platform !== 'all' && row.platform !== platform) return false;
      if (needle && !`${row.title} ${row.caption} ${row.accountName}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data, status, platform, search]);

  const byDay = useMemo(() => {
    const map = new Map();
    items.forEach((row) => {
      const stamp = row.scheduledAt ?? row.publishedAt ?? row.createdAt;
      if (!stamp) return;
      const key = dayStamp(new Date(stamp));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return map;
  }, [items]);

  /* ─── کشیدن و رها کردن ─── */

  const drop = useCallback(async (stamp) => {
    setDropKey(null);
    if (!dragId) return;

    const row = items.find((item) => item.id === dragId);
    setDragId(null);
    if (!row) return;

    const current = row.scheduledAt ?? row.publishedAt ?? row.createdAt;
    const time = current ? new Date(current) : new Date();
    const target = parseDay(stamp);
    if (!target) return;

    const next = new Date(target.getFullYear(), target.getMonth(), target.getDate(), time.getHours(), time.getMinutes());
    if (current && next.getTime() === new Date(current).getTime()) return;

    setBusy(true);
    try {
      await mediaCenter.scheduleContent(row.id, next.toISOString(), 'جابه‌جایی در تقویم');
      notify(`«${row.title}» به ${faDate(next.toISOString())} منتقل شد`);
      reload();
    } catch (err) {
      notify(err?.message ?? 'جابه‌جایی انجام نشد');
    } finally {
      setBusy(false);
    }
  }, [dragId, items, notify, reload]);

  const shift = (direction) => {
    if (view === 'day') setAnchor((date) => addDays(date, direction));
    else if (view === 'week') setAnchor((date) => addDays(date, direction * 7));
    else setAnchor((date) => new Date(date.getFullYear(), date.getMonth() + direction, 1));
  };

  const heading = useMemo(() => {
    if (view === 'day') return faDate(anchor.toISOString());
    if (view === 'week') {
      const start = addDays(anchor, -faDow(anchor));
      return `${faDate(start.toISOString())} تا ${faDate(addDays(start, 6).toISOString())}`;
    }
    return toFa(new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long' }).format(anchor));
  }, [view, anchor]);

  const todayKey = dayStamp(new Date());

  /* شبکهٔ ماهانه */
  const monthCells = useMemo(() => {
    if (view !== 'month') return [];
    const start = parseDay(bounds.from);
    const cells = [];
    for (let index = 0; index < 42; index += 1) {
      const date = addDays(start, index);
      cells.push({ key: dayStamp(date), date, inMonth: date.getMonth() === anchor.getMonth() });
    }
    return cells;
  }, [view, bounds.from, anchor]);

  const weekDays = useMemo(() => {
    const start = addDays(anchor, -faDow(anchor));
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [anchor]);

  if (error && !data) return <ErrorBlock error={error} onRetry={reload} />;
  if (loading && !data) return <SkeletonCards count={4} />;

  const chip = (row) => (
    <button
      type="button"
      key={row.id}
      className={`mc-cal__chip ${dragId === row.id ? 'is-dragging' : ''}`}
      style={{ '--mc-chip': CHIP_COLOR[row.status] ?? '#937fcd' }}
      draggable
      onDragStart={() => setDragId(row.id)}
      onDragEnd={() => { setDragId(null); setDropKey(null); }}
      onClick={() => openTab('content', { action: 'open', id: row.id })}
      title={`${row.title} — ${STATUS_LABEL(config.contentStatuses, row.status)}`}
    >
      {clockTime(row.scheduledAt ?? row.publishedAt)} {row.title}
    </button>
  );

  return (
    <>
      <SectionTitle
        title="تقویم محتوا"
        hint="برای جابه‌جایی، کارت را بکشید و روی روز مقصد رها کنید"
      />

      <Panel
        title={heading}
        description={`${toFa(items.length)} محتوا در این نما`}
        actions={(
          <>
            <div className="mc-cal__view">
              {[
                { id: 'day', label: 'روزانه' },
                { id: 'week', label: 'هفتگی' },
                { id: 'month', label: 'ماهانه' },
              ].map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`mc-range ${view === row.id ? 'is-active' : ''}`}
                  onClick={() => setView(row.id)}
                >
                  {row.label}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => shift(-1)} aria-label="بازهٔ قبل">
              <IconChevron width={15} height={15} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>امروز</Button>
            <Button variant="ghost" size="sm" onClick={() => shift(1)} aria-label="بازهٔ بعد">
              <IconChevron width={15} height={15} style={{ transform: 'rotate(180deg)' }} />
            </Button>
          </>
        )}
        flush
      >
        <div className="mc-filters">
          <DebouncedInput value={search} onChange={setSearch} placeholder="جست‌وجو در تقویم…" />
          <Picker value={status} onChange={setStatus} options={config.contentStatuses} allLabel="همهٔ وضعیت‌ها" />
          <Picker value={platform} onChange={setPlatform} options={config.platforms} allLabel="همهٔ پلتفرم‌ها" />
          <span className="mc-row" style={{ gap: '0.4rem' }}>
            {Object.entries(CHIP_COLOR).filter(([id]) => ['draft', 'review', 'approved', 'scheduled', 'published', 'failed'].includes(id)).map(([id, color]) => (
              <span className="mc-legend" key={id}><i style={{ background: color }} />{STATUS_LABEL(config.contentStatuses, id)}</span>
            ))}
          </span>
        </div>

        {/* ─── نمای ماهانه ─── */}
        {view === 'month' ? (
          <div className="mc-cal__grid">
            {DOW.map((day) => <div className="mc-cal__dow" key={day}>{day}</div>)}
            {monthCells.map((cell) => {
              const rows = byDay.get(cell.key) ?? [];
              return (
                <div
                  key={cell.key}
                  className={`mc-cal__day ${cell.inMonth ? '' : 'is-out'} ${cell.key === todayKey ? 'is-today' : ''} ${dropKey === cell.key ? 'is-drop' : ''} ${faDow(cell.date) === 6 ? 'is-weekend' : ''}`}
                  onDragOver={(event) => { event.preventDefault(); setDropKey(cell.key); }}
                  onDragLeave={() => setDropKey((key) => (key === cell.key ? null : key))}
                  onDrop={() => drop(cell.key)}
                >
                  <span className="mc-cal__num">
                    <b>{toFa(cell.date.getDate())}</b>
                    {rows.length > 3 ? <span className="mc-cal__more">+{toFa(rows.length - 3)}</span> : null}
                  </span>
                  {rows.slice(0, 3).map(chip)}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* ─── نمای هفتگی ─── */}
        {view === 'week' ? (
          <div className="mc-week" style={{ padding: '0.8rem' }}>
            {weekDays.map((date) => {
              const key = dayStamp(date);
              const rows = byDay.get(key) ?? [];
              return (
                <div className="mc-week__col" key={key}>
                  <div className={`mc-week__head ${key === todayKey ? 'is-today' : ''}`}>
                    {DOW[faDow(date)]}
                    <br />
                    <b>{toFa(date.getDate())}</b>
                  </div>
                  <div
                    className={`mc-week__drop ${dropKey === key ? 'is-drop' : ''}`}
                    onDragOver={(event) => { event.preventDefault(); setDropKey(key); }}
                    onDragLeave={() => setDropKey((current) => (current === key ? null : current))}
                    onDrop={() => drop(key)}
                  >
                    {rows.map(chip)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* ─── نمای روزانه ─── */}
        {view === 'day' ? (
          <div style={{ padding: '0.9rem' }}>
            {(byDay.get(dayStamp(anchor)) ?? []).length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(byDay.get(dayStamp(anchor)) ?? []).map((row) => (
                  <div className="mc-row mc-row--between" key={row.id} style={{ padding: '0.6rem 0.7rem', border: '1px solid var(--ad-border)', borderRadius: '0.7rem' }}>
                    <span className="mc-row" style={{ gap: '0.5rem' }}>
                      <IconClock width={15} height={15} />
                      <strong>{row.title}</strong>
                      <span className="mc-muted">{labelOf(config.platforms, row.platform)} · {row.accountName}</span>
                    </span>
                    <span className="mc-row" style={{ gap: '0.4rem' }}>
                      <Pill tone={STATUS_TONE(config.contentStatuses, row.status)}>{STATUS_LABEL(config.contentStatuses, row.status)}</Pill>
                      <Button variant="ghost" size="sm" onClick={() => openTab('content', { action: 'open', id: row.id })}>باز کردن</Button>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="این روز خالی است" description="محتوایی برای این تاریخ زمان‌بندی نشده است." />
            )}
          </div>
        ) : null}
      </Panel>

      {/* ─── فهرست ردیفی همان بازه ─── */}
      <Panel title="فهرست محتوای این بازه" description="همان دادهٔ تقویم، در قالب جدول — برای وقتی می‌خواهید سریع مرور کنید" flush>
        <DataTable
          head={['عنوان', 'پلتفرم', 'اکانت', 'وضعیت', 'زمان', 'مسئول']}
          empty={<Empty title="در این بازه محتوایی نیست" description="بازه را عوض کنید یا محتوای تازه بسازید." />}
        >
          {items.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.title}</strong>
                <small>{labelOf(config.contentTypes, row.contentType)}</small>
              </td>
              <td>{row.platformLabel}</td>
              <td>{row.accountName || '—'}</td>
              <td>
                <Pill tone={STATUS_TONE(config.contentStatuses, row.status)} dot>
                  {STATUS_LABEL(config.contentStatuses, row.status)}
                </Pill>
              </td>
              <td>
                {row.scheduledAt ? (
                  <>
                    <span>{faDate(row.scheduledAt)} {clockTime(row.scheduledAt)}</span>
                    <small>{relativeTime(row.scheduledAt)}</small>
                  </>
                ) : row.publishedAt ? (
                  <>
                    <span>{faDate(row.publishedAt)} {clockTime(row.publishedAt)}</span>
                    <small>منتشر شده</small>
                  </>
                ) : <span className="mc-muted">—</span>}
              </td>
              <td>{row.authorName || '—'}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
