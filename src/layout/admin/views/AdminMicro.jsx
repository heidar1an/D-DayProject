/*
 * میکرو درسنامه تپش — لایهٔ داخل پنل برای مدیریت کامل یک درسنامه.
 *
 * این فایل مثل «کتابخانهٔ فلش‌کارت» یک لایهٔ داخل پنل است: از دکمهٔ «ورود به لایه»
 * روی کارت «میکرو درسنامه» در بخش «صفحات» باز می‌شود (`navigate('micro-lesson')`)
 * و `onBack` به همان بخش برمی‌گرداند. در سایدبار آیتم جدا ندارد و «صفحات» فعال می‌ماند.
 *
 * ── چه چیزی اینجا مدیریت می‌شود؟ ──
 *   کادر درس اصلی (درسنامه) → مبحث → واحد یادگیری → صفحه (متن غنی) →
 *   ایستگاه تست (انتخاب از بانک تست یا بارگذاری تست دستی) + مفاهیم هر واحد.
 * همهٔ این‌ها یک رکورد واحدند؛ «ذخیره» یک PUT کامل می‌فرستد تا ساختار اتمیک بماند.
 *
 * ── متن صفحه: ویرایشگر متن، نه بلوک ──
 * متن هر صفحه با `RichTextEditor` نوشته می‌شود و در `page.content` می‌نشیند.
 * مدل قبلی (آرایه‌ای از بلوک‌های تایپ‌دار) حذف نشده، ولی از رابط کاربری کنار رفته:
 * صفحه‌های قدیمی یک‌بار سرور از همان بلوک‌ها متن غنی ساخته و ادمین متن آماده را
 * می‌بیند. تنها بلوک‌هایی که در پنل می‌مانند سه نوع‌اند که در HTML خالص قابل بیان
 * نیستند — دیاگرام، فلش‌کارت و خودآزمایی (`INTERACTIVE_BLOCK_TYPES`).
 *
 * ── انتشار ──
 * دکمهٔ «انتشار برای کاربران تپش» اول تغییرات ذخیره‌نشده را ذخیره می‌کند و بعد
 * وضعیت را `published` می‌کند. از آن لحظه درسنامه در `/api/public/micro/library`
 * سرو می‌شود؛ «لغو انتشار» فقط همین مسیر را می‌بندد و محتوا دست‌نخورده می‌ماند.
 *
 * ── چیدمان ──
 * نوار بالا: انتخاب درسنامه + شمارنده‌ها + انتشار + ذخیره.
 * دو ستون: درخت (مبحث/واحد/صفحه/ایستگاه) سمت راست، ویرایشگر گرهٔ انتخابی سمت چپ.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { micro as microApi } from '../../../services/admin/adminService';
import { INTERACTIVE_BLOCK_TYPES, hasRichContent } from '../../../data/micro/blocksToHtml';
import RichTextEditor from '../RichTextEditor';
import {
  Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input, LoadingBlock,
  Modal, SearchInput, Select, StatusBadge, Textarea, Toggle, faDateTime, faNumber, useAsync, useToast,
} from '../adminShared';
import {
  IconChevron, IconEdit, IconMicroLesson, IconPlus, IconRefresh, IconSend, IconTestBank, IconTrash,
} from '../adminIcons';

const STATUS_OPTIONS = [
  { value: 'all', label: 'همهٔ وضعیت‌ها' },
  { value: 'published', label: 'منتشرشده' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'archived', label: 'بایگانی' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'آسان' },
  { value: 'medium', label: 'متوسط' },
  { value: 'hard', label: 'سخت' },
  { value: 'very_hard', label: 'بسیار سخت' },
];

const FREQUENCY_OPTIONS = [
  { value: 'low', label: 'کم' },
  { value: 'medium', label: 'متوسط' },
  { value: 'high', label: 'زیاد' },
];

const COURSE_DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'آسان' },
  { value: 'medium', label: 'متوسط' },
  { value: 'hard', label: 'سخت' },
];

/* انواع بلوک محتوای صفحه — باید با MICRO_BLOCK_TYPES سرور یکی بماند */
const BLOCK_OPTIONS = [
  { value: 'heading', label: 'تیتر داخلی' },
  { value: 'intro', label: 'مقدمهٔ صفحه' },
  { value: 'text', label: 'متن آموزشی' },
  { value: 'keyPoint', label: 'نکتهٔ کلیدی' },
  { value: 'definition', label: 'تعریف اصطلاح' },
  { value: 'example', label: 'مثال' },
  { value: 'comparison', label: 'مقایسهٔ دو ستونه' },
  { value: 'table', label: 'جدول' },
  { value: 'warning', label: 'هشدار / دام رایج' },
  { value: 'clinical', label: 'ارتباط بالینی' },
  { value: 'crossCourse', label: 'ارتباط با درس‌های دیگر' },
  { value: 'figure', label: 'دیاگرام' },
  { value: 'flashcards', label: 'فلش‌کارت درون‌صفحه' },
  { value: 'quickQuestion', label: 'سؤال کوتاه خودآزمایی' },
  { value: 'summary', label: 'جمع‌بندی صفحه' },
];

/* دیاگرام‌های موجود در `microDiagrams.jsx` — کلید تازه نیاز به کامپوننت دارد */
const DIAGRAM_OPTIONS = [
  { value: 'pressure-timeline', label: 'منحنی فشار در چرخه' },
  { value: 'wiggers', label: 'دیاگرام وینگرز' },
  { value: 'pv-loop', label: 'حلقهٔ فشار-حجم' },
];

/* سه بلوکی که در HTML خالص قابل بیان نیستند و به‌عنوان «افزودنی تعاملی» در پنل می‌مانند */
const INTERACTIVE_BLOCK_OPTIONS = BLOCK_OPTIONS
  .filter((option) => INTERACTIVE_BLOCK_TYPES.includes(option.value));

/* ────────────────────────── ابزارهای ساخت بلوک ────────────────────────── */

function emptyBlock(type) {
  switch (type) {
    case 'definition': return { type, term: '', english: '', text: '' };
    case 'example':
    case 'clinical': return { type, title: '', text: '' };
    case 'crossCourse': return { type, title: '', items: [] };
    case 'comparison': return { type, title: '', left: { label: '', items: [] }, right: { label: '', items: [] } };
    case 'table': return { type, title: '', head: [], rows: [] };
    case 'figure': return { type, title: '', caption: '', diagram: 'pressure-timeline' };
    case 'flashcards': return { type, title: '', cards: [] };
    case 'quickQuestion': return { type, question: '', answer: '' };
    case 'summary': return { type, items: [] };
    default: return { type, text: '' };
  }
}

function emptyQuestion() {
  return { id: '', stem: '', options: ['', ''], correctAnswer: 0, difficulty: 'medium', topicPath: [], explanation: '' };
}

function emptyTopic(index) {
  return {
    id: `topic-${index + 1}`,
    title: '',
    description: '',
    accent: '#ab8e7c',
    published: false,
    units: [],
  };
}

function emptyUnit(index) {
  return {
    id: `unit-${index + 1}`,
    title: '',
    learningObjective: '',
    estimatedTime: 30,
    difficulty: 'medium',
    checkpointInterval: 4,
    testBank: { subjectId: '', topicPaths: [], relatedTopicPaths: [] },
    finalAssessment: { questionCount: 10 },
    concepts: [],
    pages: [],
    checkpoints: [],
  };
}

function emptyPage(index) {
  return {
    id: `p${String(index + 1).padStart(2, '0')}`,
    order: index + 1,
    title: '',
    learningObjective: '',
    estimatedTime: 4,
    difficulty: 'medium',
    importance: 3,
    examFrequency: 'medium',
    keywords: [],
    concepts: [],
    /* متن صفحه از ویرایشگر متنی می‌آید؛ صفحهٔ تازه بلوکی متنی ندارد */
    content: '',
    blocks: [],
  };
}

function emptyCheckpoint(index, afterPage) {
  return {
    id: `cp${index + 1}`,
    afterPage: afterPage ?? '',
    questionCount: 3,
    required: false,
    scopePages: [],
    pinnedQuestionIds: [],
    questions: [],
  };
}

/* ────────────────────────── فیلدهای کوچک مشترک ────────────────────────── */

/* فهرست رشته‌ای: هر خط یک آیتم */
function LinesField({ label, hint, value, onChange, rows = 4 }) {
  return (
    <Field label={label} hint={hint}>
      <Textarea
        rows={rows}
        value={(value ?? []).join('\n')}
        onChange={(event) => onChange(event.target.value.split('\n').map((line) => line.trim()).filter(Boolean))}
      />
    </Field>
  );
}

/* مسیر مبحث بانک تست: هر خط یک مسیر، سطح‌ها با «›» جدا می‌شوند */
function TopicPathsField({ label, hint, value, onChange }) {
  const text = (value ?? []).map((path) => path.join(' › ')).join('\n');
  return (
    <Field label={label} hint={hint}>
      <Textarea
        rows={3}
        value={text}
        onChange={(event) => onChange(event.target.value
          .split('\n')
          .map((line) => line.split('›').map((part) => part.trim()).filter(Boolean))
          .filter((path) => path.length))}
      />
    </Field>
  );
}

