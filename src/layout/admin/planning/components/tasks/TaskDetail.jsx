/*
 * نمای جزئیات تسک — کشوی کنار صفحه.
 *
 * چرا کشو و نه پنجره: کاربر باید بتواند هم‌زمان با خواندن جزئیات، فهرست تسک‌ها را
 * ببیند؛ پنجرهٔ وسط‌چین این امکان را می‌گیرد. پیشرفت، کامنت و پیوست از همین‌جا
 * به‌روزرسانی می‌شوند تا برای کارهای کوچک لازم نباشد فرم کامل باز شود.
 */

import { useEffect, useMemo, useState } from 'react';

import { Button, Input, faFileSize, useToast } from '../../../adminShared';
import {
  IconEdit, IconPaperclip, IconPlus, IconSend, IconTrash,
} from '../../../adminIcons';
import {
  PRIORITIES, TASK_STATUSES, labelOf, toneOf,
} from '../../../../../services/planning/planningTypes';
import { planning } from '../../../../../services/planning/planningService';
import {
  faTime, isoDate, jalaliLabel, relativeFa, toFa,
} from '../../../../../services/planning/jalali';
import { Drawer, Meter, Pill } from '../../planningKit';

const TABS = [
  { key: 'detail', label: 'جزئیات' },
  { key: 'files', label: 'پیوست‌ها' },
  { key: 'comments', label: 'کامنت‌ها' },
  { key: 'history', label: 'تاریخچه' },
];

