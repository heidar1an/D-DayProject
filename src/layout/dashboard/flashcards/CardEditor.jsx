/*
 * CardEditor — ساخت و ویرایش سریع کارت.
 * اصل: کاربر برای کارت ساده نباید فرم طولانی ببیند؛ Advanced Options جمع‌شده است.
 * انواع کارت: basic | basic-hint | cloze | mcq (معماری برای انواع بعدی باز است).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { SUBJECTS } from '../../../services/flashcards/mockData';
import { Icon, Modal, toFa } from './flashcardShared';

const CARD_TYPES = [
  { id: 'basic', label: 'پایه', note: 'سؤال و جواب' },
  { id: 'basic-hint', label: 'پایه + راهنما', note: 'با سرنخ' },
  { id: 'cloze', label: 'جای خالی', note: 'متن با {{}}' },
  { id: 'mcq', label: 'چهارگزینه‌ای', note: 'با توضیح' },
];

const SOURCE_TYPES = [
  { id: 'lesson', label: 'درسنامه' },
  { id: 'question', label: 'سؤال' },
  { id: 'article', label: 'مقاله' },
  { id: 'book', label: 'کتاب' },
  { id: 'manual', label: 'دستی' },
  { id: 'ai', label: 'هوش مصنوعی' },
  { id: 'user', label: 'خودم' },
];

function QualityHints({ front, back, type, options }) {
  /* اصول اتمیک بودن کارت — بازخورد ملایم، نه مانع */
  const hints = [];
  if (front.length > 160) hints.push('صورت کارت طولانی است؛ بهتر است فقط یک مفهوم را بپرسد.');
  if (back.length > 260) hints.push('پاسخ سنگین است؛ تقسیمش به دو کارت اتمیک یادگیری را بهتر می‌کند.');
  if (type === 'cloze' && (front.match(/\{\{c\d+::/g) ?? []).length > 4) hints.push('بیش از ۴ جای خالی در یک کارت توصیه نمی‌شود.');
  if (type === 'mcq' && (options ?? []).filter((option) => option.correct).length !== 1) hints.push('دقیقاً یک گزینهٔ صحیح علامت بزن.');

  if (!hints.length) return null;
  return (
    <ul className="space-y-1.5 rounded-2xl border border-[#e0b45c]/25 bg-[#e0b45c]/[0.06] px-4 py-3 text-xs leading-5 text-[var(--gold-ink)]" aria-live="polite">
      {hints.map((hint) => (
        <li key={hint} className="flex items-start gap-2">
          <Icon name="spark" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {hint}
        </li>
      ))}
    </ul>
  );
}

export default function CardEditor({ open, onClose, onSave, card = null, defaultDeckId = null, deckOptions = [] }) {
  const [type, setType] = useState('basic');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [hint, setHint] = useState('');
  const [tags, setTags] = useState([]);
  const [tagDraft, setTagDraft] = useState('');
  const [options, setOptions] = useState([
    { text: '', correct: true },
    { text: '', correct: false },
  ]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [subjectId, setSubjectId] = useState('');
  const [topic, setTopic] = useState('');
  const [deckId, setDeckId] = useState(defaultDeckId ?? '');
  const [imageUrl, setImageUrl] = useState('');
  const [sourceType, setSourceType] = useState('user');
  const [sourceTitle, setSourceTitle] = useState('');
  const [error, setError] = useState('');
  const frontRef = useRef(null);
  const clozeCounter = useRef(0);

  /* بارگذاری کارت موجود */
  useEffect(() => {
    if (!open) return;
    if (card) {
      setType(card.type ?? 'basic');
      setFront(card.front ?? '');
      setBack(card.back ?? '');
      setHint(card.hint ?? '');
      setTags(card.tags ?? []);
      setOptions(card.options?.length ? card.options.map((option) => ({ ...option })) : [
        { text: '', correct: true },
        { text: '', correct: false },
      ]);
      setSubjectId(card.subjectId ?? '');
      setTopic(card.topicId ?? '');
      setDeckId(card.deckId ?? defaultDeckId ?? '');
      setImageUrl(card.media?.imageUrl ?? '');
      setSourceType(card.source?.sourceType ?? 'user');
      setSourceTitle(card.source?.title ?? '');
    } else {
      setType('basic');
      setFront('');
      setBack('');
      setHint('');
      setTags([]);
      setTagDraft('');
      setOptions([
        { text: '', correct: true },
        { text: '', correct: false },
      ]);
      setSubjectId('');
      setTopic('');
      setDeckId(defaultDeckId ?? deckOptions[0]?.id ?? '');
      setImageUrl('');
      setSourceType('user');
      setSourceTitle('');
    }
    setShowAdvanced(false);
    setError('');
    clozeCounter.current = 0;
  }, [open, card, defaultDeckId, deckOptions]);

  /* افزودن جای خالی کلوز روی متن انتخابی */
  const addCloze = () => {
    const el = frontRef.current;
    if (!el) return;
    const start = el.selectionStart ?? front.length;
    const end = el.selectionEnd ?? front.length;
    const selected = front.slice(start, end) || '…';
    clozeCounter.current = Math.max(clozeCounter.current, (front.match(/\{\{c(\d+)::/g) ?? []).length) + 1;
    const wrapped = `{{c${clozeCounter.current}::${selected}}}`;
    setFront(front.slice(0, start) + wrapped + front.slice(end));
    el.focus();
  };

  const addTag = () => {
    const value = tagDraft.trim().replace(/^#/, '');
    if (value && !tags.includes(value)) setTags([...tags, value]);
    setTagDraft('');
  };

  const handleSave = async () => {
    if (!front.trim() || (!back.trim() && type !== 'mcq')) {
      setError('صورت و پاسخ کارت را پر کن.');
      return;
    }
    if (!deckId) {
      setError('یک دِک انتخاب کن.');
      return;
    }
    if (type === 'mcq' && options.filter((option) => option.text.trim() && option.correct).length !== 1) {
      setError('دقیقاً یک گزینهٔ صحیح لازم است.');
      return;
    }

    const draft = {
      deckId,
      type,
      front: front.trim(),
      back: back.trim(),
      hint: type === 'basic-hint' ? hint.trim() : null,
      tags,
      subjectId: subjectId || null,
      topicId: topic.trim() || null,
      imageUrl: imageUrl.trim() || null,
      source: { sourceType, sourceId: null, title: sourceTitle.trim() || null, url: null },
      ...(type === 'mcq' ? { options: options.filter((option) => option.text.trim()) } : {}),
    };

    try {
      await onSave(card?.id ?? null, draft);
      onClose();
    } catch {
      setError('ذخیره نشد؛ دوباره تلاش کن.');
    }
  };

  const quality = useMemo(() => <QualityHints front={front} back={back} type={type} options={options} />, [front, back, type, options]);

  return (
    <Modal open={open} onClose={onClose} title={card ? 'ویرایش کارت' : 'ساخت کارت'} wide>
      <div className="space-y-5">
        {/* نوع کارت */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {CARD_TYPES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setType(item.id)}
              aria-pressed={type === item.id}
              className={`cursor-pointer rounded-2xl border px-3 py-2.5 text-right transition-colors ${
                type === item.id ? 'border-[#5b8cc7]/60 bg-[#5b8cc7]/10' : 'border-white/10 bg-white/[0.03] hover:border-white/20'
              }`}
            >
              <span className={`block text-sm font-bold ${type === item.id ? 'text-[var(--blue-soft-ink)]' : 'text-[var(--white)]'}`}>{item.label}</span>
              <span className="block text-[10px] text-[var(--faint)]">{item.note}</span>
            </button>
          ))}
        </div>

        {/* صورت کارت */}
        <div>
          <label htmlFor="fc-front" className="mb-2 block text-xs text-[var(--muted)]">صورت کارت {type === 'cloze' && <span className="text-[var(--ghost)]">— بخش‌های «جای خالی» در مرور مخفی می‌شوند</span>}</label>
          <textarea
            id="fc-front"
            ref={frontRef}
            value={front}
            onChange={(event) => setFront(event.target.value)}
            rows={3}
            placeholder={type === 'cloze' ? 'هورمون {{c1::ADH}} باعث بازجذب آب می‌شود.' : 'مهم‌ترین تنظیم‌کننده ضربان قلب چیست؟'}
            className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-7 outline-none transition-colors placeholder:text-[var(--ghost)] focus:border-[#5b8cc7]/50"
          />
          {type === 'cloze' && (
            <button
              type="button"
              onClick={addCloze}
              className="mt-2 cursor-pointer rounded-xl bg-white/5 px-3.5 py-1.5 text-xs text-[var(--blue-soft-ink)] transition-colors hover:bg-white/10"
            >
              جای خالی از متن انتخابی
            </button>
          )}
        </div>

        {/* گزینه‌های MCQ */}
        {type === 'mcq' && (
          <div>
            <p className="mb-2 text-xs text-[var(--muted)]">گزینه‌ها — دایرهٔ کنار هر گزینه = صحیح</p>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOptions(options.map((item, i) => ({ ...item, correct: i === index })))}
                    aria-label={option.correct ? 'گزینه صحیح' : 'علامت‌گذاری به‌عنوان صحیح'}
                    aria-pressed={option.correct}
                    className={`grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full border transition-colors ${
                      option.correct ? 'border-[var(--green-bright)] bg-[#77b787]/20 text-[var(--green-soft-ink)]' : 'border-white/20 text-transparent hover:border-white/40'
                    }`}
                  >
                    <Icon name="check" className="h-3.5 w-3.5" />
                  </button>
                  <input
                    value={option.text}
                    onChange={(event) => setOptions(options.map((item, i) => (i === index ? { ...item, text: event.target.value } : item)))}
                    placeholder={`گزینهٔ ${toFa(index + 1)}`}
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-[var(--ghost)] focus:border-[#5b8cc7]/50"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setOptions(options.filter((_, i) => i !== index))}
                      aria-label="حذف گزینه"
                      className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--faint)] transition-colors hover:bg-white/5 hover:text-[var(--red-ink)]"
                    >
                      <Icon name="close" className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 6 && (
              <button
                type="button"
                onClick={() => setOptions([...options, { text: '', correct: false }])}
                className="mt-2 cursor-pointer rounded-xl bg-white/5 px-3.5 py-1.5 text-xs text-[var(--muted)] transition-colors hover:bg-white/10"
              >
                + گزینه
              </button>
            )}
          </div>
        )}

        {/* پاسخ */}
        {type !== 'mcq' && (
          <div>
            <label htmlFor="fc-back" className="mb-2 block text-xs text-[var(--muted)]">پاسخ</label>
            <textarea
              id="fc-back"
              value={back}
              onChange={(event) => setBack(event.target.value)}
              rows={3}
              placeholder={type === 'cloze' ? 'توضیح تکمیلی (اختیاری)' : 'فعالیت پاراسمپاتیک از طریق عصب واگ…'}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-7 outline-none transition-colors placeholder:text-[var(--ghost)] focus:border-[#5b8cc7]/50"
            />
          </div>
        )}


        {/* توضیح MCQ */}
        {type === 'mcq' && (
          <div>
            <label htmlFor="fc-expl" className="mb-2 block text-xs text-[var(--muted)]">توضیح پاسخ</label>
            <textarea
              id="fc-expl"
              value={back}
              onChange={(event) => setBack(event.target.value)}
              rows={2}
              placeholder="چرا این گزینه صحیح است؟"
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-7 outline-none transition-colors placeholder:text-[var(--ghost)] focus:border-[#5b8cc7]/50"
            />
          </div>
        )}

        {/* راهنما */}
        {type === 'basic-hint' && (
          <div>
            <label htmlFor="fc-hint" className="mb-2 block text-xs text-[var(--muted)]">راهنما (اختیاری)</label>
            <input
              id="fc-hint"
              value={hint}
              onChange={(event) => setHint(event.target.value)}
              placeholder="سرنخ کوچک، نه پاسخ"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-[var(--ghost)] focus:border-[#5b8cc7]/50"
            />
          </div>
        )}

        {/* تگ‌ها */}
        <div>
          <label htmlFor="fc-tag" className="mb-2 block text-xs text-[var(--muted)]">تگ‌ها</label>
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs text-[var(--muted)]">
                #{tag}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((item) => item !== tag))}
                  aria-label={`حذف تگ ${tag}`}
                  className="cursor-pointer text-[var(--ghost)] hover:text-[var(--red-ink)]"
                >
                  <Icon name="close" className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              id="fc-tag"
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
              placeholder="قلب، HighYield، اشتباهات…"
              className="min-w-32 flex-1 rounded-xl border border-white/10 bg-black/30 px-3.5 py-2 text-xs outline-none transition-colors placeholder:text-[var(--ghost)] focus:border-[#5b8cc7]/50"
            />
          </div>
        </div>

        {/* گزینه‌های پیشرفته — جمع‌شده */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            aria-expanded={showAdvanced}
            className="flex w-full cursor-pointer items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3 text-xs text-[var(--muted)] transition-colors hover:text-white"
          >
            گزینه‌های پیشرفته
            <Icon name="chevron" className={`h-4 w-4 transition-transform ${showAdvanced ? '-rotate-90' : 'rotate-90'}`} />
          </button>

          {showAdvanced && (
            <div className="fc-card-face mt-2 space-y-3 rounded-2xl border border-white/8 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="fc-deck" className="mb-1.5 block text-[11px] text-[var(--faint)]">دِک</label>
                  <select
                    id="fc-deck"
                    value={deckId}
                    onChange={(event) => setDeckId(event.target.value)}
                    className="w-full cursor-pointer rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-[#5b8cc7]/50"
                  >
                    {deckOptions.map((deck) => (
                      <option key={deck.id} value={deck.id} className="bg-[var(--surface)]">
                        {deck.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="fc-subject" className="mb-1.5 block text-[11px] text-[var(--faint)]">درس</label>
                  <select
                    id="fc-subject"
                    value={subjectId}
                    onChange={(event) => setSubjectId(event.target.value)}
                    className="w-full cursor-pointer rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-[#5b8cc7]/50"
                  >
                    <option value="" className="bg-[var(--surface)]">—</option>
                    {SUBJECTS.map((subject) => (
                      <option key={subject.id} value={subject.id} className="bg-[var(--surface)]">{subject.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="fc-topic" className="mb-1.5 block text-[11px] text-[var(--faint)]">مبحث</label>
                  <input
                    id="fc-topic"
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    placeholder="cardiac-cycle"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-[var(--ghost)] focus:border-[#5b8cc7]/50"
                  />
                </div>
                <div>
                  <label htmlFor="fc-image" className="mb-1.5 block text-[11px] text-[var(--faint)]">آدرس تصویر (اختیاری)</label>
                  <input
                    id="fc-image"
                    value={imageUrl}
                    onChange={(event) => setImageUrl(event.target.value)}
                    placeholder="https://…"
                    dir="ltr"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-[var(--ghost)] focus:border-[#5b8cc7]/50"
                  />
                </div>
              </div>

              {imageUrl.trim() && (
                <img src={imageUrl} alt="پیش‌نمایش تصویر کارت" className="max-h-40 rounded-xl border border-white/10 object-contain" />
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="fc-source-type" className="mb-1.5 block text-[11px] text-[var(--faint)]">نوع منبع</label>
                  <select
                    id="fc-source-type"
                    value={sourceType}
                    onChange={(event) => setSourceType(event.target.value)}
                    className="w-full cursor-pointer rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-[#5b8cc7]/50"
                  >
                    {SOURCE_TYPES.map((item) => (
                      <option key={item.id} value={item.id} className="bg-[var(--surface)]">{item.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="fc-source-title" className="mb-1.5 block text-[11px] text-[var(--faint)]">عنوان منبع</label>
                  <input
                    id="fc-source-title"
                    value={sourceTitle}
                    onChange={(event) => setSourceTitle(event.target.value)}
                    placeholder="کتاب Guyton — فصل ۹"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-[var(--ghost)] focus:border-[#5b8cc7]/50"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {quality}
        {error && <p className="text-xs text-[var(--red-ink)]" role="alert">{error}</p>}

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl px-5 py-2.5 text-sm text-[var(--muted)] transition-colors hover:text-white"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="cursor-pointer rounded-xl bg-[var(--blue-bright)] px-6 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 [font-family:'Doran','Vazir',Tahoma,sans-serif]"
          >
            {card ? 'ذخیره' : 'افزودن کارت'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
