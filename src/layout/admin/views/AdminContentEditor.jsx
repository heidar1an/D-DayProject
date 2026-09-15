/*
 * ویرایشگر محتوا — یک کامپوننت برای «مقاله» و «صفحه».
 *
 * چرا مشترک؟ چون مدل داده و فرم هر دو تقریباً یکی است و نگه‌داشتن دو نسخه یعنی
 * دو جا باید هم‌زمان اصلاح شود. تفاوت‌ها با prop `kind` کنترل می‌شود.
 *
 * ذخیره‌سازی فقط از طریق API انجام می‌شود؛ سرور محتوا را دوباره پاک‌سازی و
 * اعتبارسنجی می‌کند (کلاینت منبع اعتماد نیست).
 */

import { useEffect, useMemo, useState } from 'react';

import { articles as articlesApi, pages as pagesApi } from '../../../services/admin/adminService';
import { sanitizeHtml } from '../../../services/admin/sanitizeHtml';
import RichTextEditor from '../RichTextEditor';
import MediaPicker from '../MediaPicker';
import {
  Button, Card, ErrorState, Field, Input, LoadingBlock, Modal, Select, Textarea, Toggle,
  faDate, toFa, useToast,
} from '../adminShared';
import { IconChevron, IconEye, IconImage, IconTrash } from '../adminIcons';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'published', label: 'منتشرشده' },
  { value: 'archived', label: 'بایگانی' },
];

const EMPTY_ARTICLE = {
  title: '', slug: '', excerpt: '', contentHtml: '', cover: '', coverAlt: '',
  category: '', tags: [], authorName: '', status: 'draft', featured: false, recommended: false,
  seo: { title: '', description: '', canonical: '', ogImage: '', robots: 'index,follow' },
};

const EMPTY_PAGE = {
  title: '', slug: '', contentHtml: '', cover: '', status: 'draft',
  seo: { title: '', description: '', canonical: '', ogImage: '', robots: 'index,follow' },
};

const CONFIG = {
  article: {
    empty: EMPTY_ARTICLE,
    listView: 'articles',
    title: 'مقاله',
    api: articlesApi,
    backLabel: 'بازگشت به مقالات',
  },
  page: {
    empty: EMPTY_PAGE,
    listView: 'pages',
    title: 'صفحه',
    api: pagesApi,
    backLabel: 'بازگشت به صفحات',
  },
};

