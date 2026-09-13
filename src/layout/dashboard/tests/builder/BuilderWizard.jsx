/*
 * BuilderWizard — ماشین حالت ویزارد ۵ مرحله‌ای. وظیفه‌ها: نگه‌داری draft،
 * دسترس‌پذیری زندهٔ مخزن (debounce)، اجرای موتور انتخاب در مرحلهٔ Blueprint و
 * پاس‌دادن خروجی نهایی به لایهٔ بالاتر (ذخیره/شروع). منطق انتخاب سؤال در UI نیست.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildExamPlan,
  fetchAvailability,
  fetchBuilderCatalog,
  saveExam,
} from '../../../../services/examBuilder/examBuilderService';
import { useAsyncData } from '../../league/useAsyncData';
import { Skeleton } from '../bank/bankShared';
import { Stepper, WizardNav, toFa } from './builderShared';
import StepPurpose from './steps/StepPurpose';
import StepScope from './steps/StepScope';
import StepSettings from './steps/StepSettings';
import StepBlueprint from './steps/StepBlueprint';
import StepReview from './steps/StepReview';

export const DEFAULT_DRAFT = {
  purpose: 'personal',
  subjectIds: [],
  topicPaths: [],
  questionCount: 20,
  difficulty: { mode: 'mixed', level: null, distribution: { easy: 25, medium: 50, hard: 25, very_hard: 0 } },
  statuses: { base: 'any', quotas: [] },
  mode: 'exam',
  durationMode: 'suggested',
  durationMinutes: 30,
  negativeMarking: true,
  feedback: 'full',
  weaknessFocus: false,
  title: '',
  advanced: { types: [], sources: [], yearFrom: null, yearTo: null, search: '' },
};

const mergeDraft = (patch) => ({
  ...DEFAULT_DRAFT,
  ...(patch ?? {}),
  difficulty: { ...DEFAULT_DRAFT.difficulty, ...(patch?.difficulty ?? {}) },
  statuses: { ...DEFAULT_DRAFT.statuses, ...(patch?.statuses ?? {}) },
  advanced: { ...DEFAULT_DRAFT.advanced, ...(patch?.advanced ?? {}) },
});

export default function BuilderWizard({ userId, catalog: catalogProp = null, initialDraft = null, initialStep = 0, prefillNote = null, onLaunch }) {
  const [draft, setDraft] = useState(() => mergeDraft(initialDraft));
  const [step, setStep] = useState(initialStep);
  const [maxReached, setMaxReached] = useState(initialStep);
  const [planSeed, setPlanSeed] = useState(() => Math.floor(Math.random() * 2 ** 30));
  const [plan, setPlan] = useState(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState(null);
  const [availability, setAvailability] = useState(null);
  const availabilityRequestId = useRef(0);
  const [savedNote, setSavedNote] = useState(null);
  const [busy, setBusy] = useState(false);

  /* کاتالوگ معمولاً از ریشه می‌آید (یک لود مشترک)؛ اگر نبود، همین‌جا گرفته می‌شود */
  const { data: ownCatalog, loading: ownLoading } = useAsyncData(
    () => (catalogProp ? Promise.resolve(catalogProp) : fetchBuilderCatalog(userId)),
    [userId, catalogProp],
  );
  const catalog = catalogProp ?? ownCatalog;
  const catalogLoading = catalogProp ? false : ownLoading;

  const update = useCallback((patch) => {
    setDraft((prev) => mergeDraft({ ...prev, ...patch }));
    setSavedNote(null);
  }, []);

  /* ── دسترس‌پذیری زنده — فقط در مرحلهٔ تنظیمات ── */
  const scopeSignature = useMemo(
    () =>
      JSON.stringify([
        draft.subjectIds,
        draft.topicPaths,
        draft.advanced.types,
        draft.advanced.sources,
        draft.advanced.yearFrom,
        draft.advanced.yearTo,
        draft.advanced.search,
      ]),
    [draft.subjectIds, draft.topicPaths, draft.advanced],
  );

  useEffect(() => {
    if (step !== 2) return undefined;
    setAvailability(null);
    const requestId = ++availabilityRequestId.current;
    const timer = setTimeout(() => {
      fetchAvailability(userId, draft)
        .then((stats) => {
          if (availabilityRequestId.current === requestId) setAvailability(stats);
        })
        .catch(() => {
          if (availabilityRequestId.current === requestId) {
            setAvailability({ total: 0, byStatus: {}, byDifficulty: {}, bySubject: {}, avgTimeSec: null });
          }
        });
    }, 260);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, scopeSignature, userId]);

  /* ── اجرای موتور انتخاب هنگام ورود به مرحلهٔ Blueprint (و هر «ترکیب دیگر») ── */
  useEffect(() => {
    if (step !== 3) return undefined;
    let alive = true;
    setPlanBusy(true);
    setPlanError(null);
    buildExamPlan(userId, { ...draft, seed: planSeed })
      .then((nextPlan) => {
        if (!alive) return;
        setPlan(nextPlan);
        setPlanBusy(false);
      })
      .catch(() => {
        if (!alive) return;
        setPlanError('ساخت Blueprint ممکن نشد؛ دوباره تلاش کن.');
        setPlanBusy(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, planSeed, userId]);

  const reroll = () => {
    setPlan(null);
    setPlanSeed(Math.floor(Math.random() * 2 ** 30));
  };

  const goStep = (next) => {
    setStep(next);
    setMaxReached((prev) => Math.max(prev, next));
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const canLeave = (from) => {
    if (from === 1) return draft.subjectIds.length > 0;
    if (from === 2) return availability !== null && availability.total > 0;
    if (from === 3) return plan !== null && plan.target > 0;
    return true;
  };

  const nextHint =
    step === 1 && !draft.subjectIds.length
      ? 'حداقل یک درس انتخاب کن'
      : step === 2 && availability?.total === 0
        ? 'با این تنظیمات تستی در دسترس نیست'
        : step === 3 && plan?.target === 0
          ? 'هیچ سوئی انتخاب نشد — تنظیمات را تغییر بده'
          : null;

  const handleNext = () => {
    if (!canLeave(step)) return;
    goStep(step + 1);
  };

  /* زمان پیشنهادی هنگام ذخیره/شروع به config نهایی تزریق می‌شود تا سشن دقیق باشد */
  const finalConfig = () => ({
    ...draft,
    durationMinutes:
      draft.durationMode === 'suggested'
        ? (plan?.suggestedDuration ?? draft.durationMinutes)
        : draft.durationMinutes,
  });

  const handleSave = async () => {
    if (busy || !plan?.questionIds?.length) return;
    setBusy(true);
    try {
      const exam = await saveExam(userId, { config: finalConfig(), plan, title: draft.title });
      setSavedNote(`«${exam.title}» در آزمون‌های من ذخیره شد.`);
    } catch {
      setSavedNote(null);
      setPlanError('ذخیرهٔ آزمون ممکن نشد؛ دوباره تلاش کن.');
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async () => {
    if (busy || !plan?.questionIds?.length) return;
    setBusy(true);
    try {
      const exam = await saveExam(userId, { config: finalConfig(), plan, title: draft.title });
      await onLaunch(exam);
    } catch {
      setPlanError('ساخت آزمون ممکن نشد؛ دوباره تلاش کن.');
    } finally {
      setBusy(false);
    }
  };

  if (catalogLoading && !catalog) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <Skeleton className="h-16 rounded-[1.75rem]" />
        <Skeleton className="h-72 rounded-[2rem]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Stepper current={step} maxReached={maxReached} onStepClick={goStep} />

      {prefillNote && (
        <p className="flex items-start gap-2.5 rounded-2xl border border-[#e26d6d]/30 bg-[#e26d6d]/[0.07] px-4 py-3 text-[12.5px] leading-6 text-[#ef9196]">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#e26d6d]/20 text-[10px] font-bold">!</span>
          {prefillNote}
        </p>
      )}

      <div key={step} className="ex-enter">
        {step === 0 && <StepPurpose draft={draft} update={update} catalog={catalog} />}
        {step === 1 && <StepScope draft={draft} update={update} catalog={catalog} />}
        {step === 2 && <StepSettings draft={draft} update={update} availability={availability} />}
        {step === 3 && (
          <StepBlueprint plan={plan} planBusy={planBusy} planError={planError} onReroll={reroll} draft={draft} catalog={catalog} subjects={catalog?.subjects} />
        )}
        {step === 4 && (
          <StepReview draft={draft} update={update} plan={plan} planBusy={planBusy} subjects={catalog?.subjects} onSave={handleSave} onStart={handleStart} busy={busy} savedNote={savedNote} />
        )}
      </div>

      {step < 4 && (
        <WizardNav
          onBack={() => (step === 0 ? goStep(0) : goStep(step - 1))}
          onNext={handleNext}
          nextDisabled={!canLeave(step)}
          nextHint={nextHint}
          nextLabel={step === 3 ? 'مرور نهایی' : step === 2 ? 'ساخت Blueprint' : 'مرحلهٔ بعد'}
        >
          <span className="hidden text-[11px] text-[#777] sm:block">
            مرحلهٔ {toFa(step + 1)} از {toFa(5)}
          </span>
        </WizardNav>
      )}
    </div>
  );
}
