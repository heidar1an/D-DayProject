/*
 * مدیریت مقالات — فهرست با جست‌وجو، فیلتر، مرتب‌سازی و صفحه‌بندی سمت سرور.
 *
 * هیچ‌کدام از این‌ها در کلاینت انجام نمی‌شود؛ همه به‌صورت query param به API می‌رود
 * تا با بزرگ‌شدن حجم محتوا رفتار لیست تغییر نکند.
 */

import { useCallback, useState } from 'react';

import { articles as articlesApi } from '../../../services/admin/adminService';
import {
  Button, ConfirmDialog, EmptyState, ErrorState, IconButton, LoadingBlock, Pagination, SearchInput,
  Select, StatusBadge, TableWrap, faDateTime, faNumber, useAsync, useToast,
} from '../adminShared';
import { IconEdit, IconEye, IconEyeOff, IconPlus, IconRefresh, IconTrash } from '../adminIcons';

const STATUS_OPTIONS = [
  { value: 'all', label: 'همهٔ وضعیت‌ها' },
  { value: 'published', label: 'منتشرشده' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'archived', label: 'بایگانی' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'جدیدترین ویرایش' },
  { value: 'oldest', label: 'قدیمی‌ترین ویرایش' },
  { value: 'title', label: 'ترتیب عنوان' },
  { value: 'views', label: 'بیشترین بازدید' },
];

export default function AdminArticles({ navigate, categories, admin }) {
  const notify = useToast();
  const [filters, setFilters] = useState({ search: '', status: 'all', category: 'all', sort: 'newest', page: 1, perPage: 10 });
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const can = (permission) => admin.permissions?.includes(permission);

  const load = useCallback(() => articlesApi.list(filters), [filters]);
  const { data, loading, error, reload } = useAsync(load, [filters]);

  const patch = (changes) => setFilters((current) => ({ ...current, page: 1, ...changes }));

  const toggleStatus = async (article) => {
    const next = article.status === 'published' ? 'draft' : 'published';
    setBusyId(article.id);
    try {
      await articlesApi.setStatus(article.id, next);
      notify(next === 'published' ? 'مقاله منتشر شد' : 'انتشار مقاله لغو شد');
      reload();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    try {
      await articlesApi.remove(pendingDelete.id);
      notify('مقاله حذف شد');
      setPendingDelete(null);
      reload();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const categoryOptions = [
    { value: 'all', label: 'همهٔ دسته‌ها' },
    ...categories.map((category) => ({ value: category.id, label: `${category.label} (${category.count})` })),
  ];

  const categoryLabel = (id) => categories.find((category) => category.id === id)?.label ?? id;

  return (
    <div className="ad-stack">
      <div className="ad-toolbar">
        <SearchInput value={filters.search} onChange={(search) => patch({ search })} placeholder="جست‌وجو در عنوان، خلاصه و نویسنده…" />

        <Select options={STATUS_OPTIONS} value={filters.status} onChange={(event) => patch({ status: event.target.value })} aria-label="وضعیت" />
        <Select options={categoryOptions} value={filters.category} onChange={(event) => patch({ category: event.target.value })} aria-label="دسته‌بندی" />
        <Select options={SORT_OPTIONS} value={filters.sort} onChange={(event) => patch({ sort: event.target.value })} aria-label="مرتب‌سازی" />

        <div className="ad-toolbar__end">
          <Button variant="ghost" size="sm" onClick={reload} aria-label="تازه‌سازی"><IconRefresh width={15} height={15} />تازه‌سازی</Button>
          {can('articles.create') ? (
            <Button onClick={() => navigate('article-editor', { id: 'new' })}>
              <IconPlus width={16} height={16} />
              مقالهٔ جدید
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingBlock label="در حال خواندن مقالات…" /> : null}

      {data ? (
        <>
          <TableWrap
            head={['عنوان', 'دسته', 'نویسنده', 'وضعیت', 'بازدید', 'آخرین ویرایش', '']}
            empty={data.items.length === 0 ? (
              <EmptyState
                title="مقاله‌ای پیدا نشد"
                description={filters.search ? 'عبارت جست‌وجو را تغییر دهید.' : 'اولین مقاله را ایجاد کنید.'}
                action={can('articles.create') ? <Button size="sm" onClick={() => navigate('article-editor', { id: 'new' })}>ایجاد مقاله</Button> : null}
              />
            ) : null}
          >
            {data.items.map((article) => (
              <tr key={article.id}>
                <td>
                  <button type="button" className="ad-linkcell" onClick={() => navigate('article-editor', { id: article.id })}>
                    {article.title}
                  </button>
                  <small className="ad-sub" dir="ltr">{article.slug}</small>
                </td>
                <td>{categoryLabel(article.category)}</td>
                <td>{article.authorName}</td>
                <td><StatusBadge status={article.status} /></td>
                <td>{faNumber(article.views)}</td>
                <td><span className="ad-sub">{faDateTime(article.updatedAt)}</span></td>
                <td>
                  <div className="ad-rowactions">
                    <IconButton label="ویرایش" onClick={() => navigate('article-editor', { id: article.id })}>
                      <IconEdit width={16} height={16} />
                    </IconButton>

                    {article.status === 'published' ? (
                      <a
                        className="ad-iconbtn"
                        title="پیش‌نمایش در سایت"
                        aria-label="پیش‌نمایش در سایت"
                        href={`${window.location.pathname}#articles/${article.slug}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <IconEye width={16} height={16} />
                      </a>
                    ) : null}

                    {can('articles.publish') ? (
                      <IconButton
                        label={article.status === 'published' ? 'لغو انتشار' : 'انتشار'}
                        tone={article.status === 'published' ? 'warn' : 'ok'}
                        disabled={busyId === article.id}
                        onClick={() => toggleStatus(article)}
                      >
                        {article.status === 'published' ? <IconEyeOff width={16} height={16} /> : <IconEye width={16} height={16} />}
                      </IconButton>
                    ) : null}

                    {can('articles.delete') ? (
                      <IconButton label="حذف" tone="danger" onClick={() => setPendingDelete(article)}>
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

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف مقاله"
        message={`آیا از حذف «${pendingDelete?.title ?? ''}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.`}
        confirmLabel="حذف کن"
        busy={Boolean(busyId)}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
