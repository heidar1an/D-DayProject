/*
 * مراجع تپش — لایهٔ داخل پنل، به همان قاعدهٔ لایهٔ میکرو درسنامه.
 *
 * از کارت «رفرنس» در بخش «صفحات» باز می‌شود (`navigate('reference-library')`) و
 * `onBack` به همان بخش برمی‌گرداند. در سایدبار آیتم جداگانه‌ای ندارد.
 *
 * چیدمان، آینهٔ «میکرو درسنامه تپش» است (الگوی پروژه برای لایه‌ای که کارش ادیت
 * و کنترلِ کل محتواست):
 *   نوار بالا  → انتخاب مرجع + جست‌وجو/وضعیت + «مرجع جدید» + شمارنده‌ها +
 *                ذخیره + انتشار + حذف
 *   دو ستون    → درخت بخش‌ها و مباحث (`ad-ref__tree`) | ویرایشگر گرهٔ انتخابی
 *                (`ad-ref__editor`)
 *
 * سه سطحِ مدیریت همان خواستهٔ اصلی است:
 *   ۱) افزودن/حذف مرجع (کتاب)
 *   ۲) افزودن/حذف و جابه‌جاییِ بخش داخل مرجع (درخت، با فلش‌های بالا/پایین)
 *   ۳) افزودن/حذف و جابه‌جاییِ مبحث داخل هر بخش، و ویرایش متنِ آن با همان
 *      تجربهٔ میکرو درسنامه (رنگ متن و کادرهای آمادهٔ `micr-*`)
 *
 * ذخیره‌سازی یک رکورد کامل است (فراداده + بخش‌ها + متن)، پس ویرایش یک `PUT`
 * کامل می‌فرستد و انتشار اتمیک می‌ماند — همان قرارداد فلش‌کارت و میکرو.
 * مرجع‌های کاتالوگ ثابت تپش `origin: 'tapesh'` دارند و با نشان «تپش» دیده
 * می‌شوند؛ مرجع‌های ساختهٔ پنل `origin: 'panel'`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { references as referencesApi } from '../../../services/admin/adminService';
import {
  Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input,
  LoadingBlock, Modal, SearchInput, Select, StatusBadge, faDateTime, faNumber,
  useAsync, useToast,
} from '../adminShared';
import {
  IconChevron, IconEdit, IconPlus, IconRefresh, IconReference, IconSend, IconTrash,
} from '../adminIcons';
import RichTextEditor from '../RichTextEditor';

const STATUS_OPTIONS = [
  { value: 'all', label: 'همهٔ وضعیت‌ها' },
  { value: 'published', label: 'منتشرشده' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'archived', label: 'بایگانی' },
];

/* وضعیت انتشار در ویرایشگر — دکمهٔ نوار بالا همان را اتمیک انجام می‌دهد */
const PUBLISH_OPTIONS = [
  { value: 'published', label: 'منتشرشده (برای کاربران)' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'archived', label: 'بایگانی' },
];

/* نقش‌برجستهٔ جلد مرجع — همان سه شکلی که قفسهٔ کاربران می‌شناسد */
const GLYPH_OPTIONS = [
  { value: 'bone', label: 'استخوان' },
  { value: 'cell', label: 'سلول' },
  { value: 'heart', label: 'قلب' },
];

const STATUS_LABEL = { draft: 'پیش‌نویس', published: 'منتشرشده', archived: 'بایگانی' };

/*
 * رنگ‌ها و کادرهای آمادهٔ ویرایشگر مبحث — همان پیکربندی میکرو درسنامه (`AdminMicro`).
 * متن مبحث همان کلاس‌های محتوا را می‌گیرد (`micr-tone--*` و `micr-callout--*`) تا
 * پیش‌نمایش ویرایشگر و متن منتشرشده یکی بماند؛ پاک‌ساز HTML فقط `class` را عبور
 * می‌دهد، پس رنگ با کلاس است نه `style`. ساختار کادرهای درج از seed ساده‌تر است:
 * سرتیتر با `strong` (بدون برچسبِ گردِ `micr-callout__tag` که در ویرایشگر به‌صورت
 * عنوان آبی دیده می‌شد و کاربر حذفش را خواست) و متن در `p` بعدی.
 */
