/*
 * مدیریت صفحات عمومی سایت (درباره ما، تماس، قوانین و …).
 * ساختار همانند مقالات است؛ فقط فیلدهای دامنهٔ مقاله (دسته، برچسب، نویسنده) حذف شده‌اند.
 */

import { useCallback, useState } from 'react';

import { pages as pagesApi } from '../../../services/admin/adminService';
import {
  Button, ConfirmDialog, EmptyState, ErrorState, IconButton, LoadingBlock, Pagination, SearchInput,
  Select, StatusBadge, TableWrap, faDateTime, useAsync, useToast,
} from '../adminShared';
import { IconEdit, IconEye, IconPlus, IconRefresh, IconTrash } from '../adminIcons';

const STATUS_OPTIONS = [
  { value: 'all', label: 'همهٔ وضعیت‌ها' },
  { value: 'published', label: 'منتشرشده' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'archived', label: 'بایگانی' },
];

export default function AdminPages({ navigate, admin }) {
  const notify = useToast();
  const [filters, setFilters] = useState({ search: '', status: 'all', page: 1, perPage: 10 });
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const can = (permission) => admin.permissions?.includes(permission);
  const load = useCallback(() => pagesApi.list(filters), [filters]);
  const { data, loading, error, reload } = useAsync(load, [filters]);

  const patch = (changes) => setFilters((current) => ({ ...current, page: 1, ...changes }));

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await pagesApi.remove(pendingDelete.id);
      notify('صفحه حذف شد');
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
      <div className="ad-toolbar">
        <SearchInput value={filters.search} onChange={(search) => patch({ search })} placeholder="جست‌وجوی عنوان یا نشانی صفحه…" />
        <Select options={STATUS_OPTIONS} value={filters.status} onChange={(event) => patch({ status: event.target.value })} aria-label="وضعیت" />

        <div className="ad-toolbar__end">
          <Button variant="ghost" size="sm" onClick={reload}><IconRefresh width={15} height={15} />تازه‌سازی</Button>
          {can('pages.create') ? (
            <Button onClick={() => navigate('page-editor', { id: 'new' })}>
              <IconPlus width={16} height={16} />
              صفحهٔ جدید
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingBlock label="در حال خواندن صفحات…" rows={4} /> : null}

      {data ? (
        <>
          <TableWrap
            head={['عنوان', 'نشانی', 'وضعیت', 'انتشار', 'آخرین ویرایش', '']}
            empty={data.items.length === 0 ? (
              <EmptyState
                title="صفحه‌ای پیدا نشد"
                action={can('pages.create') ? <Button size="sm" onClick={() => navigate('page-editor', { id: 'new' })}>ایجاد صفحه</Button> : null}
              />
            ) : null}
          >
            {data.items.map((page) => (
              <tr key={page.id}>
                <td>
                  <button type="button" className="ad-linkcell" onClick={() => navigate('page-editor', { id: page.id })}>
                    {page.title}
                  </button>
                </td>
                <td><code className="ad-code" dir="ltr">/{page.slug}</code></td>
                <td><StatusBadge status={page.status} /></td>
                <td><span className="ad-sub">{faDateTime(page.publishedAt)}</span></td>
                <td><span className="ad-sub">{faDateTime(page.updatedAt)}</span></td>
                <td>
                  <div className="ad-rowactions">
                    <IconButton label="ویرایش" onClick={() => navigate('page-editor', { id: page.id })}><IconEdit width={16} height={16} /></IconButton>
                    {page.status === 'published' ? (
                      <a className="ad-iconbtn" href={`${window.location.pathname}#page/${page.slug}`} target="_blank" rel="noreferrer" title="مشاهده در سایت" aria-label="مشاهده در سایت">
                        <IconEye width={16} height={16} />
                      </a>
                    ) : null}
                    {can('pages.delete') ? (
                      <IconButton label="حذف" tone="danger" onClick={() => setPendingDelete(page)}><IconTrash width={16} height={16} /></IconButton>
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

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف صفحه"
        message={`آیا از حذف «${pendingDelete?.title ?? ''}» مطمئن هستید؟`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
