/*
 * سازندهٔ محتوا — «پیش‌نمایش = ارسال».
 *
 * پیش‌نمایش اینجا بازسازی کلاینت نیست: متن ساخته‌شده و مراحل ارسال از سرور
 * می‌آیند (`POST /media/contents/preview`)، یعنی همان تابعی که لحظهٔ انتشار هم
 * صدا زده می‌شود. پس اگر پیش‌نمایش دو مرحله نشان می‌دهد، ارسال هم دو مرحله است.
 */

import { useEffect, useMemo, useState } from 'react';

import { mediaCenter } from '../../../services/admin/adminService';
import { Button, Field, Input, Select, Textarea } from '../adminShared';
import { IconClose, IconImage, IconPlus, IconSend } from '../adminIcons';
import { Empty, Pill, toFa } from './mediaKit';

/* قالب پیش‌نمایش بر اساس خانوادهٔ پلتفرم */
const BUBBLE_FAMILY = new Set(['messenger']);

const STORY_TYPES = new Set(['story', 'reel', 'short']);

export const emptyContent = (defaults = {}) => ({
  title: '',
  caption: '',
  contentType: 'post',
  platform: defaults.platform ?? 'instagram',
  accountId: defaults.accountId ?? '',
  campaignId: defaults.campaignId ?? '',
  tagIds: [],
  hashtags: [],
  mentions: [],
  links: [],
  cta: '',
  assets: [],
  status: 'draft',
  scheduledAt: '',
  authorId: '',
  reviewerId: '',
  notes: '',
});