const TOPIC_TONES = [
  { value: 'gold', label: 'طلایی' },
  { value: 'green', label: 'سبز' },
  { value: 'blue', label: 'آبی' },
  { value: 'purple', label: 'بنفش' },
  { value: 'red', label: 'قرمز' },
  { value: 'brown', label: 'قهوه‌ای' },
  { value: '', label: 'حذف رنگ' },
];

/* `select` متنِ راهنمای بدنه است؛ بعد از درج انتخاب می‌شود تا جای تایپ کاربر بیاید */
const TOPIC_INSERTS = [
  {
    label: 'تعریف',
    hint: 'کادر «تعریف» را در متن درج می‌کند',
    select: 'متن تعریف را اینجا بنویسید…',
    html: '<div class="micr-callout micr-callout--def">'
      + '<p><strong>تعریف</strong></p>'
      + '<p>متن تعریف را اینجا بنویسید…</p>'
      + '</div><p><br></p>',
  },
  {
    label: 'نکتهٔ کلیدی',
    hint: 'کادر «نکتهٔ کلیدی» را در متن درج می‌کند',
    select: 'متن نکته را اینجا بنویسید…',
    html: '<div class="micr-callout micr-callout--key">'
      + '<p><strong>نکتهٔ کلیدی</strong></p>'
      + '<p>متن نکته را اینجا بنویسید…</p>'
      + '</div><p><br></p>',
  },
  {
    label: 'هشدار / اشتباه رایج',
    hint: 'کادر «هشدار / اشتباه رایج» را در متن درج می‌کند',
    select: 'هشدار یا اشتباه رایج را اینجا بنویسید…',
    html: '<div class="micr-callout micr-callout--warn">'
      + '<p><strong>هشدار / اشتباه رایج</strong></p>'
      + '<p>هشدار یا اشتباه رایج را اینجا بنویسید…</p>'
      + '</div><p><br></p>',
  },
  {
    label: 'ارتباط بالینی',
    hint: 'کادر «ارتباط بالینی» را در متن درج می‌کند',
    select: 'پیوند بالینی این موضوع را اینجا بنویسید…',
    html: '<div class="micr-callout micr-callout--clinical">'
      + '<p><strong>ارتباط بالینی</strong></p>'
      + '<p>پیوند بالینی این موضوع را اینجا بنویسید…</p>'
      + '</div><p><br></p>',
  },
];

/* ── ابزارهای خالص (بدون DOM، برای سنجشِ بدون مرورگر هم قابل استفاده‌اند) ── */

/* طول متنِ واقعیِ یک بخش: تگ‌ها و فاصله‌های اضافه حساب نمی‌شوند */
export function plainLength(html) {
  return String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .length;
}

/* آیا این بخش متن دارد؟ (برچسبِ «متن دارد / بدون متن» در درخت) */
export function hasText(section) {
  return plainLength(section?.content) > 0;
}

/* بخش تازه و مبحث تازه — `id` را سرور می‌سازد تا با رکوردهای موجود تصادم نکند */
function newSection() {
  return { id: null, title: '', topics: [] };
}

function newTopic() {
  return { id: null, title: '', content: '' };
}

export const EMPTY_REFERENCE = {
  title: '',
  latin: '',
  edition: '',
  authors: '',
  subject: '',
  accent: '#5b8cc7',
  pages: 0,
  glyph: 'bone',
  status: 'published',
  sections: [],
};

/*
 * اعتبارسنجی فرم — فقط چیزی که جلوی ذخیره را می‌گیرد.
 * تعداد بخش‌ها و متن آن‌ها محدودیت ندارد؛ بخشِ بی‌عنوان هم مجاز است و سرور
 * برایش عنوان پیش‌فرض می‌گذارد.
 */
export function validateReference(form) {
  const errors = {};
  if (!String(form?.title ?? '').trim()) errors.title = 'عنوان مرجع الزامی است';
  return errors;
}

/* ── اجزای کوچکِ هم‌خانواده با لایهٔ میکرو ── */

