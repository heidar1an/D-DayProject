/*
 * کتابخانهٔ رسانه — بارگذاری، جست‌وجو، ویرایش متن جانشین و حذف.
 *
 * اعتبارسنجی واقعی (نوع MIME و حجم) در سرور انجام می‌شود؛ فهرست مجاز از تنظیمات
 * سایت خوانده می‌شود، پس اینجا فقط راهنما نمایش می‌دهیم.
 */

import { useCallback, useRef, useState } from 'react';

import { media as mediaApi, readFileAsBase64 } from '../../../services/admin/adminService';
import {
  Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input, LoadingBlock,
  Modal, Pagination, SearchInput, faFileSize, toFa, useAsync, useToast,
} from '../adminShared';
import { IconEdit, IconImage, IconRefresh, IconTrash, IconUpload } from '../adminIcons';

export default function AdminMedia({ admin, meta }) {
  const notify = useToast();
  const inputRef = useRef(null);
  const [filters, setFilters] = useState({ search: '', type: 'all', page: 1, perPage: 24 });
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const can = (permission) => admin.permissions?.includes(permission);
  const load = useCallback(() => mediaApi.list(filters), [filters]);
  const { data, loading, error, reload } = useAsync(load, [filters]);

  const limits = meta?.settings?.media;
  const maxMb = limits?.maxUploadMb ?? 4;

  const handleFiles = async (files) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;

    setUploading(true);
    let successCount = 0;

    for (const file of list) {
      if (file.size > maxMb * 1024 * 1024) {
        notify(`«${file.name}» بزرگ‌تر از ${toFa(maxMb)} مگابایت است`, 'error');
        continue;
      }

      try {
        const base64 = await readFileAsBase64(file);
        await mediaApi.create({ originalName: file.name, mimeType: file.type, data: base64, altText: '' });
        successCount += 1;
      } catch (uploadError) {
        notify(`${file.name}: ${uploadError.message}`, 'error');
      }
    }

    setUploading(false);
    if (successCount) {
      notify(`${toFa(successCount)} فایل بارگذاری شد`);
      setFilters((current) => ({ ...current, page: 1 }));
      reload();
    }

    if (inputRef.current) inputRef.current.value = '';
  };

  const saveAlt = async () => {
    setBusy(true);
    try {
      await mediaApi.update(editing.id, { altText: editing.altText });
      notify('متن جانشین ذخیره شد');
      setEditing(null);
      reload();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await mediaApi.remove(pendingDelete.id);
      notify('فایل حذف شد');
      setPendingDelete(null);
      reload();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${url}`);
      notify('نشانی فایل کپی شد');
    } catch {
      notify('کپی نشانی ممکن نشد', 'error');
    }
  };

  return (
    <div className="ad-stack">
      <div className="ad-toolbar">
        <SearchInput value={filters.search} onChange={(search) => setFilters((current) => ({ ...current, search, page: 1 }))} placeholder="جست‌وجوی نام فایل…" />

        <div className="ad-toolbar__end">
          <span className="ad-toolbar__hint">حداکثر {toFa(maxMb)} مگابایت</span>
          <Button variant="ghost" size="sm" onClick={reload}><IconRefresh width={15} height={15} />تازه‌سازی</Button>

          {can('media.upload') ? (
            <>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={(limits?.allowedMimeTypes ?? ['image/*']).join(',')}
                className="ad-hiddenfile"
                onChange={(event) => handleFiles(event.target.files)}
              />
              <Button onClick={() => inputRef.current?.click()} loading={uploading}>
                <IconUpload width={16} height={16} />
                {uploading ? 'در حال بارگذاری…' : 'بارگذاری فایل'}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <Card>
        {error ? <ErrorState error={error} onRetry={reload} /> : null}
        {loading && !data ? <LoadingBlock label="در حال خواندن کتابخانه…" rows={3} /> : null}

        {data && data.items.length === 0 ? (
          <EmptyState
            title="کتابخانه خالی است"
            description="تصاویر و فایل‌های مورد استفاده در محتوا را اینجا بارگذاری کنید."
            action={can('media.upload') ? <Button size="sm" onClick={() => inputRef.current?.click()}>بارگذاری اولین فایل</Button> : null}
          />
        ) : null}

        {data && data.items.length > 0 ? (
          <div className="ad-mediagrid ad-mediagrid--manage">
            {data.items.map((item) => (
              <figure className="ad-mediacard" key={item.id}>
                <div className="ad-mediacard__thumb">
                  {String(item.mimeType).startsWith('image/') ? (
                    <img src={item.url} alt={item.altText || item.originalName} loading="lazy" />
                  ) : (
                    <span className="ad-mediatile__file"><IconImage width={24} height={24} />{item.filename.split('.').pop()}</span>
                  )}
                </div>

                <figcaption>
                  <strong title={item.originalName}>{item.originalName}</strong>
                  <small>{faFileSize(item.size)}</small>
                </figcaption>

                <div className="ad-mediacard__actions">
                  <IconButton label="کپی نشانی" onClick={() => copyUrl(item.url)}>
                    <IconImage width={15} height={15} />
                  </IconButton>
                  <IconButton label="ویرایش متن جانشین" onClick={() => setEditing({ id: item.id, altText: item.altText, url: item.url })}>
                    <IconEdit width={15} height={15} />
                  </IconButton>
                  {can('media.delete') ? (
                    <IconButton label="حذف" tone="danger" onClick={() => setPendingDelete(item)}>
                      <IconTrash width={15} height={15} />
                    </IconButton>
                  ) : null}
                </div>
              </figure>
            ))}
          </div>
        ) : null}

        {data && data.total > 0 ? (
          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            perPage={data.perPage}
            onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
          />
        ) : null}
      </Card>

      <Modal
        open={Boolean(editing)}
        title="متن جانشین تصویر"
        subtitle="این متن برای صفحه‌خوان‌ها و موتورهای جست‌وجو خوانده می‌شود."
        onClose={() => setEditing(null)}
        size="sm"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>انصراف</Button>
            <Button onClick={saveAlt} loading={busy}>ذخیره</Button>
          </>
        )}
      >
        {editing ? (
          <>
            {String(editing.url).match(/\.(png|jpe?g|webp|gif|svg)$/i) ? (
              <img className="ad-previewimg" src={editing.url} alt="" />
            ) : null}
            <Field label="متن جانشین">
              <Input
                value={editing.altText}
                autoFocus
                onChange={(event) => setEditing((current) => ({ ...current, altText: event.target.value }))}
              />
            </Field>
          </>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف فایل"
        message={`فایل «${pendingDelete?.originalName ?? ''}» حذف می‌شود. اگر در محتوایی استفاده شده باشد، تصویر آنجا نمایش داده نخواهد شد.`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
