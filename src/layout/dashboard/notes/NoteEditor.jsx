/*
 * مودال ساخت/ویرایش یادداشت.
 * دو نوع یادداشت: «متنی» (چندخطی) و «چک‌لیست» (آیتم‌های تیک‌خور).
 * هر یادداشت می‌تواند موضوع (از لیست ویکی)، تگ، رنگ کارت و یک منبع (درسنامه/تست/…) داشته باشد.
 * ذخیره async است و والد با onSave نتیجه را می‌گیرد؛ این کامپوننت خودش سرویس صدا نمی‌زند.
 */
import { useEffect, useMemo, useState } from 'react';
import { NOTE_COLORS, SOURCE_TYPES, SUBJECTS } from '../../../services/notes/notesService';
import { Icon, Modal } from './notesShared';

const labelClass = 'mb-2 block text-xs text-[#8a8a8a]';
const fieldClass =
  'w-full rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-[#5c5c5c] focus:border-[#5b8cc7]/60 focus:bg-white/[0.06]';

export default function NoteEditor({ open, note, allTags = [], saving = false, onSave, onClose }) {
  const isEdit = Boolean(note);

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('text');
  const [body, setBody] = useState('');
  const [items, setItems] = useState([]);
  const [subjectId, setSubjectId] = useState('general');
  const [tags, setTags] = useState([]);
  const [tagDraft, setTagDraft] = useState('');
  const [color, setColor] = useState(NOTE_COLORS[1]);
  const [hasSource, setHasSource] = useState(false);
  const [sourceType, setSourceType] = useState('lesson');
  const [sourceTitle, setSourceTitle] = useState('');
  const [error, setError] = useState('');

  /* هر بار باز شدن، فرم از صفر یا از یادداشت فعلی پر می‌شود */
  useEffect(() => {
    if (!open) return;
    setError('');
    setTagDraft('');

    if (note) {
      setTitle(note.title ?? '');
      setKind(note.kind === 'checklist' ? 'checklist' : 'text');
      setBody(note.body ?? '');
      setItems((note.items ?? []).map((item) => ({ ...item })));
      setSubjectId(note.subjectId ?? 'general');
      setTags([...(note.tags ?? [])]);
      setColor(note.color ?? NOTE_COLORS[1]);
      setHasSource(Boolean(note.source));
      setSourceType(note.source?.sourceType ?? 'lesson');
      setSourceTitle(note.source?.title ?? '');
    } else {
      setTitle('');
      setKind('text');
      setBody('');
      setItems([]);
      setSubjectId('general');
      setTags([]);
      setColor(NOTE_COLORS[1]);
      setHasSource(false);
      setSourceType('lesson');
      setSourceTitle('');
    }
  }, [open, note]);

  const tagSuggestions = useMemo(
    () => allTags.filter((tag) => !tags.includes(tag)).slice(0, 8),
    [allTags, tags],
  );

  const addTag = (raw) => {
    const tag = String(raw ?? tagDraft).trim().replace(/^#/, '');
    if (!tag) return;
    if (tags.includes(tag)) {
      setTagDraft('');
      return;
    }
    if (tags.length >= 8) {
      setError('حداکثر ۸ تگ مجاز است.');
      return;
    }
    setTags((current) => [...current, tag]);
    setTagDraft('');
    setError('');
  };

  const updateItem = (itemId, patch) => {
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    setItems((current) => [...current, { id: `ck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, text: '', done: false }]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const hasContent =
      title.trim() ||
      (kind === 'text' && body.trim()) ||
      (kind === 'checklist' && items.some((item) => item.text.trim()));

    if (!hasContent) {
      setError('برای ذخیره، حداقل یک عنوان یا محتوا لازم است.');
      return;
    }
    if (hasSource && !sourceTitle.trim()) {
      setError('عنوان منبع را بنویس یا منبع را حذف کن.');
      return;
    }
    if (kind === 'checklist' && !items.some((item) => item.text.trim())) {
      setError('حداقل یک آیتم برای چک‌لیست بنویس (آیتم خالی ذخیره نمی‌شود).');
      return;
    }

    setError('');
    await onSave?.({
      title,
      kind,
      body: kind === 'text' ? body : '',
      items: kind === 'checklist' ? items : [],
      subjectId,
      tags,
      color,
      pinned: note?.pinned ?? false,
      sourceType: hasSource ? sourceType : null,
      sourceTitle: hasSource ? sourceTitle : '',
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'ویرایش یادداشت' : 'یادداشت جدید'} wide>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* عنوان */}
        <div>
          <label className={labelClass} htmlFor="nt-editor-title">عنوان</label>
          <input
            id="nt-editor-title"
            className={fieldClass}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="مثلا: نکات چرخهٔ قلبی"
            maxLength={120}
          />
        </div>

        {/* نوع یادداشت */}
        <div>
          <span className={labelClass}>نوع یادداشت</span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="نوع یادداشت">
            {[
              { id: 'text', label: 'یادداشت متنی', icon: 'text' },
              { id: 'checklist', label: 'چک‌لیست', icon: 'list' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={kind === option.id}
                onClick={() => setKind(option.id)}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-colors [font-family:'Doran',Tahoma,sans-serif] ${
                  kind === option.id
                    ? 'border-[#5b8cc7]/70 bg-[#5b8cc7]/15 text-[#9cc0e8]'
                    : 'border-white/8 bg-white/[0.03] text-[#8a8a8a] hover:bg-white/[0.06]'
                }`}
              >
                <Icon name={option.icon} size={14} />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* محتوا بر اساس نوع */}
        {kind === 'text' ? (
          <div>
            <label className={labelClass} htmlFor="nt-editor-body">متن یادداشت</label>
            <textarea
              id="nt-editor-body"
              className={`${fieldClass} min-h-36 resize-y leading-7`}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="هر چیزی که بعداً لازم داری بنویس… (خط تیره و بولت آزاد است)"
            />
          </div>
        ) : (
          <div>
            <span className={labelClass}>آیتم‌های چک‌لیست</span>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-pressed={item.done}
                    aria-label={item.done ? 'علامت‌زدن به‌عنوان انجام‌نشده' : 'علامت‌زدن به‌عنوان انجام‌شده'}
                    onClick={() => updateItem(item.id, { done: !item.done })}
                    className={`grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg border transition-colors ${
                      item.done
                        ? 'border-[#77b787]/70 bg-[#77b787]/20 text-[#9ed3ab]'
                        : 'border-white/12 bg-white/[0.03] text-transparent hover:border-white/25'
                    }`}
                  >
                    <Icon name="check" size={13} />
                  </button>
                  <input
                    className={fieldClass}
                    value={item.text}
                    onChange={(event) => updateItem(item.id, { text: event.target.value })}
                    placeholder="آیتم جدید…"
                  />
                  <button
                    type="button"
                    aria-label="حذف آیتم"
                    onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}
                    className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg bg-white/[0.04] text-[#8a8a8a] transition-colors hover:bg-[#e26d6d]/15 hover:text-[#ef9196]"
                  >
                    <Icon name="close" size={13} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addItem}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/[0.05] px-4 py-2 text-xs text-[#aaa] transition-colors hover:bg-white/[0.09] hover:text-white"
              >
                <Icon name="plus" size={13} />
                افزودن آیتم
              </button>
            </div>
          </div>
        )}

        {/* موضوع */}
        <div>
          <span className={labelClass}>موضوع</span>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((subject) => (
              <button
                key={subject.id}
                type="button"
                aria-pressed={subjectId === subject.id}
                onClick={() => setSubjectId(subject.id)}
                className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                  subjectId === subject.id
                    ? 'border-transparent text-white'
                    : 'border-white/8 bg-white/[0.03] text-[#8a8a8a] hover:bg-white/[0.06]'
                }`}
                style={subjectId === subject.id ? { background: `${subject.accent}2e`, borderColor: `${subject.accent}66`, color: subject.accent } : undefined}
              >
                {subject.label}
              </button>
            ))}
          </div>
        </div>

        {/* تگ‌ها */}
        <div>
          <label className={labelClass} htmlFor="nt-editor-tag">تگ‌ها (حداکثر ۸)</label>
          {tags.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 rounded-full bg-white/[0.06] py-1 pe-2 ps-3 text-xs text-[#aaa]">
                  {tag}
                  <button
                    type="button"
                    aria-label={`حذف تگ ${tag}`}
                    onClick={() => setTags((current) => current.filter((row) => row !== tag))}
                    className="cursor-pointer text-[#6d6d6d] transition-colors hover:text-[#ef9196]"
                  >
                    <Icon name="close" size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              id="nt-editor-tag"
              className={fieldClass}
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addTag();
                }
              }}
              placeholder="تگ بنویس و Enter بزن"
            />
            <button
              type="button"
              onClick={() => addTag()}
              className="shrink-0 cursor-pointer rounded-xl bg-white/[0.06] px-4 text-xs text-[#aaa] transition-colors hover:bg-white/[0.1] hover:text-white"
            >
              افزودن
            </button>
          </div>
          {tagSuggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-[#5c5c5c]">پیشنهاد:</span>
              {tagSuggestions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className="cursor-pointer rounded-full border border-dashed border-white/12 px-2.5 py-0.5 text-[11px] text-[#8a8a8a] transition-colors hover:border-[#5b8cc7]/50 hover:text-[#9cc0e8]"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* رنگ کارت */}
        <div>
          <span className={labelClass}>رنگ کارت</span>
          <div className="flex items-center gap-2.5">
            {NOTE_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`رنگ ${swatch}`}
                aria-pressed={color === swatch}
                onClick={() => setColor(swatch)}
                className={`h-8 w-8 cursor-pointer rounded-full transition-transform ${
                  color === swatch ? 'scale-110 ring-2 ring-white/70 ring-offset-2 ring-offset-[#232323]' : 'opacity-70 hover:opacity-100'
                }`}
                style={{ background: swatch }}
              />
            ))}
          </div>
        </div>

        {/* منبع */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <button
            type="button"
            aria-pressed={hasSource}
            onClick={() => setHasSource((current) => !current)}
            className="flex cursor-pointer items-center gap-2 text-xs text-[#aaa] transition-colors hover:text-white"
          >
            <span
              className={`grid h-5 w-5 place-items-center rounded-md border transition-colors ${
                hasSource ? 'border-[#5b8cc7]/70 bg-[#5b8cc7]/20 text-[#9cc0e8]' : 'border-white/15 text-transparent'
              }`}
            >
              <Icon name="check" size={11} />
            </span>
            اتصال به یک منبع (درسنامه، تست، مقاله و…)
          </button>

          {hasSource && (
            <div className="mt-3 grid gap-2 md:grid-cols-[130px_1fr]">
              <select
                aria-label="نوع منبع"
                className={`${fieldClass} cursor-pointer`}
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value)}
              >
                {SOURCE_TYPES.map((type) => (
                  <option key={type.id} value={type.id} className="bg-[#232323]">
                    {type.label}
                  </option>
                ))}
              </select>
              <input
                className={fieldClass}
                value={sourceTitle}
                onChange={(event) => setSourceTitle(event.target.value)}
                placeholder="عنوان منبع؛ مثلا: درسنامهٔ جامع فیزیولوژی — فصل قلب"
              />
            </div>
          )}
        </div>

        {/* خطا و دکمه‌ها */}
        {error && (
          <p role="alert" className="rounded-xl bg-[#e26d6d]/10 px-4 py-2.5 text-xs text-[#ef9196]">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl bg-white/[0.05] px-5 py-2.5 text-xs text-[#aaa] transition-colors hover:bg-white/[0.09] hover:text-white"
          >
            انصراف
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#5b8cc7] px-6 py-2.5 text-xs font-bold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60 [font-family:'Doran',Tahoma,sans-serif]"
          >
            {saving && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
            )}
            {isEdit ? 'ذخیرهٔ تغییرات' : 'ساخت یادداشت'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
