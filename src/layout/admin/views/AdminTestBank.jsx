import { useCallback, useState } from 'react';

import { testBank } from '../../../services/admin/adminService';
import { DIFFICULTIES, SUBJECTS, TRACKS } from '../../../services/testBank/mockData';
import { JALALI_MONTHS } from '../../../services/testBank/questionMeta';
import MediaPicker from '../MediaPicker';
import {
  Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, Input, LoadingBlock,
  SearchInput, Select, StatusBadge, Textarea, faNumber, useAsync, useToast,
} from '../adminShared';

const statuses = [
  { value: 'all', label: 'همهٔ وضعیت‌ها' },
  { value: 'published', label: 'منتشرشده' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'archived', label: 'بایگانی' },
];
const choices = (record) => Object.entries(record).map(([value, meta]) => ({ value, label: meta.label }));
const subjectChoices = SUBJECTS.map(({ id, name }) => ({ value: id, label: name }));
const bankChoices = [{ value: 'official', label: 'علوم پایه کشوری' }, { value: 'tapesh', label: 'تألیفی' }];
const blank = () => ({
  subject: SUBJECTS[0].id, track: 'medicine', source: 'tapesh', type: 'single',
  difficulty: 'medium', year: '', examMonth: '', topicPath: [], tags: [], conceptIds: [],
  stem: '', figure: null, options: ['', '', '', ''], correctAnswer: 0,
  explanation: { summary: '', deep: '', keyPoint: '', trap: '', whyWrong: [] },
  stats: { solves: 0, correctPercent: 0, optionPercents: [0, 0, 0, 0], avgTimeSec: 0, difficultyIndex: 0 },
  status: 'draft',
});
const split = (value) => value.split(/[,،\n]/).map((part) => part.trim()).filter(Boolean);

