/*
 * کتابخانهٔ فلش‌کارت تپش — مدیریت مجموعه‌های رسمی.
 *
 * این فایل یک «لایهٔ داخل پنل» است: از کارت فلش‌کارت در بخش «صفحات»
 * (`navigate('flashcard-library')`) باز می‌شود و `onBack` آن را به همان بخش
 * برمی‌گرداند. در سایدبار آیتم جداگانه‌ای ندارد و آیتم «صفحات» فعال می‌ماند.
 *
 * هر مجموعه (دک) یا «عادی» است (کارت‌های متنی: basic/cloze/mcq) یا «آناتومی
 * تصویری» (کارت‌های image-locate: نقطهٔ مشخص‌شده روی تصویر). انتشار یک دک
 * (status: published) یعنی همان دک در «کتابخانهٔ تپش» بخش فلش‌کارت داشبورد
 * کاربران ظاهر می‌شود — شکل داده با قرارداد سرویس فلش‌کارت کاربر یکی است.
 * عمل «ارسال به کاربران تپش» در همین فایل فقط وضعیت را published می‌کند؛
 * مسیر تحویل به کاربر همان `/api/public/flashcards/library` است.
 *
 * کارت‌ها داخل فرم دک ویرایش می‌شوند و با کل رکورد ذخیره می‌شوند؛ نقطه‌های
 * کارت تصویری با کلیک روی پیش‌نمایش تصویر ثبت می‌شوند (درصدی، ۰ تا ۱۰۰).
 */

import { useCallback, useEffect, useState } from 'react';

import { flashcards as flashcardsApi } from '../../../services/admin/adminService';
import { DECK_COLORS, SUBJECTS } from '../../../services/flashcards/mockData';
import {
  Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input, LoadingBlock,
  Modal, SearchInput, Select, StatusBadge, TableWrap, Textarea, Toggle, faDateTime, faNumber,
  useAsync, useToast,
} from '../adminShared';
import { IconChevron, IconEdit, IconPlus, IconRefresh, IconSend, IconTrash } from '../adminIcons';
import MediaPicker from '../MediaPicker';

const STATUS_OPTIONS = [
  { value: 'all', label: 'همهٔ وضعیت‌ها' },
  { value: 'published', label: 'منتشرشده' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'archived', label: 'بایگانی' },
];

const KIND_OPTIONS = [
  { value: 'all', label: 'همهٔ مجموعه‌ها' },
  { value: 'normal', label: 'عادی' },
  { value: 'anatomy', label: 'آناتومی تصویری' },
];

/*
 * وضعیت انتشار — سه انتخاب صریح کنار دکمهٔ «تأیید تغییرات».
 * «انتشار برای کاربران» تنها راهی است که مجموعه در کتابخانهٔ کاربران دیده می‌شود.
 */
export const PUBLISH_OPTIONS = [
  { value: 'published', label: 'انتشار برای کاربران', hint: 'مجموعه در کتابخانهٔ فلش‌کارت کاربران تپش نمایش داده می‌شود.' },
  { value: 'draft', label: 'پیش‌نویس', hint: 'فقط در پنل می‌ماند و برای کاربران دیده نمی‌شود.' },
  { value: 'archived', label: 'بایگانی', hint: 'از کتابخانهٔ کاربران برداشته می‌شود؛ رکورد و کارت‌ها می‌مانند.' },
];

const SUBJECT_OPTIONS = [
  { value: '', label: 'انتخاب موضوع…' },
  ...SUBJECTS.map((subject) => ({ value: subject.id, label: subject.title })),
];

const EMPTY_CARD = (anatomy) => ({
  id: null,
  type: anatomy ? 'image-locate' : 'basic',
  front: '',
  back: '',
  hint: '',
  tags: [],
  subjectId: 'general',
  topicId: '',
  explanation: '',
  image: anatomy ? { url: '', alt: '', points: [] } : undefined,
  options: [],
});

