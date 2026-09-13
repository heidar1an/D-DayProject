/*
 * PersonalExamBuilder — ریشهٔ «آزمون‌ساز شخصی»: بین Hub (ورود/مسیر سریع) و Wizard
 * جابه‌جا می‌شود و کاتالوگ را یک‌بار برای هر دو می‌گیرد. شروع‌های آماده (preset /
 * prefill از کارنامه) به‌صورت draft اولیه وارد ویزارد می‌شوند؛ منطق انتخاب سؤال
 * در سرویس است و شروع آزمون با onLaunchExam به لایهٔ بانک تست سپرده می‌شود.
 */
import { useEffect, useState } from 'react';
import { fetchBuilderCatalog } from '../../../../services/examBuilder/examBuilderService';
import { DEFAULT_DRAFT } from './BuilderWizard';
import { useAsyncData } from '../../league/useAsyncData';
import { Skeleton } from '../bank/bankShared';
import BuilderHub from './BuilderHub';
import BuilderWizard from './BuilderWizard';
import { fetchSavedExams } from '../../../../services/examBuilder/examBuilderService';

const QUICK_DRAFT = {
  mode: 'exam',
  negativeMarking: true,
  difficulty: { mode: 'mixed', level: null, distribution: { easy: 20, medium: 55, hard: 25, very_hard: 0 } },
  statuses: { base: 'any', quotas: [] },
};

export default function PersonalExamBuilder({ userId, payload = null, onLaunchExam, onOpenMyExams }) {
  const { data: catalog, loading: catalogLoading } = useAsyncData(
    () => fetchBuilderCatalog(userId),
    [userId],
  );
  const { data: savedExams, retry: retrySaved } = useAsyncData(() => fetchSavedExams(userId), [userId]);

  const [entry, setEntry] = useState(null); // null = hub | { draft, step, note }
  const [wizardKey, setWizardKey] = useState(0);

  const enterWizard = (draft, step, note = null) => {
    setEntry({ draft, step, note });
    setWizardKey((key) => key + 1);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  /* شروع از مسیرهای بیرونی: prefill کارنامه / preset تصادفی */
  useEffect(() => {
    if (!payload) return;
    if (payload.prefill) {
      enterWizard(
        { ...DEFAULT_DRAFT, ...payload.prefill.config },
        1,
        payload.prefill.note ?? null,
      );
    } else if (payload.preset === 'random') {
      enterWizard({ ...DEFAULT_DRAFT, ...QUICK_DRAFT, subjectIds: [] }, 3);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  /* مسیر سریع — دو کلیک تا Blueprint */
  const handleQuickBuild = (patch) => {
    enterWizard(
      {
        ...DEFAULT_DRAFT,
        ...QUICK_DRAFT,
        ...patch,
        durationMinutes: patch.durationMinutes ?? DEFAULT_DRAFT.durationMinutes,
      },
      3,
    );
  };

  /* پریست هوشمند — Configuration واقعی + ویزارد از مرحلهٔ هدف */
  const handlePreset = (preset) => {
    const patch = preset.apply() ?? {};
    if (patch.purpose === 'weakness' && catalog?.weakTopics?.length) {
      patch.subjectIds = [...new Set(catalog.weakTopics.map((entry) => entry.subjectId))].slice(0, 2);
    }
    enterWizard({ ...DEFAULT_DRAFT, ...patch }, 0);
  };

  if (catalogLoading && !catalog) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <Skeleton className="h-36 rounded-[2.5rem]" />
        <Skeleton className="h-64 rounded-[2.5rem]" />
      </div>
    );
  }

  if (!entry) {
    return (
      <BuilderHub
        subjects={catalog?.subjects ?? []}
        savedExamCount={savedExams?.length ?? 0}
        onQuickBuild={handleQuickBuild}
        onPreset={handlePreset}
        onAdvanced={() => enterWizard({ ...DEFAULT_DRAFT }, 0)}
        onMyExams={onOpenMyExams}
      />
    );
  }

  return (
    <BuilderWizard
      key={wizardKey}
      userId={userId}
      catalog={catalog}
      initialDraft={entry.draft}
      initialStep={entry.step}
      prefillNote={entry.note}
      onLaunch={async (exam) => {
        retrySaved();
        await onLaunchExam(exam);
      }}
    />
  );
}
