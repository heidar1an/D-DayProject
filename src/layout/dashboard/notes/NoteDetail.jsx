/*
 * نمای کامل یک یادداشت — از فهرست با کلیک روی کارت باز می‌شود.
 * ویرایش/حذف/گلچین با callback به والد؛ آیتم‌های چک‌لیست اپتیمستیک تیک می‌خورند
 * (والد ابتدا state محلی را عوض می‌کند و سرویس در پس‌زمینه می‌رود).
 */
import {
  checklistProgress,
  formatNoteDate,
  noteColor,
  relativeEditedAt,
} from '../../../services/notes/notesService';
import { DeleteButton, Icon, KindBadge, SubjectChip } from './notesShared';

const SOURCE_LABELS = {
  lesson: 'درسنامه',
  question: 'بانک تست',
  article: 'مقاله',
  wiki: 'ویکی تپش',
  book: 'کتاب',
  other: 'سایر',
};

export default function NoteDetail({ note, onBack, onEdit, onDelete, onTogglePin, onToggleItem }) {
  if (!note) return null;

  const progress = checklistProgress(note);
  const color = noteColor(note);

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

      {/* بدنهٔ یادداشت */}
      <article className="relative overflow-hidden rounded-[2.5rem] border border-white/6 bg-[#282828] p-6 md:p-10">
        <span className="absolute inset-y-0 start-0 w-1.5" style={{ background: color }} aria-hidden="true" />

        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <SubjectChip subjectId={note.subjectId} />
            <KindBadge kind={note.kind} />
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

        {/* محتوا */}
        {note.kind === 'text' ? (
          note.body && (
            <p className="mt-6 whitespace-pre-wrap text-sm leading-8 text-[#d6d6d6]">{note.body}</p>
          )
        ) : (
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
                {progress.done} از {progress.total} انجام شد
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

        {/* تگ‌ها */}
        {(note.tags ?? []).length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Icon name="tag" size={14} className="text-[#5c5c5c]" />
            {note.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] text-[#aaa]">
                {tag}
              </span>
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
