/*
 * مودال ساخت/ویرایش یادداشت.
 * چهار حالت: «متنی» (چندخطی)، «چک‌لیست» (آیتم‌های تیک‌خور)، «پرسش و پاسخ»
 * (بازیابی فعال) و «جدول مقایسه» (چند مورد روی چند معیار).
 * هر یادداشت می‌تواند موضوع (از لیست ویکی)، تگ دسته‌بندی‌شده، رنگ کارت و یک منبع داشته باشد.
 * تپش هوشمند روی هر متن (بدنه، آیتم، پرسش/پاسخ، سلول) و یک‌جا روی همهٔ متن‌ها کار می‌کند.
 * ذخیره async است و والد با onSave نتیجه را می‌گیرد؛ این کامپوننت خودش سرویس CRUD صدا نمی‌زند.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  CUSTOM_TAG_GROUP,
  NOTE_AI_ACTIONS,
  NOTE_COLORS,
  NOTE_KINDS,
  SOURCE_TYPES,
  SUBJECTS,
  TAG_GROUPS,
  rewriteDraft,
  tagAccent,
} from '../../../services/notes/notesService';
import { AIAssist, Icon, Modal, TagPill, toFa } from './notesShared';

const labelClass = 'mb-2 block text-xs text-[#8a8a8a]';
const fieldClass =
  'w-full rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-[#5c5c5c] focus:border-[#5b8cc7]/60 focus:bg-white/[0.06]';
const smallBtnClass =
  'flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/[0.05] px-4 py-2 text-xs text-[#aaa] transition-colors hover:bg-white/[0.09] hover:text-white';
const removeBtnClass =
  'grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg bg-white/[0.04] text-[#8a8a8a] transition-colors hover:bg-[#e26d6d]/15 hover:text-[#ef9196] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white/[0.04] disabled:hover:text-[#8a8a8a]';

const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/* جدول تازه: ستون اول معیار است و دو مورد برای مقایسه */
const makeTable = () => ({
  columns: [
    { id: uid('col'), label: 'معیار' },
    { id: uid('col'), label: 'مورد ۱' },
    { id: uid('col'), label: 'مورد ۲' },
  ],
  rows: Array.from({ length: 3 }, () => ({ id: uid('row'), cells: {} })),
});

const makePair = () => ({ id: uid('qa'), question: '', answer: '' });

