/*
 * گزارش رویدادهای مدیریتی (Audit Log).
 *
 * هر ورود، ایجاد، ویرایش، انتشار، حذف و تغییر تنظیمات اینجا ثبت می‌شود. اطلاعات
 * حساس (رمز، توکن نشست، بدنهٔ کامل درخواست) هرگز در گزارش ذخیره نمی‌شود.
 */

import { useCallback, useState } from 'react';

import { logs as logsApi } from '../../../services/admin/adminService';
import {
  Badge, Button, EmptyState, ErrorState, LoadingBlock, Pagination, SearchInput, Select,
  TableWrap, faDateTime, relativeTime, toFa, useAsync,
} from '../adminShared';
import { IconRefresh } from '../adminIcons';

/* برچسب فارسی برای کلیدهای رویداد؛ اگر رویداد تازه‌ای اضافه شود، خود کلید نمایش داده می‌شود */
const ACTION_LABELS = {
  'auth.login': 'ورود به پنل',
  'auth.logout': 'خروج از پنل',
  'auth.password-changed': 'تغییر رمز عبور',
  'article.created': 'ایجاد مقاله',
  'article.updated': 'ویرایش مقاله',
  'article.published': 'انتشار مقاله',
  'article.unpublished': 'لغو انتشار مقاله',
  'article.deleted': 'حذف مقاله',
  'category.created': 'ایجاد دسته‌بندی',
  'category.updated': 'ویرایش دسته‌بندی',
  'category.deleted': 'حذف دسته‌بندی',
  'page.created': 'ایجاد صفحه',
  'page.updated': 'ویرایش صفحه',
  'page.deleted': 'حذف صفحه',
  'media.uploaded': 'بارگذاری فایل',
  'media.deleted': 'حذف فایل',
  'banner.created': 'ایجاد بنر',
  'banner.updated': 'ویرایش بنر',
  'banner.deleted': 'حذف بنر',
  'admin.created': 'ایجاد کاربر',
  'admin.updated': 'ویرایش کاربر',
  'admin.deleted': 'حذف کاربر',
  'settings.updated': 'تغییر تنظیمات',
};

const ACTION_OPTIONS = [
  { value: 'all', label: 'همهٔ رویدادها' },
  ...Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label })),
];

const TONE_BY_ACTION = {
  deleted: 'danger',
  unpublished: 'draft',
  login: 'published',
  logout: 'neutral',
  created: 'published',
  published: 'published',
};

function toneFor(action) {
  const suffix = String(action).split('.').pop();
  return TONE_BY_ACTION[suffix] ?? 'neutral';
}

export default function AdminLogs() {
  const [filters, setFilters] = useState({ search: '', action: 'all', page: 1, perPage: 15 });

  const load = useCallback(() => logsApi.list(filters), [filters]);
  const { data, loading, error, reload } = useAsync(load, [filters]);

  const patch = (changes) => setFilters((current) => ({ ...current, page: 1, ...changes }));

  return (
    <div className="ad-stack">
      <div className="ad-toolbar">
        <SearchInput value={filters.search} onChange={(search) => patch({ search })} placeholder="جست‌وجوی کاربر یا محتوا…" />
        <Select options={ACTION_OPTIONS} value={filters.action} onChange={(event) => patch({ action: event.target.value })} aria-label="نوع رویداد" />

        <div className="ad-toolbar__end">
          <Button variant="ghost" size="sm" onClick={reload}><IconRefresh width={15} height={15} />تازه‌سازی</Button>
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingBlock label="در حال خواندن گزارش…" rows={5} /> : null}

      {data ? (
        <>
          <TableWrap
            head={['کاربر', 'رویداد', 'موضوع', 'زمان', 'IP']}
            empty={data.items.length === 0 ? (
              <EmptyState title="رویدادی ثبت نشده" description="با اولین تغییر محتوا، گزارش اینجا پر می‌شود." />
            ) : null}
          >
            {data.items.map((entry) => (
              <tr key={entry.id}>
                <td><strong>{entry.userName}</strong></td>
                <td>
                  <Badge tone={toneFor(entry.action)}>{ACTION_LABELS[entry.action] ?? entry.action}</Badge>
                  <small className="ad-sub" dir="ltr">{entry.action}</small>
                </td>
                <td>
                  <span>{entry.entityLabel || '—'}</span>
                  <small className="ad-sub" dir="ltr">{entry.entityType}{entry.entityId ? ` · ${entry.entityId}` : ''}</small>
                </td>
                <td>
                  <span className="ad-sub">{faDateTime(entry.createdAt)}</span>
                  <small className="ad-sub">{relativeTime(entry.createdAt)}</small>
                </td>
                <td><code className="ad-code" dir="ltr">{entry.ip || '—'}</code></td>
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

          <p className="ad-muted ad-note">{toFa(data.total)} رویداد ثبت‌شده است.</p>
        </>
      ) : null}
    </div>
  );
}
