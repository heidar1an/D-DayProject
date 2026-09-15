/*
 * مدیریت بنرها — همان بنرهایی که در صفحهٔ اصلی سایت (Hero) نمایش داده می‌شوند.
 *
 * بنر «فعال» یعنی: isActive روشن است و امروز بین تاریخ شروع و پایان قرار دارد.
 * این منطق در سرور اعمال می‌شود (`publishedBanners`) تا سایت و پنل یکسان ببینند.
 */

import { useState } from 'react';

import { banners as bannersApi } from '../../../services/admin/adminService';
import MediaPicker from '../MediaPicker';
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input, LoadingBlock,
  Modal, TableWrap, Textarea, Toggle, faDate, toFa, useAsync, useToast,
} from '../adminShared';
import { IconEdit, IconImage, IconPlus, IconRefresh, IconTrash } from '../adminIcons';

const EMPTY = {
  title: '', subtitle: '', image: '', buttonText: '', buttonUrl: '',
  isActive: true, sortOrder: 1, startDate: '', endDate: '',
};

function isLive(banner) {
  const today = new Date().toISOString().slice(0, 10);
  if (!banner.isActive) return false;
  if (banner.startDate && banner.startDate > today) return false;
  if (banner.endDate && banner.endDate < today) return false;
  return true;
}

