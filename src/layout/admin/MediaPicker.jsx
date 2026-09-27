/*
 * انتخابگر رسانه — گالری مودال برای انتخاب تصویر از کتابخانهٔ رسانه یا آپلود فایل تازه.
 *
 * در سه جا استفاده می‌شود: تصویر شاخص مقاله، تصویر بنر و درج تصویر داخل ویرایشگر متن.
 * آپلود از سمت سرور اعتبارسنجی می‌شود (MIME + حجم)؛ اینجا فقط پیش‌بررسی UX انجام می‌دهیم.
 */

import { useCallback, useEffect, useState } from 'react';

import { media as mediaApi, readFileAsBase64 } from '../../services/admin/adminService';
import {
  Button, EmptyState, ErrorState, LoadingBlock, Modal, Pagination, SearchInput, faFileSize, toFa, useToast,
} from './adminShared';
import { IconCheck, IconImage, IconUpload } from './adminIcons';

/* تطبیق نوع فایل با `accept` — فقط برای پیام روشن پیش از آپلود؛ سرور مرجع است.
   نوع خالی را رد نمی‌کنیم (بعضی فایل‌ها MIME ندارند) و تصمیم را به سرور می‌سپاریم. */
function acceptMatches(accept, mimeType) {
  if (!mimeType) return true;
  return String(accept)
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .some((token) => (token.endsWith('/*') ? mimeType.startsWith(token.slice(0, -1)) : mimeType === token));
}

/*
 * `maxMb` سقف حجم را در همین‌جا هم چک می‌کند (پیش‌فرض ۰ = خاموش) تا فقط مسیری که
 * سقفش را می‌داند پیش‌بررسی بگیرد؛ سرور همچنان مرجع نهایی است.
 */
export default function MediaPicker({ open, onClose, onSelect, accept = 'image/', maxMb = 0 }) {
  const notify = useToast();
  const [state, setState] = useState({ items: [], loading: true, error: null, total: 0, pages: 1, page: 1 });
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async (page = 1, term = search) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await mediaApi.list({ page, perPage: 24, search: term });
      setState({ items: data.items, total: data.total, pages: data.pages, page: data.page, loading: false, error: null });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error }));
    }
  }, [search]);

  useEffect(() => {
    if (!open) return;
    load(1, '');
    setSearch('');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async (file) => {
    if (!file) return;
    if (!acceptMatches(accept, file.type)) {
      notify('این فرمت پشتیبانی نمی‌شود؛ یک فایل تصویری رایج انتخاب کنید', 'error');
      return;
    }
    if (maxMb > 0 && file.size > maxMb * 1024 * 1024) {
      notify(`«${file.name}» بزرگ‌تر از ${toFa(maxMb)} مگابایت است`, 'error');
      return;
    }
    setUploading(true);
    try {
      const data = await readFileAsBase64(file);
      const created = await mediaApi.create({
        originalName: file.name,
        mimeType: file.type,
        data,
        altText: '',
      });
      notify('فایل با موفقیت بارگذاری شد');
      await load(1, search);
      onSelect?.(created.media);
      onClose?.();
    } catch (error) {
      notify(error.message || 'بارگذاری ناموفق بود', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      open={open}
      title="کتابخانهٔ رسانه"
      subtitle="یک تصویر انتخاب کنید یا فایل تازه بارگذاری کنید"
      onClose={onClose}
      size="lg"
      footer={<Button variant="ghost" onClick={onClose}>بستن</Button>}
    >
      <div className="ad-mediapicker">
        <div className="ad-mediapicker__bar">
          <SearchInput value={search} onChange={(value) => { setSearch(value); load(1, value); }} placeholder="جست‌وجوی نام فایل…" />
          <label className="ad-upload">
            <input
              type="file"
              accept={accept}
              /* مقدار فیلد پاک می‌شود تا انتخاب دوبارهٔ همان فایل (مثلاً بعد از رد شدن
                 به‌خاطر حجم) هم رویداد change بدهد */
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                handleUpload(file);
              }}
              disabled={uploading}
            />
            <span className="ad-btn ad-btn--primary ad-btn--md">
              {uploading ? <span className="ad-spinner ad-spinner--sm" aria-hidden="true" /> : <IconUpload width={16} height={16} />}
              {uploading ? 'در حال بارگذاری…' : 'بارگذاری فایل'}
            </span>
          </label>
        </div>

        {state.loading ? <LoadingBlock label="در حال خواندن کتابخانه…" rows={3} /> : null}
        {state.error ? <ErrorState error={state.error} onRetry={() => load(state.page)} /> : null}

        {!state.loading && !state.error && state.items.length === 0 ? (
          <EmptyState
            title="کتابخانه خالی است"
            description="اولین تصویر را بارگذاری کنید تا در محتوا قابل استفاده شود."
          />
        ) : null}

        {!state.loading && state.items.length > 0 ? (
          <div className="ad-mediagrid">
            {state.items.map((item) => (
              <button
                type="button"
                key={item.id}
                className="ad-mediatile"
                onClick={() => { onSelect?.(item); onClose?.(); }}
                title={item.originalName}
              >
                {String(item.mimeType).startsWith('image/') ? (
                  <img src={item.url} alt={item.altText || item.originalName} loading="lazy" />
                ) : (
                  <span className="ad-mediatile__file"><IconImage width={22} height={22} />{item.filename.split('.').pop()}</span>
                )}
                <span className="ad-mediatile__meta">
                  <span className="ad-mediatile__name">{item.originalName}</span>
                  <span className="ad-mediatile__size">{faFileSize(item.size)}</span>
                </span>
                <span className="ad-mediatile__check"><IconCheck /></span>
              </button>
            ))}
          </div>
        ) : null}

        {state.total > 24 ? (
          <Pagination
            page={state.page}
            pages={state.pages}
            total={state.total}
            perPage={24}
            onPageChange={(page) => load(page)}
          />
        ) : state.total ? (
          <p className="ad-mediapicker__count">{toFa(state.total)} فایل در کتابخانه</p>
        ) : null}
      </div>
    </Modal>
  );
}
