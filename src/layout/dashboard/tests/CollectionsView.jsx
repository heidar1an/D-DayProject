/*
 * مجموعه‌های شخصی سؤال (Collections) — جایی که گلچین‌ها سازمان می‌گیرند.
 * ساخت، حذف، دیدن سؤال‌های داخل مجموعه و حل مستقیم یک مجموعه به‌شکل آزمون.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  createCollection,
  deleteCollection,
  fetchCollections,
  removeFromCollection,
} from '../../../services/international/internationalService';
import {
  DifficultyBadge,
  EmptyState,
  faNum,
  Icon,
  SampleTag,
  Skeleton,
  toFa,
} from './intlShared';

const relativeTime = (timestamp) => {
  const days = Math.floor((Date.now() - timestamp) / 86400000);
  if (days < 1) return 'امروز';
  if (days === 1) return 'دیروز';
  if (days < 30) return `${toFa(days)} روز پیش`;
  return `${toFa(Math.floor(days / 30))} ماه پیش`;
};

/* فرم ساخت مجموعهٔ جدید */
function CreateCollectionForm({ userId, onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    const collection = await createCollection(userId, { name, description });
    setSaving(false);
    onCreated(collection);
  };

  return (
    <form
      className="intl-reveal rounded-[2rem] border border-[#937fcd]/30 bg-[#937fcd]/[0.06] p-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <h3 className="flex items-center gap-2 text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]">
        <Icon name="plus" className="h-4 w-4 text-[var(--purple-soft-ink)]" />
        ساخت مجموعهٔ جدید
      </h3>
      <div className="mt-4 space-y-3">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="نام مجموعه؛ مثلاً «اشتباهات فیزیولوژی»"
          autoFocus
          maxLength={60}
          className="w-full rounded-xl border border-white/8 bg-[var(--surface-soft)] px-3.5 py-2.5 text-sm text-white placeholder:text-[var(--ghost)] focus:border-[#937fcd]/60 focus:outline-none"
        />
        <input
          type="text"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="توضیح کوتاه (اختیاری)"
          maxLength={120}
          className="w-full rounded-xl border border-white/8 bg-[var(--surface-soft)] px-3.5 py-2.5 text-xs text-white placeholder:text-[var(--ghost)] focus:border-[#937fcd]/60 focus:outline-none"
        />
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="cursor-pointer rounded-xl bg-[var(--purple-bright)] px-5 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5 disabled:cursor-default disabled:opacity-50"
        >
          {saving ? 'در حال ساخت…' : 'ساخت مجموعه'}
        </button>
        <button type="button" onClick={onCancel} className="cursor-pointer rounded-xl bg-white/8 px-4 py-2.5 text-sm transition-colors hover:bg-white/12">
          انصراف
        </button>
      </div>
    </form>
  );
}