export default function ContentComposer({
  config, accounts, campaigns, tags, team, admin, content, onClose, onSaved,
}) {
  const isEdit = Boolean(content?.id);

  const [form, setForm] = useState(() => (isEdit ? {
    ...emptyContent(),
    ...content,
    scheduledAt: content.scheduledAt ? content.scheduledAt.slice(0, 16) : '',
  } : emptyContent()));

  const [hashtagDraft, setHashtagDraft] = useState('');
  const [linkDraft, setLinkDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);

  const set = (key, value) => setForm((row) => ({ ...row, [key]: value }));

  const platformAccounts = useMemo(
    () => (accounts ?? []).filter((row) => row.platform === form.platform && row.isActive),
    [accounts, form.platform],
  );

  const catalog = useMemo(
    () => (config.platforms ?? []).find((row) => row.id === form.platform),
    [config.platforms, form.platform],
  );

  const allowedTypes = catalog?.contentTypes?.length
    ? (config.contentTypes ?? []).filter((row) => catalog.contentTypes.includes(row.id))
    : (config.contentTypes ?? []);

  /* اکانت پیش‌فرض پلتفرم انتخاب‌شده */
  useEffect(() => {
    if (form.accountId && platformAccounts.some((row) => row.id === form.accountId)) return;
    set('accountId', platformAccounts[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.platform, platformAccounts.length]);

  /* اگر نوع محتوا با پلتفرم نمی‌خواند، به اولین نوع مجاز برگرد */
  useEffect(() => {
    if (!allowedTypes.length) return;
    if (allowedTypes.some((row) => row.id === form.contentType)) return;
    set('contentType', allowedTypes[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.platform]);

  /* ─── پیش‌نمایش سمت سرور، با تأخیر کوتاه ─── */
  const previewKey = JSON.stringify({
    p: form.platform,
    c: form.caption,
    t: form.title,
    x: form.cta,
    h: form.hashtags,
    l: form.links,
    a: (form.assets ?? []).map((row) => row.url),
    i: form.accountId,
    y: form.contentType,
  });

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      Promise.resolve()
        .then(() => mediaCenter.previewContent({
          platform: form.platform,
          title: form.title,
          caption: form.caption,
          cta: form.cta,
          hashtags: form.hashtags,
          links: form.links,
          assets: form.assets,
          accountId: form.accountId,
          contentType: form.contentType,
        }))
        .then((data) => { if (active) { setPreview(data); setPreviewError(null); } })
        .catch((err) => { if (active) { setPreview(null); setPreviewError(err); } });
    }, 260);

    return () => { active = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  /* ─── برچسب‌ها ─── */

  const addHashtag = () => {
    const value = hashtagDraft.trim().replace(/^#/, '');
    if (!value || form.hashtags.includes(value)) return;
    set('hashtags', [...form.hashtags, value]);
    setHashtagDraft('');
  };

  const addLink = () => {
    const value = linkDraft.trim();
    if (!value || form.links.includes(value)) return;
    set('links', [...form.links, value]);
    setLinkDraft('');
  };

  const toggleTag = (id) => set('tagIds', form.tagIds.includes(id)
    ? form.tagIds.filter((row) => row !== id)
    : [...form.tagIds, id]);

  /* ─── ذخیره ─── */

  const save = async ({ publish = false, schedule = false } = {}) => {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        title: form.title,
        caption: form.caption,
        contentType: form.contentType,
        platform: form.platform,
        accountId: form.accountId || null,
        campaignId: form.campaignId || null,
        tagIds: form.tagIds,
        hashtags: form.hashtags,
        mentions: form.mentions,
        links: form.links,
        cta: form.cta,
        assets: form.assets,
        authorId: form.authorId || null,
        reviewerId: form.reviewerId || null,
        notes: form.notes,
      };

      const saved = isEdit
        ? await mediaCenter.updateContent(content.id, payload)
        : await mediaCenter.createContent(payload);

      const id = saved?.content?.id ?? saved?.id ?? content?.id;

      if (schedule && form.scheduledAt && id) {
        await mediaCenter.scheduleContent(id, new Date(form.scheduledAt).toISOString(), 'زمان‌بندی از سازنده');
      }

      if (publish && id) {
        const result = await mediaCenter.publishContent(id, false);
        onSaved?.(result, 'published');
        return;
      }

      onSaved?.(saved, schedule ? 'scheduled' : 'saved');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const media = form.assets?.[0] ?? null;
  const isStory = STORY_TYPES.has(form.contentType);
  const useBubble = BUBBLE_FAMILY.has(catalog?.family);

  return (
    <div className="mc-composer">
      {/* ─── فرم ─── */}
      <div className="mc-panel">
        <header className="mc-panel__head">
          <div>
            <h3>{isEdit ? `ویرایش محتوا — ${content.title}` : 'محتوای تازه'}</h3>
            <p>
              متن نهایی از ترکیب «متن + دکمهٔ اقدام + پیوندها + هشتگ‌ها» ساخته می‌شود؛
              همان چیزی که در پیش‌نمایش می‌بینید، فرستاده می‌شود.
            </p>
          </div>
          <div className="mc-panel__actions">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <IconClose width={14} height={14} />
              بستن
            </Button>
          </div>
        </header>

        <div className="mc-panel__body">
          <div className="mc-form">
            <Field label="عنوان داخلی" required hint="فقط برای تیم — به مخاطب نشان داده نمی‌شود">
              <Input value={form.title} onChange={(event) => set('title', event.target.value)} placeholder="مثلاً: پوستر جمع‌بندی فیزیولوژی قلبی" />
            </Field>

            <Field label="پلتفرم" required>
              <Select
                value={form.platform}
                onChange={(event) => set('platform', event.target.value)}
                options={(config.platforms ?? []).map((row) => ({ value: row.id, label: row.adapter ? `${row.label} — API` : row.label }))}
              />
            </Field>

            <Field label="نوع محتوا" required>
              <Select
                value={form.contentType}
                onChange={(event) => set('contentType', event.target.value)}
                options={allowedTypes.map((row) => ({ value: row.id, label: row.label }))}
              />
            </Field>

            <Field
              label="اکانت / کانال"
              hint={platformAccounts.length ? 'اکانتی که این محتوا رویش منتشر می‌شود' : 'برای این پلتفرم اکانت فعالی ثبت نشده'}
            >
              <Select
                value={form.accountId}
                onChange={(event) => set('accountId', event.target.value)}
                options={[{ value: '', label: platformAccounts.length ? '— انتخاب کنید —' : 'اکانتی نیست —' },
                  ...platformAccounts.map((row) => ({ value: row.id, label: row.name }))]}
              />
            </Field>

            <div className="mc-form__full">
              <Field label="متن محتوا" hint={`${toFa(form.caption.length)} نویسه`}>
                <Textarea rows={6} value={form.caption} onChange={(event) => set('caption', event.target.value)} />
              </Field>
            </div>

            <div className="mc-form__full">
              <Field label="دکمهٔ اقدام (CTA)" hint="یک جملهٔ کوتاه که بعد از متن می‌آید">
                <Input value={form.cta} onChange={(event) => set('cta', event.target.value)} placeholder="برای مشاهدهٔ دوره به سایت تپش سر بزنید" />
              </Field>
            </div>

            {/* ─── هشتگ ─── */}
            <div className="mc-form__full">
              <Field label="هشتگ‌ها" hint="بدون # بنویسید؛ خودش اضافه می‌شود">
                <div className="mc-chips" style={{ marginBottom: '0.4rem' }}>
                  {form.hashtags.map((tag) => (
                    <span className="mc-chip is-on" key={tag}>
                      #{tag}
                      <button type="button" className="mc-chip__x" onClick={() => set('hashtags', form.hashtags.filter((row) => row !== tag))}>×</button>
                    </span>
                  ))}
                </div>
                <span className="mc-inline-add">
                  <Input
                    dir="ltr"
                    value={hashtagDraft}
                    onChange={(event) => setHashtagDraft(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addHashtag(); } }}
                    placeholder="tapesh"
                  />
                  <Button variant="ghost" size="sm" onClick={addHashtag}>
                    <IconPlus width={14} height={14} />
                  </Button>
                </span>
              </Field>
            </div>

            {/* ─── پیوند ─── */}
            <div className="mc-form__full">
              <Field label="پیوندها" hint="هر پیوند در خط جداگانه به متن اضافه می‌شود">
                <div className="mc-chips" style={{ marginBottom: '0.4rem' }}>
                  {form.links.map((link) => (
                    <span className="mc-chip is-on" key={link}>
                      <span className="mc-mono">{link}</span>
                      <button type="button" className="mc-chip__x" onClick={() => set('links', form.links.filter((row) => row !== link))}>×</button>
                    </span>
                  ))}
                </div>
                <span className="mc-inline-add">
                  <Input
                    dir="ltr"
                    value={linkDraft}
                    onChange={(event) => setLinkDraft(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addLink(); } }}
                    placeholder="https://tapesh.ir/course"
                  />
                  <Button variant="ghost" size="sm" onClick={addLink}>
                    <IconPlus width={14} height={14} />
                  </Button>
                </span>
              </Field>
            </div>

            {/* ─── فایل پیوست ─── */}
            <div className="mc-form__full">
              <Field
                label="فایل پیوست"
                hint="نشانی فایل آپلودشده در کتابخانهٔ رسانه. برای اینستاگرام، پست بدون تصویر یا ویدئو منتشر نمی‌شود."
              >
                <span className="mc-inline-add">
                  <Input
                    dir="ltr"
                    value={media?.url ?? ''}
                    onChange={(event) => set('assets', event.target.value
                      ? [{ url: event.target.value, filename: event.target.value.split('/').pop(), mimeType: 'image/jpeg', kind: 'image', mediaId: null }]
                      : [])}
                    placeholder="/uploads/xxxx.jpg"
                  />
                </span>
                {media?.url ? (
                  <div className="mc-preview" style={{ marginTop: '0.5rem' }}>
                    <div className="mc-preview__body">
                      <div className="mc-post__media">
                        {/\.(jpg|jpeg|png|webp|gif)$/i.test(media.url)
                          ? <img src={media.url} alt="" />
                          : <span><IconImage width={18} height={18} /> {media.filename ?? 'فایل'}</span>}
                      </div>
                    </div>
                  </div>
                ) : null}
              </Field>
            </div>

            {/* ─── کمپین و موضوع ─── */}
            <Field label="کمپین">
              <Select
                value={form.campaignId}
                onChange={(event) => set('campaignId', event.target.value)}
                options={[{ value: '', label: 'بدون کمپین' },
                  ...(campaigns ?? []).map((row) => ({ value: row.id, label: row.name }))]}
              />
            </Field>

            <Field label="نویسنده">
              <Select
                value={form.authorId}
                onChange={(event) => set('authorId', event.target.value)}
                options={[{ value: '', label: 'خودم' },
                  ...(team ?? []).map((row) => ({ value: row.id, label: `${row.name} — ${row.roleLabel}` }))]}
              />
            </Field>

            <Field label="بازبین">
              <Select
                value={form.reviewerId}
                onChange={(event) => set('reviewerId', event.target.value)}
                options={[{ value: '', label: 'تعیین نشده' },
                  ...(team ?? []).map((row) => ({ value: row.id, label: `${row.name} — ${row.roleLabel}` }))]}
              />
            </Field>

            <Field label="زمان انتشار" hint="برای زمان‌بندی پر کنید">
              <Input
                type="datetime-local"
                value={form.scheduledAt ?? ''}
                onChange={(event) => set('scheduledAt', event.target.value)}
              />
            </Field>

            {/* ─── موضوع‌ها ─── */}
            <div className="mc-form__full">
              <Field label="موضوع‌ها" hint="برای تحلیل عملکرد موضوع‌ها در تب «هشتگ و موضوع»">
                <div className="mc-chips">
                  {(tags ?? []).map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className={`mc-chip ${form.tagIds.includes(row.id) ? 'is-on' : ''}`}
                      onClick={() => toggleTag(row.id)}
                    >
                      {row.label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <div className="mc-form__full">
              <Field label="یادداشت">
                <Textarea rows={2} value={form.notes} onChange={(event) => set('notes', event.target.value)} />
              </Field>
            </div>
          </div>

          {error ? (
            <p className="mc-pill mc-pill--danger" style={{ marginTop: '0.8rem' }}>{error.message}</p>
          ) : null}

          <div className="mc-row" style={{ marginTop: '0.9rem', gap: '0.45rem' }}>
            <Button onClick={() => save()} loading={busy}>ذخیره پیش‌نویس</Button>
            <Button variant="ghost" onClick={() => save({ schedule: true })} loading={busy} disabled={!form.scheduledAt}>
              زمان‌بندی انتشار
            </Button>
            <Button variant="ghost" onClick={() => save({ publish: true })} loading={busy} disabled={!form.accountId}>
              <IconSend width={15} height={15} />
              انتشار همین حالا
            </Button>
          </div>

          <p className="mc-muted" style={{ marginTop: '0.5rem', lineHeight: 1.9 }}>
            «انتشار همین حالا» بدون کلید API، هیچ درخواستی به بیرون نمی‌فرستد؛ به‌جایش نتیجهٔ
            آزمایشی با همان درخواستی که می‌رفت ثبت می‌شود.
          </p>
        </div>
      </div>

      {/* ─── پیش‌نمایش ─── */}
      <div>
        <div className="mc-preview">
          <div className="mc-preview__head">
            <strong>پیش‌نمایش {preview?.platformLabel ?? catalog?.label ?? ''}</strong>
            <small>
              {preview?.account?.name ? `→ ${preview.account.name}` : 'اکانت انتخاب نشده'}
            </small>
          </div>

          <div className={`mc-preview__body ${useBubble ? '' : `mc-preview--${form.platform}`}`}>
            {previewError ? (
              <Empty title="پیش‌نمایش ساخته نشد" description={previewError.message} />
            ) : !preview ? (
              <p className="mc-chart__empty">در حال ساخت پیش‌نمایش…</p>
            ) : (
              <>
                {preview.mediaError ? (
                  <p className="mc-pill mc-pill--danger" style={{ whiteSpace: 'normal' }}>
                    {preview.mediaError} — ارسال با خطا متوقف می‌شود.
                  </p>
                ) : null}

                {useBubble ? (
                  <div className="mc-bubble">
                    <span className="mc-bubble__avatar">{(preview.account?.name ?? 'ت').slice(0, 1)}</span>
                    <div className="mc-bubble__body">
                      <strong>{preview.account?.name ?? 'کانال'}</strong>
                      <p>{preview.caption || <em className="mc-muted">بدون متن</em>}</p>
                      {preview.cta ? <p>{preview.cta}</p> : null}
                      {preview.links?.map((link) => <p key={link} className="mc-mono">{link}</p>)}
                      {preview.hashtags?.length ? (
                        <p className="mc-post__tags">{preview.hashtags.map((tag) => `#${tag}`).join(' ')}</p>
                      ) : null}
                      {preview.media ? (
                        <div className="mc-bubble__media">
                          {/\.(jpg|jpeg|png|webp|gif)$/i.test(preview.media.url ?? '')
                            ? <img src={preview.media.url} alt="" />
                            : <span>فایل پیوست</span>}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="mc-post">
                    <div className="mc-post__top">
                      <span className="mc-post__avatar">{(preview.account?.name ?? 'ت').slice(0, 1)}</span>
                      <span className="mc-post__meta">
                        <strong>{preview.account?.name ?? 'صفحه'}</strong>
                        <small>{preview.platformLabel}</small>
                      </span>
                    </div>

                    <div className={`mc-post__media ${isStory ? 'is-story' : ''}`}>
                      {preview.media ? (
                        /\.(jpg|jpeg|png|webp|gif)$/i.test(preview.media.url ?? '')
                          ? <img src={preview.media.url} alt="" />
                          : <span>فایل پیوست</span>
                      ) : (
                        <span>
                          <IconImage width={20} height={20} />
                          {catalog?.capabilities?.publish && ['post', 'story', 'reel', 'carousel', 'infographic', 'video', 'short'].includes(form.contentType)
                            ? ' این نوع محتوا بدون تصویر یا ویدئو منتشر نمی‌شود'
                            : ' بدون فایل'}
                        </span>
                      )}
                    </div>

                    <p className="mc-post__text">{preview.caption || <em className="mc-muted">بدون متن</em>}</p>
                    {preview.cta ? <p className="mc-post__text">{preview.cta}</p> : null}
                    {preview.hashtags?.length ? (
                      <p className="mc-post__tags">{preview.hashtags.map((tag) => `#${tag}`).join(' ')}</p>
                    ) : null}
                    <div className="mc-post__actions">
                      <span>♡ پسندیدن</span>
                      <span>◯ نظر</span>
                      <span>↗ اشتراک</span>
                    </div>
                  </div>
                )}

                {/* ─── مراحل ارسال: همان چیزی که واقعاً اجرا می‌شود ─── */}
                <div>
                  <div className="mc-section-title" style={{ marginTop: '0.4rem' }}>
                    <h3 style={{ fontSize: '0.82rem' }}>مراحل ارسال</h3>
                    <span>{toFa(preview.steps?.length ?? 0)} درخواست</span>
                  </div>
                  <ul className="mc-steps">
                    {(preview.steps ?? []).map((step, index) => (
                      <li key={`${step.method}-${index}`}>
                        <span className="mc-steps__badge">{step.method}</span>
                        <span style={{ minWidth: 0 }}>
                          <strong style={{ fontSize: '0.76rem' }}>{step.label}</strong>
                          <p>{step.text || <em className="mc-muted">بدون متن</em>}</p>
                          {step.hasMedia ? <p className="mc-muted">همراه با فایل</p> : null}
                          {step.warning ? <p className="mc-pill mc-pill--warn" style={{ whiteSpace: 'normal' }}>{step.warning}</p> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mc-row" style={{ gap: '0.35rem' }}>
                  <Pill tone="neutral">طول متن: {toFa(preview.text?.length ?? 0)} نویسه</Pill>
                  {preview.text?.length > 1000 ? <Pill tone="warn">بیش از ۱۰۰۰ نویسه — پیام به دو بخش تقسیم می‌شود</Pill> : null}
                  {!catalog?.capabilities?.publish ? <Pill tone="muted">این پلتفرم آداپتور انتشار ندارد</Pill> : null}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ─── وضعیت گردش کار ─── */}
        {isEdit ? (
          <div className="mc-panel" style={{ marginTop: '0.8rem' }}>
            <header className="mc-panel__head">
              <h3>گردش کار</h3>
            </header>
            <div className="mc-panel__body">
              <ul className="mc-steps">
                {(content.history ?? []).slice().reverse().map((row, index) => (
                  <li key={`${row.at}-${index}`}>
                    <span className="mc-steps__badge">{row.to ? (config.contentStatuses.find((s) => s.id === row.to)?.label ?? row.to) : row.action}</span>
                    <span>
                      <p>{row.note || row.action}</p>
                      <p className="mc-muted">{row.byName} — {toFa(row.at?.slice(0, 10) ?? '')}</p>
                    </span>
                  </li>
                ))}
              </ul>
              {content.rejection ? (
                <p className="mc-pill mc-pill--danger" style={{ marginTop: '0.6rem', whiteSpace: 'normal' }}>
                  درخواست اصلاح: {content.rejection.reason} {content.rejection.comment ? `— ${content.rejection.comment}` : ''}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