const EMPTY_DECK = {
  title: '',
  description: '',
  shortTitle: '',
  subjectId: 'anatomy',
  level: 'علوم پایه',
  cover: DECK_COLORS[1],
  anatomy: false,
  previewImage: '',
  status: 'draft',
  cards: [],
};

function newDeckForm() {
  return { ...EMPTY_DECK, cover: DECK_COLORS[Math.floor(Math.random() * DECK_COLORS.length)], cards: [] };
}

/*
 * تصمیم خالص «آیا این مجموعه را می‌توان به کاربران تپش فرستاد؟»
 *
 * دو شرط دارد: مجموعه قبلاً منتشر نشده باشد (منتشرشده = همان لحظه فرستاده شده)
 * و مدیر دسترسی `flashcards.publish` داشته باشد. بیرون از JSX نگه داشته شده تا
 * بدون مرورگر هم قابل سنجش باشد.
 */
export function canSendDeck(deck, permissions = []) {
  return Boolean(deck)
    && deck.status !== 'published'
    && (permissions ?? []).includes('flashcards.publish');
}

/* ── ویرایشگر یک کارت — همان تجربهٔ کاربران، داخل پنل ── */

/*
 * انواع کارت — همان پنج چیپی که کاربر در «کارت جدید» می‌بیند.
 *
 * سرور چهار نوع می‌شناسد (`FLASHCARD_CARD_TYPES` در `contentStore.js`):
 * `basic | cloze | mcq | image-locate`. «پایه + راهنما» یک نوع مستقل نیست،
 * همان `basic` است که `hint` دارد؛ نگاشت دوطرفه‌اش در `cardTypeOf`/`toStoredType`
 * انجام می‌شود تا رفت‌وبرگشت داده چیزی از دست ندهد.
 */
const CARD_TYPES = [
  { id: 'basic', label: 'پایه', note: 'پرسش و پاسخ' },
  { id: 'basic-hint', label: 'پایه + راهنما', note: 'با سرنخ' },
  { id: 'cloze', label: 'جای خالی', note: 'متن با {{}}' },
  { id: 'mcq', label: 'چهارگزینه‌ای', note: 'با توضیح' },
  { id: 'image-locate', label: 'تصویری', note: 'نقطه روی عکس' },
];

/* نوع نمایشی کارت از رکورد ذخیره‌شده (`basic` + `hint` = «پایه + راهنما») */
export function cardTypeOf(card) {
  if (card?.type === 'basic' && String(card?.hint ?? '').trim()) return 'basic-hint';
  return card?.type ?? 'basic';
}

/* نوعی که سرور می‌فهمد */
export function toStoredType(displayType) {
  return displayType === 'basic-hint' ? 'basic' : displayType;
}

/* جای خالی‌های `{{c1::…}}` — همان قالب رابط کاربران */
export function parseClozeBlanks(text) {
  const blanks = [];
  const regex = /\{\{c(\d+)::(.*?)\}\}/g;
  let match = regex.exec(text ?? '');
  while (match) {
    blanks.push({ index: Number(match[1]), content: match[2] });
    match = regex.exec(text ?? '');
  }
  return blanks;
}

/*
 * بازخورد کیفیت کارت — همان اصول کارت اتمیکِ رابط کاربران، به‌شکل تابع خالص
 * تا بدون مرورگر هم قابل سنجش باشد. بازخورد است، نه مانع.
 */
export function cardQualityHints(card) {
  const hints = [];
  const front = String(card?.front ?? '');
  const back = String(card?.back ?? '');
  const display = cardTypeOf(card);

  if (front.length > 160) hints.push('صورت کارت طولانی است؛ بهتر است فقط یک مفهوم را بپرسد.');
  if (back.length > 260) hints.push('پاسخ سنگین است؛ تقسیمش به دو کارت اتمیک یادگیری را بهتر می‌کند.');

  if (display === 'cloze') {
    const blanks = parseClozeBlanks(front);
    if (!blanks.length) hints.push('برای کارت جای خالی، بخشی از متن را داخل {{c1::…}} بگذار.');
    if (blanks.length > 4) hints.push('بیش از ۴ جای خالی در یک کارت توصیه نمی‌شود.');
    if (blanks.some((blank) => !blank.content.trim())) hints.push('یک جای خالی خالی است؛ پاسخش را داخل {{}} بنویس.');
  }

  if (display === 'mcq') {
    const correct = (card?.options ?? []).filter((option) => option.correct).length;
    if (correct !== 1) hints.push('دقیقاً یک گزینهٔ صحیح علامت بزن.');
  }

  if (display === 'image-locate') {
    if (!card?.image?.url) hints.push('تصویر کارت انتخاب نشده است.');
    else if ((card?.image?.points ?? []).length === 0) hints.push('روی تصویر کلیک کن و نقطهٔ ساختار را مشخص کن.');
  }

  if (!front.trim() && display !== 'image-locate') hints.push('صورت کارت خالی است.');

  return hints;
}

