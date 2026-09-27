/*
 * مقالات تپش — لایهٔ داخل پنل، به همان قاعدهٔ لایه‌های میکرو درسنامه و مراجع.
 *
 * از کارت «مقالات تپش» در بخش «صفحات» باز می‌شود (`navigate('article-library')`) و
 * `onBack` به همان بخش برمی‌گرداند. در سایدبار آیتم جداگانه‌ای ندارد.
 *
 * چیدمان، آینهٔ «مراجع تپش» است (الگوی پروژه برای لایه‌ای که کارش ادیت و کنترلِ کل
 * محتواست):
 *   نوار بالا  → بازگشت + انتخاب مقاله + جست‌وجو/وضعیت + «مقالهٔ جدید» + تازه‌سازی
 *   نوار دوم   → عنوان مقاله + شمارنده‌ها + ذخیره + انتشار/لغو + حذف
 *   دو ستون    → فهرست مقالات (`ad-art__list`) | ویرایشگر مقاله (`ad-art__editor`)
 *
 * سه چیزی که مدیر از این لایه می‌خواهد و اینجا انجام می‌شود:
 *   ۱) تصویر شاخص — انتخاب از کتابخانهٔ رسانه یا بارگذاری فایل تازه (`MediaPicker`)
 *   ۲) متن غنی — همان تجربهٔ میکرو درسنامه (`RichTextEditor` با رنگ متن و کادرهای آماده)
 *   ۳) فراداده و انتشار — عنوان، نشانی، خلاصه، دسته، برچسب‌ها، نویسنده، وضعیت، ویژه‌سازی
 *
 * فهرست این لایه **همان مقالاتی است که کاربران می‌خوانند**: دوازده مقالهٔ ثابتِ بخش
 * `#articles` یک‌بار در سرور به رکورد پنل تبدیل می‌شوند (`syncArticles`) و کنار
 * رکوردهای ساختهٔ پنل می‌نشینند. نشان «تپش» روی همان مقاله‌های ثابت است.
 *
 * نکتهٔ مهم دربارهٔ متن: مقاله‌های ثابت متنشان بلوکی است و کاربران امروز همان را
 * می‌خوانند (با هایلایت و یادداشت‌گذاری روی متن). پس ویرایشگر، متن بلوکی را برای
 * نمایش به HTML تبدیل می‌کند ولی تا وقتی مدیر واقعاً چیزی را عوض نکرده، `contentHtml`
 * خالی می‌ماند تا خواننده همان مسیر بلوکی را برود. به‌محض اولین ویرایشِ متن،
 * `contentHtml` نوشته می‌شود و از آن به بعد همان مرجع خواننده است.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { articles as articlesApi } from '../../../services/admin/adminService';
import {
  ARTICLE_CATEGORIES, articleBlocksToHtml, headingsFromHtml,
} from '../../../services/articles/articleCatalog';
import {
  Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input,
  LoadingBlock, Modal, SearchInput, Select, StatusBadge, Textarea, Toggle,
  faDateTime, faNumber, useAsync, useToast,
} from '../adminShared';
import {
  IconArticle, IconChevron, IconEdit, IconEye, IconPlus, IconRefresh, IconSend, IconTrash,
} from '../adminIcons';
import MediaPicker from '../MediaPicker';
import RichTextEditor from '../RichTextEditor';

const STATUS_OPTIONS = [
  { value: 'all', label: 'همهٔ وضعیت‌ها' },
  { value: 'published', label: 'منتشرشده' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'archived', label: 'بایگانی' },
];

/* وضعیت انتشار در ویرایشگر — دکمهٔ نوار دوم همان را ذخیره می‌کند */
const PUBLISH_OPTIONS = [
  { value: 'published', label: 'منتشرشده (برای کاربران)' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'archived', label: 'بایگانی' },
];

const STATUS_LABEL = { draft: 'پیش‌نویس', published: 'منتشرشده', archived: 'بایگانی' };

/* دسته‌بندی‌ها از خودِ کاتالوگ مقالات می‌آیند، نه از دسته‌های عمومی پنل: فقط همین
   فهرست است که خوانندهٔ سایت برای برچسب و رنگ دسته می‌شناسد. */