function slugify(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

export default function AdminContentEditor({ kind, id, navigate, categories, admin }) {
  const config = CONFIG[kind];
  const notify = useToast();
  const isNew = !id || id === 'new';

  const [form, setForm] = useState(config.empty);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [slugLocked, setSlugLocked] = useState(!isNew);

  useEffect(() => {
    if (isNew) {
      setForm({ ...config.empty, category: categories[0]?.id ?? '' });
      setSlugLocked(false);
      return undefined;
    }

    let alive = true;
    setLoading(true);

    config.api.get(id)
      .then((data) => {
        if (!alive) return;
        setForm({ ...config.empty, ...data[kind], seo: { ...config.empty.seo, ...(data[kind].seo ?? {}) } });
        setLoadError(null);
      })
      .catch((error) => { if (alive) setLoadError(error); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [id, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setSeo = (key, value) => setForm((current) => ({ ...current, seo: { ...current.seo, [key]: value } }));

  /* اسلاگ تا وقتی کاربر دستی تغییرش نداده، از عنوان ساخته می‌شود */
  const handleTitleChange = (value) => {
    setForm((current) => ({
      ...current,
      title: value,
      slug: slugLocked ? current.slug : slugify(value),
    }));
  };

  const previewHtml = useMemo(() => sanitizeHtml(form.contentHtml), [form.contentHtml]);

  const save = async (overrides = {}) => {
    if (!form.title.trim()) {
      notify('عنوان را وارد کنید', 'error');
      return null;
    }
    if (kind === 'article' && !form.category) {
      notify('دسته‌بندی را انتخاب کنید', 'error');
      return null;
    }

    setSaving(true);
    try {
      const payload = { ...form, ...overrides };
      const data = isNew ? await config.api.create(payload) : await config.api.update(id, payload);
      notify(isNew ? `${config.title} ایجاد شد` : 'تغییرات ذخیره شد');

      if (isNew) {
        navigate('article-editor', { id: data[kind].id });
        setSlugLocked(true);
      } else {
        setForm({ ...config.empty, ...data[kind], seo: { ...config.empty.seo, ...(data[kind].seo ?? {}) } });
      }

      return data[kind];
    } catch (error) {
      notify(error.message, 'error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingBlock label={`در حال خواندن ${config.title}…`} rows={6} />;
  if (loadError) return <ErrorState error={loadError} onRetry={() => window.location.reload()} />;

  const canPublish = admin.permissions?.includes('articles.publish');

  return (
    <div className="ad-editor">
      <div className="ad-editor__main">
        <Card>
          <div className="ad-editor__topline">
            <Button variant="ghost" size="sm" onClick={() => navigate(config.listView)}>
              <IconChevron width={16} height={16} />
              {config.backLabel}
            </Button>
            <span className="ad-editor__state">
              {isNew ? 'ایجاد ' : 'ویرایش '}
              {config.title}
              {!isNew ? <em> · آخرین ویرایش {faDate(form.updatedAt)}</em> : null}
            </span>
          </div>

          <Field label="عنوان" required>
            <Input
              value={form.title}
              onChange={(event) => handleTitleChange(event.target.value)}
              placeholder={kind === 'article' ? 'عنوان مقاله…' : 'عنوان صفحه…'}
            />
          </Field>

          <Field label="نشانی (slug)" hint="در آدرس صفحه استفاده می‌شود؛ فقط حروف، عدد و خط تیره.">
            <Input
              value={form.slug}
              dir="ltr"
              onChange={(event) => { setSlugLocked(true); setField('slug', event.target.value); }}
              placeholder="my-content-slug"
            />
          </Field>

          {kind === 'article' ? (
            <Field label="خلاصه" hint="اگر خالی بماند، از ابتدای متن ساخته می‌شود.">
              <Textarea
                value={form.excerpt}
                rows={3}
                onChange={(event) => setField('excerpt', event.target.value)}
                placeholder="یک پاراگراف کوتاه برای کارت مقاله…"
              />
            </Field>
          ) : null}

          <div className="ad-editor__content">
            <span className="ad-field__label">متن محتوا</span>
            <RichTextEditor value={form.contentHtml} onChange={(value) => setField('contentHtml', value)} />
          </div>
        </Card>

        <Card title="تنظیمات سئو" description="عنوان و توضیحی که به موتور جست‌وجو و شبکه‌های اجتماعی نمایش داده می‌شود">
          <div className="ad-grid2">
            <Field label="عنوان سئو" hint="حداکثر ۷۰ کاراکتر">
              <Input value={form.seo.title} maxLength={70} onChange={(event) => setSeo('title', event.target.value)} />
            </Field>

            <Field label="نشانی کانونیکال">
              <Input value={form.seo.canonical} dir="ltr" onChange={(event) => setSeo('canonical', event.target.value)} placeholder="https://tapesh.ir/…" />
            </Field>
          </div>

          <Field label="توضیح متا" hint="حداکثر ۱۸۰ کاراکتر">
            <Textarea value={form.seo.description} rows={2} maxLength={180} onChange={(event) => setSeo('description', event.target.value)} />
          </Field>

          <div className="ad-grid2">
            <Field label="تصویر OG">
              <span className="ad-inputicon">
                <Input value={form.seo.ogImage} dir="ltr" onChange={(event) => setSeo('ogImage', event.target.value)} placeholder="/uploads/…" />
                <button type="button" className="ad-inputicon__toggle" onClick={() => setCoverPickerOpen(true)}>انتخاب</button>
              </span>
            </Field>

            <Field label="دستور Robots">
              <Select
                value={form.seo.robots}
                onChange={(event) => setSeo('robots', event.target.value)}
                options={[
                  { value: 'index,follow', label: 'index, follow' },
                  { value: 'noindex,follow', label: 'noindex, follow' },
                  { value: 'index,nofollow', label: 'index, nofollow' },
                  { value: 'noindex,nofollow', label: 'noindex, nofollow' },
                ]}
              />
            </Field>
          </div>

          <div className="ad-serp">
            <span className="ad-serp__url" dir="ltr">tapesh.ir/{form.slug || '…'}</span>
            <strong className="ad-serp__title">{form.seo.title || form.title || 'عنوان محتوا'}</strong>
            <p className="ad-serp__desc">{form.seo.description || form.excerpt || 'توضیح متا اینجا نمایش داده می‌شود.'}</p>
          </div>
        </Card>
      </div>

      <aside className="ad-editor__side">
        <Card title="انتشار">
          <Field label="وضعیت">
            <Select value={form.status} onChange={(event) => setField('status', event.target.value)} options={STATUS_OPTIONS} />
          </Field>

          {kind === 'article' ? (
            <>
              <Field label="دسته‌بندی" required>
                <Select
                  value={form.category}
                  onChange={(event) => setField('category', event.target.value)}
                  options={[
                    { value: '', label: 'انتخاب کنید…' },
                    ...categories.map((category) => ({ value: category.id, label: category.label })),
                  ]}
                />
              </Field>

              <Field label="نویسنده">
                <Input value={form.authorName} onChange={(event) => setField('authorName', event.target.value)} placeholder="نام نویسنده" />
              </Field>

              <Field label="برچسب‌ها" hint="با کاما جدا کنید">
                <Input
                  value={(form.tags ?? []).join('، ')}
                  onChange={(event) => setField('tags', event.target.value.split(/[،,]/).map((tag) => tag.trim()).filter(Boolean))}
                  placeholder="فیزیولوژی، قلب، استرس"
                />
              </Field>
            </>
          ) : null}

          <div className="ad-editor__actions">
            <Button onClick={() => save()} loading={saving} className="ad-editor__save">
              {isNew ? 'ایجاد و ذخیره' : 'ذخیرهٔ تغییرات'}
            </Button>

            {!isNew ? (
              <Button variant="ghost" onClick={() => setPreviewOpen(true)}>
                <IconEye width={16} height={16} />
                پیش‌نمایش
              </Button>
            ) : null}

            {!isNew && kind === 'article' && canPublish ? (
              <Button
                variant={form.status === 'published' ? 'ghost' : 'primary'}
                onClick={() => save({ status: form.status === 'published' ? 'draft' : 'published' })}
                loading={saving}
              >
                {form.status === 'published' ? 'لغو انتشار' : 'انتشار'}
              </Button>
            ) : null}
          </div>
        </Card>

        {kind === 'article' ? (
          <Card title="نمایش در سایت">
            <Toggle checked={form.featured} onChange={(value) => setField('featured', value)} label="مقالهٔ منتخب" hint="در تختهٔ Editorial صفحه اصلی" />
            <Toggle checked={form.recommended} onChange={(value) => setField('recommended', value)} label="پیشنهاد تپش" hint="در بخش پیشنهادها نمایش داده می‌شود" />
          </Card>
        ) : null}

        <Card title="تصویر شاخص">
          {form.cover ? (
            <div className="ad-cover">
              <img src={form.cover} alt={form.coverAlt || 'تصویر شاخص'} />
              <div className="ad-cover__actions">
                <Button variant="ghost" size="sm" onClick={() => setCoverPickerOpen(true)}>تغییر</Button>
                <Button variant="ghost" size="sm" onClick={() => { setField('cover', ''); setField('coverAlt', ''); }}>
                  <IconTrash width={15} height={15} />
                  حذف
                </Button>
              </div>
            </div>
          ) : (
            <button type="button" className="ad-coverdrop" onClick={() => setCoverPickerOpen(true)}>
              <IconImage width={22} height={22} />
              انتخاب از کتابخانهٔ رسانه
            </button>
          )}

          <Field label="متن جانشین (alt)" hint="برای دسترس‌پذیری و سئو مهم است.">
            <Input value={form.coverAlt} onChange={(event) => setField('coverAlt', event.target.value)} placeholder="توضیح تصویر" />
          </Field>
        </Card>

        {!isNew ? (
          <Card title="اطلاعات">
            <dl className="ad-deflist">
              <div><dt>شناسه</dt><dd dir="ltr">{form.id}</dd></div>
              <div><dt>ایجاد</dt><dd>{faDate(form.createdAt)}</dd></div>
              <div><dt>آخرین ویرایش</dt><dd>{faDate(form.updatedAt)}</dd></div>
              {kind === 'article' ? <div><dt>زمان مطالعه</dt><dd>{toFa(form.readingTime ?? 1)} دقیقه</dd></div> : null}
            </dl>
          </Card>
        ) : null}
      </aside>

      <MediaPicker
        open={coverPickerOpen}
        onClose={() => setCoverPickerOpen(false)}
        onSelect={(item) => {
          setField('cover', item.url);
          if (!form.coverAlt) setField('coverAlt', item.altText || item.originalName);
        }}
      />

      <Modal open={previewOpen} title="پیش‌نمایش محتوا" subtitle="دقیقاً همان HTML پاک‌شده‌ای که ذخیره می‌شود" onClose={() => setPreviewOpen(false)} size="lg">
        <div className="ad-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
      </Modal>
    </div>
  );
}
