/*
 * مدیریت دسته‌بندی‌ها — CRUD کوچک با گفت‌وگوی مودال.
 * حذف دسته‌ای که روی مقاله‌ای استفاده شده، در سرور رد می‌شود و پیامش اینجا نمایش داده می‌شود.
 */

import { useCallback, useState } from 'react';

import { categories as categoriesApi } from '../../../services/admin/adminService';
import {
  Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input, LoadingBlock,
  Modal, Select, TableWrap, toFa, useAsync, useToast,
} from '../adminShared';
import { IconEdit, IconPlus, IconTrash } from '../adminIcons';

const ACCENTS = [
  { value: 'blue', label: 'آبی' },
  { value: 'lavender', label: 'یاسی' },
  { value: 'purple', label: 'بنفش' },
  { value: 'sky', label: 'آبی روشن' },
  { value: 'green', label: 'سبز' },
  { value: 'mint', label: 'نعنایی' },
  { value: 'copper', label: 'مسی' },
  { value: 'sage', label: 'مریمی' },
  { value: 'gold', label: 'طلایی' },
];

export default function AdminCategories({ admin }) {
  const notify = useToast();
  const [dialog, setDialog] = useState(null); // { mode, form }
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const can = (permission) => admin.permissions?.includes(permission);
  const { data, loading, error, reload } = useAsync(() => categoriesApi.list(), []);
  const items = data?.categories ?? [];

  const openCreate = () => setDialog({ mode: 'create', form: { label: '', slug: '', accent: 'blue' } });
  const openEdit = (category) => setDialog({ mode: 'edit', form: { id: category.id, label: category.label, slug: category.id, accent: category.accent } });

  const submit = async () => {
    if (!dialog.form.label.trim()) {
      notify('نام دسته‌بندی را وارد کنید', 'error');
      return;
    }

    setBusy(true);
    try {
      if (dialog.mode === 'create') {
        await categoriesApi.create({ label: dialog.form.label, slug: dialog.form.slug, accent: dialog.form.accent });
        notify('دسته‌بندی ایجاد شد');
      } else {
        await categoriesApi.update(dialog.form.id, { label: dialog.form.label, accent: dialog.form.accent });
        notify('دسته‌بندی به‌روزرسانی شد');
      }
      setDialog(null);
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
      await categoriesApi.remove(pendingDelete.id);
      notify('دسته‌بندی حذف شد');
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
        title="دسته‌بندی‌های محتوا"
        description="دسته‌بندی‌ها در فهرست مقالات و فیلترهای سایت استفاده می‌شوند."
        actions={can('categories.create') ? <Button onClick={openCreate}><IconPlus width={16} height={16} />دستهٔ جدید</Button> : null}
      >
        {error ? <ErrorState error={error} onRetry={reload} /> : null}
        {loading && !data ? <LoadingBlock label="در حال خواندن دسته‌بندی‌ها…" rows={3} /> : null}

        {data ? (
          <TableWrap
            head={['نام', 'شناسه', 'رنگ', 'تعداد مقاله', '']}
            empty={items.length === 0 ? <EmptyState title="دسته‌بندی‌ای وجود ندارد" /> : null}
          >
            {items.map((category) => (
              <tr key={category.id}>
                <td><strong>{category.label}</strong></td>
                <td><code className="ad-code" dir="ltr">{category.id}</code></td>
                <td><span className={`ad-swatch ad-swatch--${category.accent}`} />{category.accent}</td>
                <td>{toFa(category.count)}</td>
                <td>
                  <div className="ad-rowactions">
                    {can('categories.update') ? (
                      <IconButton label="ویرایش" onClick={() => openEdit(category)}><IconEdit width={16} height={16} /></IconButton>
                    ) : null}
                    {can('categories.delete') ? (
                      <IconButton label="حذف" tone="danger" onClick={() => setPendingDelete(category)}><IconTrash width={16} height={16} /></IconButton>
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
        title={dialog?.mode === 'create' ? 'دستهٔ جدید' : 'ویرایش دسته‌بندی'}
        onClose={() => setDialog(null)}
        size="sm"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>انصراف</Button>
            <Button onClick={submit} loading={busy}>ذخیره</Button>
          </>
        )}
      >
        {dialog ? (
          <>
            <Field label="نام" required>
              <Input
                value={dialog.form.label}
                autoFocus
                onChange={(event) => setDialog((current) => ({
                  ...current,
                  form: {
                    ...current.form,
                    label: event.target.value,
                    slug: current.mode === 'create' ? event.target.value.toLowerCase().replace(/\s+/g, '-') : current.form.slug,
                  },
                }))}
              />
            </Field>

            {dialog.mode === 'create' ? (
              <Field label="شناسه" hint="در کد و آدرس استفاده می‌شود؛ انگلیسی و خط تیره.">
                <Input
                  value={dialog.form.slug}
                  dir="ltr"
                  onChange={(event) => setDialog((current) => ({ ...current, form: { ...current.form, slug: event.target.value } }))}
                />
              </Field>
            ) : null}

            <Field label="رنگ">
              <Select
                value={dialog.form.accent}
                options={ACCENTS}
                onChange={(event) => setDialog((current) => ({ ...current, form: { ...current.form, accent: event.target.value } }))}
              />
            </Field>
          </>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف دسته‌بندی"
        message={`اگر «${pendingDelete?.label ?? ''}» روی مقاله‌ای استفاده شده باشد، حذف انجام نمی‌شود.`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