const CATEGORY_OPTIONS = ARTICLE_CATEGORIES.map((category) => ({ value: category.id, label: category.label }));

const categoryLabel = (id) => ARTICLE_CATEGORIES.find((category) => category.id === id)?.label ?? id;

/*
 * رنگ متن و کادرهای آماده — همان تجربهٔ ویرایشگر میکرو درسنامه.
 *
 * رنگ با کلاس می‌نشیند نه `style`، چون پاک‌ساز HTML هر `style` را دور می‌ریزد و پالت
 * `.micr-tone--*` یک‌جا در `src/styles.css` است (هم پنل و هم خواننده آن را دارند).
 * کادرها هم همان کلاس‌های خوانندهٔ مقالات‌اند (`ap-callout--*`) تا متنی که در پنل
 * ساخته می‌شود، در سایت دقیقاً مثل مقاله‌های ثابت دیده شود.
 */
const TEXT_TONES = [
  { value: 'gold', label: 'طلایی' },
  { value: 'green', label: 'سبز' },
  { value: 'blue', label: 'آبی' },
  { value: 'purple', label: 'بنفش' },
  { value: 'red', label: 'قرمز' },
  { value: 'brown', label: 'قهوه‌ای' },
  { value: '', label: 'حذف رنگ' },
];

function calloutInsert(variant, label, select) {
  return {
    label,
    hint: `کادر «${label}» را در متن درج می‌کند`,
    select,
    html: `<div class="ap-callout ap-callout--${variant}">`
      + `<strong class="ap-callout__label">${label}</strong>`
      + `<p>${select}</p>`
      + '</div><p><br></p>',
  };
}

const ARTICLE_INSERTS = [
  calloutInsert('definition', 'تعریف', 'متن تعریف را اینجا بنویسید…'),
  calloutInsert('important', 'نکته مهم', 'متن نکته را اینجا بنویسید…'),
  calloutInsert('exam', 'نقطه امتحانی', 'نکتهٔ امتحانی این بخش را اینجا بنویسید…'),
  calloutInsert('clinical', 'ارتباط بالینی', 'پیوند بالینی این موضوع را اینجا بنویسید…'),
  calloutInsert('warning', 'هشدار', 'هشدار یا اشتباه رایج را اینجا بنویسید…'),
];

/* ── ابزارهای خالص (بدون DOM، برای سنجشِ بدون مرورگر هم قابل استفاده‌اند) ── */

/* طول متنِ واقعی: تگ‌ها و فاصله‌های اضافه حساب نمی‌شوند */
export function plainLength(html) {
  return String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .length;
}

/*
 * متنِ نمایشیِ یک مقاله.
 * رکوردهای تازه‌مهاجرت‌شده `contentHtml` خالی دارند و متنشان بلوکی است؛ ویرایشگر
 * باید همان را نشان بدهد تا مدیر متن واقعی را جلوی چشمش داشته باشد.
 */
export function articleText(article) {
  if (!article) return '';
  return article.contentHtml || articleBlocksToHtml(article.content);
}

/*
 * متنی که موقع ذخیره به سرور می‌رود.
 *
 * اگر مقاله از قبل متن غنی داشت (`contentHtml` پر)، همان می‌رود. اگر نه و مدیر هم
 * متن را دست نزده، رشتهٔ خالی می‌رود تا خواننده همان مسیر بلوکی (با هایلایت و
 * یادداشت‌گذاری) را نگه دارد. فقط ویرایشِ واقعی متن، مقاله را به مدل HTML می‌برد.
 */
export function contentForSave(article, text, sourceText) {
  if (!article) return '';
  if (article.contentHtml) return text;
  return text === sourceText ? '' : text;
}

export function validateArticle(form) {
  const errors = {};
  if (!String(form?.title ?? '').trim()) errors.title = 'عنوان مقاله الزامی است';
  if (!String(form?.category ?? '').trim()) errors.category = 'دسته‌بندی الزامی است';
  return errors;
}

const EMPTY_ARTICLE = {
  title: '',
  category: ARTICLE_CATEGORIES[0]?.id ?? '',
  excerpt: '',
  status: 'published',
};