export default function AdminTestBank({ admin, onBack }) {
  const notify = useToast();
  const can = (permission) => admin.permissions?.includes(permission);
  const [filters, setFilters] = useState({ search: '', status: 'all', subject: 'all', track: 'all', page: 1 });
  const [form, setForm] = useState(null);
  const [topicPath, setTopicPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [mediaOpen, setMediaOpen] = useState(false);
  const load = useCallback(() => testBank.list({ ...filters, perPage: 20 }), [filters]);
  const { data, loading, error, reload } = useAsync(load, [filters]);
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? value : 1 }));
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setExplanation = (key, value) => setForm((current) => ({ ...current, explanation: { ...current.explanation, [key]: value } }));
  const removeOption = (index) => setForm((current) => ({
    ...current,
    options: current.options.filter((_, i) => i !== index),
    correctAnswer: current.correctAnswer === index ? 0 : current.correctAnswer > index ? current.correctAnswer - 1 : current.correctAnswer,
    explanation: { ...current.explanation, whyWrong: (current.explanation?.whyWrong ?? [])
      .filter((item) => item.index !== index).map((item) => ({ ...item, index: item.index > index ? item.index - 1 : item.index })) },
    stats: { ...current.stats, optionPercents: (current.stats?.optionPercents ?? []).filter((_, i) => i !== index) },
  }));
  const edit = (question) => {
    setForm(structuredClone({ ...question, source: question.source === 'comprehensive' ? 'official' : question.source }));
    setTopicPath(question.topicPath.join('، '));
  };

  async function save() {
    if (!form.stem.trim() || form.options.length < 2 || form.options.some((option) => !option.trim())) {
      notify('صورت سؤال و دست‌کم دو گزینهٔ کامل الزامی است', 'error');
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form, topicPath: split(topicPath) };
      const result = form.id ? await testBank.update(form.id, payload) : await testBank.create(payload);
      setForm(result.question);
      reload();
      notify('سؤال ذخیره شد');
    } catch (cause) { notify(cause.message, 'error'); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    try {
      await testBank.remove(removing.id);
      setRemoving(null);
      if (form?.id === removing.id) setForm(null);
      reload();
      notify('سؤال حذف شد');
    } catch (cause) { notify(cause.message, 'error'); }
    finally { setBusy(false); }
  }

  return (
    <div className="ad-stack ad-bank">
      <div className="ad-bank__head">
        <div><Button variant="ghost" size="sm" onClick={onBack}>بازگشت به صفحات</Button><h2>بانک تست علوم پایه</h2><p className="ad-sub">سؤال‌ها، پاسخ‌ها و تحلیل‌هایی که به کاربران نمایش داده می‌شوند.</p></div>
        {can('testbank.create') && <Button onClick={() => edit({ ...blank(), subject: filters.subject === 'all' ? SUBJECTS[0].id : filters.subject })}>سؤال جدید</Button>}
      </div>
      <div className="ad-toolbar">
        <SearchInput value={filters.search} onChange={(value) => setFilter('search', value)} placeholder="جست‌وجوی سؤال، شناسه یا مبحث…" />
        <Select aria-label="وضعیت" options={statuses} value={filters.status} onChange={(event) => setFilter('status', event.target.value)} />
        <Select aria-label="رشته" options={[{ value: 'all', label: 'همهٔ رشته‌ها' }, ...choices(TRACKS)]} value={filters.track} onChange={(event) => setFilter('track', event.target.value)} />
        <Button size="sm" variant="ghost" onClick={reload}>تازه‌سازی</Button>
      </div>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <LoadingBlock label="در حال خواندن سؤال‌ها…" />}
      {data && <div className="ad-bank__layout">
        <section className="ad-card ad-bank__list" aria-label="فهرست سؤال‌ها">
          {filters.subject === 'all' ? <>
            <div className="ad-bank__listhead"><strong>درس‌ها</strong><Badge tone="neutral">{faNumber(data.subjects.length)} درس</Badge></div>
            {data.subjects.map((subject) => <button key={subject.id} type="button" className="ad-bank__item ad-bank__subject" onClick={() => { setFilter('subject', subject.id); setForm(null); }}><strong>{subject.name}</strong><Badge tone="neutral">{faNumber(subject.count)} سؤال</Badge></button>)}
          </> : <>
          <div className="ad-bank__listhead"><Button variant="ghost" size="sm" onClick={() => { setFilter('subject', 'all'); setForm(null); }}>بازگشت به درس‌ها</Button><strong>{data.subjects.find((item) => item.id === filters.subject)?.name}</strong><Badge tone="neutral">{faNumber(data.total)} سؤال</Badge></div>
          {data.items.length ? data.items.map((question) => (
            <button key={question.id} type="button" className={`ad-bank__item ${form?.id === question.id ? 'is-active' : ''}`} onClick={() => edit(question)}>
              <span className="ad-bank__itemtop"><code dir="ltr">{question.id}</code><StatusBadge status={question.status} /></span>
              <strong>{question.stem}</strong>
              <small>{SUBJECTS.find((item) => item.id === question.subject)?.name} · {TRACKS[question.track]?.short} · {question.topicPath.join(' › ')}</small>
            </button>
          )) : <EmptyState title="سؤالی پیدا نشد" />}
          <div className="ad-bank__pager"><Button size="sm" variant="ghost" disabled={data.page <= 1} onClick={() => setFilter('page', data.page - 1)}>قبلی</Button><span>{faNumber(data.page)} / {faNumber(data.pages)}</span><Button size="sm" variant="ghost" disabled={data.page >= data.pages} onClick={() => setFilter('page', data.page + 1)}>بعدی</Button></div>
          </>}
        </section>
        <section className="ad-card ad-card--padded ad-bank__editor" aria-label="ویرایش سؤال">
          {!form ? <EmptyState title="یک سؤال انتخاب کنید" description="برای ویرایش از فهرست انتخاب کنید یا سؤال تازه بسازید." /> : <>
            <div className="ad-bank__editorhead"><div><h3>{form.id ? 'ویرایش سؤال' : 'سؤال جدید'}</h3>{form.id && <code dir="ltr">{form.id}</code>}</div><div className="ad-bank__actions"><Button variant="ghost" size="sm" onClick={() => setForm(null)}>بستن</Button>{form.id && can('testbank.delete') && <Button variant="danger" size="sm" onClick={() => setRemoving(form)}>حذف</Button>}</div></div>
            <fieldset disabled={busy || !(form.id ? can('testbank.update') : can('testbank.create'))} className="ad-bank__fields">
              <div className="ad-grid2">
                <Field label="رشته"><Select options={choices(TRACKS)} value={form.track} onChange={(event) => set('track', event.target.value)} /></Field>
                <Field label="درس"><Select options={subjectChoices} value={form.subject} onChange={(event) => set('subject', event.target.value)} /></Field>
                <Field label="منبع / نوع بانک"><Select options={bankChoices} value={form.source === 'comprehensive' ? 'official' : form.source} onChange={(event) => set('source', event.target.value)} /></Field>
                <Field label="سال آزمون (شمسی)"><Input type="number" min="1300" max="1600" value={form.year ?? ''} onChange={(event) => set('year', event.target.value)} /></Field>
                <Field label="ماه آزمون (شمسی)"><Select disabled={!form.year} options={[{ value: '', label: 'ماه نامشخص' }, ...JALALI_MONTHS.map((label, index) => ({ value: index + 1, label }))]} value={form.examMonth ?? ''} onChange={(event) => set('examMonth', event.target.value)} /></Field>
              </div>
              <p className="ad-sub">درجهٔ سختی: {form.stats?.solves > 0 ? DIFFICULTIES[form.difficulty]?.label : 'پس از پاسخ کاربران تعیین می‌شود'}</p>
              <Field label="مسیر مبحث" hint="سطح‌ها را با ویرگول جدا کنید؛ مانند قلب و عروق، ECG"><Input value={topicPath} onChange={(event) => setTopicPath(event.target.value)} /></Field>
              <Field label="صورت سؤال" required><Textarea rows={4} value={form.stem} onChange={(event) => set('stem', event.target.value)} /></Field>
              <Field label="شکل سؤال" as="div"><div className="ad-bank__option"><Select aria-label="شکل آماده" options={[{ value: '', label: 'بدون شکل / تصویر انتخابی' }, ...['cardiac-ap', 'o2-curve', 'enzyme-kinetics'].map((value) => ({ value, label: value }))]} value={form.figure?.startsWith('/uploads/') ? '' : form.figure ?? ''} onChange={(event) => set('figure', event.target.value || null)} /><Button variant="ghost" size="sm" onClick={() => setMediaOpen(true)}>انتخاب تصویر</Button>{form.figure && <Button variant="ghost" size="sm" onClick={() => set('figure', null)}>حذف شکل</Button>}</div>{form.figure?.startsWith('/uploads/') && <img className="ad-bank__preview" src={form.figure} alt="پیش‌نمایش شکل سؤال" />}</Field>
              <div className="ad-bank__options"><strong>گزینه‌ها و پاسخ صحیح</strong>{form.options.map((option, index) => <div key={index} className="ad-bank__option"><label><input type="radio" name="bank-answer" checked={form.correctAnswer === index} onChange={() => set('correctAnswer', index)} /> صحیح</label><Input value={option} aria-label={`گزینهٔ ${index + 1}`} onChange={(event) => set('options', form.options.map((item, i) => i === index ? event.target.value : item))} />{form.options.length > 2 && <Button variant="ghost" size="sm" onClick={() => removeOption(index)}>حذف</Button>}</div>)}<Button variant="ghost" size="sm" onClick={() => set('options', [...form.options, ''])}>افزودن گزینه</Button></div>
              <h4>تحلیل پاسخ</h4>
              <Field label="خلاصهٔ پاسخ"><Textarea value={form.explanation?.summary ?? ''} onChange={(event) => setExplanation('summary', event.target.value)} /></Field>
              <Field label="توضیح کامل"><Textarea rows={6} value={form.explanation?.deep ?? ''} onChange={(event) => setExplanation('deep', event.target.value)} /></Field>
              <Field label="نکتهٔ کلیدی"><Textarea value={form.explanation?.keyPoint ?? ''} onChange={(event) => setExplanation('keyPoint', event.target.value)} /></Field>
              <Field label="دام / اشتباه رایج"><Textarea value={form.explanation?.trap ?? ''} onChange={(event) => setExplanation('trap', event.target.value)} /></Field>
              {form.options.map((_, index) => index !== form.correctAnswer && <Field key={index} label={`علت نادرستی گزینهٔ ${faNumber(index + 1)}`}><Textarea rows={2} value={form.explanation?.whyWrong?.find((item) => item.index === index)?.text ?? ''} onChange={(event) => setExplanation('whyWrong', [...(form.explanation?.whyWrong ?? []).filter((item) => item.index !== index), { index, text: event.target.value }])} /></Field>)}
              <Field label="وضعیت انتشار"><Select options={statuses.slice(1).filter((item) => item.value !== 'published' || can('testbank.publish') || form.status === 'published')} value={form.status} onChange={(event) => set('status', event.target.value)} /></Field>
            </fieldset>
            <div className="ad-bank__save"><Button loading={busy} disabled={!(form.id ? can('testbank.update') : can('testbank.create'))} onClick={save}>ذخیرهٔ سؤال</Button></div>
          </>}
        </section>
      </div>}
      <ConfirmDialog open={Boolean(removing)} title="حذف سؤال" message="این سؤال از بانک کاربران حذف می‌شود. حذف آن را تأیید می‌کنید؟" confirmLabel="حذف سؤال" busy={busy} onCancel={() => setRemoving(null)} onConfirm={remove} />
      <MediaPicker open={mediaOpen} onClose={() => setMediaOpen(false)} onSelect={(item) => {
        if (item.mimeType?.startsWith('image/')) set('figure', item.url);
        else notify('برای شکل سؤال یک تصویر انتخاب کنید', 'error');
      }} accept="image/" />
    </div>
  );
}
