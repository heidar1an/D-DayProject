/*
 * تنظیمات سایت — یک فرم گروه‌بندی‌شده روی سند تکی `settings`.
 *
 * نکتهٔ امنیتی: این سند فقط دادهٔ قابل نمایش عمومی را نگه می‌دارد. کلیدها و اسرار
 * (مثل رمز دیتابیس یا کلید سرویس‌ها) در متغیر محیطی می‌مانند و هرگز اینجا ذخیره نمی‌شوند.
 */

import { useEffect, useState } from 'react';

import { settings as settingsApi } from '../../../services/admin/adminService';
import MediaPicker from '../MediaPicker';
import {
  Button, Card, ErrorState, Field, Input, LoadingBlock, Select, toFa, useAsync, useToast,
} from '../adminShared';
import { IconImage } from '../adminIcons';

export default function AdminSettings({ admin, meta }) {
  const notify = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null);

  const { data, loading, error, reload } = useAsync(() => settingsApi.get(), []);
  const canUpdate = admin.permissions?.includes('settings.update');

  useEffect(() => {
    if (data?.settings) setForm(data.settings);
  }, [data]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setNested = (group, key, value) => setForm((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));

  const save = async () => {
    setSaving(true);
    try {
      const result = await settingsApi.update(form);
      setForm(result.settings);
      notify('تنظیمات ذخیره شد');
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !form) return <LoadingBlock label="در حال خواندن تنظیمات…" rows={6} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!form) return null;

  const maxMb = meta?.settings?.media?.maxUploadMb ?? form.media.maxUploadMb;

  return (
    <div className="ad-stack">
      <Card title="هویت سایت" description="نام و توضیحی که در هدر، فوتر و متادیتای پیش‌فرض استفاده می‌شود">
        <div className="ad-grid2">
          <Field label="نام سایت">
            <Input value={form.siteName} onChange={(event) => set('siteName', event.target.value)} />
          </Field>

          <Field label="شناسهٔ Google Analytics">
            <Input value={form.integrations.googleAnalyticsId} dir="ltr" onChange={(event) => setNested('integrations', 'googleAnalyticsId', event.target.value)} placeholder="G-XXXXXXX" />
          </Field>

          <div className="ad-grid2__full">
            <Field label="توضیح سایت">
              <Input value={form.siteDescription} onChange={(event) => set('siteDescription', event.target.value)} />
            </Field>
          </div>

          <Field label="لوگو">
            <span className="ad-inputicon">
              <Input value={form.logo} dir="ltr" onChange={(event) => set('logo', event.target.value)} placeholder="/uploads/…" />
              <button type="button" className="ad-inputicon__toggle" onClick={() => setPickerTarget('logo')}>
                <IconImage width={14} height={14} /> انتخاب
              </button>
            </span>
          </Field>

          <Field label="فاوآیکون">
            <span className="ad-inputicon">
              <Input value={form.favicon} dir="ltr" onChange={(event) => set('favicon', event.target.value)} placeholder="/uploads/…" />
              <button type="button" className="ad-inputicon__toggle" onClick={() => setPickerTarget('favicon')}>
                <IconImage width={14} height={14} /> انتخاب
              </button>
            </span>
          </Field>
        </div>
      </Card>

      <Card title="اطلاعات تماس و شبکه‌های اجتماعی">
        <div className="ad-grid2">
          <Field label="ایمیل">
            <Input type="email" value={form.email} dir="ltr" onChange={(event) => set('email', event.target.value)} />
          </Field>

          <Field label="تلفن">
            <Input value={form.phone} dir="ltr" onChange={(event) => set('phone', event.target.value)} />
          </Field>

          <div className="ad-grid2__full">
            <Field label="نشانی">
              <Input value={form.address} onChange={(event) => set('address', event.target.value)} />
            </Field>
          </div>

          {['instagram', 'telegram', 'linkedin', 'x', 'youtube'].map((network) => (
            <Field key={network} label={network}>
              <Input
                value={form.social[network] ?? ''}
                dir="ltr"
                onChange={(event) => setNested('social', network, event.target.value)}
                placeholder={`https://${network}.com/…`}
              />
            </Field>
          ))}
        </div>
      </Card>

      <Card title="سئوی پیش‌فرض" description="وقتی صفحه‌ای عنوان یا توضیح اختصاصی ندارد، این مقادیر استفاده می‌شوند">
        <div className="ad-grid2">
          <Field label="عنوان پیش‌فرض">
            <Input value={form.seo.defaultTitle} maxLength={70} onChange={(event) => setNested('seo', 'defaultTitle', event.target.value)} />
          </Field>

          <Field label="دامنهٔ کانونیکال">
            <Input value={form.seo.canonicalBase} dir="ltr" onChange={(event) => setNested('seo', 'canonicalBase', event.target.value)} placeholder="https://tapesh.ir" />
          </Field>

          <div className="ad-grid2__full">
            <Field label="توضیح پیش‌فرض">
              <Input value={form.seo.defaultDescription} maxLength={180} onChange={(event) => setNested('seo', 'defaultDescription', event.target.value)} />
            </Field>
          </div>

          <Field label="دستور Robots پیش‌فرض">
            <Select
              value={form.seo.robots}
              onChange={(event) => setNested('seo', 'robots', event.target.value)}
              options={[
                { value: 'index,follow', label: 'index, follow' },
                { value: 'noindex,follow', label: 'noindex, follow' },
                { value: 'index,nofollow', label: 'index, nofollow' },
                { value: 'noindex,nofollow', label: 'noindex, nofollow' },
              ]}
            />
          </Field>

          <Field label="تصویر OG پیش‌فرض">
            <span className="ad-inputicon">
              <Input value={form.seo.ogImage} dir="ltr" onChange={(event) => setNested('seo', 'ogImage', event.target.value)} />
              <button type="button" className="ad-inputicon__toggle" onClick={() => setPickerTarget('ogImage')}>
                <IconImage width={14} height={14} /> انتخاب
              </button>
            </span>
          </Field>
        </div>
      </Card>

      <Card title="رسانه و امنیت" description="محدودیت‌هایی که در سرور اعمال می‌شوند">
        <div className="ad-grid2">
          <Field label="حداکثر حجم فایل" hint="مگابایت">
            <Input
              type="number"
              min="1"
              max="50"
              value={form.media.maxUploadMb}
              onChange={(event) => setNested('media', 'maxUploadMb', Number(event.target.value))}
            />
          </Field>

          <Field label="مدت نشست" hint="ساعت">
            <Input
              type="number"
              min="1"
              max="72"
              value={form.security.sessionHours}
              onChange={(event) => setNested('security', 'sessionHours', Number(event.target.value))}
            />
          </Field>

          <Field label="حداکثر تلاش ورود ناموفق">
            <Input
              type="number"
              min="3"
              max="20"
              value={form.security.maxLoginAttempts}
              onChange={(event) => setNested('security', 'maxLoginAttempts', Number(event.target.value))}
            />
          </Field>

          <Field label="مدت قفل پس از تلاش ناموفق" hint="دقیقه">
            <Input
              type="number"
              min="1"
              max="120"
              value={form.security.lockMinutes}
              onChange={(event) => setNested('security', 'lockMinutes', Number(event.target.value))}
            />
          </Field>
        </div>

        <div className="ad-grid2__full">
          <Field label="نوع فایل‌های مجاز" hint="با کاما جدا کنید">
            <Input
              value={(form.media.allowedMimeTypes ?? []).join(', ')}
              dir="ltr"
              onChange={(event) => setNested('media', 'allowedMimeTypes', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))}
            />
          </Field>
        </div>

        <div className="ad-hardening">
          <strong>سخت‌سازی فعال روی نشست پنل</strong>
          <ul>
            <li>کوکی نشست با پرچم‌های <code className="ad-code">HttpOnly</code>، <code className="ad-code">SameSite=Strict</code> و (در پروداکشن) <code className="ad-code">Secure</code></li>
            <li>هر درخواست تغییردهنده به هدر <code className="ad-code">x-tapesh-csrf</code> نیاز دارد</li>
            <li>رمزها با <code className="ad-code">scrypt</code> و salt تصادفی ذخیره می‌شوند</li>
            <li>هر عملیات مهم در «گزارش رویدادها» ثبت می‌شود</li>
          </ul>
        </div>
      </Card>

      <div className="ad-savebar">
        <span className="ad-muted">
          نشست فعلی: {toFa(form.security.sessionHours)} ساعت · حداکثر {toFa(maxMb)} مگابایت برای هر فایل
        </span>
        <div className="ad-savebar__actions">
          <Button variant="ghost" onClick={reload} disabled={saving}>بازگرداندن</Button>
          <Button onClick={save} loading={saving} disabled={!canUpdate}>ذخیرهٔ تنظیمات</Button>
        </div>
      </div>

      <MediaPicker
        open={Boolean(pickerTarget)}
        onClose={() => setPickerTarget(null)}
        onSelect={(item) => {
          if (pickerTarget === 'logo') set('logo', item.url);
          if (pickerTarget === 'favicon') set('favicon', item.url);
          if (pickerTarget === 'ogImage') setNested('seo', 'ogImage', item.url);
        }}
      />
    </div>
  );
}
