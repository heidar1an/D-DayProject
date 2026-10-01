/*
 * بخش «پیشنهادها و گزارش‌ها» — دو سطح، مثل لایهٔ «صفحات»:
 *
 *   ۱) شبکهٔ کارت‌های مربعی هر منبع؛ روی هر کارت تعداد پیام‌های رسیده و تعداد
 *      در انتظار بررسی دیده می‌شود. منبع ناشناخته هم کارت خودش را دارد (با
 *      شناسهٔ خام منبع) — هیچ کادر عمومی «سایر منابع» وجود ندارد.
 *   ۲) با کلیک روی هر کارت، فهرست نامه‌ها و پاسخ‌های همان بخش به شکل **جدول**
 *      استاندارد پنل باز می‌شود؛ از همان جدول می‌توان پاسخ داد، وضعیت را عوض
 *      کرد و گزارش را حذف کرد.
 *
 * منبع انتخاب‌شده در hash نگه داشته می‌شود (`#admin/feedback/<source>`) تا رفرش
 * و دکمهٔ بازگشت مرورگر آن را از دست ندهند.
 */

import { useCallback, useMemo, useState } from 'react';

import { feedback as feedbackApi } from '../../../services/admin/adminService';
import { sourceLabel } from '../../../services/feedback/userFeedback';
import {
  Badge, Button, ConfirmDialog, EmptyState, ErrorState, LoadingBlock, Modal,
  TableWrap, faDateTime, faNumber, relativeTime, useAsync, useToast,
} from '../adminShared';
import {
  IconBookOpen, IconCheck, IconChevron, IconExamSheet, IconEyeOff, IconFeedback,
  IconGlobeExam, IconMessage, IconMicroLesson, IconTestBank, IconTrash,
} from '../adminIcons';

/* هر منبع گزارش: شناسه، آیکون، توضیح و تُن رنگی کارت. ترتیب = ترتیب کارت‌ها. */
const SOURCES = [
  { id: 'support', label: 'فرم راهنما و پشتیبانی', description: 'پیشنهاد، انتقاد و درخواست‌هایی که از صفحهٔ پشتیبانی سایت ارسال می‌شود.', icon: IconMessage, tone: 'learning' },
  { id: 'comprehensive', label: 'درسنامه جامع', description: 'گزارش ایراد یا خطای واحدهای درسنامهٔ جامع (دکمهٔ گزارش داخل هر واحد).', icon: IconBookOpen, tone: 'learning' },
  { id: 'micro', label: 'میکرو درسنامه', description: 'گزارش ایراد صفحه‌های میکرو درسنامه (ابزار «گزارش ایراد» در نوار بالای صفحه).', icon: IconMicroLesson, tone: 'learning' },
  { id: 'test-bank', label: 'بانک تست علوم پایه', description: 'گزارش ایراد سؤالی که کاربر حین تمرین بانک تست ثبت می‌کند.', icon: IconTestBank, tone: 'assessment' },
  { id: 'coordinated-exam', label: 'آزمون‌های هماهنگ', description: 'گزارش ایراد سؤال از مرور کارنامهٔ آزمون‌های هماهنگ.', icon: IconExamSheet, tone: 'assessment' },
  { id: 'question-lab', label: 'آزمون‌های بین‌الملل', description: 'گزارش مشکل سؤال در محیط حل سؤال آزمون‌های بین‌الملل.', icon: IconGlobeExam, tone: 'assessment' },
  { id: 'intl-courses', label: 'دوره‌های بین‌الملل', description: 'گزارش ایراد دوره و ویدیو (دکمهٔ «گزارش» در سرصفحهٔ هر دوره).', icon: IconGlobeExam, tone: 'knowledge' },
];

/* شناسهٔ منابع شناخته‌شده — برای اعتبارسنجی تبِ hash در `AdminLayout` */
export const FEEDBACK_SOURCE_IDS = new Set(SOURCES.map((source) => source.id));

const STATUS_LABELS = { open: 'در انتظار بررسی', resolved: 'بررسی شد' };

/* نام و نام کاربری فرستنده — هر دو، همان‌طور که درخواست شد */
function senderOf(item) {
  const name = item.userName || item.userLabel || (item.userId ? 'کاربر تپش' : 'مهمان');
  const username = item.userUsername ? ` (${item.userUsername})` : '';
  return `${name}${username}`;
}