/* ردیف بالا/پایین/حذف برای هر گرهٔ درخت */
function NodeActions({ onMove, onRemove, canMoveUp = true, canMoveDown = true, label }) {
  return (
    <span className="ad-ref__nodeactions">
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

/* ── ویرایشگرها ── */

/* گرهٔ «مشخصات مرجع» — فرادادهٔ کتاب
   (export شده تا بشود بدون مرورگر هم رندر و سنجید، مثل `PageEditor` در میکرو) */
export function ReferenceEditor({ reference, onChange }) {
  const set = (changes) => onChange({ ...reference, ...changes });

  return (
    <div className="ad-stack">
      <div className="ad-ref__group">
        <div className="ad-ref__grouphead">
          <h4>شناسهٔ مرجع</h4>
          {reference.origin === 'tapesh' ? <Badge tone="neutral">تپش</Badge> : null}
        </div>
        <div className="ad-grid2">
          <Field label="عنوان مرجع" required hint="روی جلد و در قفسهٔ مراجع نمایش داده می‌شود.">
            <Input value={reference.title ?? ''} onChange={(event) => set({ title: event.target.value })} />
          </Field>
          <Field label="عنوان لاتین" hint="زیر عنوان روی جلد می‌آید.">
            <Input dir="ltr" value={reference.latin ?? ''} onChange={(event) => set({ latin: event.target.value })} />
          </Field>
        </div>
      </div>

      <div className="ad-ref__group">
        <div className="ad-ref__grouphead"><h4>مشخصات کتاب</h4></div>
        <div className="ad-grid2">
          <Field label="ویرایش"><Input value={reference.edition ?? ''} onChange={(event) => set({ edition: event.target.value })} /></Field>
          <Field label="نویسنده یا نویسندگان"><Input value={reference.authors ?? ''} onChange={(event) => set({ authors: event.target.value })} /></Field>
        </div>
        <div className="ad-grid2">
          <Field label="موضوع"><Input value={reference.subject ?? ''} onChange={(event) => set({ subject: event.target.value })} /></Field>
          <Field label="تعداد صفحه">
            <Input type="number" min="0" value={reference.pages ?? 0} onChange={(event) => set({ pages: Number(event.target.value) || 0 })} />
          </Field>
        </div>
      </div>

      <div className="ad-ref__group">
        <div className="ad-ref__grouphead"><h4>ظاهر و انتشار</h4></div>
        <div className="ad-grid2">
          <Field label="رنگ جلد (hex)" hint="رنگ قفسه و جلد مرجع.">
            <span className="ad-ref__accent">
              <span className="ad-ref__swatch" style={{ background: reference.accent }} aria-hidden="true" />
              <Input dir="ltr" value={reference.accent ?? ''} onChange={(event) => set({ accent: event.target.value })} />
            </span>
          </Field>
          <Field label="نقش جلد">
            <Select options={GLYPH_OPTIONS} value={reference.glyph ?? 'bone'} onChange={(event) => set({ glyph: event.target.value })} aria-label="نقش جلد" />
          </Field>
        </div>
        <Field label="وضعیت انتشار" hint={`«${STATUS_LABEL[reference.status] ?? 'پیش‌نویس'}» — دکمهٔ نوار بالا هم همین را اتمیک ذخیره می‌کند.`}>
          <Select options={PUBLISH_OPTIONS} value={reference.status ?? 'draft'} onChange={(event) => set({ status: event.target.value })} aria-label="وضعیت انتشار" />
        </Field>
      </div>
    </div>
  );
}

/* گرهٔ هر بخش — عنوان بخش (مبحث‌ها و متن‌شان گره‌های زیرین‌اند) */
export function SectionEditor({ section, index, total, onChange }) {
  const set = (changes) => onChange({ ...section, ...changes });
  const topics = section.topics ?? [];

  return (
    <div className="ad-stack">
      <div className="ad-ref__group">
        <div className="ad-ref__grouphead">
          <h4>عنوان بخش</h4>
          <span className="ad-sub">بخش {faNumber(index + 1)} از {faNumber(total)}</span>
        </div>
        <Field label="عنوان بخش" hint="در فهرست بخش‌های مرجع و در درخت سمت راست دیده می‌شود.">
          <Input
            value={section.title ?? ''}
            onChange={(event) => set({ title: event.target.value })}
            placeholder="مثال: قلب"
          />
        </Field>
      </div>

      <div className="ad-ref__group">
        <div className="ad-ref__grouphead">
          <h4>مبحث‌های این بخش</h4>
          <span className="ad-sub">{faNumber(topics.length)} مبحث · {faNumber(topics.filter(hasText).length)} با متن</span>
        </div>
        <p className="ad-ref__hint">
          متن هر بخش روی مبحث‌های آن نشسته است — مثل میکرو درسنامه. از درخت سمت راست
          مبحث تازه اضافه کنید یا یکی را انتخاب کنید تا متنش را ویرایش کنید.
        </p>
        {topics.length ? (
          <ol className="ad-ref__topiclist">
            {topics.map((topic, topicIndex) => (
              <li key={topic.id ?? topicIndex}>
                <span>{faNumber(topicIndex + 1)}. {topic.title || 'مبحث بی‌نام'}</span>
                <span className="ad-sub">{hasText(topic) ? 'متن دارد' : 'بدون متن'}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="ad-ref__hint">این بخش هنوز مبحث ندارد؛ از درخت سمت راست «مبحث جدید» بسازید.</p>
        )}
      </div>
    </div>
  );
}

/* گرهٔ هر مبحث — عنوان + متن غنی (همان تجربهٔ ویرایش صفحهٔ میکرو درسنامه) */
export function TopicEditor({ topic, onChange }) {
  const set = (changes) => onChange({ ...topic, ...changes });

  return (
    <div className="ad-stack">
      <div className="ad-ref__group">
        <div className="ad-ref__grouphead">
          <h4>عنوان مبحث</h4>
          <span className="ad-sub">{hasText(topic) ? 'متن دارد' : 'بدون متن'}</span>
        </div>
        <Field label="عنوان مبحث" hint="عنوان این مبحث در درخت و در فهرست مطالب مرجع می‌آید.">
          <Input
            value={topic.title ?? ''}
            onChange={(event) => set({ title: event.target.value })}
            placeholder="مثال: هدف مطالعه فیزیولوژی"
          />
        </Field>
      </div>

      <div className="ad-ref__group">
        <div className="ad-ref__grouphead">
          <h4>متن مبحث</h4>
          <span className="ad-sub">{faNumber(plainLength(topic.content))} نویسه</span>
        </div>
        <RichTextEditor
          value={topic.content ?? ''}
          onChange={(html) => set({ content: html })}
          placeholder="متن این مبحث را اینجا بنویسید…"
          tones={TOPIC_TONES}
          inserts={TOPIC_INSERTS}
        />
      </div>
    </div>
  );
}

/* ── ساخت مرجع تازه ── */

export function CreateReferenceDialog({ open, busy, onClose, onCreate }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_REFERENCE }));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY_REFERENCE });
    setErrors({});
  }, [open]);

  const submit = () => {
    const found = validateReference(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onCreate(form);
  };

  return (
    <Modal
      open={open}
      title="مرجع جدید"
      subtitle="فرادادهٔ کتاب را بسازید؛ بخش‌ها و متن‌شان را بعد در همین لایه اضافه می‌کنید."
      size="sm"
      onClose={busy ? undefined : onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>انصراف</Button>
          <Button onClick={submit} loading={busy}>ساخت مرجع</Button>
        </>
      )}
    >
      <div className="ad-stack">
        <Field label="عنوان مرجع" required error={errors.title}>
          <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="مثال: ایمونولوژی عباس" />
        </Field>
        <Field label="عنوان لاتین">
          <Input dir="ltr" value={form.latin} onChange={(event) => setForm((current) => ({ ...current, latin: event.target.value }))} />
        </Field>
        <div className="ad-grid2">
          <Field label="موضوع"><Input value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} /></Field>
          <Field label="ویرایش"><Input value={form.edition} onChange={(event) => setForm((current) => ({ ...current, edition: event.target.value }))} /></Field>
        </div>
        <div className="ad-grid2">
          <Field label="نقش جلد">
            <Select options={GLYPH_OPTIONS} value={form.glyph} onChange={(event) => setForm((current) => ({ ...current, glyph: event.target.value }))} aria-label="نقش جلد" />
          </Field>
          <Field label="رنگ جلد (hex)">
            <Input dir="ltr" value={form.accent} onChange={(event) => setForm((current) => ({ ...current, accent: event.target.value }))} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/* ────────────────────────── ویوی اصلی ────────────────────────── */