/* ── ویرایشگر مقاله ──
 * export شده تا بدون مرورگر هم رندر و سنجیده شود (مثل `PageEditor` در میکرو).
 */
export function ArticleEditor({ article, text, onMeta, onText }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const set = (changes) => onMeta({ ...article, ...changes });

  const tagsValue = Array.isArray(article.tags) ? article.tags.join('، ') : '';

  return (
    <div className="ad-stack">
      <div className="ad-art__group">
        <div className="ad-art__grouphead">
          <h4>شناسهٔ مقاله</h4>
          {article.origin === 'tapesh' ? <Badge tone="neutral">تپش</Badge> : null}
        </div>
        <Field label="عنوان مقاله" required hint="در فهرست مقالات و بالای صفحهٔ مقاله دیده می‌شود.">
          <Input value={article.title ?? ''} onChange={(event) => set({ title: event.target.value })} />
        </Field>
        <Field label="نشانی مقاله" hint="خالی بگذارید تا از عنوان ساخته شود؛ نشانی تکراری خودکار یکتا می‌شود.">
          <Input dir="ltr" value={article.slug ?? ''} onChange={(event) => set({ slug: event.target.value })} placeholder="stress-heart-rate" />
        </Field>
        <Field label="خلاصه" hint="در کارت مقاله و زیر عنوان می‌آید. خالی بگذارید تا از متن ساخته شود.">
          <Textarea rows={3} value={article.excerpt ?? ''} onChange={(event) => set({ excerpt: event.target.value })} />
        </Field>
      </div>

      <div className="ad-art__group">
        <div className="ad-art__grouphead"><h4>دسته، برچسب و نویسنده</h4></div>
        <div className="ad-grid2">
          <Field label="دسته‌بندی" required>
            <Select
              options={CATEGORY_OPTIONS}
              value={article.category ?? ''}
              onChange={(event) => set({ category: event.target.value })}
              aria-label="دسته‌بندی"
            />
          </Field>
          <Field label="نویسنده" hint="نامی که زیر عنوان مقاله می‌آید.">
            <Input value={article.authorName ?? ''} onChange={(event) => set({ authorName: event.target.value })} />
          </Field>
        </div>
        <Field label="برچسب‌ها" hint="با «،» جدا کنید. هر برچسب روی صفحهٔ مقاله یک لینک جست‌وجو می‌شود.">
          <Input
            value={tagsValue}
            onChange={(event) => set({ tags: event.target.value.split('،').map((tag) => tag.trim()).filter(Boolean) })}
            placeholder="فیزیولوژی، قلب، استرس"
          />
        </Field>
      </div>

      <div className="ad-art__group">
        <div className="ad-art__grouphead">
          <h4>تصویر شاخص</h4>
          {article.figure && !article.cover ? <span className="ad-sub">تصویر ثابت تپش</span> : null}
        </div>

        <div className="ad-art__cover">
          <span className="ad-art__coverbox">
            {article.cover ? (
              <img src={article.cover} alt={article.coverAlt ?? ''} />
            ) : (
              <span className="ad-art__coverempty">بدون تصویر بارگذاری‌شده</span>
            )}
          </span>
          <span className="ad-art__coveractions">
            <Button size="sm" variant="ghost" onClick={() => setPickerOpen(true)}>
              <IconPlus width={14} height={14} />
              {article.cover ? 'تغییر تصویر' : 'انتخاب از کتابخانهٔ رسانه'}
            </Button>
            {article.cover ? (
              <Button size="sm" variant="ghost" onClick={() => set({ cover: '' })}>حذف تصویر</Button>
            ) : null}
          </span>
        </div>

        <Field label="متن جانشین تصویر" hint="برای دسترس‌پذیری و وقتی تصویر بارگذاری نمی‌شود.">
          <Input value={article.coverAlt ?? ''} onChange={(event) => set({ coverAlt: event.target.value })} />
        </Field>
      </div>

      <div className="ad-art__group">
        <div className="ad-art__grouphead">
          <h4>متن مقاله</h4>
          <span className="ad-sub">{faNumber(plainLength(text))} نویسه · {faNumber(headingsFromHtml(text).length)} سرتیتر</span>
        </div>
        <RichTextEditor
          value={text ?? ''}
          onChange={(html) => onText(html)}
          placeholder="متن مقاله را اینجا بنویسید…"
          tones={TEXT_TONES}
          inserts={ARTICLE_INSERTS}
        />
      </div>

      <div className="ad-art__group">
        <div className="ad-art__grouphead"><h4>انتشار و ویژه‌سازی</h4></div>
        <Field
          label="وضعیت انتشار"
          hint={`«${STATUS_LABEL[article.status] ?? 'پیش‌نویس'}» — دکمهٔ نوار بالا هم همین را ذخیره می‌کند.`}
        >
          <Select
            options={PUBLISH_OPTIONS}
            value={article.status ?? 'draft'}
            onChange={(event) => set({ status: event.target.value })}
            aria-label="وضعیت انتشار"
          />
        </Field>
        <Toggle
          checked={article.featured}
          onChange={(featured) => set({ featured })}
          label="مقالهٔ منتخب"
          hint="به‌عنوان مقالهٔ شاخص بالای صفحهٔ مقالات می‌نشیند."
        />
        <Toggle
          checked={article.recommended}
          onChange={(recommended) => set({ recommended })}
          label="پیشنهاد تپش"
          hint="در بخش «منتخب تپش» و کنار مقالهٔ شاخص دیده می‌شود."
        />
      </div>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        accept="image/*"
        onSelect={(item) => set({ cover: item.url, coverAlt: article.coverAlt || item.altText || item.originalName })}
      />
    </div>
  );
}