export default function NoteEditor({ open, note, tagGroups = [], saving = false, onSave, onClose }) {
  const isEdit = Boolean(note);

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('text');
  const [body, setBody] = useState('');
  const [items, setItems] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [table, setTable] = useState({ columns: [], rows: [] });
  const [subjectId, setSubjectId] = useState('general');
  const [tags, setTags] = useState([]);
  const [tagDraft, setTagDraft] = useState('');
  const [color, setColor] = useState(NOTE_COLORS[1]);
  const [hasSource, setHasSource] = useState(false);
  const [sourceType, setSourceType] = useState('lesson');
  const [sourceTitle, setSourceTitle] = useState('');
  const [error, setError] = useState('');
  const [aiNotice, setAiNotice] = useState('');

  /* هر بار باز شدن، فرم از صفر یا از یادداشت فعلی پر می‌شود */
  useEffect(() => {
    if (!open) return;
    setError('');
    setAiNotice('');
    setTagDraft('');

    if (note) {
      setTitle(note.title ?? '');
      setKind(note.kind ?? 'text');
      setBody(note.body ?? '');
      setItems((note.items ?? []).map((item) => ({ ...item })));
      setPairs((note.pairs ?? []).map((pair) => ({ ...pair })));
      setTable({
        columns: (note.table?.columns ?? []).map((column) => ({ ...column })),
        rows: (note.table?.rows ?? []).map((row) => ({ id: row.id, cells: { ...row.cells } })),
      });
      setSubjectId(note.subjectId ?? 'general');
      setTags([...(note.tags ?? [])]);
      setColor(note.color ?? NOTE_COLORS[1]);
      setHasSource(Boolean(note.source));
      setSourceType(note.source?.sourceType ?? 'lesson');
      setSourceTitle(note.source?.title ?? '');
    } else {
      setTitle('');
      setKind('text');
      setBody('');
      setItems([]);
      setPairs([]);
      setTable({ columns: [], rows: [] });
      setSubjectId('general');
      setTags([]);
      setColor(NOTE_COLORS[1]);
      setHasSource(false);
      setSourceType('lesson');
      setSourceTitle('');
    }
  }, [open, note]);

  /* پیشنهاد تگ‌ها به تفکیک دسته: واژه‌نامهٔ هر درس + تگ‌های خودِ کاربر.
     تگ‌های انتخاب‌شده از پیشنهاد حذف می‌شوند تا فهرست شلوغ نشود. */
  const suggestions = useMemo(() => {
    const custom = tagGroups.find((group) => group.id === CUSTOM_TAG_GROUP.id)?.tags.map(({ tag }) => tag) ?? [];
    const groups = [...TAG_GROUPS, ...(custom.length ? [{ ...CUSTOM_TAG_GROUP, tags: custom }] : [])];
    return groups
      .map((group) => ({ ...group, tags: group.tags.filter((tag) => !tags.includes(tag)).slice(0, 8) }))
      .filter((group) => group.tags.length > 0);
  }, [tagGroups, tags]);

  const addTag = (raw) => {
    const tag = String(raw ?? tagDraft).trim().replace(/^#/, '');
    if (!tag) return;
    if (tags.includes(tag)) {
      setTagDraft('');
      return;
    }
    if (tags.length >= 8) {
      setError('حداکثر ۸ تگ مجاز است.');
      return;
    }
    setTags((current) => [...current, tag]);
    setTagDraft('');
    setError('');
  };

  /* ── چک‌لیست ── */
  const updateItem = (itemId, patch) => {
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    setItems((current) => [...current, { id: uid('ck'), text: '', done: false }]);
  };

  /* ── پرسش و پاسخ ── */
  const updatePair = (pairId, patch) => {
    setPairs((current) => current.map((pair) => (pair.id === pairId ? { ...pair, ...patch } : pair)));
  };

  /* ── جدول مقایسه ── */
  const updateColumn = (columnId, label) => {
    setTable((current) => ({ ...current, columns: current.columns.map((column) => (column.id === columnId ? { ...column, label } : column)) }));
  };

  const addColumn = () => {
    setTable((current) =>
      current.columns.length >= 5
        ? current
        : { ...current, columns: [...current.columns, { id: uid('col'), label: `مورد ${toFa(current.columns.length)}` }] },
    );
  };

  const removeColumn = (columnId) => {
    setTable((current) =>
      current.columns.length <= 2
        ? current
        : {
            columns: current.columns.filter((column) => column.id !== columnId),
            rows: current.rows.map((row) => {
              const cells = { ...row.cells };
              delete cells[columnId];
              return { ...row, cells };
            }),
          },
    );
  };

  const updateCell = (rowId, columnId, value) => {
    setTable((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === rowId ? { ...row, cells: { ...row.cells, [columnId]: value } } : row)),
    }));
  };

  const addRow = () => {
    setTable((current) => (current.rows.length >= 40 ? current : { ...current, rows: [...current.rows, { id: uid('row'), cells: {} }] }));
  };

  const removeRow = (rowId) => {
    setTable((current) => ({ ...current, rows: current.rows.filter((row) => row.id !== rowId) }));
  };

  const changeKind = (nextKind) => {
    setKind(nextKind);
    setError('');
    if (nextKind === 'table' && table.columns.length === 0) setTable(makeTable());
    if (nextKind === 'qa' && pairs.length === 0) setPairs([makePair()]);
    if (nextKind === 'checklist' && items.length === 0) setItems([{ id: uid('ck'), text: '', done: false }]);
  };

  /* ── تپش هوشمند روی کل پیش‌نویس ── */
  const currentDraft = () => ({ title, kind, body, items, pairs, table, subjectId, tags, color });

  const applyDraftAI = (actionId) => {
    const next = rewriteDraft(currentDraft(), actionId);
    setBody(next.body ?? '');
    setItems(next.items ?? []);
    setPairs(next.pairs ?? []);
    setTable(next.table ?? { columns: [], rows: [] });
    setError('');
    setAiNotice('متن‌های این یادداشت مرتب شد.');
    window.setTimeout(() => setAiNotice(''), 2600);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const hasContent =
      title.trim() ||
      (kind === 'text' && body.trim()) ||
      (kind === 'checklist' && items.some((item) => item.text.trim())) ||
      (kind === 'qa' && pairs.some((pair) => pair.question.trim())) ||
      (kind === 'table' && table.rows.some((row) => table.columns.some((column) => (row.cells[column.id] ?? '').trim())));

    if (!hasContent) {
      setError('برای ذخیره، حداقل یک عنوان یا محتوا لازم است.');
      return;
    }
    if (hasSource && !sourceTitle.trim()) {
      setError('عنوان منبع را بنویس یا منبع را حذف کن.');
      return;
    }
    if (kind === 'checklist' && !items.some((item) => item.text.trim())) {
      setError('حداقل یک آیتم برای چک‌لیست بنویس (آیتم خالی ذخیره نمی‌شود).');
      return;
    }
    if (kind === 'qa' && !pairs.some((pair) => pair.question.trim())) {
      setError('حداقل یک پرسش بنویس تا یادداشت پرسش و پاسخ ساخته شود.');
      return;
    }
    if (kind === 'table') {
      const labeled = table.columns.filter((column) => column.label.trim()).length;
      if (labeled < 2) {
        setError('جدول حداقل به دو ستون با عنوان نیاز دارد.');
        return;
      }
      if (!table.rows.some((row) => table.columns.some((column) => (row.cells[column.id] ?? '').trim()))) {
        setError('حداقل یک ردیف از جدول را پر کن.');
        return;
      }
    }

    setError('');
    await onSave?.({
      title,
      kind,
      body: kind === 'text' ? body : '',
      items: kind === 'checklist' ? items : [],
      pairs: kind === 'qa' ? pairs : [],
      table: kind === 'table' ? table : { columns: [], rows: [] },
      subjectId,
      tags,
      color,
      pinned: note?.pinned ?? false,
      sourceType: hasSource ? sourceType : null,
      sourceTitle: hasSource ? sourceTitle : '',
    });
  };

  const activeKind = NOTE_KINDS.find((option) => option.id === kind) ?? NOTE_KINDS[0];

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'ویرایش یادداشت' : 'یادداشت جدید'} wide>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* عنوان */}
        <div>
          <label className={labelClass} htmlFor="nt-editor-title">عنوان</label>
          <input
            id="nt-editor-title"
            className={fieldClass}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="مثلا: نکات چرخهٔ قلبی"
            maxLength={120}
          />
        </div>

        {/* حالت یادداشت */}
        <div>
          <span className={labelClass}>حالت یادداشت</span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="حالت یادداشت">
            {NOTE_KINDS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={kind === option.id}
                onClick={() => changeKind(option.id)}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-colors [font-family:'Doran',Tahoma,sans-serif] ${
                  kind === option.id
                    ? 'border-[#5b8cc7]/70 bg-[#5b8cc7]/15 text-[#9cc0e8]'
                    : 'border-white/8 bg-white/[0.03] text-[#8a8a8a] hover:bg-white/[0.06]'
                }`}
              >
                <Icon name={option.icon} size={14} />
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-6 text-[#5c5c5c]">{activeKind.hint}</p>
        </div>

        {/* تپش هوشمند روی همهٔ متن‌ها */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#937fcd]/25 bg-[#937fcd]/[0.07] p-3.5">
          <span className="flex items-center gap-2 text-[11px] text-[#b6a6e6]">
            <Icon name="wand" size={14} />
            تپش هوشمند می‌تواند همهٔ متن‌های این یادداشت را یک‌جا بازنویسی کند.
          </span>
          <div className="flex flex-wrap gap-1.5">
            {NOTE_AI_ACTIONS.map((option) => (
              <button key={option.id} type="button" title={option.hint} className="nt-ai__chip" onClick={() => applyDraftAI(option.id)}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {aiNotice && (
          <p role="status" className="rounded-xl bg-[#77b787]/10 px-4 py-2.5 text-xs text-[#9ed3ab]">
            {aiNotice}
          </p>
        )}

        {/* محتوا بر اساس حالت */}
        {kind === 'text' && (
          <div>
            <label className={labelClass} htmlFor="nt-editor-body">متن یادداشت</label>
            <div className="space-y-2">
              <textarea
                id="nt-editor-body"
                className={`${fieldClass} min-h-36 resize-y leading-7`}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="هر چیزی که بعداً لازم داری بنویس… (خط تیره و بولت آزاد است)"
              />
              <AIAssist text={body} onApply={setBody} />
            </div>
          </div>
        )}

        {kind === 'checklist' && (
          <div>
            <span className={labelClass}>آیتم‌های چک‌لیست</span>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-2">
                  <button
                    type="button"
                    aria-pressed={item.done}
                    aria-label={item.done ? 'علامت‌زدن به‌عنوان انجام‌نشده' : 'علامت‌زدن به‌عنوان انجام‌شده'}
                    onClick={() => updateItem(item.id, { done: !item.done })}
                    className={`mt-1 grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg border transition-colors ${
                      item.done
                        ? 'border-[#77b787]/70 bg-[#77b787]/20 text-[#9ed3ab]'
                        : 'border-white/12 bg-white/[0.03] text-transparent hover:border-white/25'
                    }`}
                  >
                    <Icon name="check" size={13} />
                  </button>
                  <div className="flex-1 space-y-1.5">
                    <input
                      className={fieldClass}
                      value={item.text}
                      onChange={(event) => updateItem(item.id, { text: event.target.value })}
                      placeholder="آیتم جدید…"
                    />
                    <AIAssist compact text={item.text} onApply={(value) => updateItem(item.id, { text: value })} />
                  </div>
                  <button
                    type="button"
                    aria-label="حذف آیتم"
                    onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}
                    className={`mt-1 ${removeBtnClass}`}
                  >
                    <Icon name="close" size={13} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addItem} className={smallBtnClass}>
                <Icon name="plus" size={13} />
                افزودن آیتم
              </button>
            </div>
          </div>
        )}

        {kind === 'qa' && (
          <div>
            <span className={labelClass}>پرسش‌ها و پاسخ‌ها</span>
            <div className="space-y-2">
              {pairs.map((pair, index) => (
                <div key={pair.id} className="rounded-2xl border border-white/8 bg-white/[0.02] p-3.5">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-[10px] text-[#6d6d6d]">پرسش {toFa(index + 1)}</span>
                    <button
                      type="button"
                      aria-label="حذف پرسش"
                      onClick={() => setPairs((current) => current.filter((row) => row.id !== pair.id))}
                      className={removeBtnClass}
                    >
                      <Icon name="close" size={13} />
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    <div className="space-y-1.5">
                      <input
                        className={fieldClass}
                        value={pair.question}
                        onChange={(event) => updatePair(pair.id, { question: event.target.value })}
                        placeholder="پرسش… مثلا: چرا S2 شنیده می‌شود؟"
                      />
                      <AIAssist compact text={pair.question} onApply={(value) => updatePair(pair.id, { question: value })} />
                    </div>
                    <div className="space-y-1.5">
                      <textarea
                        className={`${fieldClass} min-h-20 resize-y leading-7`}
                        value={pair.answer}
                        onChange={(event) => updatePair(pair.id, { answer: event.target.value })}
                        placeholder="پاسخ… (در حالت مرور پنهان می‌ماند تا خودت بازیابی کنی)"
                      />
                      <AIAssist compact text={pair.answer} onApply={(value) => updatePair(pair.id, { answer: value })} />
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setPairs((current) => [...current, makePair()])} className={smallBtnClass}>
                <Icon name="plus" size={13} />
                افزودن پرسش
              </button>
            </div>
          </div>
        )}

        {kind === 'table' && (
          <div className="space-y-4">
            <div>
              <span className={labelClass}>ستون‌ها (۲ تا ۵ — ستون اول معیار مقایسه است)</span>
              <div className="space-y-2">
                {table.columns.map((column, index) => (
                  <div key={column.id} className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-[10px] text-[#5c5c5c]">ستون {toFa(index + 1)}</span>
                    <input
                      className={fieldClass}
                      value={column.label}
                      onChange={(event) => updateColumn(column.id, event.target.value)}
                      placeholder={index === 0 ? 'معیار' : 'نام مورد'}
                    />
                    <button
                      type="button"
                      aria-label={`حذف ستون ${column.label || index + 1}`}
                      disabled={table.columns.length <= 2}
                      onClick={() => removeColumn(column.id)}
                      className={removeBtnClass}
                    >
                      <Icon name="close" size={13} />
                    </button>
                  </div>
                ))}
                {table.columns.length < 5 && (
                  <button type="button" onClick={addColumn} className={smallBtnClass}>
                    <Icon name="plus" size={13} />
                    افزودن ستون
                  </button>
                )}
              </div>
            </div>

            <div>
              <span className={labelClass}>ردیف‌ها</span>
              <div className="space-y-2">
                {table.rows.map((row, index) => (
                  <div key={row.id} className="rounded-2xl border border-white/8 bg-white/[0.02] p-3.5">
                    <div className="mb-2.5 flex items-center justify-between">
                      <span className="text-[10px] text-[#6d6d6d]">ردیف {toFa(index + 1)}</span>
                      <button type="button" aria-label="حذف ردیف" onClick={() => removeRow(row.id)} className={removeBtnClass}>
                        <Icon name="close" size={13} />
                      </button>
                    </div>
                    <div className="grid gap-2.5 md:grid-cols-2">
                      {table.columns.map((column) => (
                        <div key={column.id} className="space-y-1.5">
                          <label className="block text-[10px] text-[#5c5c5c]" htmlFor={`nt-cell-${row.id}-${column.id}`}>
                            {column.label || 'بی‌عنوان'}
                          </label>
                          <input
                            id={`nt-cell-${row.id}-${column.id}`}
                            className={fieldClass}
                            value={row.cells[column.id] ?? ''}
                            onChange={(event) => updateCell(row.id, column.id, event.target.value)}
                            placeholder="…"
                          />
                          <AIAssist
                            compact
                            text={row.cells[column.id] ?? ''}
                            onApply={(value) => updateCell(row.id, column.id, value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addRow} className={smallBtnClass}>
                  <Icon name="plus" size={13} />
                  افزودن ردیف
                </button>
              </div>
            </div>
          </div>
        )}

        {/* موضوع */}
        <div>
          <span className={labelClass}>موضوع</span>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((subject) => (
              <button
                key={subject.id}
                type="button"
                aria-pressed={subjectId === subject.id}
                onClick={() => setSubjectId(subject.id)}
                className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                  subjectId === subject.id
                    ? 'border-transparent text-white'
                    : 'border-white/8 bg-white/[0.03] text-[#8a8a8a] hover:bg-white/[0.06]'
                }`}
                style={subjectId === subject.id ? { background: `${subject.accent}2e`, borderColor: `${subject.accent}66`, color: subject.accent } : undefined}
              >
                {subject.label}
              </button>
            ))}
          </div>
        </div>

        {/* تگ‌ها */}
        <div>
          <label className={labelClass} htmlFor="nt-editor-tag">تگ‌ها (حداکثر ۸)</label>
          {tags.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <TagPill key={tag} tag={tag} accent={tagAccent(tag)} onRemove={() => setTags((current) => current.filter((row) => row !== tag))} />
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              id="nt-editor-tag"
              className={fieldClass}
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addTag();
                }
              }}
              placeholder="تگ بنویس و Enter بزن"
            />
            <button type="button" onClick={() => addTag()} className="shrink-0 cursor-pointer rounded-xl bg-white/[0.06] px-4 text-xs text-[#aaa] transition-colors hover:bg-white/[0.1] hover:text-white">
              افزودن
            </button>
          </div>

          {suggestions.length > 0 && (
            <div className="mt-3">
              <span className="mb-2 block text-[10px] text-[#5c5c5c]">تگ‌ها به تفکیک دسته:</span>
              <div className="max-h-44 space-y-2.5 overflow-y-auto rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                {suggestions.map((group) => (
                  <div key={group.id} className="nt-taggroup" style={{ '--accent': group.accent }}>
                    <span className="nt-taggroup__label">
                      <Icon name="folder" size={12} />
                      {group.label}
                    </span>
                    <div className="nt-taggroup__tags">
                      {group.tags.map((tag) => (
                        <TagPill key={tag} tag={tag} accent={group.accent} onClick={() => addTag(tag)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* رنگ کارت */}
        <div>
          <span className={labelClass}>رنگ کارت</span>
          <div className="flex items-center gap-2.5">
            {NOTE_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`رنگ ${swatch}`}
                aria-pressed={color === swatch}
                onClick={() => setColor(swatch)}
                className={`h-8 w-8 cursor-pointer rounded-full transition-transform ${
                  color === swatch ? 'scale-110 ring-2 ring-white/70 ring-offset-2 ring-offset-[#232323]' : 'opacity-70 hover:opacity-100'
                }`}
                style={{ background: swatch }}
              />
            ))}
          </div>
        </div>

        {/* منبع */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <button
            type="button"
            aria-pressed={hasSource}
            onClick={() => setHasSource((current) => !current)}
            className="flex cursor-pointer items-center gap-2 text-xs text-[#aaa] transition-colors hover:text-white"
          >
            <span
              className={`grid h-5 w-5 place-items-center rounded-md border transition-colors ${
                hasSource ? 'border-[#5b8cc7]/70 bg-[#5b8cc7]/20 text-[#9cc0e8]' : 'border-white/15 text-transparent'
              }`}
            >
              <Icon name="check" size={11} />
            </span>
            اتصال به یک منبع (درسنامه، تست، مقاله و…)
          </button>

          {hasSource && (
            <div className="mt-3 grid gap-2 md:grid-cols-[130px_1fr]">
              <select
                aria-label="نوع منبع"
                className={`${fieldClass} cursor-pointer`}
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value)}
              >
                {SOURCE_TYPES.map((type) => (
                  <option key={type.id} value={type.id} className="bg-[#232323]">
                    {type.label}
                  </option>
                ))}
              </select>
              <input
                className={fieldClass}
                value={sourceTitle}
                onChange={(event) => setSourceTitle(event.target.value)}
                placeholder="عنوان منبع؛ مثلا: درسنامهٔ جامع فیزیولوژی — فصل قلب"
              />
            </div>
          )}
        </div>

        {/* خطا و دکمه‌ها */}
        {error && (
          <p role="alert" className="rounded-xl bg-[#e26d6d]/10 px-4 py-2.5 text-xs text-[#ef9196]">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl bg-white/[0.05] px-5 py-2.5 text-xs text-[#aaa] transition-colors hover:bg-white/[0.09] hover:text-white"
          >
            انصراف
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#5b8cc7] px-6 py-2.5 text-xs font-bold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60 [font-family:'Doran',Tahoma,sans-serif]"
          >
            {saving && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
            )}
            {isEdit ? 'ذخیرهٔ تغییرات' : 'ساخت یادداشت'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