export default function AdminBanners({ admin }) {
  const notify = useToast();
  const [dialog, setDialog] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const can = (permission) => admin.permissions?.includes(permission);
  const { data, loading, error, reload } = useAsync(() => bannersApi.list(), []);
  const items = data?.banners ?? [];

  const setField = (key, value) => setDialog((current) => ({ ...current, form: { ...current.form, [key]: value } }));

  const submit = async () => {
    if (!dialog.form.title.trim()) {
      notify('عنوان بنر را وارد کنید', 'error');
      return;
    }

    setBusy(true);
    try {
      if (dialog.mode === 'create') {
        await bannersApi.create(dialog.form);
        notify('بنر ایجاد شد');
      } else {
        await bannersApi.update(dialog.form.id, dialog.form);
        notify('بنر به‌روزرسانی شد');
      }
      setDialog(null);
      reload();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (banner) => {
    try {
      await bannersApi.update(banner.id, { ...banner, isActive: !banner.isActive });
      notify(banner.isActive ? 'بنر غیرفعال شد' : 'بنر فعال شد');
      reload();
    } catch (actionError) {
      notify(actionError.message, 'error');
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await bannersApi.remove(pendingDelete.id);
      notify('بنر حذف شد');
      setPendingDelete(null);
      reload();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-stack">
      <Card
        title="بنرهای صفحهٔ اصلی"
        description="ترتیب نمایش با «ترتیب» کنترل می‌شود؛ عدد کمتر بالاتر می‌آید."
        actions={(
          <>
            <Button variant="ghost" size="sm" onClick={reload}><IconRefresh width={15} height={15} />تازه‌سازی</Button>
            {can('banners.create') ? (
              <Button onClick={() => setDialog({ mode: 'create', form: { ...EMPTY, sortOrder: items.length + 1 } })}>
                <IconPlus width={16} height={16} />
                بنر جدید
              </Button>
            ) : null}
          </>
        )}
      >
        {error ? <ErrorState error={error} onRetry={reload} /> : null}
        {loading && !data ? <LoadingBlock label="در حال خواندن بنرها…" rows={3} /> : null}

        {data ? (
          <TableWrap
            head={['عنوان', 'دکمه', 'بازهٔ نمایش', 'ترتیب', 'وضعیت', '']}
            empty={items.length === 0 ? <EmptyState title="بنری ثبت نشده است" description="اولین بنر صفحهٔ اصلی را بسازید." /> : null}
          >
            {items.map((banner) => (
              <tr key={banner.id}>
                <td>
                  <strong>{banner.title}</strong>
                  {banner.subtitle ? <small className="ad-sub">{banner.subtitle}</small> : null}
                </td>
                <td>
                  {banner.buttonText ? (
                    <>
                      <span>{banner.buttonText}</span>
                      <small className="ad-sub" dir="ltr">{banner.buttonUrl}</small>
                    </>
                  ) : <span className="ad-muted">—</span>}
                </td>
                <td>
                  <span className="ad-sub">
                    {banner.startDate ? faDate(banner.startDate) : 'بی‌نهایت'}
                    {' → '}
                    {banner.endDate ? faDate(banner.endDate) : 'بی‌نهایت'}
                  </span>
                </td>
                <td>{toFa(banner.sortOrder)}</td>
                <td>{isLive(banner) ? <Badge tone="published">در حال نمایش</Badge> : <Badge tone="draft">غیرفعال</Badge>}</td>
                <td>
                  <div className="ad-rowactions">
                    {can('banners.update') ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(banner)}>
                          {banner.isActive ? 'غیرفعال' : 'فعال'}
                        </Button>
                        <IconButton label="ویرایش" onClick={() => setDialog({ mode: 'edit', form: { ...banner } })}>
                          <IconEdit width={16} height={16} />
                        </IconButton>
                      </>
                    ) : null}
                    {can('banners.delete') ? (
                      <IconButton label="حذف" tone="danger" onClick={() => setPendingDelete(banner)}>
                        <IconTrash width={16} height={16} />
                      </IconButton>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </TableWrap>
        ) : null}
      </Card>

      <Modal
        open={Boolean(dialog)}
        title={dialog?.mode === 'create' ? 'بنر جدید' : 'ویرایش بنر'}
        onClose={() => setDialog(null)}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>انصراف</Button>
            <Button onClick={submit} loading={busy}>ذخیره</Button>
          </>
        )}
      >
        {dialog ? (
          <div className="ad-grid2">
            <Field label="عنوان" required>
              <Input value={dialog.form.title} onChange={(event) => setField('title', event.target.value)} />
            </Field>

            <Field label="ترتیب نمایش">
              <Input
                type="number"
                min="1"
                value={dialog.form.sortOrder}
                onChange={(event) => setField('sortOrder', Number(event.target.value))}
              />
            </Field>

            <div className="ad-grid2__full">
              <Field label="زیرعنوان">
                <Textarea rows={2} value={dialog.form.subtitle} onChange={(event) => setField('subtitle', event.target.value)} />
              </Field>
            </div>

            <div className="ad-grid2__full">
              <Field label="تصویر">
                <span className="ad-inputicon">
                  <Input value={dialog.form.image} dir="ltr" onChange={(event) => setField('image', event.target.value)} placeholder="/uploads/…" />
                  <button type="button" className="ad-inputicon__toggle" onClick={() => setPickerOpen(true)}>
                    <IconImage width={14} height={14} /> انتخاب
                  </button>
                </span>
              </Field>
            </div>

            <Field label="متن دکمه">
              <Input value={dialog.form.buttonText} onChange={(event) => setField('buttonText', event.target.value)} />
            </Field>

            <Field label="نشانی دکمه">
              <Input value={dialog.form.buttonUrl} dir="ltr" onChange={(event) => setField('buttonUrl', event.target.value)} placeholder="#products" />
            </Field>

            <Field label="تاریخ شروع" hint="خالی = بدون محدودیت">
              <Input type="date" value={dialog.form.startDate} onChange={(event) => setField('startDate', event.target.value)} />
            </Field>

            <Field label="تاریخ پایان">
              <Input type="date" value={dialog.form.endDate} onChange={(event) => setField('endDate', event.target.value)} />
            </Field>

            <div className="ad-grid2__full">
              <Toggle checked={dialog.form.isActive} onChange={(value) => setField('isActive', value)} label="فعال باشد" hint="بنرهای غیرفعال در سایت نمایش داده نمی‌شوند." />
            </div>
          </div>
        ) : null}
      </Modal>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(item) => setField('image', item.url)}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف بنر"
        message={`بنر «${pendingDelete?.title ?? ''}» حذف شود؟`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