/* جزئیات یک مجموعه */
function CollectionDetail({ userId, collection, onBack, onRefresh, onStart, onOpenBuilder }) {
  const [removingId, setRemovingId] = useState(null);

  const handleRemove = async (questionId) => {
    setRemovingId(questionId);
    await removeFromCollection(userId, collection.id, questionId);
    setRemovingId(null);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-white/8 bg-[var(--surface-soft)] p-5">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#937fcd]/15 text-[var(--purple-soft-ink)]">
            <Icon name="layers" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base [font-family:'Doran','Vazir',Tahoma,sans-serif]">{collection.name}</h2>
            <p className="text-[11px] text-[var(--faint)]">
              {faNum(collection.questionIds.length)} سؤال · ساخته‌شده {relativeTime(collection.createdAt)}
            </p>
            {collection.description && <p className="mt-0.5 truncate text-xs text-[var(--faint)]">{collection.description}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onStart(collection)}
            disabled={collection.questionIds.length === 0}
            className="cursor-pointer rounded-xl bg-[var(--purple-bright)] px-4 py-2.5 text-xs font-bold transition-transform hover:-translate-y-0.5 disabled:opacity-40"
          >
            حل این مجموعه
          </button>
          <button
            type="button"
            onClick={() => onOpenBuilder(collection)}
            disabled={collection.questionIds.length === 0}
            className="cursor-pointer rounded-xl bg-white/8 px-4 py-2.5 text-xs transition-colors hover:bg-white/12 disabled:opacity-40"
          >
            آزمون‌ساز
          </button>
          <button type="button" onClick={onBack} className="cursor-pointer rounded-xl bg-white/8 px-4 py-2.5 text-xs transition-colors hover:bg-white/12">
            بازگشت
          </button>
        </div>
      </div>

      {collection.questionIds.length === 0 ? (
        <EmptyState
          icon="layers"
          title="این مجموعه خالی است"
          note="حین حل سؤال، دکمهٔ «افزودن به مجموعه» را بزن تا سؤال‌های مهم‌ات اینجا جمع شوند."
        />
      ) : (
        <ul className="space-y-2.5">
          {collection.questions.map((question, index) => (
            <li key={question.id} className="flex items-start gap-3 rounded-2xl border border-white/6 bg-[var(--surface-soft)] px-4 py-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-xs text-[var(--muted)]">
                {toFa(index + 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[13.5px] leading-6 text-[var(--white)]" dir="ltr">
                  {question.stem}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <DifficultyBadge difficulty={question.difficulty} />
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[var(--faint)]">{question.topic.fa}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(question.id)}
                disabled={removingId === question.id}
                aria-label={`حذف سؤال ${toFa(index + 1)} از مجموعه`}
                className="shrink-0 cursor-pointer rounded-lg p-2 text-[var(--faint)] transition-colors hover:bg-[#e26d6d]/15 hover:text-[var(--red-ink)]"
              >
                <Icon name="trash" className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ══════════════════════════ Collections View ══════════════════════════ */
export default function CollectionsView({ userData, onStartCollection, onOpenBuilder }) {
  const [collections, setCollections] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const refresh = useCallback(() => {
    fetchCollections(userData?.id).then(setCollections);
  }, [userData?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selected = collections?.find((collection) => collection.id === selectedId);

  if (!collections) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        <Skeleton className="h-36 rounded-[2rem]" />
        <Skeleton className="h-36 rounded-[2rem]" />
        <Skeleton className="h-36 rounded-[2rem]" />
      </div>
    );
  }

  if (selected) {
    return (
      <CollectionDetail
        userId={userData?.id}
        collection={selected}
        onBack={() => setSelectedId(null)}
        onRefresh={refresh}
        onStart={onStartCollection}
        onOpenBuilder={onOpenBuilder}
      />
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">مجموعه‌های من</h2>
          <p className="mt-1 text-xs text-[var(--faint)]">سؤال‌های گلچین‌شده‌ات را دسته‌بندی کن و از دلشان آزمون بساز.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--purple-bright)] px-4 py-2.5 text-xs font-bold transition-transform hover:-translate-y-0.5"
        >
          <Icon name="plus" className="h-4 w-4" />
          ساخت مجموعهٔ جدید
        </button>
      </header>

      {creating && <CreateCollectionForm userId={userData?.id} onCreated={() => { setCreating(false); refresh(); }} onCancel={() => setCreating(false)} />}

      {collections.length === 0 ? (
        <EmptyState
          icon="layers"
          title="هنوز مجموعه‌ای نداری"
          note="مجموعه مثل پوشهٔ شخصی توست: «اشتباهات من»، «سؤالات طلایی»، «مرور سریع قلب»… هر جور که درس می‌خوانی."
          action={
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-3 cursor-pointer rounded-xl bg-[var(--purple-bright)] px-5 py-2.5 text-sm font-bold"
            >
              اولین مجموعه را بساز
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className={`group flex flex-col rounded-[2rem] border border-white/8 bg-[var(--surface-soft)] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 ${
                deletingId === collection.id ? 'opacity-40' : ''
              }`}
            >
              <button type="button" onClick={() => setSelectedId(collection.id)} className="cursor-pointer text-right">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#937fcd]/15 text-[var(--purple-soft-ink)]">
                  <Icon name="layers" className="h-5 w-5" />
                </span>
                <strong className="mt-3.5 block text-base [font-family:'Doran','Vazir',Tahoma,sans-serif]">{collection.name}</strong>
                {collection.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--faint)]">{collection.description}</p>}
                <p className="mt-2.5 text-[11px] text-[var(--faint)]">
                  {faNum(collection.questionIds.length)} سؤال · {relativeTime(collection.createdAt)}
                </p>
              </button>
              <div className="mt-4 flex items-center justify-between border-t border-white/6 pt-3.5">
                <button
                  type="button"
                  onClick={() => onStartCollection(collection)}
                  disabled={collection.questionIds.length === 0}
                  className="cursor-pointer rounded-lg bg-[#937fcd]/15 px-3 py-1.5 text-xs text-[var(--purple-soft-ink)] transition-colors hover:bg-[#937fcd]/25 disabled:opacity-40"
                >
                  شروع حل سؤال
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setDeletingId(collection.id);
                    await deleteCollection(userData?.id, collection.id);
                    setDeletingId(null);
                    refresh();
                  }}
                  aria-label={`حذف مجموعه ${collection.name}`}
                  className="cursor-pointer rounded-lg p-2 text-[var(--faint)] transition-colors hover:bg-[#e26d6d]/15 hover:text-[var(--red-ink)]"
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="flex items-center gap-2 rounded-2xl bg-white/[0.03] px-4 py-3 text-[11px] leading-5 text-[var(--faint)]">
        <Icon name="spark" className="h-3.5 w-3.5 shrink-0" />
        سؤال‌های گلچین‌شده ولی بدون مجموعه در «آزمون‌ساز» هم قابل استفاده‌اند.
        <SampleTag className="hidden sm:inline-flex" />
      </p>
    </div>
  );
}
