/*
 * کتابخانهٔ فلش‌کارت تپش — مدیریت مجموعه‌های رسمی.
 *
 * هر مجموعه (دک) یا «عادی» است (کارت‌های متنی: basic/cloze/mcq) یا «آناتومی
 * تصویری» (کارت‌های image-locate: نقطهٔ مشخص‌شده روی تصویر). انتشار یک دک
 * (status: published) یعنی همان دک در «کتابخانهٔ تپش» بخش فلش‌کارت داشبورد
 * کاربران ظاهر می‌شود — شکل داده با قرارداد سرویس فلش‌کارت کاربر یکی است.
 *
 * کارت‌ها داخل فرم دک ویرایش می‌شوند و با کل رکورد ذخیره می‌شوند؛ نقطه‌های
 * کارت تصویری با کلیک روی پیش‌نمایش تصویر ثبت می‌شوند (درصدی، ۰ تا ۱۰۰).
 */

import { useCallback, useEffect, useState } from 'react';

import { flashcards as flashcardsApi } from '../../../services/admin/adminService';
import { DECK_COLORS, SUBJECTS } from '../../../services/flashcards/mockData';
import {
  Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input, LoadingBlock,
  Modal, SearchInput, Select, StatusBadge, TableWrap, Textarea, Toggle, faDateTime, faNumber,
  useAsync, useToast,
} from '../adminShared';
import { IconEdit, IconPlus, IconRefresh, IconTrash } from '../adminIcons';
import MediaPicker from '../MediaPicker';

const STATUS_OPTIONS = [
  { value: 'all', label: 'همهٔ وضعیت‌ها' },
  { value: 'published', label: 'منتشرشده' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'archived', label: 'بایگانی' },
];

const KIND_OPTIONS = [
  { value: 'all', label: 'همهٔ مجموعه‌ها' },
  { value: 'normal', label: 'عادی' },
  { value: 'anatomy', label: 'آناتومی تصویری' },
];

const CARD_TYPE_OPTIONS = [
  { value: 'basic', label: 'ساده (پرسش و پاسخ)' },
  { value: 'cloze', label: 'جای خالی (cloze)' },
  { value: 'mcq', label: 'چهارگزینه‌ای' },
  { value: 'image-locate', label: 'موقعیت‌یاب تصویری' },
];

const SUBJECT_OPTIONS = [
  { value: '', label: 'انتخاب موضوع…' },
  ...SUBJECTS.map((subject) => ({ value: subject.id, label: subject.title })),
];

const EMPTY_CARD = (anatomy) => ({
  id: null,
  type: anatomy ? 'image-locate' : 'basic',
  front: '',
  back: '',
  hint: '',
  tags: [],
  subjectId: 'general',
  topicId: '',
  explanation: '',
  image: anatomy ? { url: '', alt: '', points: [] } : undefined,
  options: [],
});

const EMPTY_DECK = {
  title: '',
  description: '',
  shortTitle: '',
  subjectId: 'anatomy',
  level: 'علوم پایه',
  cover: DECK_COLORS[1],
  anatomy: false,
  previewImage: '',
  status: 'draft',
  cards: [],
};

function newDeckForm() {
  return { ...EMPTY_DECK, cover: DECK_COLORS[Math.floor(Math.random() * DECK_COLORS.length)], cards: [] };
}

/* ── ویرایشگر یک کارت ── */