/* ── ساخت مقالهٔ تازه ── */

export function CreateArticleDialog({ open, busy, onClose, onCreate }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_ARTICLE }));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY_ARTICLE });
    setErrors({});
  }, [open]);

  const submit = () => {
    const found = validateArticle(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onCreate(form);
  };

  return (
    <Modal
      open={open}
      title="مقالهٔ جدید"
      subtitle="عنوان و دسته را بگذارید؛ متن و تصویر را بعد در همین لایه کامل می‌کنید."
      size="sm"
      onClose={busy ? undefined : onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>انصراف</Button>
          <Button onClick={submit} loading={busy}>ساخت مقاله</Button>
        </>
      )}
    >
      <div className="ad-stack">
        <Field label="عنوان مقاله" required error={errors.title}>
          <Input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="مثال: چرا هنگام استرس قلب سریع‌تر می‌زند؟"
          />
        </Field>
        <Field label="دسته‌بندی" required error={errors.category}>
          <Select
            options={CATEGORY_OPTIONS}
            value={form.category}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
            aria-label="دسته‌بندی"
          />
        </Field>
        <Field label="خلاصه">
          <Textarea
            rows={3}
            value={form.excerpt}
            onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))}
          />
        </Field>
        <Field label="وضعیت انتشار" hint="پیش‌فرض «منتشرشده» است تا مقالهٔ تازه بی‌درنگ در سایت دیده شود.">
          <Select
            options={PUBLISH_OPTIONS}
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
            aria-label="وضعیت انتشار"
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ────────────────────────── ویوی اصلی ────────────────────────── */

