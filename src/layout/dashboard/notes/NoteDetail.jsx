/*
 * نمای کامل یک یادداشت — از فهرست با کلیک روی کارت باز می‌شود.
 * ویرایش/حذف/گلچین با callback به والد؛ آیتم‌های چک‌لیست اپتیمستیک تیک می‌خورند
 * (والد ابتدا state محلی را عوض می‌کند و سرویس در پس‌زمینه می‌رود).
 *
 * «پرسش و پاسخ» در همین نما حالت بازیابی فعال دارد: پاسخ‌ها پنهان‌اند و با کلیک
 * یکی‌یکی (یا همه با هم) باز می‌شوند. تپش هوشمند هم کل یادداشت را بازنویسی می‌کند.
 */
import { useEffect, useState } from 'react';
import {
  NOTE_AI_ACTIONS,
  checklistProgress,
  formatNoteDate,
  noteColor,
  relativeEditedAt,
  tagAccent,
} from '../../../services/notes/notesService';
import { DeleteButton, Icon, KindBadge, SubjectChip, TagPill, toFa } from './notesShared';

const SOURCE_LABELS = {
  lesson: 'درسنامه',
  question: 'بانک تست',
  article: 'مقاله',
  wiki: 'ویکی تپش',
  book: 'کتاب',
  other: 'سایر',
};