function CardEditor({ card, onChange, onRemove, onPickImage, index }) {
  const setImage = (changes) => onChange({ ...card, image: { ...(card.image ?? { url: '', alt: '', points: [] }), ...changes } });
  const setOption = (optionIndex, changes) => onChange({
    ...card,
    options: card.options.map((option, i) => (i === optionIndex ? { ...option, ...changes } : option)),
  });

  const addPoint = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * 100);
    setImage({ points: [...(card.image?.points ?? []), { x, y }].slice(0, 4) });
  };

  return (
    <div className="ad-fccard">
      <div className="ad-fccard__head">
        <strong>کارت {faNumber(index + 1)}</strong>
        <Select
          className="ad-input--select"
          options={CARD_TYPE_OPTIONS}
          value={card.type}
          onChange={(event) => {
            const type = event.target.value;
            onChange({
              ...card,
              type,
              image: type === 'image-locate' ? (card.image ?? { url: '', alt: '', points: [] }) : card.image,
              options: type === 'mcq' && card.options.length === 0
                ? [{ text: '', correct: true }, { text: '', correct: false }]
                : card.options,
            });
          }}
        />
        <IconButton label="حذف کارت" tone="danger" onClick={onRemove}><IconTrash width={15} height={15} /></IconButton>
      </div>

      <Field label="روی کارت (پرسش)" required>
        <Textarea rows={2} value={card.front} onChange={(event) => onChange({ ...card, front: event.target.value })} />
      </Field>
      <Field label="پشت کارت (پاسخ)" required>
        <Textarea rows={2} value={card.back} onChange={(event) => onChange({ ...card, back: event.target.value })} />
      </Field>

      {card.type === 'mcq' ? (
        <Field label="گزینه‌ها" hint="گزینهٔ درست را علامت بزن.">
          <div className="ad-stack ad-stack--narrow">
            {card.options.map((option, optionIndex) => (
              <div key={optionIndex} className="ad-fccard__option">
                <input
                  type="radio"
                  name={`fc-correct-${index}`}
                  checked={option.correct}
                  onChange={() => onChange({ ...card, options: card.options.map((o, i) => ({ ...o, correct: i === optionIndex })) })}
                  aria-label="گزینهٔ درست"
                />
                <Input value={option.text} onChange={(event) => setOption(optionIndex, { text: event.target.value })} placeholder={`گزینهٔ ${faNumber(optionIndex + 1)}…`} />
                <IconButton label="حذف گزینه" tone="danger" onClick={() => onChange({ ...card, options: card.options.filter((_, i) => i !== optionIndex) })}>
                  <IconTrash width={14} height={14} />
                </IconButton>
              </div>
            ))}
            {card.options.length < 6 ? (
              <Button variant="ghost" size="sm" onClick={() => onChange({ ...card, options: [...card.options, { text: '', correct: false }] })}>
                <IconPlus width={14} height={14} /> گزینه
              </Button>
            ) : null}
          </div>
        </Field>
      ) : null}

      {card.type === 'image-locate' ? (
        <>
          <Field label="تصویر" hint="از کتابخانهٔ رسانه انتخاب کنید.">
            <div className="ad-fccard__option">
              <Input dir="ltr" value={card.image?.url ?? ''} onChange={(event) => setImage({ url: event.target.value })} placeholder="/uploads/…" />
              <Button variant="ghost" size="sm" onClick={onPickImage}>انتخاب</Button>
            </div>
          </Field>
          {card.image?.url ? (
            <div className="ad-fccard__canvas-wrap">
              <img
                src={card.image.url}
                alt={card.image.alt || 'تصویر کارت'}
                className="ad-fccard__canvas"
                onClick={addPoint}
                title="برای ثبت نقطهٔ ساختار روی تصویر کلیک کنید"
              />
              {(card.image?.points ?? []).map((point, pointIndex) => (
                <button
                  type="button"
                  key={pointIndex}
                  className="ad-fccard__point"
                  style={{ insetInlineStart: `${point.x}%`, top: `${point.y}%` }}
                  onClick={() => setImage({ points: card.image.points.filter((_, i) => i !== pointIndex) })}
                  title="حذف نقطه"
                  aria-label={`حذف نقطهٔ ${faNumber(pointIndex + 1)}`}
                />
              ))}
            </div>
          ) : null}
          <Field label="متن جانشین تصویر">
            <Input value={card.image?.alt ?? ''} onChange={(event) => setImage({ alt: event.target.value })} placeholder="مثلاً: نمای قدامی قلب" />
          </Field>
        </>
      ) : null}

      <div className="ad-grid2">
        <Field label="برچسب‌ها" hint="با کاما جدا کنید">
          <Input
            value={(card.tags ?? []).join('، ')}
            onChange={(event) => onChange({ ...card, tags: event.target.value.split(/[،,]/).map((tag) => tag.trim()).filter(Boolean) })}
          />
        </Field>
        <Field label="موضوع (topicId)" hint="اختیاری — برای فیلتر موضوعی">
          <Input dir="ltr" value={card.topicId ?? ''} onChange={(event) => onChange({ ...card, topicId: event.target.value })} />
        </Field>
      </div>
    </div>
  );
}

/* ── ویرایشگر دک (فرم اصلی) ── */

