/*
 * CardEditor — ساخت و ویرایش سریع کارت.
 * اصل: کاربر برای کارت ساده نباید فرم طولانی ببیند؛ Advanced Options جمع‌شده است.
 * انواع کارت: basic | basic-hint | cloze | mcq | image (معماری برای انواع بعدی باز است).
 * صدا و تصویر: فایل کاربر (تا ۲ مگابایت) به‌صورت Data-URL روی کارت ذخیره می‌شود؛
 * تصویر هم برای صورت کارت و هم برای پاسخ جداگانه بارگذاری می‌شود.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { SUBJECTS } from '../../../services/flashcards/mockData';
import { Icon, Modal, parseClozeBlanks, textFieldError, toFa } from './flashcardShared';

const CARD_TYPES = [
  { id: 'basic', label: 'پایه', note: 'سؤال و جواب' },
  { id: 'basic-hint', label: 'پایه + راهنما', note: 'با سرنخ' },
  { id: 'cloze', label: 'جای خالی', note: 'متن با {{}}' },
  { id: 'mcq', label: 'چهارگزینه‌ای', note: 'با توضیح' },
  { id: 'image', label: 'تصویری', note: 'کارت با عکس' },
];

/* اگر فیلد درس قبلاً به‌شکل شناسهٔ ذخیره شده باشد، برای نمایش به عنوانش تبدیل می‌شود */
const subjectLabelOf = (value) => SUBJECTS.find((subject) => subject.id === value)?.title ?? value;