/* ردیف بالا/پایین/حذف برای هر گرهٔ درخت */
function NodeActions({ onMove, onRemove, canMoveUp = true, canMoveDown = true, label }) {
  return (
    <span className="ad-mic__nodeactions">
      {onMove ? (
        <>
          <IconButton label={`انتقال ${label} به بالا`} disabled={!canMoveUp} onClick={() => onMove(-1)}>
            <IconChevron width={14} height={14} style={{ transform: 'rotate(-90deg)' }} />
          </IconButton>
          <IconButton label={`انتقال ${label} به پایین`} disabled={!canMoveDown} onClick={() => onMove(1)}>
            <IconChevron width={14} height={14} style={{ transform: 'rotate(90deg)' }} />
          </IconButton>
        </>
      ) : null}
      {onRemove ? (
        <IconButton label={`حذف ${label}`} tone="danger" onClick={onRemove}><IconTrash width={14} height={14} /></IconButton>
      ) : null}
    </span>
  );
}

/* ────────────────────────── ویرایشگر بلوک محتوا ────────────────────────── */

/* `typeOptions` محدودسازی انواع را به فراخوان می‌دهد: صفحه‌ها امروز فقط بلوک‌های
   تعاملی (دیاگرام/فلش‌کارت/خودآزمایی) را از این فرم می‌سازند و متن جای دیگری است. */
