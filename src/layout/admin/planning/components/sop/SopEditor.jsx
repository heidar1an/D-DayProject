/*
 * ویرایشگر SOP.
 *
 * برای متن اصلی از همان `RichTextEditor` پنل استفاده می‌شود (تیتر، فهرست، جدول،
 * چک‌لیست، لینک و فایل) تا کاربر یک ویرایشگر در کل پنل داشته باشد؛ چرخهٔ
 * پیش‌نویس خودکار، پیش‌نمایش و گردش تأیید دور آن ساخته شده است.
 *
 * ذخیرهٔ خودکار پیش‌نویس با تأخیر ۱٫۲ ثانیه انجام می‌شود تا هر کلید یک نوشتن
 * در حافظه نسازد؛ وضعیت ذخیره در نوار بالای ویرایشگر نمایش داده می‌شود.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import RichTextEditor from '../../../RichTextEditor';
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '../../../adminShared';
import {
  IconCheck, IconClose, IconEye, IconHistory, IconPlus, IconSend, IconTrash,
} from '../../../adminIcons';
import { sanitizeHtml } from '../../../../../services/admin/sanitizeHtml';
import { planning } from '../../../../../services/planning/planningService';
import { SOP_STATUSES, labelOf, toneOf } from '../../../../../services/planning/planningTypes';
import { jalaliLabel, relativeFa, toFa } from '../../../../../services/planning/jalali';
import { Pill, Tip } from '../../planningKit';
import JalaliDatePicker from '../calendar/JalaliDatePicker';

const AUTOSAVE_MS = 1200;

const SECTIONS = [
  { key: 'body', label: 'مراحل اجرا' },
  { key: 'checklist', label: 'چک‌لیست اجرایی' },
  { key: 'kpis', label: 'شاخص‌های ارزیابی' },
  { key: 'meta', label: 'شناسنامه و مسئولیت‌ها' },
  { key: 'versions', label: 'نسخه‌ها' },
  { key: 'comments', label: 'کامنت و پیشنهاد' },
];

export default function SopEditor({ sop, units = [], users = [], onBack, onChanged }) {
  const notify = useToast();

  const [draft, setDraft] = useState(sop);
  const [tab, setTab] = useState('body');
  const [preview, setPreview] = useState(false);
  const [saveState, setSaveState] = useState('saved');
  const [busy, setBusy] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [comment, setComment] = useState('');
  const [newItem, setNewItem] = useState('');
  const [kpi, setKpi] = useState({ title: '', target: '', measure: '' });
  const timerRef = useRef(0);

  useEffect(() => {
    setDraft(sop);
    setSaveState('saved');
    setTab('body');
    setPreview(false);
  }, [sop?.id]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(sop), [draft, sop]);

  /* ذخیرهٔ خودکار پیش‌نویس — فقط روی متن اصلی */
  const queueAutosave = useCallback((body) => {
    window.clearTimeout(timerRef.current);
    setSaveState('pending');
    timerRef.current = window.setTimeout(async () => {
      try {
        await planning.sop.saveDraft(sop.id, { body });
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, AUTOSAVE_MS);
  }, [sop?.id]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const saveAll = async () => {
    setBusy(true);
    try {
      const saved = await planning.sop.update(sop.id, {
        title: draft.title,
        code: draft.code,
        unitId: draft.unitId,
        authorId: draft.authorId,
        reviewerId: draft.reviewerId,
        version: draft.version,
        nextReviewAt: draft.nextReviewAt,
        purpose: draft.purpose,
        scope: draft.scope,
        responsibilities: draft.responsibilities,
        prerequisites: draft.prerequisites,
        body: draft.body,
        checklist: draft.checklist,
        kpis: draft.kpis,
        pitfalls: draft.pitfalls,
      }, { changeNote: 'ویرایش در ویرایشگر' });
      notify('SOP ذخیره شد');
      setDraft(saved);
      onChanged?.(saved);
    } catch (error) {
      notify(error.message ?? 'ذخیره ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  const workflow = async (action, message) => {
    setBusy(true);
    try {
      await saveAll();
      const next = await action(sop.id);
      notify(message);
      setDraft(next);
      onChanged?.(next);
    } catch (error) {
      notify(error.message ?? 'عملیات ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  const addChecklistItem = () => {
    if (!newItem.trim()) return;
    set({ checklist: [...(draft.checklist ?? []), { id: `ck-${Date.now()}`, text: newItem.trim(), done: false }] });
    setNewItem('');
  };

  const toggleChecklistItem = (id) => {
    set({ checklist: (draft.checklist ?? []).map((item) => (item.id === id ? { ...item, done: !item.done } : item)) });
  };

  const removeChecklistItem = (id) => {
    set({ checklist: (draft.checklist ?? []).filter((item) => item.id !== id) });
  };

  const addKpi = () => {
    if (!kpi.title.trim()) return;
    set({ kpis: [...(draft.kpis ?? []), { id: `k-${Date.now()}`, ...kpi, title: kpi.title.trim() }] });
    setKpi({ title: '', target: '', measure: '' });
  };

  const addComment = async () => {
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await planning.sop.addComment(sop.id, comment);
      setComment('');
      const fresh = await planning.sop.get(sop.id);
      setDraft(fresh);
      onChanged?.(fresh);
      notify('پیشنهاد ثبت شد');
    } catch (error) {
      notify(error.message ?? 'ثبت پیشنهاد ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      const next = await planning.sop.restore(sop.id, restoreTarget.id);
      notify(`به نسخهٔ ${restoreTarget.version} بازگشتیم`);
      setDraft(next);
      onChanged?.(next);
      setRestoreTarget(null);
    } catch (error) {
      notify(error.message ?? 'بازگردانی ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doneCount = (draft.checklist ?? []).filter((item) => item.done).length;

  return (
    <div className="pl-sop">
      <header className="pl-sop__bar">
        <button type="button" className="pl-linkbtn" onClick={onBack}>‹ بازگشت به فهرست</button>

        <div className="pl-sop__title">
          <code className="pl-mono">{draft.code}</code>
          <strong>{draft.title}</strong>
          <Pill tone={toneOf(SOP_STATUSES, draft.status)} soft={false}>{labelOf(SOP_STATUSES, draft.status)}</Pill>
          <Pill tone="neutral">نسخهٔ {draft.version}</Pill>
        </div>

        <span className="pl-spacer" />

        <span className={`pl-savestate pl-savestate--${saveState}`}>
          {saveState === 'pending' ? 'در حال ذخیرهٔ پیش‌نویس…' : saveState === 'error' ? 'ذخیرهٔ خودکار ناموفق' : 'پیش‌نویس ذخیره شد'}
        </span>

        <Tip text={preview ? 'بازگشت به ویرایش' : 'پیش‌نمایش'}>
          <button type="button" className={`pl-iconbtn ${preview ? 'is-active' : ''}`} onClick={() => setPreview((state) => !state)} aria-label="پیش‌نمایش">
            {preview ? <IconClose width={15} height={15} /> : <IconEye width={15} height={15} />}
          </button>
        </Tip>

        <Button variant="ghost" size="sm" onClick={saveAll} loading={busy} disabled={!dirty}>ذخیره</Button>

        {draft.status === 'draft' || draft.status === 'obsolete' ? (
          <Button size="sm" onClick={() => workflow((id) => planning.sop.submit(id), 'SOP برای تأیید ارسال شد')} loading={busy}>
            <IconSend width={14} height={14} />
            ارسال برای تأیید
          </Button>
        ) : null}

        {draft.status === 'review' ? (
          <>
            <Button size="sm" onClick={() => workflow((id) => planning.sop.approve(id, 'تأیید نهایی'), 'SOP تأیید شد')} loading={busy}>
              <IconCheck width={14} height={14} />
              تأیید
            </Button>
            <Button variant="ghost" size="sm" onClick={() => workflow((id) => planning.sop.requestFix(id, 'نیاز به اصلاح دارد'), 'درخواست اصلاح ثبت شد')} loading={busy}>
              درخواست اصلاح
            </Button>
          </>
        ) : null}
      </header>

      <nav className="pl-sop__tabs" aria-label="بخش‌های SOP">
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`pl-sop__tab ${tab === item.key ? 'is-active' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
            {item.key === 'checklist' && (draft.checklist ?? []).length ? (
              <span className="pl-badge-count">{toFa(doneCount)}/{toFa(draft.checklist.length)}</span>
            ) : null}
            {item.key === 'versions' && (draft.versions ?? []).length ? (
              <span className="pl-badge-count">{toFa(draft.versions.length)}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="pl-sop__body">
        {tab === 'body' ? (
          preview ? (
            <article className="pl-sop__preview" dangerouslySetInnerHTML={{ __html: sanitizeHtml(draft.body ?? '') }} />
          ) : (
            <RichTextEditor
              value={draft.body ?? ''}
              onChange={(html) => { set({ body: html }); queueAutosave(html); }}
              placeholder="مراحل اجرای فرایند را بنویسید…"
            />
          )
        ) : null}

        {tab === 'checklist' ? (
          <div className="pl-checklistbox">
            <div className="pl-inline-add">
              <Input
                value={newItem}
                onChange={(event) => setNewItem(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') addChecklistItem(); }}
                placeholder="گام اجرایی تازه…"
              />
              <Button size="sm" onClick={addChecklistItem} disabled={!newItem.trim()}>
                <IconPlus width={14} height={14} />
                افزودن
              </Button>
            </div>

            {(draft.checklist ?? []).length === 0 ? (
              <p className="pl-muted">چک‌لیستی ثبت نشده است.</p>
            ) : (
              <ul className="pl-checkitems">
                {draft.checklist.map((item) => (
                  <li key={item.id} className={item.done ? 'is-done' : ''}>
                    <label>
                      <input type="checkbox" checked={item.done} onChange={() => toggleChecklistItem(item.id)} />
                      <span>{item.text}</span>
                    </label>
                    <button type="button" className="pl-iconbtn pl-iconbtn--sm pl-iconbtn--danger" onClick={() => removeChecklistItem(item.id)} aria-label="حذف گام">
                      <IconTrash width={13} height={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {tab === 'kpis' ? (
          <div className="pl-kpibox">
            <div className="pl-inline-add">
              <Input value={kpi.title} onChange={(event) => setKpi((state) => ({ ...state, title: event.target.value }))} placeholder="عنوان شاخص" />
              <Input value={kpi.target} onChange={(event) => setKpi((state) => ({ ...state, target: event.target.value }))} placeholder="هدف" />
              <Input value={kpi.measure} onChange={(event) => setKpi((state) => ({ ...state, measure: event.target.value }))} placeholder="واحد سنجش" />
              <Button size="sm" onClick={addKpi} disabled={!kpi.title.trim()}>
                <IconPlus width={14} height={14} />
                افزودن
              </Button>
            </div>

            {(draft.kpis ?? []).length === 0 ? (
              <p className="pl-muted">شاخصی ثبت نشده است.</p>
            ) : (
              <table className="pl-table pl-table--slim">
                <thead>
                  <tr><th>شاخص</th><th>هدف</th><th>واحد سنجش</th><th /></tr>
                </thead>
                <tbody>
                  {draft.kpis.map((item) => (
                    <tr key={item.id}>
                      <td>{item.title}</td>
                      <td>{item.target}</td>
                      <td>{item.measure}</td>
                      <td>
                        <button
                          type="button"
                          className="pl-iconbtn pl-iconbtn--sm pl-iconbtn--danger"
                          onClick={() => set({ kpis: draft.kpis.filter((row) => row.id !== item.id) })}
                          aria-label="حذف شاخص"
                        >
                          <IconTrash width={13} height={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {tab === 'meta' ? (
          <div className="pl-form">
            <div className="pl-form__row">
              <Field label="عنوان SOP">
                <Input value={draft.title} onChange={(event) => set({ title: event.target.value })} />
              </Field>
              <Field label="کد SOP">
                <Input value={draft.code} onChange={(event) => set({ code: event.target.value })} dir="ltr" />
              </Field>
              <Field label="نسخه">
                <Input value={draft.version} onChange={(event) => set({ version: event.target.value })} />
              </Field>
            </div>

            <div className="pl-form__row">
              <Field label="واحد مالک">
                <Select value={draft.unitId} onChange={(event) => set({ unitId: event.target.value })} options={units.map((unit) => ({ value: unit.id, label: unit.name }))} />
              </Field>
              <Field label="نویسنده">
                <Select value={draft.authorId} onChange={(event) => set({ authorId: event.target.value })} options={users.map((user) => ({ value: user.id, label: user.name }))} />
              </Field>
              <Field label="ناظر / تأییدکننده">
                <Select value={draft.reviewerId} onChange={(event) => set({ reviewerId: event.target.value })} options={users.map((user) => ({ value: user.id, label: user.name }))} />
              </Field>
            </div>

            <div className="pl-form__row">
              <Field label="تاریخ ایجاد">
                <Input value={jalaliLabel(draft.createdAt)} readOnly />
              </Field>
              <Field label="آخرین ویرایش">
                <Input value={jalaliLabel(draft.updatedAt)} readOnly />
              </Field>
              <Field label="بازبینی بعدی">
                <JalaliDatePicker value={draft.nextReviewAt} onChange={(iso) => set({ nextReviewAt: iso })} allowClear={false} />
              </Field>
            </div>

            <Field label="هدف">
              <Textarea rows={2} value={draft.purpose} onChange={(event) => set({ purpose: event.target.value })} />
            </Field>
            <Field label="دامنهٔ کاربرد">
              <Textarea rows={2} value={draft.scope} onChange={(event) => set({ scope: event.target.value })} />
            </Field>
            <Field label="مسئولیت‌ها">
              <Textarea rows={2} value={draft.responsibilities} onChange={(event) => set({ responsibilities: event.target.value })} />
            </Field>
            <Field label="پیش‌نیازها">
              <Textarea rows={2} value={draft.prerequisites} onChange={(event) => set({ prerequisites: event.target.value })} />
            </Field>
            <Field label="خطاهای رایج">
              <Textarea rows={2} value={draft.pitfalls} onChange={(event) => set({ pitfalls: event.target.value })} />
            </Field>
          </div>
        ) : null}

        {tab === 'versions' ? (
          (draft.versions ?? []).length === 0 ? (
            <p className="pl-muted">نسخهٔ بایگانی‌شده‌ای وجود ندارد. با ذخیرهٔ تغییرات متن، نسخهٔ قبلی اینجا نگه داشته می‌شود.</p>
          ) : (
            <ul className="pl-versions">
              {draft.versions.map((version) => (
                <li key={version.id}>
                  <span className="pl-versions__icon"><IconHistory width={15} height={15} /></span>
                  <div>
                    <strong>نسخهٔ {version.version}</strong>
                    <p>{version.note}</p>
                    <span className="pl-muted">
                      {jalaliLabel(version.savedAt)} · {relativeFa(version.savedAt)} · {labelOf(SOP_STATUSES, version.status)}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setRestoreTarget(version)}>بازگردانی</Button>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {tab === 'comments' ? (
          <div className="pl-commentsbox">
            {(draft.comments ?? []).length === 0 ? (
              <p className="pl-muted">پیشنهادی ثبت نشده است.</p>
            ) : (
              <ul className="pl-comments">
                {draft.comments.map((item) => {
                  const author = users.find((user) => user.id === item.authorId);
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
                placeholder="پیشنهاد اصلاح یا نکتهٔ خود را بنویسید…"
              />
              <Button size="sm" onClick={addComment} loading={busy} disabled={!comment.trim()}>ثبت پیشنهاد</Button>
            </div>
          </div>
        ) : null}
      </div>

      <Modal
        open={Boolean(restoreTarget)}
        size="sm"
        title="بازگردانی نسخه"
        onClose={() => setRestoreTarget(null)}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setRestoreTarget(null)}>انصراف</Button>
            <Button onClick={restore} loading={busy}>بازگردانی</Button>
          </>
        )}
      >
        <p className="pl-confirm__message">
          متن SOP به نسخهٔ <b>{restoreTarget?.version}</b> برمی‌گردد. نسخهٔ کنونی هم بایگانی می‌شود و از دست نمی‌رود.
        </p>
      </Modal>
    </div>
  );
}
