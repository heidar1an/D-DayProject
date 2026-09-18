/*
 * DeckModal — ساخت و ویرایش مجموعه.
 * فرم کوتاه: نام، توضیح، موضوع، رنگ کاور (از پالت تپش) و سطح دسترسی.
 * موضوع آزاد-متنی است اما فقط حروف فارسی/انگلیسی را می‌پذیرد (عدد و نماد غیرعادی رد می‌شود).
 */
import { useEffect, useState } from 'react';
import { DECK_COLORS, SUBJECTS } from '../../../services/flashcards/mockData';
import { Modal, textFieldError } from './flashcardShared';

/* اگر فیلد موضوع قبلاً به‌شکل شناسه ذخیره شده باشد، برای نمایش به عنوانش تبدیل می‌شود */
const subjectLabelOf = (value) => SUBJECTS.find((subject) => subject.id === value)?.title ?? value;

export default function DeckModal({ open, onClose, onSave, deck = null }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [cover, setCover] = useState(DECK_COLORS[0]);
  const [visibility, setVisibility] = useState('private');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (deck) {
      setTitle(deck.title ?? '');
      setDescription(deck.description ?? '');
      setSubject(deck.subjectId && deck.subjectId !== 'general' ? subjectLabelOf(deck.subjectId) : '');
      setCover(deck.cover ?? DECK_COLORS[0]);
      setVisibility(deck.visibility ?? 'private');
    } else {
      setTitle('');
      setDescription('');
      setSubject('');
      setCover(DECK_COLORS[Math.floor(Math.random() * DECK_COLORS.length)]);
      setVisibility('private');
    }
    setError('');
  }, [open, deck]);

  const handleSave = async () => {
    if (!title.trim()) {
      setError('نام مجموعه را بنویس.');
      return;
    }
    const subjectError = textFieldError(subject);
    if (subjectError) {
      setError(subjectError);
      return;
    }
    setSaving(true);
    try {
      await onSave(deck?.id ?? null, { title, description, subjectId: subject.trim() || 'general', cover, visibility });
      onClose();
    } catch {
      setError('ذخیره نشد؛ دوباره تلاش کن.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={deck ? 'ویرایش مجموعه' : 'ساخت مجموعه'}>
      <div className="space-y-4">
        <div>
          <label htmlFor="deck-title" className="mb-2 block text-xs text-[var(--muted)]">نام مجموعه</label>
          <input
            id="deck-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="مثلاً: فیزیولوژی گوارش"
            autoFocus
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition-colors placeholder:text-[var(--ghost)] focus:border-[#5b8cc7]/50"
          />
        </div>

        <div>
          <label htmlFor="deck-desc" className="mb-2 block text-xs text-[var(--muted)]">توضیح (اختیاری)</label>
          <textarea
            id="deck-desc"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            placeholder="این مجموعه برای چیست؟"
            className="w-full resize-none rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-7 outline-none transition-colors placeholder:text-[var(--ghost)] focus:border-[#5b8cc7]/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="deck-subject" className="mb-2 block text-xs text-[var(--muted)]">موضوع</label>
            <input
              id="deck-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="مثلاً آناتومی"
              className={`w-full rounded-xl border bg-black/30 px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-[var(--ghost)] focus:border-[#5b8cc7]/50 ${
                subject && textFieldError(subject) ? 'border-[#ef9196]/60' : 'border-white/10'
              }`}
            />
            <p className="mt-1.5 text-[10px] leading-4 text-[var(--ghost)]">فقط حروف فارسی یا انگلیسی — عدد و نماد غیرعادی مجاز نیست.</p>
          </div>
          <div>
            <label htmlFor="deck-visibility" className="mb-2 block text-xs text-[var(--muted)]">دسترسی</label>
            <select
              id="deck-visibility"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value)}
              className="w-full cursor-pointer rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-[#5b8cc7]/50"
            >
              <option value="private" className="bg-[var(--surface)]">خصوصی</option>
              <option value="shared" className="bg-[var(--surface)]">اشتراکی</option>
            </select>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs text-[var(--muted)]">رنگ کاور</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="رنگ کاور مجموعه">
            {DECK_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={cover === color}
                aria-label={`رنگ ${color}`}
                onClick={() => setCover(color)}
                className={`h-8 w-8 cursor-pointer rounded-full transition-transform hover:scale-110 ${
                  cover === color ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-[#232323]' : ''
                }`}
                style={{ background: color }}
              />
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-[var(--red-ink)]" role="alert">{error}</p>}

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-xl px-5 py-2.5 text-sm text-[var(--muted)] transition-colors hover:text-white">
            انصراف
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="cursor-pointer rounded-xl bg-[var(--blue-bright)] px-6 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60 [font-family:'Doran','Vazir',Tahoma,sans-serif]"
          >
            {deck ? 'ذخیره' : 'ساخت مجموعه'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