function BlockEditor({ block, index, onChange, onRemove, typeOptions = BLOCK_OPTIONS }) {
  const set = (changes) => onChange({ ...block, ...changes });

  return (
    <div className="ad-mic__block">
      <div className="ad-mic__blockhead">
        <strong>بلوک {faNumber(index + 1)}</strong>
        <Select
          className="ad-input--select"
          options={typeOptions}
          value={block.type}
          onChange={(event) => onChange({ ...emptyBlock(event.target.value), ...(event.target.value === block.type ? block : {}) })}
        />
        <NodeActions label="بلوک" onRemove={onRemove} />
      </div>

      {block.type === 'heading' || block.type === 'intro' || block.type === 'keyPoint'
        || block.type === 'warning' || block.type === 'text' ? (
        <>
          <Field label="متن">
            <Textarea rows={block.type === 'text' ? 5 : 2} value={block.text ?? ''} onChange={(event) => set({ text: event.target.value })} />
          </Field>
          {block.type === 'text' ? (
            <Toggle
              checked={block.depth === 'extended'}
              onChange={(value) => set({ depth: value ? 'extended' : undefined })}
              label="فقط در مطالعهٔ عمیق"
              hint="بلوک‌های extended در «درس سریع» جمع می‌شوند"
            />
          ) : null}
        </>
      ) : null}

      {block.type === 'definition' ? (
        <>
          <div className="ad-grid2">
            <Field label="اصطلاح"><Input value={block.term ?? ''} onChange={(event) => set({ term: event.target.value })} /></Field>
            <Field label="معادل انگلیسی"><Input dir="ltr" value={block.english ?? ''} onChange={(event) => set({ english: event.target.value })} /></Field>
          </div>
          <Field label="توضیح"><Textarea rows={3} value={block.text ?? ''} onChange={(event) => set({ text: event.target.value })} /></Field>
        </>
      ) : null}

      {block.type === 'example' || block.type === 'clinical' ? (
        <>
          <Field label="عنوان"><Input value={block.title ?? ''} onChange={(event) => set({ title: event.target.value })} /></Field>
          <Field label="متن"><Textarea rows={4} value={block.text ?? ''} onChange={(event) => set({ text: event.target.value })} /></Field>
        </>
      ) : null}

      {block.type === 'crossCourse' ? (
        <>
          <Field label="عنوان"><Input value={block.title ?? ''} onChange={(event) => set({ title: event.target.value })} /></Field>
          <LinesField label="پیوندها" hint="هر خط یک پیوند" value={block.items} onChange={(items) => set({ items })} rows={3} />
        </>
      ) : null}

      {block.type === 'summary' ? (
        <LinesField label="بندهای جمع‌بندی" hint="هر خط یک بند" value={block.items} onChange={(items) => set({ items })} rows={4} />
      ) : null}

      {block.type === 'comparison' ? (
        <>
          <Field label="عنوان"><Input value={block.title ?? ''} onChange={(event) => set({ title: event.target.value })} /></Field>
          <div className="ad-grid2">
            <div className="ad-stack ad-stack--narrow">
              <Field label="عنوان ستون راست"><Input value={block.left?.label ?? ''} onChange={(event) => set({ left: { ...block.left, label: event.target.value } })} /></Field>
              <LinesField label="بندهای ستون راست" value={block.left?.items} onChange={(items) => set({ left: { ...block.left, items } })} rows={4} />
            </div>
            <div className="ad-stack ad-stack--narrow">
              <Field label="عنوان ستون چپ"><Input value={block.right?.label ?? ''} onChange={(event) => set({ right: { ...block.right, label: event.target.value } })} /></Field>
              <LinesField label="بندهای ستون چپ" value={block.right?.items} onChange={(items) => set({ right: { ...block.right, items } })} rows={4} />
            </div>
          </div>
        </>
      ) : null}

      {block.type === 'table' ? (
        <>
          <Field label="عنوان جدول"><Input value={block.title ?? ''} onChange={(event) => set({ title: event.target.value })} /></Field>
          <LinesField
            label="سرستون‌ها"
            hint="هر خط یک سرستون"
            value={block.head}
            onChange={(head) => set({ head })}
            rows={2}
          />
          <Field label="سطرها" hint="هر خط یک سطر؛ سلول‌ها را با «|» جدا کنید.">
            <Textarea
              rows={5}
              value={(block.rows ?? []).map((row) => row.join(' | ')).join('\n')}
              onChange={(event) => set({
                rows: event.target.value
                  .split('\n')
                  .map((line) => line.split('|').map((cell) => cell.trim()).filter(Boolean))
                  .filter((row) => row.length),
              })}
            />
          </Field>
        </>
      ) : null}

      {block.type === 'figure' ? (
        <>
          <Field label="عنوان"><Input value={block.title ?? ''} onChange={(event) => set({ title: event.target.value })} /></Field>
          <Field label="دیاگرام" hint="دیاگرام تازه باید کامپوننتش در microDiagrams.jsx اضافه شود.">
            <Select className="ad-input--select" options={DIAGRAM_OPTIONS} value={block.diagram ?? 'pressure-timeline'} onChange={(event) => set({ diagram: event.target.value })} />
          </Field>
          <Field label="زیرنویس"><Textarea rows={2} value={block.caption ?? ''} onChange={(event) => set({ caption: event.target.value })} /></Field>
        </>
      ) : null}

      {block.type === 'flashcards' ? (
        <>
          <Field label="عنوان"><Input value={block.title ?? ''} onChange={(event) => set({ title: event.target.value })} /></Field>
          <div className="ad-mic__qlist">
            {(block.cards ?? []).map((card, cardIndex) => (
              <div key={cardIndex} className="ad-mic__qrow">
                <Input
                  value={card.front ?? ''}
                  onChange={(event) => set({ cards: block.cards.map((item, i) => (i === cardIndex ? { ...item, front: event.target.value } : item)) })}
                  placeholder="روی کارت…"
                />
                <Input
                  value={card.back ?? ''}
                  onChange={(event) => set({ cards: block.cards.map((item, i) => (i === cardIndex ? { ...item, back: event.target.value } : item)) })}
                  placeholder="پشت کارت…"
                />
                <IconButton label="حذف کارت" tone="danger" onClick={() => set({ cards: block.cards.filter((_, i) => i !== cardIndex) })}>
                  <IconTrash width={14} height={14} />
                </IconButton>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => set({ cards: [...(block.cards ?? []), { front: '', back: '' }] })}>
              <IconPlus width={14} height={14} /> کارت
            </Button>
          </div>
        </>
      ) : null}

      {block.type === 'quickQuestion' ? (
        <>
          <Field label="پرسش"><Textarea rows={2} value={block.question ?? ''} onChange={(event) => set({ question: event.target.value })} /></Field>
          <Field label="پاسخ"><Textarea rows={2} value={block.answer ?? ''} onChange={(event) => set({ answer: event.target.value })} /></Field>
        </>
      ) : null}
    </div>
  );
}

/* ────────────────────────── ویرایشگر گره‌ها ────────────────────────── */

function CourseEditor({ course, onChange }) {
  const set = (changes) => onChange({ ...course, ...changes });

  return (
    <div className="ad-stack">
      <div className="ad-grid2">
        <Field label="عنوان درسنامه" required hint="همین عنوان روی کادر درس اصلی در میکرو درس‌ها می‌آید.">
          <Input value={course.title ?? ''} onChange={(event) => set({ title: event.target.value })} />
        </Field>
        <Field label="عنوان انگلیسی"><Input dir="ltr" value={course.englishTitle ?? ''} onChange={(event) => set({ englishTitle: event.target.value })} /></Field>
      </div>

      <div className="ad-grid2">
        <Field label="شناسهٔ درس (subjectId)" hint="مثل physiology — گره اتصال به بانک تست و درس‌های تپش.">
          <Input dir="ltr" value={course.subjectId ?? ''} onChange={(event) => set({ subjectId: event.target.value })} />
        </Field>
        <Field label="برچسب بالای عنوان"><Input value={course.kicker ?? ''} onChange={(event) => set({ kicker: event.target.value })} /></Field>
      </div>

      <Field label="توضیح" hint="زیر عنوان کادر درس اصلی نمایش داده می‌شود.">
        <Textarea rows={2} value={course.description ?? ''} onChange={(event) => set({ description: event.target.value })} />
      </Field>

      <div className="ad-grid3">
        <Field label="زمان تقریبی (دقیقه)">
          <Input dir="ltr" value={course.estimatedTime ?? ''} onChange={(event) => set({ estimatedTime: event.target.value })} />
        </Field>
        <Field label="سطح دشواری">
          <Select className="ad-input--select" options={COURSE_DIFFICULTY_OPTIONS} value={course.difficulty ?? 'medium'} onChange={(event) => set({ difficulty: event.target.value })} />
        </Field>
        <Field label="فاصلهٔ پیش‌فرض ایستگاه تست" hint="سطح درس؛ واحد می‌تواند بازنویسی کند.">
          <Input dir="ltr" value={course.checkpointInterval ?? ''} onChange={(event) => set({ checkpointInterval: event.target.value })} />
        </Field>
      </div>

      <div className="ad-grid2">
        <Field label="رنگ لهجه (hex)"><Input dir="ltr" value={course.accent ?? ''} onChange={(event) => set({ accent: event.target.value })} /></Field>
        <Field label="وضعیت">
          <Select
            className="ad-input--select"
            options={[{ value: 'draft', label: 'پیش‌نویس' }, { value: 'published', label: 'منتشرشده (برای کاربران)' }, { value: 'archived', label: 'بایگانی' }]}
            value={course.status ?? 'draft'}
            onChange={(event) => set({ status: event.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

function TopicEditor({ topic, onChange }) {
  const set = (changes) => onChange({ ...topic, ...changes });

  return (
    <div className="ad-stack">
      <div className="ad-grid2">
        <Field label="عنوان مبحث" required><Input value={topic.title ?? ''} onChange={(event) => set({ title: event.target.value })} /></Field>
        <Field label="شناسهٔ مبحث"><Input dir="ltr" value={topic.id ?? ''} onChange={(event) => set({ id: event.target.value })} /></Field>
      </div>
      <Field label="توضیح مبحث" hint="روی کارت مبحث در فهرست مبحث‌ها دیده می‌شود.">
        <Textarea rows={2} value={topic.description ?? ''} onChange={(event) => set({ description: event.target.value })} />
      </Field>
      <div className="ad-grid2">
        <Field label="رنگ لهجه"><Input dir="ltr" value={topic.accent ?? ''} onChange={(event) => set({ accent: event.target.value })} /></Field>
        <div className="ad-stack ad-stack--narrow">
          <Toggle
            checked={Boolean(topic.published)}
            onChange={(value) => set({ published: value })}
            label="مبحث آمادهٔ محتوا"
            hint="مبحث بدون واحد یادگیری هم فهرست می‌شود؛ این پرچم فقط مسیر پیش‌فرض ورود را تعیین می‌کند."
          />
        </div>
      </div>
    </div>
  );
}

function UnitEditor({ unit, onChange }) {
  const set = (changes) => onChange({ ...unit, ...changes });
  const setConcept = (index, changes) => set({
    concepts: unit.concepts.map((concept, i) => (i === index ? { ...concept, ...changes } : concept)),
  });

  return (
    <div className="ad-stack">
      <div className="ad-grid2">
        <Field label="عنوان واحد یادگیری" required><Input value={unit.title ?? ''} onChange={(event) => set({ title: event.target.value })} /></Field>
        <Field label="شناسهٔ واحد"><Input dir="ltr" value={unit.id ?? ''} onChange={(event) => set({ id: event.target.value })} /></Field>
      </div>

      <Field label="هدف یادگیری" hint="جملهٔ «بعد از این واحد می‌توانی…»">
        <Textarea rows={3} value={unit.learningObjective ?? ''} onChange={(event) => set({ learningObjective: event.target.value })} />
      </Field>

      <div className="ad-grid3">
        <Field label="زمان تقریبی (دقیقه)"><Input dir="ltr" value={unit.estimatedTime ?? ''} onChange={(event) => set({ estimatedTime: event.target.value })} /></Field>
        <Field label="سطح دشواری">
          <Select className="ad-input--select" options={DIFFICULTY_OPTIONS} value={unit.difficulty ?? 'medium'} onChange={(event) => set({ difficulty: event.target.value })} />
        </Field>
        <Field label="فاصلهٔ ایستگاه تست" hint="بعد از هر چند صفحه"><Input dir="ltr" value={unit.checkpointInterval ?? ''} onChange={(event) => set({ checkpointInterval: event.target.value })} /></Field>
      </div>

      <div className="ad-mic__group">
        <h4>اتصال به بانک تست</h4>
        <p className="ad-mic__hint">
          ایستگاه‌های تست این واحد از همین حوزه سؤال برمی‌دارند. اگر در ایستگاهی سؤال دستی بارگذاری
          کنید یا سؤال مشخصی را سنجاق کنید، همان‌ها اولویت دارند.
        </p>
        <Field label="شناسهٔ درس در بانک"><Input dir="ltr" value={unit.testBank?.subjectId ?? ''} onChange={(event) => set({ testBank: { ...unit.testBank, subjectId: event.target.value } })} /></Field>
        <TopicPathsField
          label="مسیرهای مبحث در بانک"
          hint="هر خط یک مسیر؛ سطح‌ها را با «›» جدا کنید. مثل: قلب و عروق › چرخهٔ قلبی"
          value={unit.testBank?.topicPaths}
          onChange={(topicPaths) => set({ testBank: { ...unit.testBank, topicPaths } })}
        />
        <TopicPathsField
          label="مباحث مرتبط (اختیاری)"
          hint="برای آزمون جمع‌بندی هم از این مسیرها سؤال می‌آید."
          value={unit.testBank?.relatedTopicPaths}
          onChange={(relatedTopicPaths) => set({ testBank: { ...unit.testBank, relatedTopicPaths } })}
        />
        <Field label="تعداد سؤال آزمون جمع‌بندی">
          <Input dir="ltr" value={unit.finalAssessment?.questionCount ?? ''} onChange={(event) => set({ finalAssessment: { ...unit.finalAssessment, questionCount: event.target.value } })} />
        </Field>
      </div>

      <div className="ad-mic__group">
        <div className="ad-mic__grouphead">
          <h4>مفاهیم واحد ({faNumber(unit.concepts.length)})</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => set({ concepts: [...unit.concepts, { id: `concept-${unit.concepts.length + 1}`, title: '', english: '', importance: 3, examFrequency: 'medium', crossCourse: [] }] })}
          >
            <IconPlus width={14} height={14} /> مفهوم
          </Button>
        </div>
        <p className="ad-mic__hint">مفهوم‌ها گره اتصال صفحه‌ها به سؤال‌های بانک تست‌اند.</p>

        {unit.concepts.length === 0 ? <EmptyState title="مفهومی ثبت نشده" description="بدون مفهوم، سؤال‌ها فقط با مسیر مبحث انتخاب می‌شوند." /> : null}

        {unit.concepts.map((concept, index) => (
          <div key={index} className="ad-mic__qrow">
            <Input value={concept.id ?? ''} dir="ltr" placeholder="شناسه" onChange={(event) => setConcept(index, { id: event.target.value })} />
            <Input value={concept.title ?? ''} placeholder="عنوان مفهوم" onChange={(event) => setConcept(index, { title: event.target.value })} />
            <Input value={concept.english ?? ''} dir="ltr" placeholder="English" onChange={(event) => setConcept(index, { english: event.target.value })} />
            <Input dir="ltr" value={concept.importance ?? 3} title="اهمیت ۱ تا ۵" onChange={(event) => setConcept(index, { importance: event.target.value })} />
            <Select
              className="ad-input--select"
              options={FREQUENCY_OPTIONS}
              value={concept.examFrequency ?? 'medium'}
              onChange={(event) => setConcept(index, { examFrequency: event.target.value })}
            />
            <IconButton label="حذف مفهوم" tone="danger" onClick={() => set({ concepts: unit.concepts.filter((_, i) => i !== index) })}>
              <IconTrash width={14} height={14} />
            </IconButton>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageEditor({ page, unit, onChange }) {
  const set = (changes) => onChange({ ...page, ...changes });
  const blocks = page.blocks ?? [];
  /* فقط بلوک‌های تعاملی در پنل می‌مانند؛ متن به ویرایشگر متنی منتقل شده است */
  const interactiveBlocks = blocks.filter((block) => INTERACTIVE_BLOCK_TYPES.includes(block.type));
  const archivedTextBlocks = blocks.length - interactiveBlocks.length;

  /* ترتیب نسبی بلوک‌های تعاملی حفظ می‌شود و بلوک‌های متنی آرشیوی دست‌نخورده می‌مانند */
  const setInteractive = (list) => set({
    blocks: [...blocks.filter((block) => !INTERACTIVE_BLOCK_TYPES.includes(block.type)), ...list],
  });
  const setBlock = (index, block) => setInteractive(interactiveBlocks.map((item, i) => (i === index ? block : item)));
  const toggleConcept = (conceptId) => set({
    concepts: (page.concepts ?? []).includes(conceptId)
      ? page.concepts.filter((id) => id !== conceptId)
      : [...(page.concepts ?? []), conceptId],
  });

  return (
    <div className="ad-stack">
      <div className="ad-grid2">
        <Field label="عنوان صفحه" required><Input value={page.title ?? ''} onChange={(event) => set({ title: event.target.value })} /></Field>
        <Field label="شناسهٔ صفحه"><Input dir="ltr" value={page.id ?? ''} onChange={(event) => set({ id: event.target.value })} /></Field>
      </div>

      <Field label="هدف یادگیری صفحه"><Textarea rows={2} value={page.learningObjective ?? ''} onChange={(event) => set({ learningObjective: event.target.value })} /></Field>

      <div className="ad-grid3">
        <Field label="ترتیب"><Input dir="ltr" value={page.order ?? ''} onChange={(event) => set({ order: event.target.value })} /></Field>
        <Field label="زمان (دقیقه)"><Input dir="ltr" value={page.estimatedTime ?? ''} onChange={(event) => set({ estimatedTime: event.target.value })} /></Field>
        <Field label="اهمیت (۱ تا ۵)"><Input dir="ltr" value={page.importance ?? ''} onChange={(event) => set({ importance: event.target.value })} /></Field>
      </div>

      <div className="ad-grid2">
        <Field label="سطح دشواری">
          <Select className="ad-input--select" options={DIFFICULTY_OPTIONS} value={page.difficulty ?? 'medium'} onChange={(event) => set({ difficulty: event.target.value })} />
        </Field>
        <Field label="تکرار در آزمون‌ها">
          <Select className="ad-input--select" options={FREQUENCY_OPTIONS} value={page.examFrequency ?? 'medium'} onChange={(event) => set({ examFrequency: event.target.value })} />
        </Field>
      </div>

      <LinesField label="کلیدواژه‌ها" hint="هر خط یک کلیدواژه" value={page.keywords} onChange={(keywords) => set({ keywords })} rows={2} />

      <Field label="مفاهیم این صفحه" hint="مفهوم‌ها از واحد می‌آیند؛ انتخاب‌شان تعیین می‌کند تست ایستگاه بعدی از کدام مفهوم بیاید.">
        {unit.concepts.length === 0 ? (
          <p className="ad-mic__hint">این واحد هنوز مفهومی ندارد. اول در گرهٔ «واحد یادگیری» مفهوم اضافه کنید.</p>
        ) : (
          <div className="ad-chiprow">
            {unit.concepts.map((concept) => (
              <button
                type="button"
                key={concept.id}
                className={`ad-chip ${(page.concepts ?? []).includes(concept.id) ? 'is-active' : ''}`}
                onClick={() => toggleConcept(concept.id)}
              >
                {concept.title || concept.id}
              </button>
            ))}
          </div>
        )}
      </Field>

      <Field
        label="متن صفحه"
        hint="مثل یک ویرایشگر متن معمولی بنویسید. تیتر، فهرست، جدول، نقل‌قول، لینک و تصویر در نوار ابزار هست."
      >
        <RichTextEditor
          value={page.content ?? ''}
          onChange={(content) => set({ content })}
          placeholder="متن این صفحه را اینجا بنویسید…"
        />
      </Field>

      <div className="ad-mic__group">
        <div className="ad-mic__grouphead">
          <h4>افزودنی‌های تعاملی ({faNumber(interactiveBlocks.length)})</h4>
          <Select
            className="ad-input--select"
            options={[{ value: '', label: 'افزودن…' }, ...INTERACTIVE_BLOCK_OPTIONS]}
            value=""
            onChange={(event) => { if (event.target.value) setInteractive([...interactiveBlocks, emptyBlock(event.target.value)]); }}
          />
        </div>

        <p className="ad-mic__hint">
          دیاگرام، فلش‌کارت و خودآزمایی متن نیستند و در ویرایشگر بالا نمی‌گنجند؛ اینجا ساخته می‌شوند و
          خواننده آن‌ها را زیر متن همان صفحه نشان می‌دهد.
          {archivedTextBlocks > 0
            ? ` ${faNumber(archivedTextBlocks)} متن بلوکی قدیمی این صفحه در آرشیو نگه داشته شده و دیگر نمایش داده نمی‌شود.`
            : ''}
        </p>

        {interactiveBlocks.length === 0 ? (
          <EmptyState
            title="افزودنی تعاملی ندارد"
            description="اگر این صفحه دیاگرام، فلش‌کارت یا خودآزمایی لازم دارد، از فهرست بالا اضافه کنید."
          />
        ) : null}

        {interactiveBlocks.map((block, index) => (
          <BlockEditor
            key={index}
            index={index}
            block={block}
            typeOptions={INTERACTIVE_BLOCK_OPTIONS}
            onChange={(next) => setBlock(index, next)}
            onRemove={() => setInteractive(interactiveBlocks.filter((_, i) => i !== index))}
          />
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────── بارگذاری گروهی تست ────────────────────────── */

/*
 * قالب ساده و بدون وابستگی: هر خط یک سؤال
 *   متن سؤال | گزینه ۱ | گزینه ۲ | … | شمارهٔ گزینهٔ درست (از ۱)
 * خواندن از فایل هم پشتیبانی می‌شود (.txt/.csv) — همان متن، بدون رفت‌وبرگشت سرور.
 */
/* رقم فارسی/عربی → لاتین؛ پنل فارسی است و شمارهٔ گزینه معمولاً فارسی تایپ می‌شود */
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function latinDigits(value) {
  return String(value ?? '').replace(/[۰-۹٠-٩]/g, (digit) => {
    const persian = PERSIAN_DIGITS.indexOf(digit);
    return String(persian >= 0 ? persian : ARABIC_DIGITS.indexOf(digit));
  });
}

/* خالص و بیرون از JSX تا بدون مرورگر هم قابل سنجش باشد */
export function parseBulkQuestions(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map((part) => part.trim());
      const answerRaw = parts.length > 2 ? parts[parts.length - 1] : '';
      const correctIndex = Number(latinDigits(answerRaw)) - 1;
      const body = parts.length > 2 ? parts.slice(0, -1) : parts;
      const options = body.slice(1).filter(Boolean);

      if (!body[0] || options.length < 2 || !Number.isInteger(correctIndex) || correctIndex < 0) return null;

      return {
        id: '',
        stem: body[0],
        options,
        correctAnswer: Math.min(Math.max(correctIndex, 0), options.length - 1),
        difficulty: 'medium',
        topicPath: [],
        explanation: '',
      };
    })
    .filter(Boolean);
}

function BulkQuestions({ onClose, onAdd }) {
  const notify = useToast();
  const [text, setText] = useState('');
  const parsed = useMemo(() => parseBulkQuestions(text), [text]);

  const readFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ''));
    reader.onerror = () => notify('خواندن فایل ناموفق بود', 'error');
    reader.readAsText(file, 'utf-8');
  };

  return (
    <Modal
      open
      title="بارگذاری تست"
      subtitle="هر خط یک سؤال؛ گزینه‌ها را با «|» جدا کنید و شمارهٔ گزینهٔ درست را آخر بنویسید."
      onClose={onClose}
      size="lg"
      footer={(
        <div className="ad-editor__actions">
          <Button disabled={parsed.length === 0} onClick={() => onAdd(parsed)}>
            افزودن {faNumber(parsed.length)} سؤال
          </Button>
          <span className="ad-sub">نمونه: S1 با بسته شدن کدام دریچه‌ها می‌آید؟ | میترال و سه‌لختی | آئورت و ششی | ۱</span>
        </div>
      )}
    >
      <div className="ad-stack">
        <Field label="فایل متنی (اختیاری)" hint=".txt یا .csv با همان قالب">
          <input type="file" accept=".txt,.csv,text/plain" onChange={readFile} />
        </Field>
        <Field label="متن سؤال‌ها" required>
          <Textarea rows={10} value={text} onChange={(event) => setText(event.target.value)} placeholder="متن سؤال | گزینه ۱ | گزینه ۲ | ۱" />
        </Field>
      </div>
    </Modal>
  );
}

/* ────────────────────────── انتخاب از بانک تست ────────────────────────── */

function BankPicker({ onClose, onAdd, subjectId, topicPaths }) {
  const [filters, setFilters] = useState({
    search: '',
    subjectId: subjectId ?? '',
    topicPath: topicPaths?.[0]?.join(' › ') ?? '',
    difficulty: 'all',
  });
  const [picked, setPicked] = useState([]);

  const load = useCallback(
    () => microApi.testBank({ ...filters, limit: 60 }),
    [filters.search, filters.subjectId, filters.topicPath, filters.difficulty],
  );
  const { data, loading, error, reload } = useAsync(load, [filters.search, filters.subjectId, filters.topicPath, filters.difficulty]);

  const patch = (changes) => setFilters((current) => ({ ...current, ...changes }));
  const toggle = (id) => setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const subjectOptions = [
    { value: '', label: 'همهٔ درس‌های بانک' },
    ...(data?.subjects ?? []).map((subject) => ({ value: subject.id, label: subject.name })),
  ];
  const difficultyOptions = [
    { value: 'all', label: 'همهٔ سطوح' },
    ...(data?.difficulties ?? []).map((item) => ({ value: item.id, label: item.label })),
  ];

  return (
    <Modal
      open
      title="انتخاب از بانک تست تپش"
      subtitle="سؤال‌های انتخاب‌شده به همین ایستگاه سنجاق می‌شوند و بر فیلتر خودکار اولویت دارند."
      onClose={onClose}
      size="lg"
      footer={(
        <div className="ad-editor__actions">
          <Button disabled={picked.length === 0} onClick={() => onAdd(picked)}>
            سنجاق {faNumber(picked.length)} سؤال
          </Button>
          <Button variant="ghost" onClick={onClose}>بستن</Button>
        </div>
      )}
    >
      <div className="ad-stack">
        <div className="ad-toolbar">
          <SearchInput value={filters.search} onChange={(search) => patch({ search })} placeholder="جست‌وجو در متن سؤال یا مسیر مبحث…" />
          <Select options={subjectOptions} value={filters.subjectId} onChange={(event) => patch({ subjectId: event.target.value })} aria-label="درس" />
          <Select options={difficultyOptions} value={filters.difficulty} onChange={(event) => patch({ difficulty: event.target.value })} aria-label="سطح" />
          <div className="ad-toolbar__end">
            <Button variant="ghost" size="sm" onClick={reload}><IconRefresh width={15} height={15} />تازه‌سازی</Button>
          </div>
        </div>

        <Field label="مسیر مبحث" hint="بخشی از مسیر را بنویسید؛ مثل «چرخهٔ قلبی»">
          <Input value={filters.topicPath} onChange={(event) => patch({ topicPath: event.target.value })} />
        </Field>

        {error ? <ErrorState error={error} onRetry={reload} /> : null}
        {loading && !data ? <LoadingBlock label="در حال خواندن بانک تست…" rows={5} /> : null}

        {data ? (
          <>
            <p className="ad-mic__hint">{faNumber(data.total)} سؤال با این فیلتر پیدا شد؛ {faNumber(Math.min(60, data.total))} سؤال اول نمایش داده می‌شود.</p>

            {data.items.length === 0 ? <EmptyState title="سؤالی پیدا نشد" description="فیلترها را ساده‌تر کنید." /> : null}

            <div className="ad-mic__qlist">
              {data.items.map((question) => (
                <label key={question.id} className={`ad-mic__pick ${picked.includes(question.id) ? 'is-picked' : ''}`}>
                  <input type="checkbox" checked={picked.includes(question.id)} onChange={() => toggle(question.id)} />
                  <span className="ad-mic__pickbody">
                    <span className="ad-mic__pickstem">{question.stem}</span>
                    <span className="ad-mic__pickmeta">
                      <code className="ad-code" dir="ltr">{question.id}</code>
                      <span>{question.subjectTitle}</span>
                      <span>{question.topicPath.join(' › ')}</span>
                      <Badge tone="neutral">{question.difficultyLabel}</Badge>
                      {question.tags.map((tag) => <Badge key={tag} tone="neutral">{tag}</Badge>)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

function CheckpointEditor({ checkpoint, unit, onChange }) {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const set = (changes) => onChange({ ...checkpoint, ...changes });

  const pageOptions = [
    { value: '', label: 'انتخاب صفحه…' },
    ...unit.pages.map((page) => ({ value: page.id, label: `${faNumber(page.order)}. ${page.title || page.id}` })),
  ];

  const toggleScope = (pageId) => set({
    scopePages: checkpoint.scopePages.includes(pageId)
      ? checkpoint.scopePages.filter((id) => id !== pageId)
      : [...checkpoint.scopePages, pageId],
  });

  const setQuestion = (index, changes) => set({
    questions: checkpoint.questions.map((question, i) => (i === index ? { ...question, ...changes } : question)),
  });

  return (
    <div className="ad-stack">
      <div className="ad-grid3">
        <Field label="شناسهٔ ایستگاه"><Input dir="ltr" value={checkpoint.id ?? ''} onChange={(event) => set({ id: event.target.value })} /></Field>
        <Field label="بعد از کدام صفحه" hint="ایستگاه در جریان مطالعه همین‌جا باز می‌شود.">
          <Select className="ad-input--select" options={pageOptions} value={checkpoint.afterPage ?? ''} onChange={(event) => set({ afterPage: event.target.value })} />
        </Field>
        <Field label="تعداد سؤال"><Input dir="ltr" value={checkpoint.questionCount ?? ''} onChange={(event) => set({ questionCount: event.target.value })} /></Field>
      </div>

      <Toggle
        checked={Boolean(checkpoint.required)}
        onChange={(value) => set({ required: value })}
        label="ایستگاه الزامی"
        hint="با عملکرد ضعیف، «مرور کوتاه + تلاش مجدد» پیشنهاد می‌شود."
      />

      <Field label="صفحه‌های در حوزهٔ این ایستگاه" hint="تست از مفهوم‌های همین صفحه‌ها انتخاب می‌شود.">
        {unit.pages.length === 0 ? (
          <p className="ad-mic__hint">این واحد هنوز صفحه‌ای ندارد.</p>
        ) : (
          <div className="ad-chiprow">
            {unit.pages.map((page) => (
              <button
                type="button"
                key={page.id}
                className={`ad-chip ${checkpoint.scopePages.includes(page.id) ? 'is-active' : ''}`}
                onClick={() => toggleScope(page.id)}
              >
                {faNumber(page.order)}. {page.title || page.id}
              </button>
            ))}
          </div>
        )}
      </Field>

      <div className="ad-mic__group">
        <div className="ad-mic__grouphead">
          <h4>سؤال‌های سنجاق‌شده از بانک ({faNumber(checkpoint.pinnedQuestionIds.length)})</h4>
          <Button variant="ghost" size="sm" onClick={() => setBankOpen(true)}>
            <IconTestBank width={15} height={15} /> انتخاب از بانک تست
          </Button>
        </div>
        <p className="ad-mic__hint">
          بدون سؤال سنجاق‌شده، ایستگاه از فیلتر «اتصال به بانک تست» واحد سؤال برمی‌دارد.
        </p>

        {checkpoint.pinnedQuestionIds.length === 0 ? null : (
          <div className="ad-mic__qlist">
            {checkpoint.pinnedQuestionIds.map((questionId) => (
              <div key={questionId} className="ad-mic__qrow">
                <code className="ad-code" dir="ltr">{questionId}</code>
                <span className="ad-sub">از بانک تست تپش</span>
                <IconButton
                  label="حذف از سنجاق‌شده‌ها"
                  tone="danger"
                  onClick={() => set({ pinnedQuestionIds: checkpoint.pinnedQuestionIds.filter((id) => id !== questionId) })}
                >
                  <IconTrash width={14} height={14} />
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ad-mic__group">
        <div className="ad-mic__grouphead">
          <h4>تست‌های بارگذاری‌شده ({faNumber(checkpoint.questions.length)})</h4>
          <span className="ad-chiprow">
            <Button variant="ghost" size="sm" onClick={() => setBulkOpen(true)}>بارگذاری گروهی</Button>
            <Button variant="ghost" size="sm" onClick={() => set({ questions: [...checkpoint.questions, emptyQuestion()] })}>
              <IconPlus width={14} height={14} /> سؤال
            </Button>
          </span>
        </div>
        <p className="ad-mic__hint">
          اگر اینجا سؤالی باشد، ایستگاه همان‌ها را بر فیلتر بانک ترجیح می‌دهد.
        </p>

        {checkpoint.questions.length === 0 ? (
          <EmptyState title="سؤال دستی ثبت نشده" description="می‌توانید از بانک تست انتخاب کنید یا تست را دستی/گروهی بارگذاری کنید." />
        ) : null}

        {checkpoint.questions.map((question, index) => (
          <div key={index} className="ad-mic__block">
            <div className="ad-mic__blockhead">
              <strong>سؤال {faNumber(index + 1)}</strong>
              <Select
                className="ad-input--select"
                options={DIFFICULTY_OPTIONS}
                value={question.difficulty ?? 'medium'}
                onChange={(event) => setQuestion(index, { difficulty: event.target.value })}
              />
              <NodeActions label="سؤال" onRemove={() => set({ questions: checkpoint.questions.filter((_, i) => i !== index) })} />
            </div>

            <Field label="متن سؤال" required>
              <Textarea rows={2} value={question.stem ?? ''} onChange={(event) => setQuestion(index, { stem: event.target.value })} />
            </Field>

            <LinesField
              label="گزینه‌ها"
              hint="هر خط یک گزینه"
              value={question.options}
              onChange={(options) => setQuestion(index, { options })}
              rows={4}
            />

            <div className="ad-grid2">
              <Field label="گزینهٔ درست">
                <Select
                  className="ad-input--select"
                  options={(question.options ?? []).map((option, optionIndex) => ({
                    value: String(optionIndex),
                    label: `${faNumber(optionIndex + 1)}. ${option || '—'}`,
                  }))}
                  value={String(question.correctAnswer ?? 0)}
                  onChange={(event) => setQuestion(index, { correctAnswer: Number(event.target.value) })}
                />
              </Field>
              <Field label="مسیر مبحث" hint="اختیاری — برای دسته‌بندی">
                <Input dir="ltr" value={(question.topicPath ?? []).join(' › ')} onChange={(event) => setQuestion(index, { topicPath: event.target.value.split('›').map((part) => part.trim()).filter(Boolean) })} />
              </Field>
            </div>

            <Field label="توضیح پاسخ" hint="در بازخورد بعد از پاسخ نمایش داده می‌شود.">
              <Textarea rows={2} value={question.explanation ?? ''} onChange={(event) => setQuestion(index, { explanation: event.target.value })} />
            </Field>
          </div>
        ))}
      </div>

      {bulkOpen ? (
        <BulkQuestions
          onClose={() => setBulkOpen(false)}
          onAdd={(questions) => { set({ questions: [...checkpoint.questions, ...questions] }); setBulkOpen(false); }}
        />
      ) : null}

      {bankOpen ? (
        <BankPicker
          onClose={() => setBankOpen(false)}
          subjectId={unit.testBank?.subjectId}
          topicPaths={unit.testBank?.topicPaths}
          onAdd={(ids) => {
            set({ pinnedQuestionIds: [...new Set([...checkpoint.pinnedQuestionIds, ...ids])] });
            setBankOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

/* ────────────────────────── ساخت درسنامهٔ تازه ────────────────────────── */

/*
 * دو راه ساخت، هر دو با یک فرم:
 *   • «درس آمادهٔ تپش» — یکی از درس‌های رجیستری که ساختار مبحث/واحد/صفحه‌اش در کد
 *     هست؛ سرور همان ساختار را کپی می‌کند تا ادمین از صفر شروع نکند.
 *   • «درسنامهٔ خالی» — برای درسی که در رجیستری نیست؛ عنوان و رنگ را ادمین می‌دهد.
 *
 * درسی که از قبل رکورد پنل دارد با برچسب «از قبل ساخته شده» می‌آید و انتخابش ساخت را
 * قفل می‌کند تا دو درسنامهٔ هم‌نام برای یک درس ساخته نشود.
 */
export function CreateCourseDialog({ open, busy, subjects, takenSubjectIds, onClose, onCreate }) {
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [accent, setAccent] = useState('#ab8e7c');

  /* هر بار باز شدن، فرم از صفر شروع کند تا انتخاب قبلی جا نماند */
  useEffect(() => {
    if (!open) return;
    setSubjectId('');
    setTitle('');
    setAccent('#ab8e7c');
  }, [open]);

  const options = [
    { value: '', label: 'درسنامهٔ خالی (درس سفارشی)' },
    ...subjects.map((subject) => ({
      value: subject.id,
      label: `${subject.title} — ${takenSubjectIds.has(subject.id)
        ? 'از قبل ساخته شده'
        : `${faNumber(subject.topics)} مبحث آماده`}`,
    })),
  ];

  const picked = subjects.find((subject) => subject.id === subjectId) ?? null;
  const duplicate = Boolean(picked && takenSubjectIds.has(picked.id));
  const finalTitle = (title.trim() || picked?.title || '').trim();

  return (
    <Modal
      open={open}
      title="درسنامهٔ تازه"
      onClose={onClose}
      size="sm"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>انصراف</Button>
          <Button
            disabled={!finalTitle || duplicate || busy}
            loading={busy}
            onClick={() => onCreate({
              subjectId: picked?.id ?? '',
              title: finalTitle,
              englishTitle: picked?.englishTitle ?? '',
              accent: picked?.accent ?? accent,
              description: picked?.description ?? '',
            })}
          >
            ساخت درسنامه
          </Button>
        </>
      )}
    >
      <Field label="درس" hint="با انتخاب درس آماده، مبحث‌ها، واحدها و صفحه‌های همان درس کپی می‌شود.">
        <Select
          className="ad-input--select"
          options={options}
          value={subjectId}
          onChange={(event) => setSubjectId(event.target.value)}
        />
      </Field>

      {picked ? (
        <p className="ad-hint">
          <span className="ad-mic__swatch" style={{ background: picked.accent }} aria-hidden="true" />
          {picked.title}
          {picked.englishTitle ? ` · ${picked.englishTitle}` : ''}
          {' — '}
          {picked.description || 'بدون توضیح'}
        </p>
      ) : (
        <div className="ad-grid2">
          <Field label="عنوان درسنامه" required>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثلاً: سم‌شناسی" />
          </Field>
          <Field label="رنگ درس" hint="رنگ کارت این درس در داشبورد">
            <Input dir="ltr" value={accent} onChange={(event) => setAccent(event.target.value)} />
          </Field>
        </div>
      )}

      {duplicate ? (
        <p className="ad-hint ad-hint--warn">
          این درس از قبل درسنامه دارد. از فهرست بالای صفحه بازش کنید یا درس دیگری انتخاب کنید.
        </p>
      ) : null}
    </Modal>
  );
}

/* ────────────────────────── درخت ────────────────────────── */

/* درخت را جدا export کرده‌ایم چون ویوی اصلی داده را در افکت می‌گیرد و در رندر سرور
   (تأیید بدون مرورگر) فقط شعبهٔ بارگذاری دیده می‌شود. */
export function Outline({ course, node, onSelect, actions }) {
  const isNode = (kind, ids) => node?.kind === kind && ids.every(([key, value]) => node[key] === value);

  /* گره‌های بسته — کلید مبحث `t:<index>` و کلید واحد `u:<topic>:<unit>`.
     پیش‌فرض «همه باز» است تا ورود به لایه، ساختار کامل درسنامه را نشان دهد. */
  const [collapsed, setCollapsed] = useState(() => new Set());

  const toggleNode = (key) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  /* انتخاب هر گره، مسیر والدش را باز می‌کند تا گرهٔ انتخاب‌شده از چشم پنهان نماند */
  useEffect(() => {
    if (node?.topicIndex === undefined) return;
    setCollapsed((current) => {
      const next = new Set(current);
      next.delete(`t:${node.topicIndex}`);
      if (node.unitIndex !== undefined) next.delete(`u:${node.topicIndex}:${node.unitIndex}`);
      return next.size === current.size ? current : next;
    });
  }, [node]);

  const branchKeys = useMemo(() => {
    const keys = [];
    course.topics.forEach((topic, topicIndex) => {
      keys.push(`t:${topicIndex}`);
      (topic.units ?? []).forEach((unit, unitIndex) => keys.push(`u:${topicIndex}:${unitIndex}`));
    });
    return keys;
  }, [course.topics]);

  const allCollapsed = branchKeys.length > 0 && branchKeys.every((key) => collapsed.has(key));

  /* فلشِ باز/بسته — کلیک روی آن فقط گره را جمع می‌کند و انتخاب را عوض نمی‌کند */
  const caret = (key, label) => {
    const open = !collapsed.has(key);
    return (
      <button
        type="button"
        className={`ad-mic__caret ${open ? 'is-open' : ''}`}
        onClick={() => toggleNode(key)}
        aria-expanded={open}
        aria-label={`${open ? 'بستن' : 'باز کردن'} ${label}`}
        title={open ? 'بستن' : 'باز کردن'}
      >
        <IconChevron width={13} height={13} />
      </button>
    );
  };

  return (
    <nav className="ad-mic__tree" aria-label="ساختار درسنامه">
      <div className="ad-mic__treebar">
        <span className="ad-sub">
          {faNumber(course.topics.length)} مبحث · {faNumber(branchKeys.length)} گره
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(branchKeys))}
        >
          {allCollapsed ? 'باز کردن همه' : 'بستن همه'}
        </Button>
      </div>

      <button
        type="button"
        className={`ad-mic__node ${isNode('course', []) ? 'is-active' : ''}`}
        onClick={() => onSelect({ kind: 'course' })}
      >
        <IconMicroLesson width={15} height={15} />
        <span className="ad-mic__nodelabel">تنظیمات درسنامه</span>
        <Badge tone="neutral">{faNumber(course.topics.length)} مبحث</Badge>
      </button>

      {course.topics.map((topic, topicIndex) => {
        const topicKey = `t:${topicIndex}`;
        const topicOpen = !collapsed.has(topicKey);
        const topicUnits = topic.units ?? [];

        return (
          <div key={topicIndex} className="ad-mic__branch">
            <div className={`ad-mic__node ad-mic__node--topic ${isNode('topic', [['topicIndex', topicIndex]]) ? 'is-active' : ''}`}>
              {caret(topicKey, 'مبحث')}
              <button type="button" className="ad-mic__nodetoggle" onClick={() => onSelect({ kind: 'topic', topicIndex })}>
                <IconEdit width={15} height={15} />
                <span className="ad-mic__nodelabel">{topic.title || 'مبحث بی‌نام'}</span>
                {topic.published ? <Badge tone="neutral">آماده</Badge> : <Badge tone="neutral">در راه</Badge>}
              </button>
              <NodeActions
                label="مبحث"
                canMoveUp={topicIndex > 0}
                canMoveDown={topicIndex < course.topics.length - 1}
                onMove={(direction) => actions.moveTopic(topicIndex, direction)}
                onRemove={() => actions.removeTopic(topicIndex)}
              />
            </div>

            {topicOpen ? (
              <>
                {topicUnits.map((unit, unitIndex) => {
                  const unitKey = `u:${topicIndex}:${unitIndex}`;
                  const unitOpen = !collapsed.has(unitKey);
                  const unitPages = unit.pages ?? [];
                  const unitCheckpoints = unit.checkpoints ?? [];

                  return (
                    <div key={unitIndex} className="ad-mic__branch ad-mic__branch--unit">
                      <div className={`ad-mic__node ad-mic__node--unit ${isNode('unit', [['topicIndex', topicIndex], ['unitIndex', unitIndex]]) ? 'is-active' : ''}`}>
                        {caret(unitKey, 'واحد یادگیری')}
                        <button type="button" className="ad-mic__nodetoggle" onClick={() => onSelect({ kind: 'unit', topicIndex, unitIndex })}>
                          <IconEdit width={15} height={15} />
                          <span className="ad-mic__nodelabel">{unit.title || 'واحد یادگیری بی‌نام'}</span>
                          <Badge tone="neutral">{faNumber(unitPages.length)} صفحه</Badge>
                        </button>
                        <NodeActions
                          label="واحد"
                          canMoveUp={unitIndex > 0}
                          canMoveDown={unitIndex < topicUnits.length - 1}
                          onMove={(direction) => actions.moveUnit(topicIndex, unitIndex, direction)}
                          onRemove={() => actions.removeUnit(topicIndex, unitIndex)}
                        />
                      </div>

                      {unitOpen ? (
                        <>
                          {unitPages.map((page, pageIndex) => (
                            <div
                              key={pageIndex}
                              className={`ad-mic__node ad-mic__node--leaf ${isNode('page', [['topicIndex', topicIndex], ['unitIndex', unitIndex], ['pageIndex', pageIndex]]) ? 'is-active' : ''}`}
                            >
                              <button type="button" className="ad-mic__nodetoggle" onClick={() => onSelect({ kind: 'page', topicIndex, unitIndex, pageIndex })}>
                                <span className="ad-mic__nodedot" aria-hidden="true" />
                                <span className="ad-mic__nodelabel">{faNumber(page.order)}. {page.title || 'صفحهٔ بی‌نام'}</span>
                                <span className="ad-sub">{hasRichContent(page) ? 'متن دارد' : 'بدون متن'}</span>
                              </button>
                              <NodeActions
                                label="صفحه"
                                canMoveUp={pageIndex > 0}
                                canMoveDown={pageIndex < unitPages.length - 1}
                                onMove={(direction) => actions.movePage(topicIndex, unitIndex, pageIndex, direction)}
                                onRemove={() => actions.removePage(topicIndex, unitIndex, pageIndex)}
                              />
                            </div>
                          ))}

                          {unitCheckpoints.map((checkpoint, checkpointIndex) => (
                            <div
                              key={checkpointIndex}
                              className={`ad-mic__node ad-mic__node--leaf ad-mic__node--cp ${isNode('checkpoint', [['topicIndex', topicIndex], ['unitIndex', unitIndex], ['checkpointIndex', checkpointIndex]]) ? 'is-active' : ''}`}
                            >
                              <button type="button" className="ad-mic__nodetoggle" onClick={() => onSelect({ kind: 'checkpoint', topicIndex, unitIndex, checkpointIndex })}>
                                <IconTestBank width={14} height={14} />
                                <span className="ad-mic__nodelabel">ایستگاه تست {checkpoint.id || faNumber(checkpointIndex + 1)}</span>
                                <span className="ad-sub">{faNumber(checkpoint.questions?.length ?? 0)} دستی · {faNumber(checkpoint.pinnedQuestionIds?.length ?? 0)} بانک</span>
                              </button>
                              <NodeActions
                                label="ایستگاه"
                                canMoveUp={checkpointIndex > 0}
                                canMoveDown={checkpointIndex < unitCheckpoints.length - 1}
                                onMove={(direction) => actions.moveCheckpoint(topicIndex, unitIndex, checkpointIndex, direction)}
                                onRemove={() => actions.removeCheckpoint(topicIndex, unitIndex, checkpointIndex)}
                              />
                            </div>
                          ))}

                          <div className="ad-mic__addrow">
                            <Button variant="ghost" size="sm" onClick={() => actions.addPage(topicIndex, unitIndex)}><IconPlus width={13} height={13} /> صفحه</Button>
                            <Button variant="ghost" size="sm" onClick={() => actions.addCheckpoint(topicIndex, unitIndex)}><IconPlus width={13} height={13} /> ایستگاه تست</Button>
                          </div>
                        </>
                      ) : (
                        <div className="ad-mic__addrow">
                          <span className="ad-sub">
                            {faNumber(unitPages.length)} صفحه · {faNumber(unitCheckpoints.length)} ایستگاه تست
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="ad-mic__addrow">
                  <Button variant="ghost" size="sm" onClick={() => actions.addUnit(topicIndex)}><IconPlus width={13} height={13} /> واحد یادگیری</Button>
                </div>
              </>
            ) : (
              <div className="ad-mic__addrow">
                <span className="ad-sub">
                  {topicUnits.length === 0
                    ? 'هنوز واحد یادگیری ندارد'
                    : `${faNumber(topicUnits.length)} واحد · ${faNumber(topicUnits.reduce((total, unit) => total + (unit.pages ?? []).length, 0))} صفحه`}
                </span>
              </div>
            )}
          </div>
        );
      })}

      <div className="ad-mic__addrow">
        <Button variant="ghost" size="sm" onClick={actions.addTopic}><IconPlus width={13} height={13} /> مبحث جدید</Button>
      </div>
    </nav>
  );
}

/* ────────────────────────── ویوی اصلی ────────────────────────── */

export default function AdminMicro({ admin, onBack }) {
  const notify = useToast();
  const [filters, setFilters] = useState({ search: '', status: 'all' });
  const [courseId, setCourseId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [node, setNode] = useState({ kind: 'course' });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const can = (permission) => admin.permissions?.includes(permission);

  /* فهرست درس‌های رجیستری برای فرم ساخت — از سرور، نه از باندل پنل
     (وگرنه باندل پنل ۱۶ فایل درس را با خودش حمل می‌کرد) */
  const subjectsLoad = useCallback(() => microApi.subjects(), []);
  const { data: subjectsData } = useAsync(subjectsLoad, []);

  const listLoad = useCallback(
    () => microApi.list({ search: filters.search, status: filters.status, perPage: 100 }),
    [filters.search, filters.status],
  );
  const { data: listData, error: listError, reload: reloadList } = useAsync(listLoad, [filters.search, filters.status]);

  /* اولین درسنامه به‌صورت خودکار انتخاب می‌شود تا ورود به لایه خالی نباشد */
  useEffect(() => {
    if (courseId || !listData) return;
    setCourseId(listData.items?.[0]?.id ?? null);
  }, [listData, courseId]);

  const courseLoad = useCallback(() => (courseId ? microApi.get(courseId) : Promise.resolve(null)), [courseId]);
  const { data: courseData, loading, error, reload } = useAsync(courseLoad, [courseId]);

  useEffect(() => {
    setDraft(courseData?.course ?? null);
    setDirty(false);
    setNode({ kind: 'course' });
  }, [courseData]);

  const mutate = useCallback((mutator) => {
    setDraft((current) => (current ? mutator(current) : current));
    setDirty(true);
  }, []);

  const save = useCallback(async ({ silent = false } = {}) => {
    if (!draft) return null;
    setBusy(true);
    try {
      const data = await microApi.update(draft.id, draft);
      setDraft(data.course);
      setDirty(false);
      if (!silent) notify('تغییرات درسنامه ذخیره شد');
      reloadList();
      return data.course;
    } catch (actionError) {
      notify(actionError.message, 'error');
      return null;
    } finally {
      setBusy(false);
    }
  }, [draft, notify, reloadList]);

  /* انتشار = ذخیره (اگر لازم باشد) + تغییر وضعیت. از لحظهٔ انتشار، درسنامه در
     `/api/public/micro/library` به همهٔ کاربران تپش تحویل داده می‌شود. */
  const setPublished = useCallback(async (status) => {
    const current = dirty ? await save({ silent: true }) : draft;
    if (!current) return;
    setBusy(true);
    try {
      const data = await microApi.setStatus(current.id, status);
      setDraft(data.course);
      setDirty(false);
      notify(status === 'published'
        ? 'درسنامه برای همهٔ کاربران تپش منتشر شد'
        : 'انتشار برداشته شد — محتوا دست‌نخورده ماند');
      reloadList();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }
  }, [dirty, draft, save, notify, reloadList]);

  /* ساخت درسنامهٔ تازه از فرم؛ سرور اگر درس از رجیستری باشد ساختارش را کپی می‌کند */
  const createCourse = async (payload) => {
    setBusy(true);
    try {
      const data = await microApi.create(payload);
      notify('درسنامهٔ تازه ساخته شد — مبحث‌ها و صفحه‌هایش را کامل کنید');
      setCourseId(data.course.id);
      setDraft(data.course);
      setDirty(false);
      setNode({ kind: 'course' });
      setCreateOpen(false);
      reloadList();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await microApi.remove(pendingDelete.id);
      notify('درسنامه حذف شد');
      setPendingDelete(null);
      setCourseId(null);
      setDraft(null);
      reloadList();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  /* ── عملیات ساختار ── */

  const actions = useMemo(() => {
    const mapTopics = (course, topicIndex, mapper) => ({
      ...course,
      topics: course.topics.map((topic, i) => (i === topicIndex ? mapper(topic) : topic)),
    });

    const move = (list, index, direction) => {
      const target = index + direction;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    };

    return {
      addTopic: () => mutate((course) => ({ ...course, topics: [...course.topics, emptyTopic(course.topics.length)] })),
      removeTopic: (topicIndex) => mutate((course) => ({ ...course, topics: course.topics.filter((_, i) => i !== topicIndex) })),
      moveTopic: (topicIndex, direction) => mutate((course) => ({ ...course, topics: move(course.topics, topicIndex, direction) })),

      addUnit: (topicIndex) => mutate((course) => mapTopics(course, topicIndex, (topic) => ({
        ...topic, units: [...(topic.units ?? []), emptyUnit((topic.units ?? []).length)],
      }))),
      removeUnit: (topicIndex, unitIndex) => mutate((course) => mapTopics(course, topicIndex, (topic) => ({
        ...topic, units: topic.units.filter((_, i) => i !== unitIndex),
      }))),
      moveUnit: (topicIndex, unitIndex, direction) => mutate((course) => mapTopics(course, topicIndex, (topic) => ({
        ...topic, units: move(topic.units, unitIndex, direction),
      }))),

      addPage: (topicIndex, unitIndex) => mutate((course) => mapTopics(course, topicIndex, (topic) => ({
        ...topic,
        units: topic.units.map((unit, i) => (i !== unitIndex ? unit : {
          ...unit, pages: [...unit.pages, emptyPage(unit.pages.length)],
        })),
      }))),
      removePage: (topicIndex, unitIndex, pageIndex) => mutate((course) => mapTopics(course, topicIndex, (topic) => ({
        ...topic,
        units: topic.units.map((unit, i) => (i !== unitIndex ? unit : {
          ...unit,
          pages: unit.pages.filter((_, pageI) => pageI !== pageIndex)
            .map((page, pageI) => ({ ...page, order: pageI + 1 })),
        })),
      }))),
      movePage: (topicIndex, unitIndex, pageIndex, direction) => mutate((course) => mapTopics(course, topicIndex, (topic) => ({
        ...topic,
        units: topic.units.map((unit, i) => (i !== unitIndex ? unit : {
          ...unit,
          pages: move(unit.pages, pageIndex, direction).map((page, pageI) => ({ ...page, order: pageI + 1 })),
        })),
      }))),

      addCheckpoint: (topicIndex, unitIndex) => mutate((course) => mapTopics(course, topicIndex, (topic) => ({
        ...topic,
        units: topic.units.map((unit, i) => (i !== unitIndex ? unit : {
          ...unit,
          checkpoints: [...unit.checkpoints, emptyCheckpoint(unit.checkpoints.length, unit.pages.at(-1)?.id)],
        })),
      }))),
      removeCheckpoint: (topicIndex, unitIndex, checkpointIndex) => mutate((course) => mapTopics(course, topicIndex, (topic) => ({
        ...topic,
        units: topic.units.map((unit, i) => (i !== unitIndex ? unit : {
          ...unit, checkpoints: unit.checkpoints.filter((_, cpI) => cpI !== checkpointIndex),
        })),
      }))),
      moveCheckpoint: (topicIndex, unitIndex, checkpointIndex, direction) => mutate((course) => mapTopics(course, topicIndex, (topic) => ({
        ...topic,
        units: topic.units.map((unit, i) => (i !== unitIndex ? unit : {
          ...unit, checkpoints: move(unit.checkpoints, checkpointIndex, direction),
        })),
      }))),
    };
  }, [mutate]);

  const setTopicAt = (topicIndex, topic) => mutate((course) => ({
    ...course, topics: course.topics.map((item, i) => (i === topicIndex ? topic : item)),
  }));

  const setUnitAt = (topicIndex, unitIndex, unit) => mutate((course) => ({
    ...course,
    topics: course.topics.map((topic, i) => (i !== topicIndex ? topic : {
      ...topic, units: topic.units.map((item, u) => (u === unitIndex ? unit : item)),
    })),
  }));

  const setPageAt = (topicIndex, unitIndex, pageIndex, page) => mutate((course) => ({
    ...course,
    topics: course.topics.map((topic, i) => (i !== topicIndex ? topic : {
      ...topic,
      units: topic.units.map((unit, u) => (u !== unitIndex ? unit : {
        ...unit, pages: unit.pages.map((item, p) => (p === pageIndex ? page : item)),
      })),
    })),
  }));

  const setCheckpointAt = (topicIndex, unitIndex, checkpointIndex, checkpoint) => mutate((course) => ({
    ...course,
    topics: course.topics.map((topic, i) => (i !== topicIndex ? topic : {
      ...topic,
      units: topic.units.map((unit, u) => (u !== unitIndex ? unit : {
        ...unit, checkpoints: unit.checkpoints.map((item, c) => (c === checkpointIndex ? checkpoint : item)),
      })),
    })),
  }));

  /* ── گرهٔ انتخابی ── */

  const selected = useMemo(() => {
    if (!draft || !node) return null;
    const topic = draft.topics[node.topicIndex];
    const unit = topic?.units?.[node.unitIndex];
    return {
      topic,
      unit,
      page: unit?.pages?.[node.pageIndex],
      checkpoint: unit?.checkpoints?.[node.checkpointIndex],
    };
  }, [draft, node]);

  const renderEditor = () => {
    if (!draft) return null;

    switch (node.kind) {
      case 'topic':
        return selected.topic
          ? <TopicEditor topic={selected.topic} onChange={(topic) => setTopicAt(node.topicIndex, topic)} />
          : <EmptyState title="این مبحث پیدا نشد" description="با تغییر ساختار، انتخاب قبلی معتبر نمانده است." />;
      case 'unit':
        return selected.unit
          ? <UnitEditor unit={selected.unit} onChange={(unit) => setUnitAt(node.topicIndex, node.unitIndex, unit)} />
          : <EmptyState title="این واحد پیدا نشد" description="با تغییر ساختار، انتخاب قبلی معتبر نمانده است." />;
      case 'page':
        return selected.page
          ? <PageEditor page={selected.page} unit={selected.unit} onChange={(page) => setPageAt(node.topicIndex, node.unitIndex, node.pageIndex, page)} />
          : <EmptyState title="این صفحه پیدا نشد" description="با تغییر ساختار، انتخاب قبلی معتبر نمانده است." />;
      case 'checkpoint':
        return selected.checkpoint
          ? <CheckpointEditor checkpoint={selected.checkpoint} unit={selected.unit} onChange={(checkpoint) => setCheckpointAt(node.topicIndex, node.unitIndex, node.checkpointIndex, checkpoint)} />
          : <EmptyState title="این ایستگاه پیدا نشد" description="با تغییر ساختار، انتخاب قبلی معتبر نمانده است." />;
      default:
        return <CourseEditor course={draft} onChange={(course) => mutate(() => course)} />;
    }
  };

  const counts = useMemo(() => {
    if (!draft) return null;
    const units = draft.topics.flatMap((topic) => topic.units ?? []);
    const pages = units.flatMap((unit) => unit.pages ?? []);
    const checkpoints = units.flatMap((unit) => unit.checkpoints ?? []);
    return {
      topics: draft.topics.length,
      pages: pages.length,
      checkpoints: checkpoints.length,
      bank: checkpoints.reduce((total, cp) => total + (cp.pinnedQuestionIds?.length ?? 0), 0),
      manual: checkpoints.reduce((total, cp) => total + (cp.questions?.length ?? 0), 0),
    };
  }, [draft]);

  const published = draft?.status === 'published';

  return (
    <div className="ad-stack">
      <div className="ad-toolbar">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <IconChevron width={15} height={15} style={{ transform: 'rotate(180deg)' }} />
          بازگشت به صفحات
        </Button>

        <Select
          options={(listData?.items ?? []).map((item) => ({
            value: item.id,
            label: `${item.title}${item.status === 'published' ? ' ✓' : ''}`,
          }))}
          value={courseId ?? ''}
          onChange={(event) => setCourseId(event.target.value)}
          aria-label="درسنامه"
        />

        <SearchInput value={filters.search} onChange={(search) => setFilters((current) => ({ ...current, search }))} placeholder="جست‌وجوی درسنامه…" />
        <Select options={STATUS_OPTIONS} value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} aria-label="وضعیت" />

        <div className="ad-toolbar__end">
          <Button variant="ghost" size="sm" onClick={() => { reloadList(); if (courseId) reload(); }}>
            <IconRefresh width={15} height={15} />تازه‌سازی
          </Button>
          {can('micro.create') ? (
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(true)}><IconPlus width={15} height={15} />درسنامهٔ جدید</Button>
          ) : null}
        </div>
      </div>

      {listError ? <ErrorState error={listError} onRetry={reloadList} /> : null}
      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !draft ? <LoadingBlock label="در حال خواندن درسنامه…" rows={5} /> : null}

      {!loading && !draft && !error ? (
        <EmptyState
          title="هنوز درسنامه‌ای ثبت نشده"
          description="با «درسنامهٔ جدید» اولین درسنامه را بسازید؛ بعد مبحث، واحد یادگیری، صفحه و ایستگاه تست اضافه کنید."
          action={can('micro.create') ? <Button onClick={() => setCreateOpen(true)}>درسنامهٔ جدید</Button> : null}
        />
      ) : null}

      {draft ? (
        <>
          <div className="ad-mic__bar">
            <span className="ad-mic__bartitle">
              <IconMicroLesson width={17} height={17} />
              <strong>{draft.title}</strong>
              <StatusBadge status={draft.status} />
              {dirty ? <Badge tone="neutral">ذخیره‌نشده</Badge> : null}
            </span>

            <span className="ad-mic__barmeta">
              <span className="ad-sub">{faNumber(counts.topics)} مبحث</span>
              <span className="ad-sub">{faNumber(counts.pages)} صفحه</span>
              <span className="ad-sub">{faNumber(counts.checkpoints)} ایستگاه تست</span>
              <span className="ad-sub">{faNumber(counts.bank + counts.manual)} سؤال</span>
              <span className="ad-sub">آخرین ویرایش {faDateTime(draft.updatedAt)}</span>
              {draft.publishedAt ? <span className="ad-sub">انتشار {faDateTime(draft.publishedAt)}</span> : null}
            </span>

            <span className="ad-mic__baractions">
              {can('micro.update') ? (
                <Button size="sm" variant="ghost" loading={busy} disabled={!dirty} onClick={() => save()}>
                  ذخیره تغییرات
                </Button>
              ) : null}

              {can('micro.publish') ? (
                published ? (
                  <Button size="sm" variant="ghost" loading={busy} onClick={() => setPublished('draft')}>
                    لغو انتشار
                  </Button>
                ) : (
                  <Button size="sm" loading={busy} onClick={() => setPublished('published')}>
                    <IconSend width={15} height={15} />
                    انتشار برای کاربران تپش
                  </Button>
                )
              ) : null}

              {can('micro.delete') ? (
                <IconButton label="حذف درسنامه" tone="danger" onClick={() => setPendingDelete(draft)}>
                  <IconTrash width={16} height={16} />
                </IconButton>
              ) : null}
            </span>
          </div>

          {published ? (
            <p className="ad-mic__hint">
              این درسنامه منتشر شده است و از مسیر <code className="ad-code" dir="ltr">/api/public/micro/library</code> برای همهٔ کاربران تپش سرو می‌شود.
              هر تغییر بعدی با «ذخیره تغییرات» روی همان نسخهٔ منتشرشده می‌نشیند.
            </p>
          ) : null}

          <div className="ad-mic__layout">
            <Outline
              course={draft}
              node={node}
              onSelect={setNode}
              actions={actions}
            />

            <section className="ad-mic__editor" aria-label="ویرایشگر">
              {renderEditor()}
            </section>
          </div>
        </>
      ) : null}

      <CreateCourseDialog
        open={createOpen}
        busy={busy}
        subjects={subjectsData?.subjects ?? []}
        takenSubjectIds={new Set((listData?.items ?? []).map((item) => item.subjectId))}
        onClose={() => setCreateOpen(false)}
        onCreate={createCourse}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف درسنامه"
        message={`آیا از حذف «${pendingDelete?.title ?? ''}» با همهٔ مبحث‌ها، صفحه‌ها و ایستگاه‌های تستش مطمئن هستید؟ اگر منتشر شده باشد، از دسترس کاربران تپش هم خارج می‌شود.`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