export default function AdminFeedback({ tab = null, onTabChange }) {
  const notify = useToast();
  const { data, loading, error, reload, setData } = useAsync(() => feedbackApi.list(), []);
  const [busyId, setBusyId] = useState(null);
  const [pendingRemove, setPendingRemove] = useState(null);
  const [replying, setReplying] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const items = data?.items ?? [];

  /* گروه‌بندی روی منابع: منابع ناشناخته با شناسهٔ خام خودشان کارت جدا می‌گیرند */
  const groups = useMemo(() => {
    const known = SOURCES.map((source) => ({ ...source, items: [] }));
    const extras = new Map();

    for (const item of items) {
      const bucket = known.find((source) => source.id === item.source);
      if (bucket) {
        bucket.items.push(item);
        continue;
      }
      const key = item.source || 'unknown';
      if (!extras.has(key)) {
        extras.set(key, {
          id: key,
          label: sourceLabel(key),
          description: 'منبع ثبت‌نشده در فهرست پنل.',
          icon: IconFeedback,
          tone: 'knowledge',
          items: [],
        });
      }
      extras.get(key).items.push(item);
    }

    return [...known, ...extras.values()];
  }, [items]);

  const activeGroup = useMemo(() => groups.find((group) => group.id === tab) ?? null, [groups, tab]);
  const openCount = items.filter((item) => item.status !== 'resolved').length;

  const toggleStatus = useCallback(async (item) => {
    setBusyId(item.id);
    try {
      const status = item.status === 'resolved' ? 'open' : 'resolved';
      await feedbackApi.setStatus(item.id, status);
      setData({ items: items.map((row) => (row.id === item.id ? { ...row, status } : row)) });
    } catch (requestError) {
      notify(requestError?.message || 'عملیات ناموفق بود');
    } finally {
      setBusyId(null);
    }
  }, [items, notify, setData]);

  const sendReply = useCallback(async () => {
    if (!replying || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const result = await feedbackApi.reply(replying.id, replyText.trim());
      setData({
        items: items.map((row) => (
          row.id === replying.id ? { ...row, replies: [...(row.replies ?? []), result?.reply] } : row
        )),
      });
      notify('پاسخ ثبت شد و در اعلان‌های کاربر دیده می‌شود');
      setReplying(null);
      setReplyText('');
    } catch (requestError) {
      notify(requestError?.message || 'ارسال پاسخ ناموفق بود');
    } finally {
      setSendingReply(false);
    }
  }, [items, notify, replying, replyText, setData]);

  const confirmRemove = useCallback(async () => {
    if (!pendingRemove) return;
    setBusyId(pendingRemove.id);
    try {
      await feedbackApi.remove(pendingRemove.id);
      setData({ items: items.filter((row) => row.id !== pendingRemove.id) });
      notify('گزارش حذف شد');
    } catch (requestError) {
      notify(requestError?.message || 'حذف ناموفق بود');
    } finally {
      setPendingRemove(null);
      setBusyId(null);
    }
  }, [items, notify, pendingRemove, setData]);

  /* ── سطح ۲: جدول نامه‌ها و پاسخ‌های یک منبع ── */
  if (activeGroup) {
    const Icon = activeGroup.icon;
    const open = activeGroup.items.filter((item) => item.status !== 'resolved').length;

    return (
      <div className="ad-stack">
        <div className="ad-toolbar">
          <Button variant="ghost" size="sm" onClick={() => onTabChange?.(null)}>
            <IconChevron width={15} height={15} style={{ transform: 'rotate(180deg)' }} />
            همهٔ بخش‌ها
          </Button>
          <span className="ad-fbsource__title">
            <Icon width={18} height={18} />
            {activeGroup.label}
            <Badge tone={activeGroup.items.length ? 'published' : 'neutral'}>
              {faNumber(activeGroup.items.length)} پیام
            </Badge>
            {open ? <Badge tone="draft">{faNumber(open)} در انتظار</Badge> : null}
          </span>
        </div>

        {error ? <ErrorState error={error} onRetry={reload} /> : null}

        <TableWrap
          head={['فرستنده', 'موضوع و متن', 'پاسخ‌ها', 'زمان', 'وضعیت', 'عملیات']}
          empty={activeGroup.items.length === 0 ? (
            <EmptyState
              title="پیامی از این بخش نیست"
              description="با اولین گزارش کاربران از این بخش، اینجا پر می‌شود."
            />
          ) : null}
        >
          {activeGroup.items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{senderOf(item)}</strong>
                {item.userPhone ? <small className="ad-sub" dir="ltr">{item.userPhone}</small> : null}
              </td>
              <td>
                <strong className="ad-subject">{item.subject || 'بدون موضوع'}</strong>
                {item.category ? <Badge tone="neutral">{item.category}</Badge> : null}
                {item.message ? <small className="ad-sub ad-clamp">{item.message}</small> : null}
              </td>
              <td>
                {(item.replies ?? []).length ? (
                  <>
                    <Badge tone="published">{faNumber((item.replies ?? []).length)} پاسخ</Badge>
                    <small className="ad-sub ad-clamp">{(item.replies ?? []).slice(-1)[0].text}</small>
                  </>
                ) : (
                  <span className="ad-sub">بدون پاسخ</span>
                )}
              </td>
              <td>
                <span className="ad-sub">{faDateTime(item.createdAt)}</span>
                <small className="ad-sub">{relativeTime(item.createdAt)}</small>
              </td>
              <td>
                <Badge tone={item.status === 'resolved' ? 'published' : 'draft'}>
                  {STATUS_LABELS[item.status] ?? item.status}
                </Badge>
              </td>
              <td>
                <div className="ad-rowactions">
                  <Button size="sm" onClick={() => { setReplying(item); setReplyText(''); }}>
                    پاسخ
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === item.id}
                    onClick={() => toggleStatus(item)}
                    title={item.status === 'resolved' ? 'بازگشایی گزارش' : 'علامت‌گذاری به‌عنوان بررسی‌شده'}
                  >
                    {item.status === 'resolved' ? <IconEyeOff width={15} height={15} /> : <IconCheck width={15} height={15} />}
                  </Button>
                  <Button variant="danger" size="sm" disabled={busyId === item.id} onClick={() => setPendingRemove(item)}>
                    <IconTrash width={15} height={15} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </TableWrap>

        <Modal
          open={Boolean(replying)}
          title="پاسخ به گزارش"
          subtitle={replying ? `${activeGroup.label} · ${senderOf(replying)}` : ''}
          onClose={() => setReplying(null)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setReplying(null)}>انصراف</Button>
              <Button loading={sendingReply} disabled={!replyText.trim()} onClick={sendReply}>ارسال پاسخ</Button>
            </>
          )}
        >
          {replying ? (
            <div className="ad-stack">
              <p className="ad-subject">{replying.subject || 'بدون موضوع'}</p>
              {replying.message ? <p className="ad-fbitem__msg">{replying.message}</p> : null}

              {(replying.replies ?? []).length ? (
                <div className="ad-fbreplies">
                  {(replying.replies ?? []).map((reply) => (
                    <div key={reply.id} className="ad-fbreply">
                      <span className="ad-fbreply__head">
                        <strong>{reply.adminName}</strong>
                        <span className="ad-sub">{faDateTime(reply.createdAt)}</span>
                        {reply.readAt ? <Badge tone="neutral">خوانده شد</Badge> : <Badge tone="draft">خوانده‌نشده</Badge>}
                      </span>
                      <p>{reply.text}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <textarea
                className="ad-replybox"
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                rows={4}
                placeholder="پاسخ شما در بخش «اعلان‌ها»ی همین کاربر نمایش داده می‌شود."
                aria-label="متن پاسخ"
              />
            </div>
          ) : null}
        </Modal>

        <ConfirmDialog
          open={Boolean(pendingRemove)}
          title="حذف گزارش"
          message={`گزارش «${pendingRemove?.subject || 'بدون موضوع'}» و پاسخ‌هایش برای همیشه حذف می‌شود. مطمئنید؟`}
          confirmLabel="حذف"
          busy={Boolean(pendingRemove) && busyId === pendingRemove?.id}
          onConfirm={confirmRemove}
          onCancel={() => setPendingRemove(null)}
        />
      </div>
    );
  }

  /* ── سطح ۱: کارت‌های مربعی هر بخش ── */
  return (
    <div className="ad-stack">
      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingBlock label="در حال خواندن گزارش‌ها…" rows={4} /> : null}

      {data ? (
        <p className="ad-muted ad-note">
          {faNumber(items.length)} پیام رسیده که {faNumber(openCount)} مورد در انتظار بررسی است؛
          برای دیدن فهرست هر بخش، روی کارتش بزنید.
        </p>
      ) : null}

      {data ? (
        <div className="ad-layergrid">
          {groups.map((group) => {
            const Icon = group.icon;
            const groupOpen = group.items.filter((item) => item.status !== 'resolved').length;

            return (
              <button
                type="button"
                key={group.id}
                className={`ad-layercard ad-layercard--clickable ad-layercard--${group.tone}`}
                onClick={() => onTabChange?.(group.id)}
                aria-label={`${group.label} — ${group.items.length} پیام`}
              >
                <span className="ad-layercard__top">
                  <span className={`ad-layercard__icon ad-layercard__icon--${group.tone}`} aria-hidden="true">
                    <Icon width={20} height={20} />
                  </span>
                  <span className="ad-layercard__name">{group.label}</span>
                </span>

                <span className="ad-layercard__desc">{group.description}</span>

                <span className="ad-layercard__meta">
                  <Badge tone={group.items.length ? 'published' : 'neutral'}>
                    {faNumber(group.items.length)} پیام
                  </Badge>
                  {groupOpen ? <Badge tone="draft">{faNumber(groupOpen)} در انتظار</Badge> : null}
                </span>

                <span className="ad-layercard__foot">
                  <span className="ad-sub">مشاهدهٔ فهرست نامه‌ها</span>
                  <IconChevron width={16} height={16} style={{ transform: 'rotate(180deg)' }} />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