export default function NoteDetail({ note, onBack, onEdit, onDelete, onTogglePin, onToggleItem, onRewrite }) {
  const [revealed, setRevealed] = useState(() => new Set());
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotice, setAiNotice] = useState('');
  const [aiError, setAiError] = useState('');

  /* با عوض شدن یادداشت، حالت مرور و پنل هوشمند از صفر شروع می‌کنند */
  useEffect(() => {
    setRevealed(new Set());
    setAiOpen(false);
    setAiBusy(false);
    setAiNotice('');
    setAiError('');
  }, [note?.id]);

  if (!note) return null;

  const progress = checklistProgress(note);
  const color = noteColor(note);
  const pairs = note.pairs ?? [];
  const table = note.table ?? { columns: [], rows: [] };
  const allRevealed = pairs.length > 0 && pairs.every((pair) => revealed.has(pair.id));

  const toggleReveal = (pairId) => {
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(pairId)) next.delete(pairId);
      else next.add(pairId);
      return next;
    });
  };

  const toggleAll = () => setRevealed(allRevealed ? new Set() : new Set(pairs.map((pair) => pair.id)));

  const applyAI = async (actionId) => {
    setAiBusy(true);
    setAiError('');
    try {
      await onRewrite?.(note, actionId);
      setAiOpen(false);
      setAiNotice('یادداشت با تپش هوشمند بازنویسی شد.');
      window.setTimeout(() => setAiNotice(''), 2600);
    } catch {
      setAiError('تپش هوشمند همین حالا پاسخ نمی‌دهد؛ دوباره تلاش کن.');
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="nt-pop space-y-4">
      {/* نوار بالا: بازگشت + عملیات */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex cursor-pointer items-center gap-2 rounded-xl bg-white/[0.05] px-4 py-2.5 text-xs text-[#aaa] transition-colors hover:bg-white/[0.09] hover:text-white"
        >
          <Icon name="back" size={14} />
          بازگشت به یادداشت‌ها
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAiOpen((current) => !current)}
            aria-expanded={aiOpen}
            className={`nt-ai__btn ${aiOpen ? 'is-open' : ''}`}
          >
            <Icon name="wand" size={14} />
            تپش هوشمند
          </button>
          <button
            type="button"
            onClick={() => onTogglePin?.(note)}
            aria-pressed={note.pinned}
            aria-label={note.pinned ? 'خروج از گلچین' : 'افزودن به گلچین'}
            className={`grid h-9 w-9 cursor-pointer place-items-center rounded-xl transition-colors ${
              note.pinned
                ? 'bg-[#e0b45c]/15 text-[#e0b45c]'
                : 'bg-white/[0.05] text-[#8a8a8a] hover:bg-white/[0.09] hover:text-white'
            }`}
          >
            <Icon name={note.pinned ? 'pinFilled' : 'pin'} size={15} />
          </button>
          <button
            type="button"
            onClick={() => onEdit?.(note)}
            aria-label="ویرایش یادداشت"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl bg-white/[0.05] text-[#8a8a8a] transition-colors hover:bg-white/[0.09] hover:text-white"
          >
            <Icon name="edit" size={15} />
          </button>
          <DeleteButton onConfirm={() => onDelete?.(note)} />
        </div>
      </div>

      {/* پنل تپش هوشمند روی کل یادداشت */}
      {aiOpen && (
        <div className="nt-ai__panel">
          <p className="nt-ai__hint">می‌خواهی تپش هوشمند این یادداشت را چطور بازنویسی کند؟</p>
          <div className="nt-ai__actions mt-2">
            {NOTE_AI_ACTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                title={option.hint}
                className="nt-ai__chip"
                disabled={aiBusy}
                onClick={() => applyAI(option.id)}
              >
                {option.label}
              </button>
            ))}
            {aiBusy && (
              <span className="nt-ai__status">
                <span className="nt-ai__spinner" aria-hidden="true" />
                در حال نوشتن…
              </span>
            )}
          </div>
          {aiError && (
            <p role="alert" className="nt-ai__error">
              {aiError}
            </p>
          )}
        </div>
      )}

      {aiNotice && (
        <p role="status" className="rounded-xl bg-[#77b787]/10 px-4 py-2.5 text-xs text-[#9ed3ab]">
          {aiNotice}
        </p>
      )}

      {/* بدنهٔ یادداشت */}
      <article className="relative overflow-hidden rounded-[2.5rem] border border-white/6 bg-[#282828] p-6 md:p-10">
        <span className="absolute inset-y-0 start-0 w-1.5" style={{ background: color }} aria-hidden="true" />

        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <SubjectChip subjectId={note.subjectId} />
            <KindBadge kind={note.kind} long />
            {note.pinned && (
              <span className="flex items-center gap-1 rounded-full bg-[#e0b45c]/12 px-2.5 py-1 text-[11px] text-[#e0b45c]">
                <Icon name="pinFilled" size={11} />
                گلچین‌شده
              </span>
            )}
          </div>

          <h2 className="text-xl leading-9 [font-family:'Doran',Tahoma,sans-serif] md:text-2xl">
            {note.title || 'یادداشت بی‌عنوان'}
          </h2>

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#6d6d6d]">
            <span className="flex items-center gap-1.5">
              <Icon name="calendar" size={13} />
              ساخته‌شده: {formatNoteDate(note.createdAt)}
            </span>
            <i aria-hidden="true" className="h-1 w-1 rounded-full bg-white/20" />
            <span>آخرین ویرایش: {relativeEditedAt(note.updatedAt)}</span>
          </p>
        </header>

        {/* محتوا بر اساس حالت */}
        {note.kind === 'text' && note.body && (
          <p className="mt-6 whitespace-pre-wrap text-sm leading-8 text-[#d6d6d6]">{note.body}</p>
        )}

        {note.kind === 'checklist' && (
          <div className="mt-6">
            {/* پیشرفت چک‌لیست — رنگ هرگز تنها حامل معنا نیست؛ عدد کنارش هست */}
            <div className="mb-4 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="پیشرفت چک‌لیست">
                <span
                  className="block h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{ width: `${progress.percent}%`, background: '#77b787' }}
                />
              </div>
              <span className="text-xs text-[#8a8a8a]">
                {toFa(progress.done)} از {toFa(progress.total)} انجام شد
              </span>
            </div>

            <ul className="space-y-2">
              {(note.items ?? []).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={item.done}
                    onClick={() => onToggleItem?.(note.id, item.id)}
                    className={`flex w-full cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-right transition-colors ${
                      item.done
                        ? 'border-white/5 bg-white/[0.02] text-[#6d6d6d]'
                        : 'border-white/8 bg-white/[0.04] text-[#d6d6d6] hover:bg-white/[0.06]'
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors ${
                        item.done ? 'border-[#77b787]/70 bg-[#77b787]/25 text-[#9ed3ab]' : 'border-white/20 text-transparent'
                      }`}
                    >
                      <Icon name="check" size={12} />
                    </span>
                    <span className={`text-sm leading-7 ${item.done ? 'line-through decoration-[#77b787]/60' : ''}`}>
                      {item.text}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {note.kind === 'qa' && (
          <div className="mt-6">
            {pairs.length > 1 && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#937fcd]/25 bg-[#937fcd]/[0.07] px-4 py-3">
                <span className="flex items-center gap-2 text-[11px] text-[#b6a6e6]">
                  <Icon name="qa" size={14} />
                  حالت مرور: پاسخ‌ها پنهان‌اند تا خودت بازیابی کنی.
                </span>
                <button type="button" onClick={toggleAll} className="nt-qa__toggle">
                  <Icon name={allRevealed ? 'eyeOff' : 'eye'} size={12} />
                  {allRevealed ? 'پنهان‌کردن همهٔ پاسخ‌ها' : 'نمایش همهٔ پاسخ‌ها'}
                </button>
              </div>
            )}

            <div className="nt-qa">
              {pairs.map((pair, index) => {
                const shown = revealed.has(pair.id);
                return (
                  <article key={pair.id} className="nt-qa__item">
                    <div className="nt-qa__row">
                      <span className="nt-qa__badge">{toFa(index + 1)}</span>
                      <span className="nt-qa__text">{pair.question}</span>
                      {pair.answer ? (
                        <button type="button" className="nt-qa__toggle" aria-expanded={shown} onClick={() => toggleReveal(pair.id)}>
                          <Icon name={shown ? 'eyeOff' : 'eye'} size={12} />
                          {shown ? 'پنهان‌کردن پاسخ' : 'نمایش پاسخ'}
                        </button>
                      ) : (
                        <span className="nt-qa__empty">پاسخی ثبت نشده</span>
                      )}
                    </div>
                    {pair.answer && shown && <p className="nt-qa__answer">{pair.answer}</p>}
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {note.kind === 'table' && (
          <div className="mt-6">
            {table.columns.length > 0 ? (
              <div className="nt-table-wrap">
                <table className="nt-table">
                  <thead>
                    <tr>
                      {table.columns.map((column) => (
                        <th key={column.id} scope="col">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row) => (
                      <tr key={row.id}>
                        {table.columns.map((column) => (
                          <td key={column.id}>{row.cells?.[column.id] || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[11px] text-[#6d6d6d]">جدول خالی است.</p>
            )}
          </div>
        )}

        {/* تگ‌ها */}
        {(note.tags ?? []).length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Icon name="tag" size={14} className="text-[#5c5c5c]" />
            {note.tags.map((tag) => (
              <TagPill key={tag} tag={tag} accent={tagAccent(tag)} />
            ))}
          </div>
        )}

        {/* منبع */}
        {note.source && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#5b8cc7]/12 text-[#9cc0e8]">
              <Icon name="link" size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-[#6d6d6d]">منبع: {SOURCE_LABELS[note.source.sourceType] ?? 'سایر'}</p>
              <p className="truncate text-xs text-[#aaa]">{note.source.title}</p>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