export default function AdminArticleLibrary({ admin, onBack }) {
  const notify = useToast();
  const [filters, setFilters] = useState({ search: '', status: 'all' });
  const [articleId, setArticleId] = useState(null);
  const [draft, setDraft] = useState(null);
  /* متنِ ویرایشگر و متنِ اولیهٔ همان مقاله — تفاضلشان می‌گوید مدیر متن را دست زده یا نه */
  const [text, setText] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const can = (permission) => admin?.permissions?.includes(permission);

  const listLoad = useCallback(
    () => articlesApi.list({ search: filters.search, status: filters.status, sort: 'title', perPage: 200 }),
    [filters.search, filters.status],
  );
  const { data: listData, error: listError, reload: reloadList } = useAsync(listLoad, [filters.search, filters.status]);

  /* اولین مقاله خودکار انتخاب می‌شود تا ورود به لایه خالی نباشد */
  useEffect(() => {
    if (articleId || !listData) return;
    setArticleId(listData.items?.[0]?.id ?? null);
  }, [listData, articleId]);

  const articleLoad = useCallback(
    () => (articleId ? articlesApi.get(articleId) : Promise.resolve(null)),
    [articleId],
  );
  const { data: articleData, loading, error, reload } = useAsync(articleLoad, [articleId]);

  useEffect(() => {
    const article = articleData?.article ?? null;
    setDraft(article);
    const initial = articleText(article);
    setText(initial);
    setSourceText(initial);
    setDirty(false);
  }, [articleData]);

  const patchMeta = useCallback((next) => {
    setDraft(next);
    setDirty(true);
  }, []);

  const patchText = useCallback((html) => {
    setText(html);
    setDirty(true);
  }, []);

  const save = useCallback(async ({ silent = false } = {}) => {
    if (!draft) return null;
    setBusy(true);
    try {
      const payload = { ...draft, contentHtml: contentForSave(draft, text, sourceText) };
      const data = await articlesApi.update(draft.id, payload);
      setDraft(data.article);
      const saved = articleText(data.article);
      setText(saved);
      setSourceText(saved);
      setDirty(false);
      if (!silent) notify('تغییرات مقاله ذخیره شد');
      reloadList();
      return data.article;
    } catch (actionError) {
      notify(actionError.message, 'error');
      return null;
    } finally {
      setBusy(false);
    }
  }, [draft, text, sourceText, notify, reloadList]);

  /* انتشار = ذخیره (اگر لازم باشد) + تغییر وضعیت. از لحظهٔ انتشار، مقاله از مسیر
     `/api/public/articles` برای بخش مقالات کاربران تپش سرو می‌شود. */
  const setPublished = useCallback(async (status) => {
    const current = dirty ? await save({ silent: true }) : draft;
    if (!current) return;
    setBusy(true);
    try {
      const data = await articlesApi.setStatus(current.id, status);
      setDraft(data.article);
      notify(status === 'published'
        ? 'مقاله برای کاربران تپش منتشر شد'
        : 'انتشار برداشته شد — متن مقاله دست‌نخورده ماند');
      reloadList();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }
  }, [dirty, draft, save, notify, reloadList]);

  const createArticle = async (payload) => {
    setBusy(true);
    try {
      const data = await articlesApi.create({ ...payload, contentHtml: '' });
      notify('مقالهٔ تازه ساخته شد — متن و تصویرش را کامل کنید');
      setArticleId(data.article.id);
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
      await articlesApi.remove(pendingDelete.id);
      notify('مقاله حذف شد');
      setPendingDelete(null);
      setArticleId(null);
      setDraft(null);
      reloadList();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const counts = useMemo(() => {
    const items = listData?.items ?? [];
    return {
      total: listData?.total ?? items.length,
      published: items.filter((article) => article.status === 'published').length,
      withText: items.filter((article) => plainLength(articleText(article)) > 0).length,
      chars: plainLength(text),
      headings: headingsFromHtml(text).length,
    };
  }, [listData, text]);

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
          value={articleId ?? ''}
          onChange={(event) => setArticleId(event.target.value)}
          aria-label="مقاله"
        />

        <SearchInput
          value={filters.search}
          onChange={(search) => setFilters((current) => ({ ...current, search }))}
          placeholder="جست‌وجوی عنوان، نشانی، خلاصه یا نویسنده…"
        />
        <Select
          options={STATUS_OPTIONS}
          value={filters.status}
          onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          aria-label="وضعیت"
        />

        <div className="ad-toolbar__end">
          <Button variant="ghost" size="sm" onClick={() => { reloadList(); if (articleId) reload(); }}>
            <IconRefresh width={15} height={15} />تازه‌سازی
          </Button>
          {can('articles.create') ? (
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(true)}>
              <IconPlus width={15} height={15} />مقالهٔ جدید
            </Button>
          ) : null}
        </div>
      </div>

      {listError ? <ErrorState error={listError} onRetry={reloadList} /> : null}
      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !draft ? <LoadingBlock label="در حال خواندن مقاله…" rows={5} /> : null}

      {!loading && !draft && !error ? (
        <EmptyState
          title="هنوز مقاله‌ای ثبت نشده"
          description="با «مقالهٔ جدید» اولین مقاله را بسازید؛ بعد متن و تصویرش را در همین لایه کامل کنید."
          action={can('articles.create') ? <Button onClick={() => setCreateOpen(true)}>مقالهٔ جدید</Button> : null}
        />
      ) : null}

      {draft ? (
        <>
          <div className="ad-art__bar">
            <span className="ad-art__bartitle">
              <IconArticle width={17} height={17} />
              <strong>{draft.title}</strong>
              <StatusBadge status={draft.status} />
              {dirty ? <Badge tone="neutral">ذخیره‌نشده</Badge> : null}
            </span>

            <span className="ad-art__barmeta">
              <span className="ad-sub">{faNumber(counts.chars)} نویسه</span>
              <span className="ad-sub">{faNumber(counts.headings)} سرتیتر</span>
              <span className="ad-sub">آخرین ویرایش {faDateTime(draft.updatedAt)}</span>
              {draft.publishedAt ? <span className="ad-sub">انتشار {faDateTime(draft.publishedAt)}</span> : null}
            </span>

            <span className="ad-art__baractions">
              {can('articles.update') ? (
                <Button size="sm" variant="ghost" loading={busy} disabled={!dirty} onClick={() => save()}>
                  ذخیره تغییرات
                </Button>
              ) : null}

              {can('articles.publish') ? (
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

              {draft.status === 'published' ? (
                <a
                  className="ad-iconbtn"
                  title="مشاهدهٔ مقاله در سایت"
                  aria-label="مشاهدهٔ مقاله در سایت"
                  href={`${window.location.pathname}#articles/${draft.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <IconEye width={16} height={16} />
                </a>
              ) : null}

              {can('articles.delete') ? (
                <IconButton label="حذف مقاله" tone="danger" onClick={() => setPendingDelete(draft)}>
                  <IconTrash width={16} height={16} />
                </IconButton>
              ) : null}
            </span>
          </div>

          {published ? (
            <p className="ad-art__hint">
              این مقاله منتشر شده است و از مسیر <code className="ad-code" dir="ltr">/api/public/articles</code> به
              بخش مقالات کاربران تپش می‌رود. هر تغییر بعدی با «ذخیره تغییرات» روی همان نسخهٔ منتشرشده می‌نشیند.
            </p>
          ) : null}

          <div className="ad-art__layout">
            <nav className="ad-art__list" aria-label="فهرست مقالات">
              <div className="ad-art__listbar">
                <span className="ad-sub">
                  {faNumber(counts.total)} مقاله · {faNumber(counts.published)} منتشرشده · {faNumber(counts.withText)} با متن
                </span>
              </div>

              {(listData?.items ?? []).map((item) => (
                <div
                  key={item.id}
                  className={`ad-art__item ${item.id === articleId ? 'is-active' : ''}`}
                >
                  <button
                    type="button"
                    className="ad-art__itemtoggle"
                    onClick={() => setArticleId(item.id)}
                  >
                    <IconEdit width={15} height={15} />
                    <span className="ad-art__itemlabel">{item.title || 'مقالهٔ بی‌نام'}</span>
                  </button>
                  <span className="ad-art__itemmeta">
                    <span className="ad-sub">{categoryLabel(item.category)}</span>
                    <StatusBadge status={item.status} />
                    {item.origin === 'tapesh' ? <Badge tone="neutral">تپش</Badge> : null}
                  </span>
                </div>
              ))}

              {(listData?.items ?? []).length === 0 ? (
                <p className="ad-art__hint">با فیلترهای فعلی مقاله‌ای پیدا نشد.</p>
              ) : null}
            </nav>

            <section className="ad-art__editor" aria-label="ویرایشگر مقاله">
              <ArticleEditor article={draft} text={text} onMeta={patchMeta} onText={patchText} />
            </section>
          </div>
        </>
      ) : null}

      <CreateArticleDialog
        open={createOpen}
        busy={busy}
        onClose={() => setCreateOpen(false)}
        onCreate={createArticle}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف مقاله"
        message={`آیا از حذف «${pendingDelete?.title ?? ''}» مطمئن هستید؟ اگر منتشر شده باشد، از بخش مقالات کاربران تپش هم خارج می‌شود.`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
