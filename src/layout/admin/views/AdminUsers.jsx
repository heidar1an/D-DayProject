/*
 * مدیریت کاربران پنل و نقش‌ها.
 *
 * قواعدی که در سرور اعمال می‌شود و اینجا فقط نمایش داده می‌شود:
 *   - آخرین «مدیر کل» فعال را نمی‌توان حذف، غیرفعال یا تنزل داد.
 *   - کاربر نمی‌تواند حساب خودش را حذف کند.
 *   - رمز عبور فقط با الگوریتم امن ذخیره می‌شود و هرگز به کلاینت برنمی‌گردد.
 */

import { useCallback, useState } from 'react';

import { users as usersApi } from '../../../services/admin/adminService';
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input, LoadingBlock,
  Modal, Pagination, SearchInput, Select, TableWrap, Toggle, faDateTime, relativeTime, toFa, useAsync, useToast,
} from '../adminShared';
import { IconEdit, IconPlus, IconRefresh, IconShield, IconTrash } from '../adminIcons';

const EMPTY = { username: '', name: '', email: '', password: '', role: 'editor', isActive: true };

export default function AdminUsers({ admin, roles }) {
  const notify = useToast();
  const [filters, setFilters] = useState({ search: '', role: 'all', page: 1, perPage: 10 });
  const [dialog, setDialog] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const can = (permission) => admin.permissions?.includes(permission);
  const load = useCallback(() => usersApi.list(filters), [filters]);
  const { data, loading, error, reload } = useAsync(load, [filters]);

  const roleOptions = [
    { value: 'all', label: 'همهٔ نقش‌ها' },
    ...roles.map((role) => ({ value: role.id, label: role.label })),
  ];

  const roleLabel = (id) => roles.find((role) => role.id === id)?.label ?? id;

  const submit = async () => {
    const form = dialog.form;

    if (dialog.mode === 'create') {
      if (!form.username.trim()) return notify('نام کاربری را وارد کنید', 'error');
      if (form.password.length < 4) return notify('رمز عبور حداقل ۴ کاراکتر باشد', 'error');
    }

    setBusy(true);
    try {
      if (dialog.mode === 'create') {
        await usersApi.create({
          username: form.username,
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          isActive: form.isActive,
        });
        notify('کاربر ایجاد شد');
      } else {
        await usersApi.update(form.id, {
          name: form.name,
          email: form.email,
          role: form.role,
          isActive: form.isActive,
          ...(form.password ? { password: form.password } : {}),
        });
        notify('کاربر به‌روزرسانی شد');
      }
      setDialog(null);
      reload();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }

    return undefined;
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await usersApi.remove(pendingDelete.id);
      notify('کاربر حذف شد');
      setPendingDelete(null);
      reload();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const setField = (key, value) => setDialog((current) => ({ ...current, form: { ...current.form, [key]: value } }));

  return (
    <div className="ad-stack">
      <div className="ad-rolegrid">
        {roles.map((role) => (
          <Card key={role.id} className="ad-rolecard">
            <span className="ad-rolecard__icon"><IconShield width={18} height={18} /></span>
            <strong>{role.label}</strong>
            <p>{role.description}</p>
            <code className="ad-code" dir="ltr">{role.id}</code>
          </Card>
        ))}
      </div>

      <div className="ad-toolbar">
        <SearchInput value={filters.search} onChange={(search) => setFilters((current) => ({ ...current, search, page: 1 }))} placeholder="جست‌وجوی نام کاربری، نام یا ایمیل…" />
        <Select options={roleOptions} value={filters.role} onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value, page: 1 }))} aria-label="نقش" />

        <div className="ad-toolbar__end">
          <Button variant="ghost" size="sm" onClick={reload}><IconRefresh width={15} height={15} />تازه‌سازی</Button>
          {can('users.create') ? (
            <Button onClick={() => setDialog({ mode: 'create', form: { ...EMPTY } })}>
              <IconPlus width={16} height={16} />
              کاربر جدید
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingBlock label="در حال خواندن کاربران…" rows={4} /> : null}

      {data ? (
        <>
          <TableWrap
            head={['کاربر', 'نقش', 'وضعیت', 'آخرین ورود', 'ایجاد', '']}
            empty={data.items.length === 0 ? <EmptyState title="کاربری پیدا نشد" /> : null}
          >
            {data.items.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.name || user.username}</strong>
                  <small className="ad-sub" dir="ltr">{user.username}{user.email ? ` · ${user.email}` : ''}</small>
                </td>
                <td><Badge tone={user.role === 'super-admin' ? 'published' : 'neutral'}>{roleLabel(user.role)}</Badge></td>
                <td>{user.isActive ? <Badge tone="published">فعال</Badge> : <Badge tone="draft">غیرفعال</Badge>}</td>
                <td><span className="ad-sub">{user.lastLoginAt ? relativeTime(user.lastLoginAt) : 'هرگز'}</span></td>
                <td><span className="ad-sub">{faDateTime(user.createdAt)}</span></td>
                <td>
                  <div className="ad-rowactions">
                    {can('users.update') ? (
                      <IconButton
                        label="ویرایش"
                        onClick={() => setDialog({ mode: 'edit', form: { ...user, password: '' } })}
                      >
                        <IconEdit width={16} height={16} />
                      </IconButton>
                    ) : null}
                    {can('users.delete') ? (
                      <IconButton
                        label="حذف"
                        tone="danger"
                        disabled={user.id === admin.id}
                        onClick={() => setPendingDelete(user)}
                      >
                        <IconTrash width={16} height={16} />
                      </IconButton>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </TableWrap>

          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            perPage={data.perPage}
            onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
            onPerPageChange={(perPage) => setFilters((current) => ({ ...current, perPage, page: 1 }))}
          />
        </>
      ) : null}

      <Modal
        open={Boolean(dialog)}
        title={dialog?.mode === 'create' ? 'کاربر جدید پنل' : `ویرایش ${dialog?.form?.username ?? ''}`}
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
            {dialog.mode === 'create' ? (
              <Field label="نام کاربری" required hint="فقط برای ورود به پنل">
                <Input value={dialog.form.username} dir="ltr" onChange={(event) => setField('username', event.target.value)} />
              </Field>
            ) : null}

            <Field label="نام نمایشی">
              <Input value={dialog.form.name} onChange={(event) => setField('name', event.target.value)} />
            </Field>

            <Field label="ایمیل">
              <Input type="email" value={dialog.form.email} dir="ltr" onChange={(event) => setField('email', event.target.value)} />
            </Field>

            <Field label="نقش" required>
              <Select
                value={dialog.form.role}
                options={roles.map((role) => ({ value: role.id, label: role.label }))}
                onChange={(event) => setField('role', event.target.value)}
              />
            </Field>

            <div className="ad-grid2__full">
              <Field
                label={dialog.mode === 'create' ? 'رمز عبور' : 'رمز عبور جدید'}
                required={dialog.mode === 'create'}
                hint={dialog.mode === 'edit' ? 'خالی بگذارید تا رمز فعلی تغییر نکند.' : 'حداقل ۴ کاراکتر'}
              >
                <Input
                  type="password"
                  value={dialog.form.password}
                  dir="ltr"
                  autoComplete="new-password"
                  onChange={(event) => setField('password', event.target.value)}
                />
              </Field>
            </div>

            <div className="ad-grid2__full">
              <Toggle
                checked={dialog.form.isActive}
                onChange={(value) => setField('isActive', value)}
                label="حساب فعال باشد"
                hint="حساب غیرفعال اجازهٔ ورود ندارد."
              />
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف کاربر"
        message={`کاربر «${pendingDelete?.username ?? ''}» حذف شود؟ این عملیات قابل بازگشت نیست.`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <p className="ad-muted ad-note">
        تعداد دسترسی‌های نقش مدیر کل: {toFa(admin.permissions?.length ?? 0)} مورد
      </p>
    </div>
  );
}