/* یک جای خالی بارگذاری تصویر — پیش‌نمایش + حذف؛ فایل ≤ ۲ مگابایت به Data-URL */
function ImageSlot({ label, required = false, value, onPick, onClear }) {
  return (
    <div>
      <p className="mb-2 text-xs text-[var(--muted)]">
        {label} {required && <span className="text-[var(--red-ink)]">*</span>}
      </p>
      {value ? (
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
          <img src={value} alt={label} className="max-h-44 w-full object-contain" />
          <button
            type="button"
            onClick={onClear}
            aria-label={`حذف ${label}`}
            title="حذف تصویر"
            className="absolute left-2 top-2 grid h-8 w-8 cursor-pointer place-items-center rounded-lg bg-black/70 text-[var(--muted)] transition-colors hover:text-[var(--red-ink)]"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-xs text-[var(--faint)] transition-colors hover:border-[#5b8cc7]/40 hover:text-white">
          <Icon name="image" className="h-4 w-4" />
          بارگذاری تصویر
          <input type="file" accept="image/*" onChange={onPick} className="hidden" />
        </label>
      )}
    </div>
  );
}

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
  if (type === 'cloze') {
    const blanks = parseClozeBlanks(front);
    if (blanks.length > 4) hints.push('بیش از ۴ جای خالی در یک کارت توصیه نمی‌شود.');
    const emptyBlank = blanks.find((blank) => !blank.content.trim() || blank.content.trim() === '…');
    if (emptyBlank) hints.push(`پاسخ جای خالی ${toFa(emptyBlank.index)} هنوز خالی است؛ در بخش پاسخ بنویسش.`);
  }
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

const MAX_AUDIO_BYTES = 2 * 1024 * 1024; /* سقف ذخیره‌سازی محلی — localStorage محدود است */

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
  const [frontImageUrl, setFrontImageUrl] = useState('');
  const [backImageUrl, setBackImageUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
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
      setSubjectId(card.subjectId ? subjectLabelOf(card.subjectId) : '');
      setTopic(card.topicId ?? '');
      setDeckId(card.deckId ?? defaultDeckId ?? '');
      setFrontImageUrl(card.media?.frontImageUrl ?? card.media?.imageUrl ?? '');
      setBackImageUrl(card.media?.backImageUrl ?? '');
      setAudioUrl(card.media?.audioUrl ?? '');
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
      /* مجموعه به‌صورت خودکار پر نمی‌شود: مقصد ذخیره باید انتخابِ آگاه کاربر باشد
         (فقط وقتی از داخل یک مجموعه باز شده، `defaultDeckId` از قبل نشسته است). */
      setDeckId(defaultDeckId ?? '');
      setFrontImageUrl('');
      setBackImageUrl('');
      setAudioUrl('');
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
    /* شمارهٔ بعدی = بیشترین شمارهٔ موجود + ۱؛ شمارشِ تعداد بعد از حذف یک جای خالی، شمارهٔ تکراری می‌ساخت */
    const maxIndex = Math.max(0, ...[...front.matchAll(/\{\{c(\d+)::/g)].map((match) => Number(match[1])));
    clozeCounter.current = Math.max(clozeCounter.current, maxIndex) + 1;
    const wrapped = `{{c${clozeCounter.current}::${selected}}}`;
    setFront(front.slice(0, start) + wrapped + front.slice(end));
    el.focus();
  };

  /* جای خالی‌های صورت کارت — مبنای کادرهای پاسخ پایین‌تر */
  const clozeBlanks = type === 'cloze' ? parseClozeBlanks(front) : [];

  /* ویرایش پاسخ هر جای خالی، مستقیم روی سینتکس {{cN::…}} در صورت کارت می‌نویسد
     تا پاسخ و صورت کارت همیشه یک منبع واحد داشته باشند (جای خالیِ بی‌پاسخ در مرور بی‌جواب نمی‌ماند) */
  const setBlankContent = (blankIndex, value) => {
    const regex = new RegExp(`\\{\\{c${blankIndex}::(.*?)\\}\\}`, 'g');
    setFront(front.replace(regex, () => `{{c${blankIndex}::${value}}}`));
  };

  const addTag = () => {
    const value = tagDraft.trim().replace(/^#/, '');
    if (value && !tags.includes(value)) setTags([...tags, value]);
    setTagDraft('');
  };

  /* فایل صوتی کاربر → Data-URL؛ اعتبارسنجی نوع و حجم پیش از خواندن */
  const handleAudioFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; /* انتخاب دوبارهٔ همان فایل هم کار کند */
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setError('یک فایل صوتی انتخاب کن (mp3، m4a، ogg و…).');
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setError('حجم فایل صوتی باید کمتر از ۲ مگابایت باشد.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAudioUrl(String(reader.result));
      setError('');
    };
    reader.onerror = () => setError('خواندن فایل صوتی نشد؛ دوباره تلاش کن.');
    reader.readAsDataURL(file);
  };

  /* فایل تصویری کاربر (صورت یا پاسخ کارت) → Data-URL با همان سقف ۲ مگابایت */
  const handleImageFile = (kind) => (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('یک فایل تصویری انتخاب کن (jpg، png، webp و…).');
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setError('حجم تصویر باید کمتر از ۲ مگابایت باشد.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (kind === 'front') setFrontImageUrl(String(reader.result));
      else setBackImageUrl(String(reader.result));
      setError('');
    };
    reader.onerror = () => setError('خواندن فایل تصویری نشد؛ دوباره تلاش کن.');
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const subjectError = textFieldError(subjectId);
    if (subjectError) {
      setError(subjectError);
      return;
    }
    if (type === 'image' && !frontImageUrl) {
      setError('برای کارت تصویری، عکسِ صورت کارت را بارگذاری کن.');
      return;
    }
    if (type !== 'image' && !front.trim()) {
      setError('صورت کارت را پر کن.');
      return;
    }
    if (type === 'cloze') {
      if (!clozeBlanks.length) {
        setError('حداقل یک جای خالی در صورت کارت تعریف کن — متنی را انتخاب و «جای خالی از متن انتخابی» را بزن.');
        return;
      }
      const emptyBlank = clozeBlanks.find((blank) => !blank.content.trim() || blank.content.trim() === '…');
      if (emptyBlank) {
        setError(`پاسخ جای خالی ${toFa(emptyBlank.index)} را در بخش پاسخ بنویس.`);
        return;
      }
    }
    if (!back.trim() && type !== 'mcq' && type !== 'cloze') {
      setError('پاسخ کارت را پر کن.');
      return;
    }
    if (!deckId) {
      setError('مجموعه مقصد را انتخاب کن — کارت بدون مجموعه ذخیره نمی‌شود.');
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
      subjectId: subjectId.trim() || null,
      topicId: topic.trim() || null,
      media: {
        frontImageUrl: frontImageUrl || null,
        backImageUrl: backImageUrl || null,
        audioUrl: audioUrl || null,
      },
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
        {/* مجموعه — اولین فیلد و اجباری: مقصد ذخیره از همان ابتدا روشن است، نه در گزینه‌های پیشرفته */}
        <div>
          <label htmlFor="fc-deck" className="mb-2 block text-xs text-[var(--muted)]">
            مجموعه <span className="text-[var(--red-ink)]">*</span>
          </label>
          <select
            id="fc-deck"
            value={deckId}
            onChange={(event) => setDeckId(event.target.value)}
            aria-required="true"
            className={`w-full cursor-pointer rounded-xl border bg-black/30 px-3.5 py-3 text-sm outline-none transition-colors focus:border-[#5b8cc7]/50 ${
              deckId ? 'border-white/10' : 'border-[#ef9196]/60'
            }`}
          >
            <option value="" disabled className="bg-[var(--surface)]">
              انتخاب مجموعه…
            </option>
            {deckOptions.map((deck) => (
              <option key={deck.id} value={deck.id} className="bg-[var(--surface)]">
                {deck.title}
              </option>
            ))}
          </select>
          {deckOptions.length === 0 ? (
            <p className="mt-1.5 text-[11px] leading-5 text-[var(--gold-ink)]">
              هنوز مجموعه‌ای نداری؛ اول از بخش «مجموعه‌های من» یک مجموعه بساز، بعد کارتت را در آن ذخیره کن.
            </p>
          ) : (
            !deckId && <p className="mt-1.5 text-[11px] text-[var(--ghost)]">کارت داخل مجموعه‌ای که اینجا انتخاب می‌کنی ذخیره می‌شود.</p>
          )}
        </div>

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

        {/* صورت کارت — در کارت تصویری، متن اختیاری است و عکس نقش اصلی را دارد */}
        <div>
          <label htmlFor="fc-front" className="mb-2 block text-xs text-[var(--muted)]">
            صورت کارت {type === 'cloze' && <span className="text-[var(--ghost)]">— بخش‌های «جای خالی» در مرور مخفی می‌شوند</span>}
            {type === 'image' && <span className="text-[var(--ghost)]">— اختیاری؛ عکس زیر را همراهی می‌کند</span>}
          </label>
          <textarea
            id="fc-front"
            ref={frontRef}
            value={front}
            onChange={(event) => setFront(event.target.value)}
            rows={3}
            placeholder={type === 'cloze' ? 'هورمون {{c1::ADH}} باعث بازجذب آب می‌شود.' : type === 'image' ? 'مثلاً: این ساختار کجاست؟' : 'مهم‌ترین تنظیم‌کننده ضربان قلب چیست؟'}
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

        {/* پاسخ — در کارت کلوز به تعداد جای خالی‌های صورت کارت، کادر پاسخ جداگانه ساخته می‌شود */}
        {type === 'cloze' && (
          <div>
            <p className="mb-2 text-xs text-[var(--muted)]">
              پاسخ جای خالی‌ها <span className="text-[var(--ghost)]">— به تعداد جای خالی‌های صورت کارت</span>
            </p>
            {clozeBlanks.length > 0 ? (
              <div className="space-y-2">
                {clozeBlanks.map((blank) => (
                  <div key={blank.index} className="flex items-center gap-2">
                    <span className="shrink-0 rounded-lg bg-white/5 px-2.5 py-2 text-[11px] text-[var(--muted)]">
                      جای خالی {toFa(blank.index)}
                    </span>
                    <input
                      value={blank.content}
                      onChange={(event) => setBlankContent(blank.index, event.target.value)}
                      placeholder={`پاسخ جای خالی ${toFa(blank.index)}`}
                      aria-label={`پاسخ جای خالی ${toFa(blank.index)}`}
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-[var(--ghost)] focus:border-[#5b8cc7]/50"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-xs leading-5 text-[var(--faint)]">
                هنوز جای خالی‌ای تعریف نشده — در صورت کارت متنی را انتخاب کن و دکمهٔ «جای خالی از متن انتخابی» را بزن تا کادر پاسخش همین‌جا ساخته شود.
              </p>
            )}
            <label htmlFor="fc-back" className="mb-2 mt-4 block text-xs text-[var(--muted)]">توضیح تکمیلی (اختیاری)</label>
            <textarea
              id="fc-back"
              value={back}
              onChange={(event) => setBack(event.target.value)}
              rows={2}
              placeholder="نکته‌ای که بعد از پاسخ جای خالی‌ها نمایش داده می‌شود…"
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-7 outline-none transition-colors placeholder:text-[var(--ghost)] focus:border-[#5b8cc7]/50"
            />
          </div>
        )}

        {type !== 'mcq' && type !== 'cloze' && (
          <div>
            <label htmlFor="fc-back" className="mb-2 block text-xs text-[var(--muted)]">پاسخ</label>
            <textarea
              id="fc-back"
              value={back}
              onChange={(event) => setBack(event.target.value)}
              rows={3}
              placeholder="فعالیت پاراسمپاتیک از طریق عصب واگ…"
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

        {/* تصاویر کارت — هم صورت و هم پاسخ؛ فایل تا ۲ مگابایت */}
        <div>
          <p className="mb-2 text-xs text-[var(--muted)]">
            تصاویر کارت {type === 'image' && <span className="text-[var(--ghost)]">— برای نوع تصویری، عکس صورت لازم است</span>}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ImageSlot
              label="تصویر صورت کارت"
              required={type === 'image'}
              value={frontImageUrl}
              onPick={handleImageFile('front')}
              onClear={() => setFrontImageUrl('')}
            />
            <ImageSlot
              label="تصویر پاسخ"
              value={backImageUrl}
              onPick={handleImageFile('back')}
              onClear={() => setBackImageUrl('')}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-[var(--ghost)]">حداکثر ۲ مگابایت برای هر تصویر — در مرور بالای صورت کارت و داخل پاسخ نمایش داده می‌شود.</p>
        </div>

        {/* صدا — بارگذاری فایل صوتی توسط کاربر */}
        <div>
          <p className="mb-2 text-xs text-[var(--muted)]">صدا (اختیاری)</p>
          {audioUrl ? (
            <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-black/30 px-3.5 py-2.5">
              <Icon name="volume" className="h-4 w-4 shrink-0 text-[var(--blue-soft-ink)]" />
              <audio controls src={audioUrl} className="h-9 min-w-0 flex-1" aria-label="پیش‌نمایش صدای کارت" />
              <button
                type="button"
                onClick={() => setAudioUrl('')}
                aria-label="حذف صدای کارت"
                title="حذف صدا"
                className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--faint)] transition-colors hover:bg-white/5 hover:text-[var(--red-ink)]"
              >
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-xs text-[var(--muted)] transition-colors hover:bg-white/10 hover:text-white">
              <Icon name="volume" className="h-4 w-4 text-[var(--blue-soft-ink)]" />
              بارگذاری فایل صوتی
              <input type="file" accept="audio/*" onChange={handleAudioFile} className="hidden" />
            </label>
          )}
          <p className="mt-1.5 text-[10px] text-[var(--ghost)]">حداکثر ۲ مگابایت — در مرور با دکمهٔ پخش یا خودکار (تنظیمات) پخش می‌شود.</p>
        </div>

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
              <div>
                <label htmlFor="fc-subject" className="mb-1.5 block text-[11px] text-[var(--faint)]">درس</label>
                <input
                  id="fc-subject"
                  value={subjectId}
                  onChange={(event) => setSubjectId(event.target.value)}
                  placeholder="مثلاً فیزیولوژی"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-[var(--ghost)] focus:border-[#5b8cc7]/50"
                />
                <p className="mt-1.5 text-[10px] text-[var(--ghost)]">فقط حروف فارسی یا انگلیسی — استفاده از عدد و نماد غیرعادی مجاز نیست.</p>
                {textFieldError(subjectId) && <p className="mt-1 text-[11px] text-[var(--red-ink)]" role="alert">{textFieldError(subjectId)}</p>}
              </div>

              <div>
                <label htmlFor="fc-topic" className="mb-1.5 block text-[11px] text-[var(--faint)]">مبحث</label>
                <input
                  id="fc-topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="چرخهٔ قلبی"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-[var(--ghost)] focus:border-[#5b8cc7]/50"
                />
              </div>

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
