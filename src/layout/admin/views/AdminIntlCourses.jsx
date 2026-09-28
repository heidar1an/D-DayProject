/*
 * دوره‌های بین‌الملل — لایهٔ داخل پنل، به همان قاعدهٔ «مراجع تپش» و «میکرو درسنامه».
 *
 * از کارت «دوره‌های بین‌الملل» در بخش «صفحات» باز می‌شود (`navigate('intl-courses')`)
 * و `onBack` به همان بخش برمی‌گرداند. در سایدبار آیتم جداگانه‌ای ندارد.
 *
 * دو تب دارد، چون لایه دو موجودیت دارد:
 *   ۱) دوره‌ها — فراداده + تصویر + نوع/دسته + سطح + مدت + تعداد ویدیو + بخش‌ها.
 *      هر بخش یک ویدیو و چند زیرنویس دارد (بارگذاری فایل یا آدرس دستی).
 *   ۲) دانشگاه‌ها و مراجع — معرفی منبع: نام فارسی/لاتین، کشور، سال بنیان،
 *      حوزه‌ها، لوگو، ترتیب فهرست و ترتیب نوار متحرک بالای کاتالوگ.
 *
 * چیدمان تب دوره‌ها آینهٔ «مراجع» است:
 *   نوار بالا → انتخاب دوره + جست‌وجو/وضعیت + «دورهٔ جدید» + ذخیره + انتشار + حذف
 *   دو ستون  → درخت بخش‌ها و ویدیوها (`ad-intl__tree`) | ویرایشگر گرهٔ انتخابی
 *
 * ذخیره‌سازی یک رکورد کامل است، پس ویرایش یک PUT کامل می‌فرستد و انتشار اتمیک
 * می‌ماند. از لحظهٔ انتشار، لایه از `/api/public/intl-courses/library` می‌خواند.
 *
 * ناشر دوره فقط با `providerId` به منبع وصل است: نام و لوگو در ویرایشگر منبع
 * عوض می‌شود و روی همهٔ کارت‌های آن دانشگاه می‌نشیند.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { intlCourses as intlApi, uploadIntlMedia } from '../../../services/admin/adminService';
import {
  INTL_COURSE_CATEGORIES,
  INTL_DEFAULT_MAX_VIDEO_MB,
  INTL_LEVELS,
  INTL_PROVIDER_KINDS,
  INTL_SUBTITLE_ACCEPT,
  INTL_SUBTITLE_LANGS,
  INTL_VIDEO_ACCEPT,
  uploadMimeOf,
} from '../../../services/international/intlCatalog';
import { COURSE_IMAGE_KEYS, PROVIDER_LOGO_KEYS, assetByKey } from '../../../services/international/intlAssets';
import {
  Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input,
  LoadingBlock, Modal, SearchInput, Select, StatusBadge, Textarea, Toggle,
  faDateTime, faNumber, useAsync, useToast,
} from '../adminShared';
import {
  IconChevron, IconEdit, IconGlobe, IconImage, IconPlus, IconRefresh, IconSend, IconTrash, IconUpload,
} from '../adminIcons';
import MediaPicker from '../MediaPicker';

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

const CATEGORY_OPTIONS = INTL_COURSE_CATEGORIES.map((category) => ({ value: category.id, label: category.label }));
const LEVEL_OPTIONS = INTL_LEVELS.map((level) => ({ value: level, label: level }));
const KIND_OPTIONS = INTL_PROVIDER_KINDS.map((kind) => ({ value: kind.id, label: kind.label }));

/* دستهٔ سفارشی — اگر ادمین دسته‌ای بیرون از فهرست ثابت بخواهد */
const CUSTOM_CATEGORY = '__custom__';
const CATEGORY_SELECT_OPTIONS = [...CATEGORY_OPTIONS, { value: CUSTOM_CATEGORY, label: 'دستهٔ سفارشی…' }];

const STATUS_LABEL = { draft: 'پیش‌نویس', published: 'منتشرشده', archived: 'بایگانی' };

/* سقف بارگذاری — نمایشی؛ سرور مرجع نهایی است */
const MAX_VIDEO_MB = INTL_DEFAULT_MAX_VIDEO_MB;

/* ── ابزارهای خالص (بدون DOM — برای سنجش بدون مرورگر هم قابل استفاده‌اند) ── */

export function newSection() {
  return { id: null, title: '', time: '', desc: '', videoUrl: '', videoMime: '', subtitles: [] };
}

export function newSubtitle(lang = 'fa') {
  return { lang, label: INTL_SUBTITLE_LANGS.find((item) => item.id === lang)?.label ?? '', url: '' };
}

export function newCourse(sortOrder = 0) {
  return {
    title: '',
    providerId: '',
    category: INTL_COURSE_CATEGORIES[0]?.id ?? 'medicine',
    categoryLabel: '',
    level: INTL_LEVELS[0] ?? 'مقدماتی',
    duration: 0,
    totalDuration: '',
    progress: 0,
    accent: '#5b8cc7',
    accentSoft: '#1d314a',
    badge: '',
    description: '',
    tags: [],
    image: '',
    imageKey: '',
    sortOrder,
    status: 'draft',
    sections: [],
  };
}

export function newProvider(sortOrder = 0) {
  return {
    name: '',
    nameEn: '',
    kind: 'university',
    country: '',
    founded: '',
    description: '',
    focus: [],
    logo: '',
    logoKey: '',
    sortOrder,
    marqueeOrder: 0,
    status: 'published',
  };
}

/* فقط چیزی که جلوی ذخیره را می‌گیرد؛ بقیه اختیاری است */
export function validateIntlCourse(form) {
  const errors = {};
  if (!String(form?.title ?? '').trim()) errors.title = 'عنوان دوره الزامی است';
  if (!String(form?.providerId ?? '').trim()) errors.providerId = 'منبع (دانشگاه یا نهاد) را انتخاب کنید';
  return errors;
}

export function validateIntlProvider(form) {
  const errors = {};
  if (!String(form?.name ?? '').trim()) errors.name = 'نام منبع الزامی است';
  return errors;
}

/* شمارنده‌های نوار بالا — «تعداد بخش» و «چند ویدیو آماده است» */
export function intlCounts(course) {
  const sections = course?.sections ?? [];
  const withVideo = sections.filter((section) => section.videoUrl).length;
  const subtitles = sections.reduce((total, section) => total + (section.subtitles?.length ?? 0), 0);
  return { sections: sections.length, withVideo, withoutVideo: sections.length - withVideo, subtitles };
}