function DeckEditor({ deckId, onClose, onSaved, notify }) {
  const isNew = !deckId;
  const [form, setForm] = useState(isNew ? newDeckForm() : null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null); // 'preview' | index کارت

  useEffect(() => {
    if (isNew) return undefined;
    let alive = true;
    flashcardsApi.get(deckId)
      .then((data) => { if (alive) setForm({ ...EMPTY_DECK, ...data.deck }); })
      .catch((error) => { notify(error.message, 'error'); if (alive) onClose(); });
    return () => { alive = false; };
  }, [deckId]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setCard = (index, card) => setForm((current) => ({
    ...current,
    cards: current.cards.map((item, i) => (i === index ? card : item)),
  }));

  const save = async () => {
    if (!form.title.trim()) { notify('عنوان مجموعه را وارد کنید', 'error'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      const data = isNew ? await flashcardsApi.create(payload) : await flashcardsApi.update(deckId, payload);
      notify(isNew ? 'مجموعه ایجاد شد' : 'تغییرات ذخیره شد');
      onSaved(data.deck);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const pickFor = (target) => { setPickerTarget(target); setPickerOpen(true); };

  return (
    <>
      <Modal
        open
        title={isNew ? 'مجموعهٔ جدید فلش‌کارت' : `ویرایش «${form?.title ?? ''}»`}
        subtitle="بعد از انتشار، مجموعه در کتابخانهٔ تپش کاربران نمایش داده می‌شود"
        onClose={onClose}
        size="lg"
      >
        {form ? (
          <div className="ad-stack">
            <div className="ad-grid2">
              <Field label="عنوان" required>
                <Input value={form.title} onChange={(event) => setField('title', event.target.value)} placeholder="مثلاً: آناتومی تصویری — قلب" />
              </Field>
              <Field label="عنوان کوتاه" hint="برای نمایش فشرده در کتابخانه">
                <Input value={form.shortTitle} onChange={(event) => setField('shortTitle', event.target.value)} placeholder="مثلاً: بخش قلب" />
              </Field>
            </div>

            <Field label="توضیح">
              <Textarea rows={2} value={form.description} onChange={(event) => setField('description', event.target.value)} />
            </Field>

            <div className="ad-grid2">
              <Field label="موضوع">
                <Select options={SUBJECT_OPTIONS} value={form.subjectId} onChange={(event) => setField('subjectId', event.target.value)} />
              </Field>
              <Field label="سطح">
                <Input value={form.level} onChange={(event) => setField('level', event.target.value)} placeholder="علوم پایه" />
              </Field>
            </div>

            <div className="ad-grid2">
              <Field label="رنگ کاور">
                <div className="ad-chiprow" role="group" aria-label="رنگ کاور">
                  {DECK_COLORS.map((color) => (
                    <button
                      type="button"
                      key={color}
                      className={`ad-fccard__swatch ${form.cover === color ? 'is-active' : ''}`}
                      style={{ background: color }}
                      onClick={() => setField('cover', color)}
                      aria-label={`رنگ ${color}`}
                    />
                  ))}
                </div>
              </Field>
              <div className="ad-stack ad-stack--narrow">
                <Toggle
                  checked={form.anatomy}
                  onChange={(value) => setField('anatomy', value)}
                  label="آناتومی تصویری"
                  hint="کارت‌های این مجموعه روی تصویر نقطه مشخص می‌کنند"
                />
                <Field label="تصویر پیش‌نمایش مجموعه" hint="در کارت مجموعه در کتابخانه نمایش داده می‌شود">
                  <div className="ad-fccard__option">
                    <Input dir="ltr" value={form.previewImage} onChange={(event) => setField('previewImage', event.target.value)} placeholder="/uploads/…" />
                    <Button variant="ghost" size="sm" onClick={() => pickFor('preview')}>انتخاب</Button>
                  </div>
                </Field>
              </div>
            </div>

            <div className="ad-fccard__listhead">
              <strong>کارت‌ها ({faNumber(form.cards.length)})</strong>
              <Button variant="ghost" size="sm" onClick={() => setField('cards', [...form.cards, EMPTY_CARD(form.anatomy)])}>
                <IconPlus width={14} height={14} /> کارت جدید
              </Button>
            </div>

            {form.cards.length === 0 ? (
              <EmptyState title="کارتی ندارد" description="با «کارت جدید» اولین کارت این مجموعه را بسازید." />
            ) : form.cards.map((card, index) => (
              <CardEditor
                key={index}
                index={index}
                card={card}
                onChange={(next) => setCard(index, next)}
                onRemove={() => setField('cards', form.cards.filter((_, i) => i !== index))}
                onPickImage={() => pickFor(index)}
              />
            ))}

            <div className="ad-editor__actions">
              <Button onClick={save} loading={saving}>ذخیرهٔ مجموعه</Button>
              <Field label="وضعیت">
                <Select
                  className="ad-input--select"
                  options={[{ value: 'draft', label: 'پیش‌نویس' }, { value: 'published', label: 'منتشرشده (در کتابخانه)' }, { value: 'archived', label: 'بایگانی' }]}
                  value={form.status}
                  onChange={(event) => setField('status', event.target.value)}
                />
              </Field>
            </div>
          </div>
        ) : (
          <LoadingBlock label="در حال خواندن مجموعه…" rows={4} />
        )}
      </Modal>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(item) => {
          if (pickerTarget === 'preview') setField('previewImage', item.url);
          else if (typeof pickerTarget === 'number') setCard(pickerTarget, { ...form.cards[pickerTarget], image: { ...(form.cards[pickerTarget].image ?? { alt: '', points: [] }), url: item.url } });
          setPickerOpen(false);
        }}
      />
    </>
  );
}

/* ── ویوی اصلی ── */

export default function AdminFlashcards({ admin }) {
  const notify = useToast();
  const [filters, setFilters] = useState({ search: '', status: 'all', kind: 'all', page: 1, perPage: 10 });
  const [editing, setEditing] = useState(null); // 'new' | deckId
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const can = (permission) => admin.permissions?.includes(permission);
  const load = useCallback(() => flashcardsApi.list(filters), [filters]);
  const { data, loading, error, reload } = useAsync(load, [filters]);

  const patch = (changes) => setFilters((current) => ({ ...current, page: 1, ...changes }));

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await flashcardsApi.remove(pendingDelete.id);
      notify('مجموعه حذف شد');
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
        <SearchInput value={filters.search} onChange={(search) => patch({ search })} placeholder="جست‌وجوی مجموعه…" />
        <Select options={KIND_OPTIONS} value={filters.kind} onChange={(event) => patch({ kind: event.target.value })} aria-label="نوع مجموعه" />
        <Select options={STATUS_OPTIONS} value={filters.status} onChange={(event) => patch({ status: event.target.value })} aria-label="وضعیت" />

        <div className="ad-toolbar__end">
          <Button variant="ghost" size="sm" onClick={reload}><IconRefresh width={15} height={15} />تازه‌سازی</Button>
          {can('flashcards.create') ? (
            <Button onClick={() => setEditing('new')}>
              <IconPlus width={16} height={16} />
              مجموعهٔ جدید
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingBlock label="در حال خواندن مجموعه‌ها…" rows={4} /> : null}

      {data ? (
        <>
          <TableWrap
            head={['مجموعه', 'نوع', 'موضوع', 'کارت‌ها', 'وضعیت', 'آخرین ویرایش', '']}
            empty={data.items.length === 0 ? (
              <EmptyState
                title="مجموعه‌ای پیدا نشد"
                action={can('flashcards.create') ? <Button size="sm" onClick={() => setEditing('new')}>ایجاد مجموعه</Button> : null}
              />
            ) : null}
          >
            {data.items.map((deck) => (
              <tr key={deck.id}>
                <td>
                  <button type="button" className="ad-linkcell" onClick={() => setEditing(deck.id)}>
                    {deck.title}
                  </button>
                </td>
                <td>{deck.anatomy ? <Badge tone="neutral">آناتومی تصویری</Badge> : <Badge tone="neutral">عادی</Badge>}</td>
                <td><span className="ad-sub">{SUBJECTS.find((s) => s.id === deck.subjectId)?.title ?? deck.subjectId}</span></td>
                <td><span className="ad-sub">{faNumber(deck.cards?.length ?? 0)}</span></td>
                <td><StatusBadge status={deck.status} /></td>
                <td><span className="ad-sub">{faDateTime(deck.updatedAt)}</span></td>
                <td>
                  <div className="ad-rowactions">
                    <IconButton label="ویرایش" onClick={() => setEditing(deck.id)}><IconEdit width={16} height={16} /></IconButton>
                    {can('flashcards.delete') ? (
                      <IconButton label="حذف" tone="danger" onClick={() => setPendingDelete(deck)}><IconTrash width={16} height={16} /></IconButton>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </TableWrap>

          {data.pages > 1 ? (
            <div className="ad-toolbar">
              <Button variant="ghost" size="sm" disabled={data.page <= 1} onClick={() => setFilters((c) => ({ ...c, page: c.page - 1 }))}>قبلی</Button>
              <span className="ad-toolbar__hint">صفحه {faNumber(data.page)} از {faNumber(data.pages)} — {faNumber(data.total)} مجموعه</span>
              <Button variant="ghost" size="sm" disabled={data.page >= data.pages} onClick={() => setFilters((c) => ({ ...c, page: c.page + 1 }))}>بعدی</Button>
            </div>
          ) : null}
        </>
      ) : null}

      {editing ? (
        <DeckEditor
          deckId={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
          notify={notify}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف مجموعه"
        message={`آیا از حذف «${pendingDelete?.title ?? ''}» و همهٔ کارت‌هایش مطمئن هستید؟ کاربرانی که این مجموعه را اضافه کرده‌اند دیگر آن را نمی‌بینند.`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