/*
 * اعتبارسنجی مجموعه پیش از «تأیید تغییرات» — خالص، تا بدون مرورگر هم سنجیده شود.
 *
 * این‌ها **مانع ذخیره**اند (برخلاف `cardQualityHints` که فقط بازخورد است). سرور هم
 * کارت بی‌صورت را دور می‌ریزد و عنوان را الزامی می‌داند؛ اگر اینجا گرفته نشود،
 * کاربر «ذخیره شد» می‌بیند ولی کارتش بی‌صدا حذف شده است.
 */
export function validateDeck(deck) {
  const problems = [];
  if (!String(deck?.title ?? '').trim()) problems.push('عنوان مجموعه را وارد کنید.');

  const cards = Array.isArray(deck?.cards) ? deck.cards : [];
  if (!cards.length) problems.push('مجموعه باید حداقل یک کارت داشته باشد.');

  cards.forEach((card, index) => {
    const label = 'کارت ' + faNumber(index + 1);
    const display = cardTypeOf(card);
    const front = String(card?.front ?? '').trim();
    const back = String(card?.back ?? '').trim();

    if (!front) problems.push(label + ': صورت کارت خالی است.');
    if (!back && display !== 'mcq') problems.push(label + ': پاسخ کارت خالی است.');

    if (display === 'cloze' && !parseClozeBlanks(card.front).length) {
      problems.push(label + ': کارت جای خالی باید دست‌کم یک {{c1::…}} داشته باشد.');
    }

    if (display === 'mcq') {
      const filled = (card?.options ?? []).filter((option) => String(option.text ?? '').trim());
      if (filled.length < 2) problems.push(label + ': حداقل دو گزینه لازم است.');
      if (filled.filter((option) => option.correct).length !== 1) problems.push(label + ': دقیقاً یک گزینهٔ صحیح علامت بزن.');
    }

    if (display === 'image-locate') {
      if (!card?.image?.url) problems.push(label + ': تصویر انتخاب نشده است.');
      else if (!(card?.image?.points ?? []).length) problems.push(label + ': روی تصویر نقطه مشخص نکن.');
    }
  });

  return problems;
}