const hexOr = (value, fallback) => (/^#[0-9a-fA-F]{3,8}$/.test(String(value ?? '')) ? value : fallback);

/* ── اجزای کوچک ── */

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

/*
 * کادر تصویر — انتخاب از کتابخانهٔ رسانه یا بارگذاری تازه، به‌علاوهٔ گزینه‌های
 * دارایی باندل‌شدهٔ خود پروژه. `as="div"` لازم است چون داخل کادر دکمه هست و
 * اگر داخل `<label>` باشد، کلیک روی دکمه‌ها را می‌دزدد.
 */
function MediaField({ label, hint, value, assetKind, assetKey, assetKeys, onChange, onAssetKey, onOpenPicker }) {
  return (
    <Field label={label} hint={hint} as="div">
      <div className="ad-intl__media">
        <span className="ad-intl__preview" aria-hidden="true">
          {value ? <img src={value} alt="" /> : <IconImage width={20} height={20} />}
        </span>
        <div className="ad-intl__mediabody">
          <Input
            dir="ltr"
            value={value ?? ''}
            placeholder="/uploads/… یا آدرس کامل تصویر"
            onChange={(event) => onChange(event.target.value)}
            aria-label={label}
          />
          <div className="ad-intl__mediarow">
            <Button size="sm" variant="ghost" onClick={onOpenPicker}><IconUpload width={14} height={14} />انتخاب از کتابخانه</Button>
            {value ? <Button size="sm" variant="ghost" onClick={() => onChange('')}>برداشتن تصویر</Button> : null}
          </div>
          {assetKeys.length > 0 ? (
            <div className="ad-intl__assets" role="group" aria-label="تصویرهای آمادهٔ پروژه">
              {assetKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`ad-intl__asset ${assetKey === key ? 'is-active' : ''}`}
                  title={key}
                  onClick={() => onAssetKey(assetKey === key ? '' : key)}
                >
                  <img src={assetByKey(assetKind, key)} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Field>
  );
}

/*
 * بارگذاری فایل ویدیو/زیرنویس.
 *
 * فایل خام به سرور می‌رود (نه base64) و آدرس برگشتی روی رکورد می‌نشیند.
 * امکان «آدرس دستی» هم هست تا مدیر بتواند از CDN بیرونی استفاده کند.
 */
function UploadField({ label, hint, accept, kind = '', placeholder, value, mime, onUploaded, onUrl, onClear, disabled }) {
  const notify = useToast();
  const [busy, setBusy] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;

    /*
     * `kind` تعیین می‌کند این فیلد ویدیو می‌پذیرد یا زیرنویس. بدون آن، فیلد
     * زیرنویس یک ویدیو را هم قبول می‌کرد و برعکس — همان «قاطی شدن با فرمت ویدیو».
     */
    const resolved = uploadMimeOf(file, kind);
    if (!resolved) {
      notify(
        kind === 'subtitle'
          ? 'این فیلد فقط زیرنویس می‌پذیرد (vtt یا srt)'
          : 'این فیلد فقط ویدیو می‌پذیرد (mp4/webm/mov/ogv/mkv)',
        'error',
      );
      return;
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      notify(`«${file.name}» بزرگ‌تر از ${faNumber(MAX_VIDEO_MB)} مگابایت است`, 'error');
      return;
    }

    setBusy(true);
    try {
      const media = await uploadIntlMedia(file, kind);
      onUploaded(media);
      notify(`«${media.originalName}» بارگذاری شد`);
    } catch (error) {
      notify(error.message || 'بارگذاری ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Field label={label} hint={hint} as="div">
      <div className="ad-intl__upload">
        <Input
          dir="ltr"
          value={value ?? ''}
          placeholder={placeholder ?? '/uploads/intl/…mp4 یا آدرس ویدیوی بیرونی'}
          onChange={(event) => onUrl(event.target.value)}
          aria-label={label}
        />
        <div className="ad-intl__uploadrow">
          <label className={`ad-upload ${disabled || busy ? 'is-disabled' : ''}`}>
            <input
              type="file"
              accept={accept}
              disabled={disabled || busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                /* مقدار فیلد پاک می‌شود تا انتخاب دوبارهٔ همان فایل هم رویداد بدهد */
                event.target.value = '';
                handleFile(file);
              }}
            />
            <span className="ad-btn ad-btn--primary ad-btn--sm">
              {busy ? <span className="ad-spinner ad-spinner--sm" aria-hidden="true" /> : <IconUpload width={14} height={14} />}
              {busy ? 'در حال بارگذاری…' : 'بارگذاری فایل'}
            </span>
          </label>
          {value ? <Button size="sm" variant="ghost" onClick={onClear}>برداشتن</Button> : null}
          {mime ? <span className="ad-sub" dir="ltr">{mime}</span> : null}
        </div>
      </div>
    </Field>
  );
}

/* ── ویرایشگرها ── */

export function IntlCourseEditor({ course, providers, onChange }) {
  const set = (changes) => onChange({ ...course, ...changes });
  const [pickerOpen, setPickerOpen] = useState(false);
  const categoryOptions = CATEGORY_SELECT_OPTIONS.some((option) => option.value === course.category)
    ? CATEGORY_SELECT_OPTIONS
    : [...CATEGORY_OPTIONS, { value: course.category, label: course.categoryLabel || course.category }, { value: CUSTOM_CATEGORY, label: 'دستهٔ سفارشی…' }];
  const isCustomCategory = !CATEGORY_OPTIONS.some((option) => option.value === course.category);

  return (
    <div className="ad-stack">
      <div className="ad-ref__group">
        <div className="ad-ref__grouphead">
          <h4>شناسهٔ دوره</h4>
          {course.origin === 'tapesh' ? <Badge tone="neutral">تپش</Badge> : null}
        </div>
        <Field label="عنوان دوره" required hint="روی کارت کاتالوگ و تیتر صفحهٔ دوره می‌آید.">
          <Input value={course.title ?? ''} onChange={(event) => set({ title: event.target.value })} placeholder="مثال: مغز، یادگیری و حافظه" />
        </Field>
        <div className="ad-grid2">
          <Field label="منبع (دانشگاه یا نهاد)" required hint="نام و لوگو از ویرایشگر همین منبع خوانده می‌شود.">
            <Select
              options={[{ value: '', label: '— انتخاب منبع —' }, ...providers.map((provider) => ({ value: provider.id, label: provider.name }))]}
              value={course.providerId ?? ''}
              onChange={(event) => set({ providerId: event.target.value })}
              aria-label="منبع"
            />
          </Field>
          <Field label="برچسب روی کارت" hint="مثل «جدید» یا «پربازدید»؛ خالی باشد چیزی نشان داده نمی‌شود.">
            <Input value={course.badge ?? ''} onChange={(event) => set({ badge: event.target.value })} />
          </Field>
        </div>
        <Field label="توضیح کوتاه" hint="روی کارت کاتالوگ زیر عنوان می‌آید.">
          <Textarea rows={3} value={course.description ?? ''} onChange={(event) => set({ description: event.target.value })} />
        </Field>
        <Field label="هشتگ‌ها" hint="با کاما جدا کنید؛ در تیتر صفحهٔ دوره نمایش داده می‌شوند.">
          <Input
            value={(course.tags ?? []).join('، ')}
            onChange={(event) => set({ tags: event.target.value.split(/[،,]/).map((tag) => tag.trim()).filter(Boolean) })}
            placeholder="سلامت عمومی، اپیدمیولوژی"
          />
        </Field>
      </div>

      <div className="ad-ref__group">
        <div className="ad-ref__grouphead"><h4>نوع، سطح و زمان</h4></div>
        <div className="ad-grid2">
          <Field label="نوع دوره (دسته)" hint="فیلترهای کاتالوگ از همین دسته‌ها ساخته می‌شوند.">
            <Select
              options={categoryOptions}
              value={isCustomCategory ? CUSTOM_CATEGORY : course.category}
              onChange={(event) => set({ category: event.target.value === CUSTOM_CATEGORY ? '' : event.target.value })}
              aria-label="نوع دوره"
            />
          </Field>
          <Field label="برچسب دسته" hint="متنی که روی کارت دیده می‌شود؛ خالی باشد از نام دسته پر می‌شود.">
            <Input value={course.categoryLabel ?? ''} onChange={(event) => set({ categoryLabel: event.target.value })} />
          </Field>
        </div>
        {isCustomCategory ? (
          <Field label="شناسهٔ دستهٔ سفارشی" hint="لاتین و بدون فاصله؛ فیلتر کاتالوگ با همین شناسه ساخته می‌شود.">
            <Input dir="ltr" value={course.category ?? ''} onChange={(event) => set({ category: event.target.value })} placeholder="مثال: nutrition" />
          </Field>
        ) : null}
        <div className="ad-grid2">
          <Field label="سطح">
            <Select options={LEVEL_OPTIONS} value={course.level ?? ''} onChange={(event) => set({ level: event.target.value })} aria-label="سطح" />
          </Field>
          <Field label="مدت (ساعت)" hint="عدد ساعت که روی کارت دیده می‌شود.">
            <Input type="number" min="0" value={course.duration ?? 0} onChange={(event) => set({ duration: Number(event.target.value) || 0 })} />
          </Field>
        </div>
        <div className="ad-grid2">
          <Field label="مدت کل دوره" hint="مثل ۰۸:۴۲:۰۰ — کنار زمان ویدیو در پخش‌کننده می‌آید.">
            <Input dir="ltr" value={course.totalDuration ?? ''} onChange={(event) => set({ totalDuration: event.target.value })} placeholder="۰۸:۴۲:۰۰" />
          </Field>
          <Field label="درصد پیشرفت نمایشی" hint="فقط برای کارت کاتالوگ؛ پیشرفت واقعی هر کاربر جای دیگری است.">
            <Input type="number" min="0" max="100" value={course.progress ?? 0} onChange={(event) => set({ progress: Number(event.target.value) || 0 })} />
          </Field>
        </div>
        <div className="ad-grid2">
          <Field label="ترتیب نمایش" hint="عدد کوچک‌تر جلوتر می‌آید.">
            <Input type="number" min="0" value={course.sortOrder ?? 0} onChange={(event) => set({ sortOrder: Number(event.target.value) || 0 })} />
          </Field>
          <Field label="رنگ اکسنت (hex)" hint="رنگ قاب و نشانگرهای همین دوره.">
            <span className="ad-ref__accent">
              <span className="ad-ref__swatch" style={{ background: hexOr(course.accent, '#5b8cc7') }} aria-hidden="true" />
              <Input dir="ltr" value={course.accent ?? ''} onChange={(event) => set({ accent: event.target.value })} />
            </span>
          </Field>
        </div>
        <Field label="رنگ نرم اکسنت (hex)" hint="پس‌زمینهٔ تیرهٔ قاب در تم تیره.">
          <Input dir="ltr" value={course.accentSoft ?? ''} onChange={(event) => set({ accentSoft: event.target.value })} />
        </Field>
      </div>

      <div className="ad-ref__group">
        <div className="ad-ref__grouphead"><h4>تصویر دوره</h4></div>
        <MediaField
          label="تصویر کارت"
          hint="از کتابخانهٔ رسانه انتخاب یا بارگذاری کنید؛ یا یکی از تصویرهای آمادهٔ پروژه را بزنید."
          value={course.image}
          assetKind="course"
          assetKey={course.imageKey}
          assetKeys={COURSE_IMAGE_KEYS}
          onChange={(url) => set({ image: url ?? '' })}
          onAssetKey={(key) => set({ imageKey: key, image: key ? '' : course.image })}
          onOpenPicker={() => setPickerOpen(true)}
        />
      </div>

      <div className="ad-ref__group">
        <div className="ad-ref__grouphead"><h4>انتشار</h4></div>
        <Field label="وضعیت انتشار" hint={`«${STATUS_LABEL[course.status] ?? 'پیش‌نویس'}» — دکمهٔ نوار بالا هم همین را اتمیک ذخیره می‌کند.`}>
          <Select options={PUBLISH_OPTIONS} value={course.status ?? 'draft'} onChange={(event) => set({ status: event.target.value })} aria-label="وضعیت انتشار" />
        </Field>
      </div>

      <MediaPicker
        open={pickerOpen}
        accept="image/"
        maxMb={4}
        onClose={() => setPickerOpen(false)}
        onSelect={(item) => set({ image: item?.url ?? '', imageKey: '' })}
      />
    </div>
  );
}

export function IntlSectionEditor({ section, index, total, course, onChange, onPersist }) {
  const set = (changes) => onChange({ ...section, ...changes });
  const subtitles = section.subtitles ?? [];

  /*
   * بعد از بارگذاری فایل، تغییر همان لحظه ذخیره می‌شود.
   *
   * چرا: بارگذاری روی دیسک انجام می‌شود ولی رکورد تا «ذخیره»ی دستی عوض نمی‌شد؛
   * مدیر فکر می‌کرد زیرنویس به کاربر رسیده، در حالی که رکورد هنوز خالی بود.
   * `patch` فقط بخش جاری را عوض می‌کند و بقیهٔ دوره دست‌نخورده می‌رود.
   */
  const persist = (patch) => {
    if (!onPersist || !course?.id) return;
    const nextSection = { ...section, ...patch };
    const sections = (course.sections ?? []).map((item, i) => (i === index ? nextSection : item));
    onPersist({ ...course, sections });
  };

  const setSubtitleAt = (subtitleIndex, next) => set({
    subtitles: subtitles.map((item, i) => (i === subtitleIndex ? next : item)),
  });

  return (
    <div className="ad-stack">
      <div className="ad-ref__group">
        <div className="ad-ref__grouphead">
          <h4>مشخصات ویدیو</h4>
          <span className="ad-sub">ویدیو {faNumber(index + 1)} از {faNumber(total)}</span>
        </div>
        <Field label="عنوان ویدیو" hint="در فهرست «محتوای دوره» و زیر پخش‌کننده می‌آید.">
          <Input value={section.title ?? ''} onChange={(event) => set({ title: event.target.value })} placeholder="مثال: مغز چگونه یادگیری را ثبت می‌کند؟" />
        </Field>
        <div className="ad-grid2">
          <Field label="زمان شروع" hint="مثل ۰۵:۱۵ — روی قاب فهرست دیده می‌شود.">
            <Input dir="ltr" value={section.time ?? ''} onChange={(event) => set({ time: event.target.value })} placeholder="۰۵:۱۵" />
          </Field>
          <Field label="شناسهٔ بخش" hint="خالی بگذارید تا سرور بسازد.">
            <Input dir="ltr" value={section.id ?? ''} onChange={(event) => set({ id: event.target.value })} />
          </Field>
        </div>
        <Field label="توضیح این ویدیو" hint="زیر پخش‌کننده، بالای کادر یادداشت‌برداری.">
          <Textarea rows={3} value={section.desc ?? ''} onChange={(event) => set({ desc: event.target.value })} />
        </Field>
      </div>

      <div className="ad-ref__group">
        <div className="ad-ref__grouphead"><h4>ویدیوی این بخش</h4></div>
        <UploadField
          label="فایل ویدیو"
          hint={`فایل را بارگذاری کنید یا آدرس بگذارید. فرمت‌های مجاز: mp4، webm، ogv، mov، mkv — سقف ${faNumber(MAX_VIDEO_MB)} مگابایت.`}
          kind="video"
          accept={INTL_VIDEO_ACCEPT}
          value={section.videoUrl}
          mime={section.videoMime}
          onUploaded={(media) => {
            const patch = { videoUrl: media.url, videoMime: media.mimeType };
            set(patch);
            persist(patch);
          }}
          onUrl={(url) => set({ videoUrl: url, videoMime: '' })}
          onClear={() => set({ videoUrl: '', videoMime: '' })}
        />
      </div>

      <div className="ad-ref__group">
        <div className="ad-ref__grouphead">
          <h4>زیرنویس‌های این ویدیو</h4>
          <span className="ad-sub">{faNumber(subtitles.filter((item) => item.url).length)} زیرنویس آماده</span>
        </div>
        <p className="ad-ref__hint">
          برای هر زبان یک زیرنویس. کد زبان آزاد است (هر زبانی که بخواهید)؛ فایل `.vtt` یا `.srt`
          را بارگذاری کنید — فایل `srt` همان لحظه به `vtt` تبدیل می‌شود، چون پخش‌کنندهٔ مرورگر
          فقط WebVTT را می‌خواند. تا وقتی فایلی بارگذاری نشده باشد، آن زبان در پخش‌کنندهٔ کاربر
          دیده نمی‌شود.
        </p>

        <datalist id="intl-subtitle-langs">
          {INTL_SUBTITLE_LANGS.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </datalist>

        {subtitles.map((subtitle, subtitleIndex) => (
          <div className="ad-intl__subtitle" key={`${subtitle.lang}-${subtitleIndex}`}>
            <div className="ad-intl__subtitlehead">
              {/* کد زبان آزاد است؛ فهرست فقط پیشنهاد است */}
              <Input
                dir="ltr"
                list="intl-subtitle-langs"
                value={subtitle.lang ?? ''}
                onChange={(event) => {
                  const lang = event.target.value;
                  setSubtitleAt(subtitleIndex, {
                    ...subtitle,
                    lang,
                    label: subtitle.label || (INTL_SUBTITLE_LANGS.find((item) => item.id === lang)?.label ?? ''),
                  });
                }}
                placeholder="fa"
                aria-label="کد زبان زیرنویس"
              />
              <Input
                value={subtitle.label ?? ''}
                onChange={(event) => setSubtitleAt(subtitleIndex, { ...subtitle, label: event.target.value })}
                placeholder="برچسب زبان"
                aria-label="برچسب زیرنویس"
              />
              <IconButton
                label="حذف زیرنویس"
                tone="danger"
                onClick={() => set({ subtitles: subtitles.filter((_, i) => i !== subtitleIndex) })}
              >
                <IconTrash width={14} height={14} />
              </IconButton>
            </div>
            <UploadField
              label="فایل زیرنویس"
              hint="vtt یا srt"
              kind="subtitle"
              accept={INTL_SUBTITLE_ACCEPT}
              placeholder="/uploads/intl/…vtt یا آدرس زیرنویس بیرونی"
              value={subtitle.url}
              mime=""
              onUploaded={(media) => {
                const next = subtitles.map((item, i) => (i === subtitleIndex ? { ...item, url: media.url } : item));
                set({ subtitles: next });
                persist({ subtitles: next });
              }}
              onUrl={(url) => setSubtitleAt(subtitleIndex, { ...subtitle, url })}
              onClear={() => setSubtitleAt(subtitleIndex, { ...subtitle, url: '' })}
            />
          </div>
        ))}

        <Button
          size="sm"
          variant="ghost"
          onClick={() => set({ subtitles: [...subtitles, newSubtitle(INTL_SUBTITLE_LANGS.find((option) => !subtitles.some((item) => item.lang === option.id))?.id ?? '')] })}
        >
          <IconPlus width={13} height={13} /> افزودن زیرنویس
        </Button>
      </div>

      <div className="ad-ref__group">
        <div className="ad-ref__grouphead"><h4>این بخش در کدام دوره است</h4></div>
        <p className="ad-ref__hint">
          دوره: <strong>{course?.title || 'بی‌عنوان'}</strong> — ترتیب بخش‌ها از درخت سمت راست
          کم و زیاد می‌شود و همان ترتیب در «محتوای دوره» کاربر دیده می‌شود.
        </p>
      </div>
    </div>
  );
}

export function IntlProviderEditor({ provider, courses, onChange }) {
  const set = (changes) => onChange({ ...provider, ...changes });
  const [pickerOpen, setPickerOpen] = useState(false);
  const ownCourses = (courses ?? []).filter((course) => course.providerId === provider.id);

  return (
    <div className="ad-stack">
      <div className="ad-ref__group">
        <div className="ad-ref__grouphead">
          <h4>شناسهٔ منبع</h4>
          {provider.origin === 'tapesh' ? <Badge tone="neutral">تپش</Badge> : null}
        </div>
        <div className="ad-grid2">
          <Field label="نام فارسی" required hint="روی کارت دوره و تیتر لایهٔ منبع می‌آید.">
            <Input value={provider.name ?? ''} onChange={(event) => set({ name: event.target.value })} placeholder="مثال: دانشگاه تورنتو" />
          </Field>
          <Field label="نام لاتین">
            <Input dir="ltr" value={provider.nameEn ?? ''} onChange={(event) => set({ nameEn: event.target.value })} />
          </Field>
        </div>
        <div className="ad-grid2">
          <Field label="نوع منبع">
            <Select options={KIND_OPTIONS} value={provider.kind ?? 'university'} onChange={(event) => set({ kind: event.target.value })} aria-label="نوع منبع" />
          </Field>
          <Field label="کشور">
            <Input value={provider.country ?? ''} onChange={(event) => set({ country: event.target.value })} />
          </Field>
        </div>
        <div className="ad-grid2">
          <Field label="سال بنیان">
            <Input value={provider.founded ?? ''} onChange={(event) => set({ founded: event.target.value })} placeholder="۱۸۲۷" />
          </Field>
          <Field label="وضعیت انتشار">
            <Select options={PUBLISH_OPTIONS} value={provider.status ?? 'draft'} onChange={(event) => set({ status: event.target.value })} aria-label="وضعیت انتشار منبع" />
          </Field>
        </div>
        <Field label="معرفی منبع" hint="در لایهٔ منبع، زیر نام دانشگاه می‌آید.">
          <Textarea rows={3} value={provider.description ?? ''} onChange={(event) => set({ description: event.target.value })} />
        </Field>
        <Field label="حوزه‌های تمرکز" hint="با کاما جدا کنید؛ به‌شکل برچسب کنار معرفی دیده می‌شوند.">
          <Input
            value={(provider.focus ?? []).join('، ')}
            onChange={(event) => set({ focus: event.target.value.split(/[،,]/).map((item) => item.trim()).filter(Boolean) })}
            placeholder="علوم اعصاب، حافظه، یادگیری"
          />
        </Field>
      </div>

      <div className="ad-ref__group">
        <div className="ad-ref__grouphead"><h4>لوگو و جایگاه</h4></div>
        <MediaField
          label="لوگوی منبع"
          hint="لوگوی خالص و بدون پلاک؛ در کارت دوره، لایهٔ منبع و نوار متحرک استفاده می‌شود."
          value={provider.logo}
          assetKind="provider"
          assetKey={provider.logoKey}
          assetKeys={PROVIDER_LOGO_KEYS}
          onChange={(url) => set({ logo: url ?? '' })}
          onAssetKey={(key) => set({ logoKey: key, logo: key ? '' : provider.logo })}
          onOpenPicker={() => setPickerOpen(true)}
        />
        <div className="ad-grid2">
          <Field label="ترتیب در فهرست منابع" hint="عدد کوچک‌تر جلوتر می‌آید.">
            <Input type="number" min="0" value={provider.sortOrder ?? 0} onChange={(event) => set({ sortOrder: Number(event.target.value) || 0 })} />
          </Field>
          <Field label="ترتیب در نوار متحرک" hint="صفر یعنی این منبع در نوار بالای کاتالوگ نمایش داده نشود.">
            <Input type="number" min="0" value={provider.marqueeOrder ?? 0} onChange={(event) => set({ marqueeOrder: Number(event.target.value) || 0 })} />
          </Field>
        </div>
        <Toggle
          checked={Number(provider.marqueeOrder) > 0}
          onChange={(checked) => set({ marqueeOrder: checked ? (provider.marqueeOrder > 0 ? provider.marqueeOrder : 10) : 0 })}
          label="نمایش در نوار متحرک کاتالوگ"
          hint="نوار لوگوهای بی‌پایان بالای کاتالوگ، به ترتیب عدد بالا."
        />
      </div>

      <div className="ad-ref__group">
        <div className="ad-ref__grouphead"><h4>دوره‌های این منبع</h4></div>
        {ownCourses.length > 0 ? (
          <ol className="ad-ref__topiclist">
            {ownCourses.map((course) => (
              <li key={course.id}>
                <span>{course.title}</span>
                <span className="ad-sub">{course.status === 'published' ? 'منتشرشده' : STATUS_LABEL[course.status] ?? '—'}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="ad-ref__hint">این منبع هنوز دوره‌ای در تپش ندارد؛ فقط در نوار یا فهرست منابع دیده می‌شود.</p>
        )}
      </div>

      <MediaPicker
        open={pickerOpen}
        accept="image/"
        maxMb={4}
        onClose={() => setPickerOpen(false)}
        onSelect={(item) => set({ logo: item?.url ?? '', logoKey: '' })}
      />
    </div>
  );
}

/* ── ساخت دوره و منبع تازه ── */

function CreateDialog({ open, busy, title, subtitle, onClose, onCreate, fields }) {
  const [form, setForm] = useState(() => fields.initial);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setForm(fields.initial);
    setErrors({});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    const found = fields.validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onCreate(form);
  };

  return (
    <Modal
      open={open}
      title={title}
      subtitle={subtitle}
      size="sm"
      onClose={busy ? undefined : onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>انصراف</Button>
          <Button onClick={submit} loading={busy}>ساخت</Button>
        </>
      )}
    >
      <div className="ad-stack">
        {fields.render(form, setForm, errors)}
      </div>
    </Modal>
  );
}

/* ────────────────────────── ویوی اصلی ────────────────────────── */

export default function AdminIntlCourses({ admin, onBack }) {
  const notify = useToast();
  const [tab, setTab] = useState('courses');
  const [filters, setFilters] = useState({ search: '', status: 'all' });
  const [courseId, setCourseId] = useState(null);
  const [providerId, setProviderId] = useState(null);
  const [courseDraft, setCourseDraft] = useState(null);
  const [providerDraft, setProviderDraft] = useState(null);
  const [node, setNode] = useState({ kind: 'course' });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => new Set());

  const can = (permission) => admin?.permissions?.includes(permission);

  const toggleBranch = (key) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  /* ── بارگذاری فهرست‌ها ── */

  const listLoad = useCallback(
    () => intlApi.list({ search: filters.search, status: filters.status, perPage: 100 }),
    [filters.search, filters.status],
  );
  const { data: listData, error: listError, reload: reloadList } = useAsync(listLoad, [filters.search, filters.status]);

  const providerLoad = useCallback(() => intlApi.providers.list(), []);
  const { data: providerData, error: providerError, reload: reloadProviders } = useAsync(providerLoad, []);

  const providers = providerData?.items ?? [];

  /*
   * فهرست بی‌فیلتر دوره‌ها — فقط برای تب منابع.
   * فهرست بالای صفحه با جست‌وجو و وضعیت فیلتر می‌شود؛ اگر همان را به ویرایشگر
   * منبع می‌دادیم، «دوره‌های این منبع» با هر فیلتر ناقص می‌شد.
   */
  const allCoursesLoad = useCallback(() => intlApi.list({ perPage: 200 }), []);
  const { data: allCoursesData, reload: reloadAllCourses } = useAsync(allCoursesLoad, []);
  const allCourses = allCoursesData?.items ?? [];

  useEffect(() => {
    if (courseId || !listData) return;
    setCourseId(listData.items?.[0]?.id ?? null);
  }, [listData, courseId]);

  useEffect(() => {
    if (providerId || providers.length === 0) return;
    setProviderId(providers[0].id);
  }, [providers, providerId]);

  const courseLoad = useCallback(
    () => (courseId ? intlApi.get(courseId) : Promise.resolve(null)),
    [courseId],
  );
  const { data: courseData, loading: courseLoading, error: courseError, reload: reloadCourse } = useAsync(courseLoad, [courseId]);

  const providerDetailLoad = useCallback(
    () => (providerId ? intlApi.providers.get(providerId) : Promise.resolve(null)),
    [providerId],
  );
  const { data: providerDetail, loading: providerLoading, reload: reloadProviderDetail } = useAsync(providerDetailLoad, [providerId]);

  useEffect(() => {
    setCourseDraft(courseData?.course ?? null);
    setDirty(false);
    setNode({ kind: 'course' });
  }, [courseData]);

  useEffect(() => {
    setProviderDraft(providerDetail?.provider ?? null);
    setDirty(false);
  }, [providerDetail]);

  const mutateCourse = useCallback((mutator) => {
    setCourseDraft((current) => (current ? mutator(current) : current));
    setDirty(true);
  }, []);

  const mutateProvider = useCallback((mutator) => {
    setProviderDraft((current) => (current ? mutator(current) : current));
    setDirty(true);
  }, []);

  /* ── ذخیره و انتشار ── */

  const save = useCallback(async ({ silent = false, draft = null } = {}) => {
    /* `draft` برای ذخیرهٔ فوری بعد از بارگذاری فایل است: آنجا رکورد تازه در
       همین لحظه ساخته شده و state هنوز به‌روز نشده. */
    const target = draft ?? (tab === 'courses' ? courseDraft : providerDraft);
    if (!target) return null;
    setBusy(true);
    try {
      if (tab === 'courses') {
        const data = await intlApi.update(target.id, target);
        setCourseDraft(data.course);
        setDirty(false);
        if (!silent) notify('تغییرات دوره ذخیره شد');
        reloadList();
        return data.course;
      }
      const data = await intlApi.providers.update(target.id, target);
      setProviderDraft(data.provider);
      setDirty(false);
      if (!silent) notify('تغییرات منبع ذخیره شد');
      reloadProviders();
      return data.provider;
    } catch (actionError) {
      notify(actionError.message, 'error');
      return null;
    } finally {
      setBusy(false);
    }
  }, [tab, courseDraft, providerDraft, notify, reloadList, reloadProviders]);

  /*
   * انتشار = ذخیره (اگر لازم باشد) + تغییر وضعیت. از لحظهٔ انتشار، لایه از
   * `/api/public/intl-courses/library` می‌خواند و کاربر دوره را می‌بیند.
   */
  const setPublished = useCallback(async (status) => {
    const current = dirty ? await save({ silent: true }) : (tab === 'courses' ? courseDraft : providerDraft);
    if (!current) return;
    setBusy(true);
    try {
      if (tab === 'courses') {
        const data = await intlApi.update(current.id, { ...current, status });
        setCourseDraft(data.course);
        notify(status === 'published'
          ? 'دوره برای کاربران تپش منتشر شد'
          : 'انتشار برداشته شد — محتوا دست‌نخورده ماند');
        reloadList();
      } else {
        const data = await intlApi.providers.update(current.id, { ...current, status });
        setProviderDraft(data.provider);
        notify(status === 'published'
          ? 'منبع برای کاربران تپش منتشر شد'
          : 'انتشار برداشته شد — محتوا دست‌نخورده ماند');
        reloadProviders();
        reloadList();
      }
      setDirty(false);
      reloadAllCourses();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }
  }, [dirty, tab, courseDraft, providerDraft, save, notify, reloadList, reloadProviders, reloadAllCourses]);

  const createCourse = async (payload) => {
    setBusy(true);
    try {
      const data = await intlApi.create({ ...payload, sections: [newSection()] });
      notify('دورهٔ تازه ساخته شد — بخش‌ها و ویدیوهایش را کامل کنید');
      setCourseId(data.course.id);
      setCourseDraft(data.course);
      setDirty(false);
      setNode({ kind: 'course' });
      setCreateOpen(false);
      reloadList();
      reloadAllCourses();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const createProvider = async (payload) => {
    setBusy(true);
    try {
      const data = await intlApi.providers.create(payload);
      notify('منبع تازه ساخته شد');
      setProviderId(data.provider.id);
      setProviderDraft(data.provider);
      setDirty(false);
      setCreateOpen(false);
      reloadProviders();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      if (pendingDelete.kind === 'course') {
        await intlApi.remove(pendingDelete.id);
        notify('دوره حذف شد');
        setCourseId(null);
        setCourseDraft(null);
        reloadList();
        reloadAllCourses();
      } else {
        await intlApi.providers.remove(pendingDelete.id);
        notify('منبع حذف شد');
        setProviderId(null);
        setProviderDraft(null);
        reloadProviders();
      }
      setPendingDelete(null);
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  /* ── عملیات ساختار دوره ── */

  const actions = useMemo(() => {
    const move = (list, index, direction) => {
      const target = index + direction;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    };

    return {
      addSection: () => mutateCourse((course) => ({ ...course, sections: [...(course.sections ?? []), newSection()] })),
      removeSection: (index) => mutateCourse((course) => ({
        ...course,
        sections: (course.sections ?? []).filter((_, i) => i !== index),
      })),
      moveSection: (index, direction) => mutateCourse((course) => ({
        ...course,
        sections: move(course.sections ?? [], index, direction),
      })),
    };
  }, [mutateCourse]);

  const setSectionAt = (index, section) => mutateCourse((course) => ({
    ...course,
    sections: (course.sections ?? []).map((item, i) => (i === index ? section : item)),
  }));

  /* انتخاب بخش، شاخهٔ والدش را باز می‌کند تا گرهٔ انتخاب‌شده پنهان نماند */
  useEffect(() => {
    if (node.kind !== 'section') return;
    setCollapsed((current) => {
      const next = new Set(current);
      next.delete('sections');
      return next.size === current.size ? current : next;
    });
  }, [node]);

  const counts = useMemo(() => intlCounts(courseDraft), [courseDraft]);

  const renderEditor = () => {
    if (tab === 'providers') {
      return providerDraft
        ? <IntlProviderEditor provider={providerDraft} courses={allCourses} onChange={(next) => mutateProvider(() => next)} />
        : <EmptyState title="منبعی انتخاب نشده" description="از فهرست بالا یک منبع انتخاب کنید." />;
    }

    if (!courseDraft) return null;

    if (node.kind === 'section') {
      const section = courseDraft.sections?.[node.sectionIndex];
      return section ? (
        <IntlSectionEditor
          section={section}
          index={node.sectionIndex}
          total={courseDraft.sections.length}
          course={courseDraft}
          onChange={(next) => setSectionAt(node.sectionIndex, next)}
          onPersist={(next) => save({ silent: true, draft: next })}
        />
      ) : <EmptyState title="این ویدیو پیدا نشد" description="با تغییر ساختار، انتخاب قبلی معتبر نمانده است." />;
    }

    return <IntlCourseEditor course={courseDraft} providers={providers} onChange={(next) => mutateCourse(() => next)} />;
  };

  const active = tab === 'courses' ? courseDraft : providerDraft;
  const published = active?.status === 'published';
  const sectionsOpen = !collapsed.has('sections');

  return (
    <div className="ad-stack">
      <div className="ad-toolbar">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <IconChevron width={15} height={15} style={{ transform: 'rotate(180deg)' }} />
          بازگشت به صفحات
        </Button>

        <div className="ad-tabs ad-intl__tabs" role="tablist" aria-label="بخش‌های مدیریت">
          <button type="button" role="tab" aria-selected={tab === 'courses'} className={tab === 'courses' ? 'is-active' : ''} onClick={() => { setTab('courses'); setDirty(false); }}>
            دوره‌ها
          </button>
          <button type="button" role="tab" aria-selected={tab === 'providers'} className={tab === 'providers' ? 'is-active' : ''} onClick={() => { setTab('providers'); setDirty(false); }}>
            دانشگاه‌ها و مراجع
          </button>
        </div>

        {tab === 'courses' ? (
          <>
            <Select
              options={(listData?.items ?? []).map((item) => ({
                value: item.id,
                label: `${item.title}${item.status === 'published' ? ' ✓' : ''}`,
              }))}
              value={courseId ?? ''}
              onChange={(event) => setCourseId(event.target.value)}
              aria-label="دوره"
            />
            <SearchInput value={filters.search} onChange={(search) => setFilters((current) => ({ ...current, search }))} placeholder="جست‌وجوی دوره…" />
            <Select options={STATUS_OPTIONS} value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} aria-label="وضعیت" />
          </>
        ) : (
          <Select
            options={providers.map((item) => ({
              value: item.id,
              label: `${item.name}${item.status === 'published' ? ' ✓' : ''}`,
            }))}
            value={providerId ?? ''}
            onChange={(event) => setProviderId(event.target.value)}
            aria-label="منبع"
          />
        )}

        <div className="ad-toolbar__end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reloadProviders();
              reloadAllCourses();
              if (tab === 'courses') { reloadList(); if (courseId) reloadCourse(); }
              else if (providerId) reloadProviderDetail();
            }}
          >
            <IconRefresh width={15} height={15} />تازه‌سازی
          </Button>
          {tab === 'courses' && can('intl.create') ? (
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(true)}><IconPlus width={15} height={15} />دورهٔ جدید</Button>
          ) : null}
          {tab === 'providers' && can('intl.create') ? (
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(true)}><IconPlus width={15} height={15} />منبع جدید</Button>
          ) : null}
        </div>
      </div>

      {listError ? <ErrorState error={listError} onRetry={reloadList} /> : null}
      {providerError ? <ErrorState error={providerError} onRetry={reloadProviders} /> : null}
      {courseError ? <ErrorState error={courseError} onRetry={reloadCourse} /> : null}
      {(tab === 'courses' && courseLoading && !courseDraft) || (tab === 'providers' && providerLoading && !providerDraft) ? (
        <LoadingBlock label="در حال خواندن محتوای لایه…" rows={5} />
      ) : null}

      {tab === 'courses' && !courseLoading && !courseDraft && !courseError ? (
        <EmptyState
          title="هنوز دوره‌ای ثبت نشده"
          description="با «دورهٔ جدید» اولین دورهٔ بین‌الملل را بسازید؛ بعد بخش‌ها، ویدیو و زیرنویسش را اضافه کنید."
          action={can('intl.create') ? <Button onClick={() => setCreateOpen(true)}>دورهٔ جدید</Button> : null}
        />
      ) : null}

      {active ? (
        <>
          <div className="ad-ref__bar">
            <span className="ad-ref__bartitle">
              <IconGlobe width={17} height={17} />
              <strong>{active.title || active.name}</strong>
              <StatusBadge status={active.status} />
              {dirty ? <Badge tone="neutral">ذخیره‌نشده</Badge> : null}
            </span>

            <span className="ad-ref__barmeta">
              {tab === 'courses' ? (
                <>
                  <span className="ad-sub">{faNumber(counts.sections)} بخش</span>
                  <span className="ad-sub">{faNumber(counts.withVideo)} ویدیو آماده</span>
                  <span className="ad-sub">{faNumber(counts.withoutVideo)} بدون ویدیو</span>
                  <span className="ad-sub">{faNumber(counts.subtitles)} زیرنویس</span>
                </>
              ) : (
                <>
                  <span className="ad-sub">{faNumber(allCourses.filter((course) => course.providerId === active.id).length)} دوره</span>
                  <span className="ad-sub">{Number(active.marqueeOrder) > 0 ? 'در نوار متحرک' : 'بدون نوار'}</span>
                </>
              )}
              <span className="ad-sub">آخرین ویرایش {faDateTime(active.updatedAt)}</span>
              {active.publishedAt ? <span className="ad-sub">انتشار {faDateTime(active.publishedAt)}</span> : null}
            </span>

            <span className="ad-ref__baractions">
              {can('intl.update') ? (
                <Button size="sm" variant="ghost" loading={busy} disabled={!dirty} onClick={() => save()}>
                  ذخیره تغییرات
                </Button>
              ) : null}

              {can('intl.publish') ? (
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

              {can('intl.delete') ? (
                <IconButton
                  label={tab === 'courses' ? 'حذف دوره' : 'حذف منبع'}
                  tone="danger"
                  onClick={() => setPendingDelete({ kind: tab === 'courses' ? 'course' : 'provider', id: active.id, title: active.title || active.name })}
                >
                  <IconTrash width={16} height={16} />
                </IconButton>
              ) : null}
            </span>
          </div>

          {published ? (
            <p className="ad-ref__hint">
              این {tab === 'courses' ? 'دوره' : 'منبع'} منتشر شده است و از مسیر <code className="ad-code" dir="ltr">/api/public/intl-courses/library</code> برای
              لایهٔ «دوره‌های بین‌الملل» کاربران سرو می‌شود. هر تغییر بعدی با «ذخیره تغییرات» روی همان نسخهٔ منتشرشده می‌نشیند.
            </p>
          ) : null}

          <div className="ad-ref__layout">
            <nav className="ad-ref__tree" aria-label="ساختار لایه">
              <div className="ad-ref__treebar">
                {tab === 'courses' ? (
                  <>
                    <span className="ad-sub">{faNumber(counts.sections)} بخش · {faNumber(counts.subtitles)} زیرنویس</span>
                    {can('intl.update') ? (
                      <Button variant="ghost" size="sm" onClick={actions.addSection}><IconPlus width={13} height={13} /> بخش جدید</Button>
                    ) : null}
                  </>
                ) : (
                  <span className="ad-sub">{faNumber(providers.length)} منبع ثبت‌شده</span>
                )}
              </div>

              {tab === 'courses' ? (
                <>
                  <div className={`ad-ref__node ${node.kind === 'course' ? 'is-active' : ''}`}>
                    <button type="button" className="ad-ref__nodetoggle" onClick={() => setNode({ kind: 'course' })}>
                      <IconGlobe width={15} height={15} />
                      <span className="ad-ref__nodelabel">مشخصات دوره</span>
                    </button>
                  </div>

                  {(courseDraft?.sections ?? []).length > 0 ? (
                    <div className="ad-ref__branch">
                      <div className="ad-ref__node">
                        <button
                          type="button"
                          className={`ad-ref__caret ${sectionsOpen ? 'is-open' : ''}`}
                          onClick={() => toggleBranch('sections')}
                          aria-expanded={sectionsOpen}
                          aria-label={`${sectionsOpen ? 'بستن' : 'باز کردن'} بخش‌ها`}
                        >
                          <IconChevron width={13} height={13} />
                        </button>
                        <span className="ad-ref__nodelabel">بخش‌ها و ویدیوها</span>
                        <Badge tone="neutral">{faNumber(counts.sections)}</Badge>
                      </div>

                      {sectionsOpen ? (courseDraft.sections ?? []).map((section, sectionIndex) => (
                        <div
                          key={section.id ?? `section-${sectionIndex}`}
                          className={`ad-ref__node ad-ref__node--leaf ${node.kind === 'section' && node.sectionIndex === sectionIndex ? 'is-active' : ''}`}
                        >
                          <button
                            type="button"
                            className="ad-ref__nodetoggle"
                            onClick={() => setNode({ kind: 'section', sectionIndex })}
                          >
                            <IconEdit width={14} height={14} />
                            <span className="ad-ref__nodelabel">{faNumber(sectionIndex + 1)}. {section.title || 'ویدیوی بی‌نام'}</span>
                            <span className="ad-sub">
                              {section.videoUrl ? 'ویدیو ✓' : 'بدون ویدیو'}
                              {(section.subtitles?.length ?? 0) > 0 ? ` · ${faNumber(section.subtitles.length)} زیرنویس` : ''}
                            </span>
                          </button>
                          {can('intl.update') ? (
                            <NodeActions
                              label="بخش"
                              canMoveUp={sectionIndex > 0}
                              canMoveDown={sectionIndex < courseDraft.sections.length - 1}
                              onMove={(direction) => actions.moveSection(sectionIndex, direction)}
                              onRemove={() => actions.removeSection(sectionIndex)}
                            />
                          ) : null}
                        </div>
                      )) : null}

                      <div className="ad-ref__addrow">
                        {can('intl.update') ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              actions.addSection();
                              setNode({ kind: 'section', sectionIndex: (courseDraft.sections ?? []).length });
                            }}
                          >
                            <IconPlus width={13} height={13} /> ویدیوی جدید
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="ad-ref__addrow">
                      {can('intl.update') ? (
                        <Button variant="ghost" size="sm" onClick={() => { actions.addSection(); setNode({ kind: 'section', sectionIndex: 0 }); }}>
                          <IconPlus width={13} height={13} /> ویدیوی جدید
                        </Button>
                      ) : (
                        <span className="ad-sub">این دوره هنوز بخشی ندارد.</span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                providers.map((provider) => (
                  <div key={provider.id} className={`ad-ref__node ${providerId === provider.id ? 'is-active' : ''}`}>
                    <button type="button" className="ad-ref__nodetoggle" onClick={() => setProviderId(provider.id)}>
                      <IconEdit width={15} height={15} />
                      <span className="ad-ref__nodelabel">{provider.name}</span>
                      <span className="ad-sub">
                        {Number(provider.marqueeOrder) > 0 ? 'نوار' : '—'}
                        {provider.status !== 'published' ? ' · پیش‌نویس' : ''}
                      </span>
                    </button>
                  </div>
                ))
              )}
            </nav>

            <section className="ad-ref__editor" aria-label="ویرایشگر">
              {renderEditor()}
            </section>
          </div>
        </>
      ) : null}

      <CreateDialog
        open={createOpen && tab === 'courses'}
        busy={busy}
        title="دورهٔ جدید"
        subtitle="فراداده را بسازید؛ بخش‌ها، ویدیو و زیرنویس را بعد در همین لایه اضافه می‌کنید."
        onClose={() => setCreateOpen(false)}
        onCreate={createCourse}
        fields={{
          initial: newCourse((listData?.items?.length ?? 0) * 10 + 10),
          validate: validateIntlCourse,
          render: (form, setForm, errors) => (
            <>
              <Field label="عنوان دوره" required error={errors.title}>
                <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="مثال: تغذیه و متابولیسم" />
              </Field>
              <Field label="منبع" required error={errors.providerId}>
                <Select
                  options={[{ value: '', label: '— انتخاب منبع —' }, ...providers.map((provider) => ({ value: provider.id, label: provider.name }))]}
                  value={form.providerId}
                  onChange={(event) => setForm((current) => ({ ...current, providerId: event.target.value }))}
                  aria-label="منبع"
                />
              </Field>
              <div className="ad-grid2">
                <Field label="نوع دوره">
                  <Select options={CATEGORY_OPTIONS} value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} aria-label="نوع دوره" />
                </Field>
                <Field label="سطح">
                  <Select options={LEVEL_OPTIONS} value={form.level} onChange={(event) => setForm((current) => ({ ...current, level: event.target.value }))} aria-label="سطح" />
                </Field>
              </div>
              <div className="ad-grid2">
                <Field label="مدت (ساعت)">
                  <Input type="number" min="0" value={form.duration} onChange={(event) => setForm((current) => ({ ...current, duration: Number(event.target.value) || 0 }))} />
                </Field>
                <Field label="وضعیت">
                  <Select options={PUBLISH_OPTIONS} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} aria-label="وضعیت" />
                </Field>
              </div>
            </>
          ),
        }}
      />

      <CreateDialog
        open={createOpen && tab === 'providers'}
        busy={busy}
        title="منبع جدید"
        subtitle="دانشگاه، رسانه یا نهادی که دوره‌ها به آن وصل می‌شوند."
        onClose={() => setCreateOpen(false)}
        onCreate={createProvider}
        fields={{
          initial: newProvider((providers.length + 1) * 10),
          validate: validateIntlProvider,
          render: (form, setForm, errors) => (
            <>
              <Field label="نام فارسی" required error={errors.name}>
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="مثال: دانشگاه تورنتو" />
              </Field>
              <Field label="نام لاتین">
                <Input dir="ltr" value={form.nameEn} onChange={(event) => setForm((current) => ({ ...current, nameEn: event.target.value }))} />
              </Field>
              <div className="ad-grid2">
                <Field label="نوع منبع">
                  <Select options={KIND_OPTIONS} value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value }))} aria-label="نوع منبع" />
                </Field>
                <Field label="کشور">
                  <Input value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} />
                </Field>
              </div>
              <Field label="نمایش در نوار متحرک کاتالوگ">
                <Toggle
                  checked={Number(form.marqueeOrder) > 0}
                  onChange={(checked) => setForm((current) => ({ ...current, marqueeOrder: checked ? 10 : 0 }))}
                  label="در نوار لوگوها بیاید"
                  hint="ترتیب دقیقش را بعد در ویرایشگر منبع تعیین کنید."
                />
              </Field>
            </>
          ),
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete?.kind === 'course' ? 'حذف دوره' : 'حذف منبع'}
        message={pendingDelete?.kind === 'course'
          ? `آیا از حذف «${pendingDelete?.title ?? ''}» با همهٔ بخش‌ها، ویدیوها و زیرنویس‌هایش مطمئن هستید؟ اگر منتشر شده باشد، از دسترس کاربران تپش هم خارج می‌شود.`
          : `آیا از حذف «${pendingDelete?.title ?? ''}» مطمئن هستید؟ اگر دوره‌ای به آن وصل باشد، حذف انجام نمی‌شود.`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