export default function AdminReferences({ admin, onBack }) {
  const notify = useToast();
  const [filters, setFilters] = useState({ search: '', status: 'all' });
  const [referenceId, setReferenceId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [node, setNode] = useState({ kind: 'reference' });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  /* گره‌های بستهٔ درخت — کلید بخش `s:<index>`؛ پیش‌فرض «همه باز» مثل میکرو */
  const [collapsed, setCollapsed] = useState(() => new Set());

  /* فلشِ باز/بسته فقط همان شاخه را جمع می‌کند و انتخاب را عوض نمی‌کند */
  const toggleBranch = (key) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  const can = (permission) => admin?.permissions?.includes(permission);

  const listLoad = useCallback(
    () => referencesApi.list({ search: filters.search, status: filters.status, perPage: 100 }),
    [filters.search, filters.status],
  );
  const { data: listData, error: listError, reload: reloadList } = useAsync(listLoad, [filters.search, filters.status]);

  /* اولین مرجع خودکار انتخاب می‌شود تا ورود به لایه خالی نباشد */
  useEffect(() => {
    if (referenceId || !listData) return;
    setReferenceId(listData.items?.[0]?.id ?? null);
  }, [listData, referenceId]);

  const referenceLoad = useCallback(
    () => (referenceId ? referencesApi.get(referenceId) : Promise.resolve(null)),
    [referenceId],
  );
  const { data: referenceData, loading, error, reload } = useAsync(referenceLoad, [referenceId]);

  useEffect(() => {
    setDraft(referenceData?.reference ?? null);
    setDirty(false);
    setNode({ kind: 'reference' });
  }, [referenceData]);

  const mutate = useCallback((mutator) => {
    setDraft((current) => (current ? mutator(current) : current));
    setDirty(true);
  }, []);

  const save = useCallback(async ({ silent = false } = {}) => {
    if (!draft) return null;
    setBusy(true);
    try {
      const data = await referencesApi.update(draft.id, draft);
      setDraft(data.reference);
      setDirty(false);
      if (!silent) notify('تغییرات مرجع ذخیره شد');
      reloadList();
      return data.reference;
    } catch (actionError) {
      notify(actionError.message, 'error');
      return null;
    } finally {
      setBusy(false);
    }
  }, [draft, notify, reloadList]);

  /* انتشار = ذخیره (اگر لازم باشد) + تغییر وضعیت. از لحظهٔ انتشار، مرجع در
     `/api/public/references/library` در دسترس لایهٔ رفرنس کاربران می‌گذارد. */
  const setPublished = useCallback(async (status) => {
    const current = dirty ? await save({ silent: true }) : draft;
    if (!current) return;
    setBusy(true);
    try {
      const data = await referencesApi.update(current.id, { ...current, status });
      setDraft(data.reference);
      setDirty(false);
      notify(status === 'published'
        ? 'مرجع برای کاربران تپش منتشر شد'
        : 'انتشار برداشته شد — محتوا دست‌نخورده ماند');
      reloadList();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }
  }, [dirty, draft, save, notify, reloadList]);

  const createReference = async (payload) => {
    setBusy(true);
    try {
      const data = await referencesApi.create({ ...payload, sections: [newSection()] });
      notify('مرجع تازه ساخته شد — بخش‌ها و متن‌شان را کامل کنید');
      setReferenceId(data.reference.id);
      setDraft(data.reference);
      setDirty(false);
      setNode({ kind: 'reference' });
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
      await referencesApi.remove(pendingDelete.id);
      notify('مرجع حذف شد');
      setPendingDelete(null);
      setReferenceId(null);
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
    const mapSections = (reference, sectionIndex, mapper) => ({
      ...reference,
      sections: reference.sections.map((section, i) => (i === sectionIndex ? mapper(section) : section)),
    });

    const move = (list, index, direction) => {
      const target = index + direction;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    };

    return {
      addSection: () => mutate((reference) => ({ ...reference, sections: [...reference.sections, newSection()] })),
      removeSection: (index) => mutate((reference) => ({
        ...reference,
        sections: reference.sections.filter((_, i) => i !== index),
      })),
      moveSection: (index, direction) => mutate((reference) => ({
        ...reference,
        sections: move(reference.sections, index, direction),
      })),

      addTopic: (sectionIndex) => mutate((reference) => mapSections(reference, sectionIndex, (section) => ({
        ...section,
        topics: [...(section.topics ?? []), newTopic()],
      }))),
      removeTopic: (sectionIndex, topicIndex) => mutate((reference) => mapSections(reference, sectionIndex, (section) => ({
        ...section,
        topics: (section.topics ?? []).filter((_, i) => i !== topicIndex),
      }))),
      moveTopic: (sectionIndex, topicIndex, direction) => mutate((reference) => mapSections(reference, sectionIndex, (section) => ({
        ...section,
        topics: move(section.topics ?? [], topicIndex, direction),
      }))),
    };
  }, [mutate]);

  const setSectionAt = (index, section) => mutate((reference) => ({
    ...reference,
    sections: reference.sections.map((item, i) => (i === index ? section : item)),
  }));

  const setTopicAt = (sectionIndex, topicIndex, topic) => mutate((reference) => ({
    ...reference,
    sections: reference.sections.map((section, i) => (i !== sectionIndex ? section : {
      ...section,
      topics: (section.topics ?? []).map((item, t) => (t === topicIndex ? topic : item)),
    })),
  }));

  /* ── گرهٔ انتخابی ── */

  const selected = useMemo(() => {
    if (!draft || !node || node.kind === 'reference') return {};
    const section = draft.sections?.[node.sectionIndex];
    return {
      section,
      topic: section?.topics?.[node.topicIndex],
    };
  }, [draft, node]);

  /* انتخاب مبحث/بخش، شاخهٔ والدش را باز می‌کند تا گرهٔ انتخاب‌شده پنهان نماند */
  useEffect(() => {
    if (node.kind === 'reference') return;
    setCollapsed((current) => {
      const next = new Set(current);
      next.delete(`s:${node.sectionIndex}`);
      return next.size === current.size ? current : next;
    });
  }, [node]);

  const renderEditor = () => {
    if (!draft) return null;

    if (node.kind === 'section') {
      return selected.section
        ? (
          <SectionEditor
            section={selected.section}
            index={node.sectionIndex}
            total={draft.sections.length}
            onChange={(section) => setSectionAt(node.sectionIndex, section)}
          />
        )
        : <EmptyState title="این بخش پیدا نشد" description="با تغییر ساختار، انتخاب قبلی معتبر نمانده است." />;
    }

    if (node.kind === 'topic') {
      return selected.topic
        ? <TopicEditor topic={selected.topic} onChange={(topic) => setTopicAt(node.sectionIndex, node.topicIndex, topic)} />
        : <EmptyState title="این مبحث پیدا نشد" description="با تغییر ساختار، انتخاب قبلی معتبر نمانده است." />;
    }

    return <ReferenceEditor reference={draft} onChange={(reference) => mutate(() => reference)} />;
  };

  const counts = useMemo(() => {
    const sections = draft?.sections ?? [];
    const topics = sections.flatMap((section) => section.topics ?? []);
    return {
      sections: sections.length,
      topics: topics.length,
      withText: topics.filter(hasText).length,
      chars: topics.reduce((total, topic) => total + plainLength(topic.content), 0),
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
          value={referenceId ?? ''}
          onChange={(event) => setReferenceId(event.target.value)}
          aria-label="مرجع"
        />

        <SearchInput value={filters.search} onChange={(search) => setFilters((current) => ({ ...current, search }))} placeholder="جست‌وجوی مرجع…" />
        <Select options={STATUS_OPTIONS} value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} aria-label="وضعیت" />

        <div className="ad-toolbar__end">
          <Button variant="ghost" size="sm" onClick={() => { reloadList(); if (referenceId) reload(); }}>
            <IconRefresh width={15} height={15} />تازه‌سازی
          </Button>
          {can('references.create') ? (
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(true)}><IconPlus width={15} height={15} />مرجع جدید</Button>
          ) : null}
        </div>
      </div>

      {listError ? <ErrorState error={listError} onRetry={reloadList} /> : null}
      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !draft ? <LoadingBlock label="در حال خواندن مرجع…" rows={5} /> : null}

      {!loading && !draft && !error ? (
        <EmptyState
          title="هنوز مرجعی ثبت نشده"
          description="با «مرجع جدید» اولین کتاب را بسازید؛ بعد بخش‌هایش را اضافه کنید و متن هر بخش را بنویسید."
          action={can('references.create') ? <Button onClick={() => setCreateOpen(true)}>مرجع جدید</Button> : null}
        />
      ) : null}

      {draft ? (
        <>
          <div className="ad-ref__bar">
            <span className="ad-ref__bartitle">
              <IconReference width={17} height={17} />
              <strong>{draft.title}</strong>
              <StatusBadge status={draft.status} />
              {dirty ? <Badge tone="neutral">ذخیره‌نشده</Badge> : null}
            </span>

            <span className="ad-ref__barmeta">
              <span className="ad-sub">{faNumber(counts.sections)} بخش</span>
              <span className="ad-sub">{faNumber(counts.topics)} مبحث</span>
              <span className="ad-sub">{faNumber(counts.withText)} با متن</span>
              <span className="ad-sub">{faNumber(counts.chars)} نویسه</span>
              <span className="ad-sub">آخرین ویرایش {faDateTime(draft.updatedAt)}</span>
              {draft.publishedAt ? <span className="ad-sub">انتشار {faDateTime(draft.publishedAt)}</span> : null}
            </span>

            <span className="ad-ref__baractions">
              {can('references.update') ? (
                <Button size="sm" variant="ghost" loading={busy} disabled={!dirty} onClick={() => save()}>
                  ذخیره تغییرات
                </Button>
              ) : null}

              {can('references.publish') ? (
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

              {can('references.delete') ? (
                <IconButton label="حذف مرجع" tone="danger" onClick={() => setPendingDelete(draft)}>
                  <IconTrash width={16} height={16} />
                </IconButton>
              ) : null}
            </span>
          </div>

          {published ? (
            <p className="ad-ref__hint">
              این مرجع منتشر شده است و از مسیر <code className="ad-code" dir="ltr">/api/public/references/library</code> برای
              لایهٔ رفرنس کاربران تپش سرو می‌شود. هر تغییر بعدی با «ذخیره تغییرات» روی همان نسخهٔ منتشرشده می‌نشیند.
            </p>
          ) : null}

          <div className="ad-ref__layout">
            <nav className="ad-ref__tree" aria-label="ساختار مرجع">
              <div className="ad-ref__treebar">
                <span className="ad-sub">{faNumber(counts.sections)} بخش · {faNumber(counts.topics)} مبحث</span>
                {can('references.update') ? (
                  <Button variant="ghost" size="sm" onClick={actions.addSection}>
                    <IconPlus width={13} height={13} /> بخش جدید
                  </Button>
                ) : null}
              </div>

              <div className={`ad-ref__node ${node.kind === 'reference' ? 'is-active' : ''}`}>
                <button type="button" className="ad-ref__nodetoggle" onClick={() => setNode({ kind: 'reference' })}>
                  <IconReference width={15} height={15} />
                  <span className="ad-ref__nodelabel">مشخصات مرجع</span>
                </button>
              </div>

              {draft.sections.map((section, sectionIndex) => {
                const branchKey = `s:${sectionIndex}`;
                const open = !collapsed.has(branchKey);
                const topics = section.topics ?? [];

                return (
                  <div key={section.id ?? `section-${sectionIndex}`} className="ad-ref__branch">
                    <div className={`ad-ref__node ${node.kind === 'section' && node.sectionIndex === sectionIndex ? 'is-active' : ''}`}>
                      {can('references.update') ? (
                        <button
                          type="button"
                          className={`ad-ref__caret ${open ? 'is-open' : ''}`}
                          onClick={() => toggleBranch(branchKey)}
                          aria-expanded={open}
                          aria-label={`${open ? 'بستن' : 'باز کردن'} ${section.title || 'بخش'}`}
                          title={open ? 'بستن' : 'باز کردن'}
                        >
                          <IconChevron width={13} height={13} />
                        </button>
                      ) : <span className="ad-ref__caret" aria-hidden="true" />}

                      <button
                        type="button"
                        className="ad-ref__nodetoggle"
                        onClick={() => setNode({ kind: 'section', sectionIndex })}
                      >
                        <IconEdit width={15} height={15} />
                        <span className="ad-ref__nodelabel">{section.title || 'بخش بی‌نام'}</span>
                        <Badge tone="neutral">{faNumber(topics.length)} مبحث</Badge>
                      </button>

                      {can('references.update') ? (
                        <NodeActions
                          label="بخش"
                          canMoveUp={sectionIndex > 0}
                          canMoveDown={sectionIndex < draft.sections.length - 1}
                          onMove={(direction) => actions.moveSection(sectionIndex, direction)}
                          onRemove={() => actions.removeSection(sectionIndex)}
                        />
                      ) : null}
                    </div>

                    {open ? (
                      <>
                        {topics.map((topic, topicIndex) => (
                          <div
                            key={topic.id ?? `topic-${topicIndex}`}
                            className={`ad-ref__node ad-ref__node--leaf ${node.kind === 'topic' && node.sectionIndex === sectionIndex && node.topicIndex === topicIndex ? 'is-active' : ''}`}
                          >
                            <button
                              type="button"
                              className="ad-ref__nodetoggle"
                              onClick={() => setNode({ kind: 'topic', sectionIndex, topicIndex })}
                            >
                              <span className="ad-ref__nodedot" aria-hidden="true" />
                              <span className="ad-ref__nodelabel">{faNumber(topicIndex + 1)}. {topic.title || 'مبحث بی‌نام'}</span>
                              <span className="ad-sub">{hasText(topic) ? 'متن دارد' : 'بدون متن'}</span>
                            </button>
                            {can('references.update') ? (
                              <NodeActions
                                label="مبحث"
                                canMoveUp={topicIndex > 0}
                                canMoveDown={topicIndex < topics.length - 1}
                                onMove={(direction) => actions.moveTopic(sectionIndex, topicIndex, direction)}
                                onRemove={() => actions.removeTopic(sectionIndex, topicIndex)}
                              />
                            ) : null}
                          </div>
                        ))}

                        <div className="ad-ref__addrow">
                          {can('references.update') ? (
                            <Button variant="ghost" size="sm" onClick={() => { actions.addTopic(sectionIndex); setNode({ kind: 'topic', sectionIndex, topicIndex: topics.length }); }}>
                              <IconPlus width={13} height={13} /> مبحث جدید
                            </Button>
                          ) : (
                            <span className="ad-sub">
                              {topics.length ? `${faNumber(topics.length)} مبحث` : 'این بخش هنوز مبحث ندارد'}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="ad-ref__addrow">
                        <span className="ad-sub">
                          {topics.length
                            ? `${faNumber(topics.length)} مبحث · ${faNumber(topics.filter(hasText).length)} با متن`
                            : 'این بخش هنوز مبحث ندارد'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="ad-ref__addrow">
                {can('references.update') ? (
                  <Button variant="ghost" size="sm" onClick={actions.addSection}>
                    <IconPlus width={13} height={13} /> بخش جدید
                  </Button>
                ) : (
                  <span className="ad-sub">برای افزودن بخش دسترسی لازم است.</span>
                )}
              </div>
            </nav>

            <section className="ad-ref__editor" aria-label="ویرایشگر">
              {renderEditor()}
            </section>
          </div>
        </>
      ) : null}

      <CreateReferenceDialog
        open={createOpen}
        busy={busy}
        onClose={() => setCreateOpen(false)}
        onCreate={createReference}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف مرجع"
        message={`آیا از حذف «${pendingDelete?.title ?? ''}» با همهٔ بخش‌ها و متن‌هایش مطمئن هستید؟ اگر منتشر شده باشد، از دسترس کاربران تپش هم خارج می‌شود.`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