function CardEditor({ card, onChange, onRemove, onPickImage, index }) {
  const displayType = cardTypeOf(card);
  const hints = cardQualityHints(card);
  const blanks = displayType === 'cloze' ? parseClozeBlanks(card.front) : [];

  const setImage = (changes) => onChange({ ...card, image: { ...(card.image ?? { url: '', alt: '', points: [] }), ...changes } });
  const setOption = (optionIndex, changes) => onChange({
    ...card,
    options: card.options.map((option, i) => (i === optionIndex ? { ...option, ...changes } : option)),
  });

  const changeType = (next) => {
    onChange({
      ...card,
      type: toStoredType(next),
      /* «پایه» راهنما ندارد؛ اگر پاک نشود `cardTypeOf` دوباره «پایه + راهنما» می‌خواند
         و چیپ انتخاب‌شده با چیپ فعال نمی‌خواند. */
      hint: next === 'basic' ? '' : (card.hint ?? ''),
      image: next === 'image-locate' ? (card.image ?? { url: '', alt: '', points: [] }) : card.image,
      options: next === 'mcq' && card.options.length === 0
        ? [{ text: '', correct: true }, { text: '', correct: false }]
        : card.options,
    });
  };

  const addPoint = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * 100);
    setImage({ points: [...(card.image?.points ?? []), { x, y }].slice(0, 4) });
  };

  return (
    <div className="ad-fccard">
      <div className="ad-fccard__head">
        <strong>کارت {faNumber(index + 1)}</strong>
        <IconButton label="حذف کارت" tone="danger" onClick={onRemove}><IconTrash width={15} height={15} /></IconButton>
      </div>

      {/* انتخاب نوع کارت — چیپ، مثل رابط کاربران (نه فهرست کشویی) */}
      <div className="ad-chiprow" role="group" aria-label="نوع کارت">
        {CARD_TYPES.map((type) => (
          <button
            type="button"
            key={type.id}
            className={`ad-chip ${displayType === type.id ? 'is-active' : ''}`}
            onClick={() => changeType(type.id)}
            aria-pressed={displayType === type.id}
            title={type.note}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* پیش‌نمایش زنده — همان چیزی که کاربر در مرور می‌بیند */}
      <div className="ad-fccard__preview">
        <div className="ad-fccard__face">
          <span className="ad-fccard__sub">روی کارت</span>
          <p>{card.front.trim() || '—'}</p>
        </div>
        <div className="ad-fccard__face ad-fccard__face--back">
          <span className="ad-fccard__sub">پشت کارت</span>
          <p>{card.back.trim() || '—'}</p>
        </div>
      </div>

      <Field label="روی کارت (پرسش)" required>
        <Textarea rows={2} value={card.front} onChange={(event) => onChange({ ...card, front: event.target.value })} />
      </Field>
      <Field label="پشت کارت (پاسخ)" required>
        <Textarea rows={2} value={card.back} onChange={(event) => onChange({ ...card, back: event.target.value })} />
      </Field>

      {displayType === 'basic-hint' ? (
        <Field label="راهنما (سرنخ)" hint="پیش از دیدن پاسخ به کاربر نشان داده می‌شود">
          <Input value={card.hint ?? ''} onChange={(event) => onChange({ ...card, hint: event.target.value })} />
        </Field>
      ) : null}

      {displayType === 'cloze' ? (
        <div className="ad-fccard__blanks" aria-live="polite">
          <span className="ad-fccard__sub">جای خالی‌ها</span>
          {blanks.length ? (
            <span className="ad-chiprow">
              {blanks.map((blank) => (
                <span key={blank.index} className="ad-fccard__blank">
                  {faNumber(blank.index)}: {blank.content.trim() || '—'}
                </span>
              ))}
            </span>
          ) : (
            <span className="ad-sub">{'هنوز جای خالی نداری — مثلاً: {{c1::گره سینوسی}}'}</span>
          )}
        </div>
      ) : null}

      {card.type === 'mcq' ? (
        <Field label="گزینه‌ها" hint="گزینهٔ درست را علامت بزن.">
          <div className="ad-stack ad-stack--narrow">
            {card.options.map((option, optionIndex) => (
              <div key={optionIndex} className="ad-fccard__option">
                <input
                  type="radio"
                  name={`fc-correct-${index}`}
                  checked={option.correct}
                  onChange={() => onChange({ ...card, options: card.options.map((o, i) => ({ ...o, correct: i === optionIndex })) })}
                  aria-label="گزینهٔ درست"
                />
                <Input value={option.text} onChange={(event) => setOption(optionIndex, { text: event.target.value })} placeholder={`گزینهٔ ${faNumber(optionIndex + 1)}…`} />
                <IconButton label="حذف گزینه" tone="danger" onClick={() => onChange({ ...card, options: card.options.filter((_, i) => i !== optionIndex) })}>
                  <IconTrash width={14} height={14} />
                </IconButton>
              </div>
            ))}
            {card.options.length < 6 ? (
              <Button variant="ghost" size="sm" onClick={() => onChange({ ...card, options: [...card.options, { text: '', correct: false }] })}>
                <IconPlus width={14} height={14} /> گزینه
              </Button>
            ) : null}
          </div>
        </Field>
      ) : null}

      {card.type === 'image-locate' ? (
        <>
          <Field label="تصویر" hint="از کتابخانهٔ رسانه انتخاب کنید.">
            <div className="ad-fccard__option">
              <Input dir="ltr" value={card.image?.url ?? ''} onChange={(event) => setImage({ url: event.target.value })} placeholder="/uploads/…" />
              <Button variant="ghost" size="sm" onClick={onPickImage}>انتخاب</Button>
            </div>
          </Field>
          {card.image?.url ? (
            <div className="ad-fccard__canvas-wrap">
              <img
                src={card.image.url}
                alt={card.image.alt || 'تصویر کارت'}
                className="ad-fccard__canvas"
                onClick={addPoint}
                title="برای ثبت نقطهٔ ساختار روی تصویر کلیک کنید"
              />
              {(card.image?.points ?? []).map((point, pointIndex) => (
                <button
                  type="button"
                  key={pointIndex}
                  className="ad-fccard__point"
                  /*
                   * `left` عمداً فیزیکی است نه `inset-inline-start`: تصویر با
                   * `direction: rtl` آینه نمی‌شود و `x` هم از لبهٔ چپِ تصویر
                   * حساب شده؛ با ویژگی منطقی، نقطه در RTL آینه می‌شد.
                   */
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  onClick={() => setImage({ points: card.image.points.filter((_, i) => i !== pointIndex) })}
                  title="حذف نقطه"
                  aria-label={`حذف نقطهٔ ${faNumber(pointIndex + 1)}`}
                />
              ))}
            </div>
          ) : null}
          <Field label="متن جانشین تصویر">
            <Input value={card.image?.alt ?? ''} onChange={(event) => setImage({ alt: event.target.value })} placeholder="مثلاً: نمای قدامی قلب" />
          </Field>
        </>
      ) : null}

      {hints.length ? (
        <ul className="ad-fccard__hints" aria-live="polite">
          {hints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      ) : null}

      <div className="ad-grid2">
        <Field label="برچسب‌ها" hint="با کاما جدا کنید">
          <Input
            value={(card.tags ?? []).join('، ')}
            onChange={(event) => onChange({ ...card, tags: event.target.value.split(/[،,]/).map((tag) => tag.trim()).filter(Boolean) })}
          />
        </Field>
        <Field label="موضوع (topicId)" hint="اختیاری — برای فیلتر موضوعی">
          <Input dir="ltr" value={card.topicId ?? ''} onChange={(event) => onChange({ ...card, topicId: event.target.value })} />
        </Field>
      </div>
    </div>
  );
}

/* ── ویرایشگر دک (فرم اصلی) ── */

function DeckEditor({ deckId, onClose, onSaved, notify }) {
  const isNew = !deckId;
  const [form, setForm] = useState(isNew ? newDeckForm() : null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null); // 'preview' | index کارت

  useEffect(() => {
    if (isNew) return undefined;
    let alive = true;
    flashcardsApi.get(deckId)
      .then((data) => { if (alive) setForm({ ...EMPTY_DECK, ...data.deck }); })
      .catch((error) => { notify(error.message, 'error'); if (alive) onClose(); });
    return () => { alive = false; };
  }, [deckId]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setCard = (index, card) => setForm((current) => ({
    ...current,
    cards: current.cards.map((item, i) => (i === index ? card : item)),
  }));

  /*
   * «تأیید تغییرات» — تنها راه ذخیره.
   *
   * اول اعتبارسنجی (`validateDeck`)؛ اگر ایرادی بود هیچ درخواستی نمی‌رود و اولین
   * ایراد به کاربر گفته می‌شود. بعد ذخیره با همان وضعیت انتشارِ انتخاب‌شده در فرم.
   */
  const save = async () => {
    const problems = validateDeck(form);
    if (problems.length) {
      notify(problems[0], 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form };
      const data = isNew ? await flashcardsApi.create(payload) : await flashcardsApi.update(deckId, payload);
      const live = form.status === 'published';
      notify(
        isNew
          ? (live ? 'مجموعه ساخته و برای کاربران تپش منتشر شد' : 'مجموعه ساخته شد — بدون انتشار')
          : (live ? 'تغییرات تأیید و برای کاربران تپش منتشر شد' : 'تغییرات تأیید شد'),
      );
      onSaved(data.deck);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const pickFor = (target) => { setPickerTarget(target); setPickerOpen(true); };

  return (
    <>
      <Modal
        open
        title={isNew ? 'مجموعهٔ جدید فلش‌کارت' : `ویرایش «${form?.title ?? ''}»`}
        subtitle="بعد از انتشار، مجموعه در کتابخانهٔ تپش کاربران نمایش داده می‌شود"
        onClose={onClose}
        size="lg"
      >
        {form ? (
          <div className="ad-stack">
            <div className="ad-grid2">
              <Field label="عنوان" required>
                <Input value={form.title} onChange={(event) => setField('title', event.target.value)} placeholder="مثلاً: آناتومی تصویری — قلب" />
              </Field>
              <Field label="عنوان کوتاه" hint="برای نمایش فشرده در کتابخانه">
                <Input value={form.shortTitle} onChange={(event) => setField('shortTitle', event.target.value)} placeholder="مثلاً: بخش قلب" />
              </Field>
            </div>

            <Field label="توضیح">
              <Textarea rows={2} value={form.description} onChange={(event) => setField('description', event.target.value)} />
            </Field>

            <div className="ad-grid2">
              <Field label="موضوع">
                <Select options={SUBJECT_OPTIONS} value={form.subjectId} onChange={(event) => setField('subjectId', event.target.value)} />
              </Field>
              <Field label="سطح">
                <Input value={form.level} onChange={(event) => setField('level', event.target.value)} placeholder="علوم پایه" />
              </Field>
            </div>

            <div className="ad-grid2">
              <Field label="رنگ کاور">
                <div className="ad-chiprow" role="group" aria-label="رنگ کاور">
                  {DECK_COLORS.map((color) => (
                    <button
                      type="button"
                      key={color}
                      className={`ad-fccard__swatch ${form.cover === color ? 'is-active' : ''}`}
                      style={{ background: color }}
                      onClick={() => setField('cover', color)}
                      aria-label={`رنگ ${color}`}
                    />
                  ))}
                </div>
              </Field>
              <div className="ad-stack ad-stack--narrow">
                <Toggle
                  checked={form.anatomy}
                  onChange={(value) => setField('anatomy', value)}
                  label="آناتومی تصویری"
                  hint="کارت‌های این مجموعه روی تصویر نقطه مشخص می‌کنند"
                />
                <Field label="تصویر پیش‌نمایش مجموعه" hint="در کارت مجموعه در کتابخانه نمایش داده می‌شود">
                  <div className="ad-fccard__option">
                    <Input dir="ltr" value={form.previewImage} onChange={(event) => setField('previewImage', event.target.value)} placeholder="/uploads/…" />
                    <Button variant="ghost" size="sm" onClick={() => pickFor('preview')}>انتخاب</Button>
                  </div>
                </Field>
              </div>
            </div>

            <div className="ad-fccard__listhead">
              <strong>کارت‌ها ({faNumber(form.cards.length)})</strong>
              <Button variant="ghost" size="sm" onClick={() => setField('cards', [...form.cards, EMPTY_CARD(form.anatomy)])}>
                <IconPlus width={14} height={14} /> کارت جدید
              </Button>
            </div>

            {form.cards.length === 0 ? (
              <EmptyState title="کارتی ندارد" description="با «کارت جدید» اولین کارت این مجموعه را بسازید." />
            ) : form.cards.map((card, index) => (
              <CardEditor
                key={index}
                index={index}
                card={card}
                onChange={(next) => setCard(index, next)}
                onRemove={() => setField('cards', form.cards.filter((_, i) => i !== index))}
                onPickImage={() => pickFor(index)}
              />
            ))}

            {/*
              * مرحلهٔ آخر: انتخاب وضعیت انتشار + دکمهٔ تأیید.
              * وضعیت فقط با زدن «تأیید تغییرات» اعمال می‌شود — نه با انتخاب چیپ.
              */}
            <div className="ad-fccard__publish">
              <span className="ad-fccard__sub">وضعیت انتشار</span>
              <div className="ad-chiprow" role="group" aria-label="وضعیت انتشار">
                {PUBLISH_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={`ad-chip ${form.status === option.value ? 'is-active' : ''}`}
                    onClick={() => setField('status', option.value)}
                    aria-pressed={form.status === option.value}
                    title={option.hint}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="ad-sub">
                {PUBLISH_OPTIONS.find((option) => option.value === form.status)?.hint}
              </p>
            </div>

            <div className="ad-editor__actions">
              <Button onClick={save} loading={saving}>تأیید تغییرات</Button>
              <p className="ad-sub">
                تا وقتی تأیید نزنید هیچ تغییری ذخیره نمی‌شود.
              </p>
            </div>
          </div>
        ) : (
          <LoadingBlock label="در حال خواندن مجموعه…" rows={4} />
        )}
      </Modal>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(item) => {
          if (pickerTarget === 'preview') setField('previewImage', item.url);
          else if (typeof pickerTarget === 'number') setCard(pickerTarget, { ...form.cards[pickerTarget], image: { ...(form.cards[pickerTarget].image ?? { alt: '', points: [] }), url: item.url } });
          setPickerOpen(false);
        }}
      />
    </>
  );
}

/* ── ویوی اصلی ── */

export default function AdminFlashcards({ admin, onBack }) {
  const notify = useToast();
  const [filters, setFilters] = useState({ search: '', status: 'all', kind: 'all', page: 1, perPage: 10 });
  const [editing, setEditing] = useState(null); // 'new' | deckId
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingSend, setPendingSend] = useState(null);
  const [busy, setBusy] = useState(false);

  const can = (permission) => admin.permissions?.includes(permission);
  const load = useCallback(() => flashcardsApi.list(filters), [filters]);
  const { data, loading, error, reload } = useAsync(load, [filters]);

  const patch = (changes) => setFilters((current) => ({ ...current, page: 1, ...changes }));

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await flashcardsApi.remove(pendingDelete.id);
      notify('مجموعه حذف شد');
      setPendingDelete(null);
      reload();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  /*
   * «ارسال به کاربران تپش» = انتشار مجموعه.
   * رکورد کاملی که از فهرست آمده دوباره فرستاده می‌شود (PUT کل دک را می‌گیرد)
   * و فقط `status` عوض می‌شود؛ کارت‌ها دست‌نخورده برمی‌گردند.
   */
  const confirmSend = async () => {
    setBusy(true);
    try {
      await flashcardsApi.update(pendingSend.id, { ...pendingSend, status: 'published' });
      notify('مجموعه در کتابخانهٔ کاربران تپش منتشر شد');
      setPendingSend(null);
      reload();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-stack">
      {onBack ? (
        <div className="ad-fclib__bar">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <IconChevron width={16} height={16} />
            بازگشت به لایه‌ها
          </Button>
          <span className="ad-editor__state">
            لایهٔ <em>کتابخانهٔ فلش‌کارت تپش</em>
          </span>
        </div>
      ) : null}

      <p className="ad-fclib__hint">
        مجموعه‌های «منتشرشده» در کتابخانهٔ فلش‌کارت کاربران تپش نمایش داده می‌شوند.
        برای فرستادن یک مجموعه به کاربران، در ستون عملیات دکمهٔ «ارسال به کاربران تپش» را بزنید.
        فیلتر «نوع مجموعه» بین مجموعه‌های عادی و آناتومی تصویری جابه‌جا می‌شود.
      </p>

      <div className="ad-toolbar">
        <SearchInput value={filters.search} onChange={(search) => patch({ search })} placeholder="جست‌وجوی مجموعه…" />
        <Select options={KIND_OPTIONS} value={filters.kind} onChange={(event) => patch({ kind: event.target.value })} aria-label="نوع مجموعه" />
        <Select options={STATUS_OPTIONS} value={filters.status} onChange={(event) => patch({ status: event.target.value })} aria-label="وضعیت" />

        <div className="ad-toolbar__end">
          <Button variant="ghost" size="sm" onClick={reload}><IconRefresh width={15} height={15} />تازه‌سازی</Button>
          {can('flashcards.create') ? (
            <Button onClick={() => setEditing('new')}>
              <IconPlus width={16} height={16} />
              مجموعهٔ جدید
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingBlock label="در حال خواندن مجموعه‌ها…" rows={4} /> : null}

      {data ? (
        <>
          <TableWrap
            head={['مجموعه', 'نوع', 'موضوع', 'کارت‌ها', 'وضعیت', 'آخرین ویرایش', '']}
            empty={data.items.length === 0 ? (
              <EmptyState
                title="مجموعه‌ای پیدا نشد"
                action={can('flashcards.create') ? <Button size="sm" onClick={() => setEditing('new')}>ایجاد مجموعه</Button> : null}
              />
            ) : null}
          >
            {data.items.map((deck) => (
              <tr key={deck.id}>
                <td>
                  <button type="button" className="ad-linkcell" onClick={() => setEditing(deck.id)}>
                    {deck.title}
                  </button>
                </td>
                <td>{deck.anatomy ? <Badge tone="neutral">آناتومی تصویری</Badge> : <Badge tone="neutral">عادی</Badge>}</td>
                <td><span className="ad-sub">{SUBJECTS.find((s) => s.id === deck.subjectId)?.title ?? deck.subjectId}</span></td>
                <td><span className="ad-sub">{faNumber(deck.cards?.length ?? 0)}</span></td>
                <td><StatusBadge status={deck.status} /></td>
                <td><span className="ad-sub">{faDateTime(deck.updatedAt)}</span></td>
                <td>
                  <div className="ad-rowactions">
                    {canSendDeck(deck, admin.permissions) ? (
                      <IconButton label="ارسال به کاربران تپش" onClick={() => setPendingSend(deck)}>
                        <IconSend width={16} height={16} />
                      </IconButton>
                    ) : null}
                    <IconButton label="ویرایش" onClick={() => setEditing(deck.id)}><IconEdit width={16} height={16} /></IconButton>
                    {can('flashcards.delete') ? (
                      <IconButton label="حذف" tone="danger" onClick={() => setPendingDelete(deck)}><IconTrash width={16} height={16} /></IconButton>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </TableWrap>

          {data.pages > 1 ? (
            <div className="ad-toolbar">
              <Button variant="ghost" size="sm" disabled={data.page <= 1} onClick={() => setFilters((c) => ({ ...c, page: c.page - 1 }))}>قبلی</Button>
              <span className="ad-toolbar__hint">صفحه {faNumber(data.page)} از {faNumber(data.pages)} — {faNumber(data.total)} مجموعه</span>
              <Button variant="ghost" size="sm" disabled={data.page >= data.pages} onClick={() => setFilters((c) => ({ ...c, page: c.page + 1 }))}>بعدی</Button>
            </div>
          ) : null}
        </>
      ) : null}

      {editing ? (
        <DeckEditor
          deckId={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
          notify={notify}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف مجموعه"
        message={`آیا از حذف «${pendingDelete?.title ?? ''}» و همهٔ کارت‌هایش مطمئن هستید؟ کاربرانی که این مجموعه را اضافه کرده‌اند دیگر آن را نمی‌بینند.`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingSend)}
        title="ارسال به کاربران تپش"
        message={`مجموعهٔ «${pendingSend?.title ?? ''}» با ${faNumber(pendingSend?.cards?.length ?? 0)} کارت در کتابخانهٔ فلش‌کارت کاربران تپش منتشر می‌شود. ادامه می‌دهید؟`}
        confirmLabel="ارسال کن"
        busy={busy}
        onConfirm={confirmSend}
        onCancel={() => setPendingSend(null)}
      />
    </div>
  );
}