export default function TaskDetail({
  task, projects = [], users = [], onClose, onChanged, onEdit, onAssign,
}) {
  const notify = useToast();
  const [tab, setTab] = useState('detail');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState({ name: '', url: '' });
  /* پیشرفت جداگانه نگه داشته می‌شود تا کشیدن لغزنده در هر پیکسل یک نوشتن نسازد */
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setTab('detail');
    setComment('');
    setFile({ name: '', url: '' });
    setProgress(task?.progress ?? 0);
  }, [task?.id, task?.progress]);

  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const project = projects.find((item) => item.id === task?.projectId) ?? null;

  if (!task) return null;

  const owner = userMap.get(task.ownerId);
  const overdue = task.dueDate < isoDate(new Date()) && !['done', 'canceled'].includes(task.status);

  const patch = async (payload, message) => {
    setBusy(true);
    try {
      const saved = await planning.tasks.update(task.id, payload);
      notify(message);
      onChanged?.(saved);
    } catch (error) {
      notify(error.message ?? 'به‌روزرسانی ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  const addComment = async () => {
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await planning.tasks.addComment(task.id, comment);
      setComment('');
      notify('کامنت ثبت شد');
      const fresh = await planning.tasks.get(task.id);
      onChanged?.(fresh);
    } catch (error) {
      notify(error.message ?? 'ثبت کامنت ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  const addAttachment = async () => {
    if (!file.name.trim()) return;
    setBusy(true);
    try {
      await planning.tasks.addAttachment(task.id, { name: file.name, url: file.url, kind: 'document' });
      setFile({ name: '', url: '' });
      notify('پیوست افزوده شد');
      const fresh = await planning.tasks.get(task.id);
      onChanged?.(fresh);
    } catch (error) {
      notify(error.message ?? 'افزودن پیوست ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeAttachment = async (attachmentId) => {
    await planning.tasks.removeAttachment(task.id, attachmentId);
    notify('پیوست برداشته شد');
    const fresh = await planning.tasks.get(task.id);
    onChanged?.(fresh);
  };

  const history = [...(task.history ?? [])].sort((a, b) => String(b.at).localeCompare(String(a.at)));

  return (
    <Drawer
      open
      width={620}
      title={task.title}
      subtitle={`${task.code} · آخرین ویرایش ${relativeFa(task.updatedAt)}`}
      onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" size="sm" onClick={() => onEdit?.(task)}>
            <IconEdit width={14} height={14} />
            ویرایش
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAssign?.(task)}>
            <IconSend width={14} height={14} />
            ابلاغ
          </Button>
          <span className="pl-spacer" />
          <Button
            size="sm"
            loading={busy}
            onClick={() => patch({ status: task.status === 'done' ? 'in-progress' : 'done' }, task.status === 'done' ? 'تسک بازگشایی شد' : 'تسک تکمیل شد')}
          >
            {task.status === 'done' ? 'بازگشایی تسک' : 'علامت‌زدن به‌عنوان تکمیل‌شده'}
          </Button>
        </>
      )}
    >
      <div className="pl-detail">
        <div className="pl-detail__badges">
          <Pill tone={toneOf(TASK_STATUSES, task.status)}>{labelOf(TASK_STATUSES, task.status)}</Pill>
          <Pill tone={toneOf(PRIORITIES, task.priority)}>{labelOf(PRIORITIES, task.priority)}</Pill>
          {overdue ? <Pill tone="danger" soft={false}>عقب‌افتاده</Pill> : null}
          {(task.tags ?? []).map((tag) => <span key={tag} className="pl-tag">{tag}</span>)}
        </div>

        <nav className="pl-detail__tabs" aria-label="بخش‌های تسک">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`pl-detail__tab ${tab === item.key ? 'is-active' : ''}`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
              {item.key === 'comments' && task.comments?.length ? <span className="pl-badge-count">{toFa(task.comments.length)}</span> : null}
              {item.key === 'files' && task.attachments?.length ? <span className="pl-badge-count">{toFa(task.attachments.length)}</span> : null}
            </button>
          ))}
        </nav>

        {tab === 'detail' ? (
          <>
            {task.description ? <p className="pl-detail__desc">{task.description}</p> : <p className="pl-muted">توضیحی ثبت نشده است.</p>}

            <dl className="pl-deflist">
              <div><dt>پروژه</dt><dd>{project?.title ?? 'بدون پروژه'}</dd></div>
              <div><dt>مسئول اصلی</dt><dd>{owner ? `${owner.name} — ${owner.role}` : '—'}</dd></div>
              <div><dt>دریافت‌کنندگان</dt><dd>{(task.recipientIds ?? []).map((id) => userMap.get(id)?.name ?? '—').join('، ') || '—'}</dd></div>
              <div><dt>تاریخ شروع</dt><dd>{jalaliLabel(task.startDate)}</dd></div>
              <div><dt>تاریخ سررسید</dt><dd className={overdue ? 'is-danger' : ''}>{jalaliLabel(task.dueDate)}</dd></div>
              <div><dt>ساخت</dt><dd>{relativeFa(task.createdAt)}</dd></div>
              <div><dt>آخرین ویرایش</dt><dd>{relativeFa(task.updatedAt)}</dd></div>
              <div><dt>درصد پیشرفت</dt><dd>{toFa(task.progress)}٪</dd></div>
            </dl>

            <div className="pl-detail__progress">
              <Meter value={task.progress} tone={task.status === 'done' ? 'green' : 'accent'} label="پیشرفت" />
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progress}
                disabled={busy}
                onChange={(event) => setProgress(Number(event.target.value))}
                onPointerUp={() => (progress !== task.progress ? patch({ progress }, 'پیشرفت ثبت شد') : undefined)}
                onKeyUp={() => (progress !== task.progress ? patch({ progress }, 'پیشرفت ثبت شد') : undefined)}
                aria-label="درصد پیشرفت"
              />
            </div>

            <div className="pl-detail__quick">
              <label>
                <span>وضعیت</span>
                <select
                  className="pl-select"
                  value={task.status}
                  disabled={busy}
                  onChange={(event) => patch({ status: event.target.value }, 'وضعیت تغییر کرد')}
                >
                  {TASK_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </label>

              <label>
                <span>اولویت</span>
                <select
                  className="pl-select"
                  value={task.priority}
                  disabled={busy}
                  onChange={(event) => patch({ priority: event.target.value }, 'اولویت تغییر کرد')}
                >
                  {PRIORITIES.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
                </select>
              </label>
            </div>
          </>
        ) : null}

        {tab === 'files' ? (
          <>
            {(task.attachments ?? []).length === 0 ? (
              <p className="pl-muted">پیوستی ثبت نشده است.</p>
            ) : (
              <ul className="pl-files">
                {task.attachments.map((item) => (
                  <li key={item.id}>
                    <span className="pl-files__icon"><IconPaperclip width={15} height={15} /></span>
                    <span className="pl-files__name">{item.name}</span>
                    <span className="pl-muted">{faFileSize(item.size)}</span>
                    <span className="pl-muted">{relativeFa(item.uploadedAt)}</span>
                    <button
                      type="button"
                      className="pl-iconbtn pl-iconbtn--sm pl-iconbtn--danger"
                      onClick={() => removeAttachment(item.id)}
                      aria-label="حذف پیوست"
                    >
                      <IconTrash width={13} height={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="pl-inline-add">
              <Input value={file.name} onChange={(event) => setFile((state) => ({ ...state, name: event.target.value }))} placeholder="نام فایل" />
              <Input value={file.url} onChange={(event) => setFile((state) => ({ ...state, url: event.target.value }))} placeholder="نشانی فایل (اختیاری)" dir="ltr" />
              <Button size="sm" onClick={addAttachment} loading={busy} disabled={!file.name.trim()}>
                <IconPlus width={14} height={14} />
                افزودن
              </Button>
            </div>
          </>
        ) : null}

        {tab === 'comments' ? (
          <>
            {(task.comments ?? []).length === 0 ? (
              <p className="pl-muted">کامنتی ثبت نشده است.</p>
            ) : (
              <ul className="pl-comments">
                {task.comments.map((item) => {
                  const author = userMap.get(item.authorId);
                  return (
                    <li key={item.id}>
                      <span className="pl-avatar pl-avatar--sm">{author?.avatar ?? '؟'}</span>
                      <div>
                        <strong>{author?.name ?? 'کاربر'}</strong>
                        <span className="pl-muted">{relativeFa(item.createdAt)}</span>
                        <p>{item.body}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="pl-comment-form">
              <textarea
                className="pl-input pl-input--area"
                rows={3}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="کامنت یا گزارش پیشرفت خود را بنویسید…"
              />
              <Button size="sm" onClick={addComment} loading={busy} disabled={!comment.trim()}>ثبت کامنت</Button>
            </div>
          </>
        ) : null}

        {tab === 'history' ? (
          history.length === 0 ? <p className="pl-muted">تاریخچه‌ای ثبت نشده است.</p> : (
            <ol className="pl-timeline">
              {history.map((row) => {
                const actor = userMap.get(row.actorId);
                return (
                  <li key={row.id}>
                    <span className="pl-timeline__dot" aria-hidden="true" />
                    <div>
                      <strong>{row.action}</strong>
                      <p>{row.detail}</p>
                      <span className="pl-muted">
                        {actor?.name ?? 'کاربر'} · {jalaliLabel(row.at)} {faTime(new Date(row.at).toTimeString().slice(0, 5))}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )
        ) : null}
      </div>
    </Drawer>
  );
}
