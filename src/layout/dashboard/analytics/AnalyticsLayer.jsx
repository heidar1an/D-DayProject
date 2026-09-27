/*
 * AnalyticsLayer — پوستهٔ لایهٔ «تحلیل عملکرد».
 * نقش: روتر داخلی بین نماها (خانه، درس، سؤال‌ها، آزمون‌ها، تحلیل‌های رفتاری) و
 * حل‌کردن دادهٔ هر گذار از طریق سرویس — هیچ نایی مستقیماً به منبع داده وابسته نیست.
 * Header شامل Time Range و فیلترهای چیپی است؛ همهٔ فیلترها به سرویس می‌روند و
 * تحلیل سمت سرویس از نو ساخته می‌شود (قرارداد API واقعی).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAnalyticsBundle,
  fetchExamAnalytics,
  fetchExamDetail,
  fetchQuestionAnalytics,
  TIME_RANGES,
  normalizeFilters,
} from '../../../services/analytics/analyticsService';
import {
  Icon,
  Skeleton,
  EmptyState,
  Modal,
  faNum,
} from './analyticsShared';
import './analytics.css';
import AnalyticsHome from './AnalyticsHome';
import { SubjectView, TopicView, QuestionAnalyticsModal } from './SubjectDrilldown';
import { ExamListView, ExamDetailView } from './ExamsDrilldown';
import { ErrorView, TimeView, ConfidenceView, UnansweredView, DifficultyView } from './BehaviorViews';
import { LAYER_IDS, useLayerRoute } from '../dashboardRoute';

/* نمای آغازین لایه؛ فیلترها هم روی مسیر داشبورد می‌نشینند تا رفرش همان تحلیل را برگرداند */
const DEFAULT_FILTERS = normalizeFilters({});
const ANALYTICS_VIEW = { name: 'home', payload: null, filters: null };

const BEHAVIOR_VIEWS = ['errors', 'time', 'confidence', 'unanswered', 'difficulty'];

/* قالب چیپ بازهٔ زمانی — هم‌قالب ردیف گزینه‌های «چطور می‌خواهی تست بزنی؟» بانک تست */
const RANGE_META = {
  '7d': { icon: 'clock', accent: '#61D192' },
  '30d': { icon: 'chart', accent: '#5b8cc7' },
  '90d': { icon: 'layers', accent: '#937fcd' },
  all: { icon: 'grid', accent: '#e0b45c' },
};

export default function AnalyticsLayer({ userData, onBack }) {
  const userId = userData?.id ?? userData?.phone ?? 'guest';
  const [view, , patchView] = useLayerRoute(LAYER_IDS.analytics, ANALYTICS_VIEW);
  const filters = view.filters ?? DEFAULT_FILTERS;
  const [bundle, setBundle] = useState(null);
  const [questionsData, setQuestionsData] = useState(null); /* لود تنبل — فقط برای درس/سؤال‌ها */
  const [examsData, setExamsData] = useState(null);
  const [examDetail, setExamDetail] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'instant' });

  /* دادهٔ خانه — با هر تغییر فیلتر از نو */
  useEffect(() => {
    let alive = true;
    setBundle(null);
    fetchAnalyticsBundle(userId, filters)
      .then((data) => alive && setBundle(data))
      .catch(() => alive && setBundle(null));
    return () => {
      alive = false;
    };
  }, [userId, filters]);

  const go = useCallback((name, payload = null) => {
    patchView({ name, payload });
    setToast(null);
    scrollToTop();
  }, [patchView]);

  /* اطمینان از وجود دادهٔ تنبل مورد نیاز نما */
  useEffect(() => {
    const needsQuestions = ['subject', 'topic', 'questions'].includes(view.name);
    const needsExams = ['exams'].includes(view.name);
    if (!needsQuestions && !needsExams) return undefined;
    let alive = true;
    setBusy(true);
    (async () => {
      try {
        if (needsQuestions && !questionsData) {
          const data = await fetchQuestionAnalytics(userId, filters);
          if (alive) setQuestionsData(data);
        }
        if (needsExams && !examsData) {
          const data = await fetchExamAnalytics(userId);
          if (alive) setExamsData(data);
        }
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [view.name, userId, filters, questionsData, examsData]);

  /* کارنامهٔ آزمون — هر بار ورود تازه */
  useEffect(() => {
    if (view.name !== 'exam-detail' || !view.payload?.examId) return undefined;
    let alive = true;
    setBusy(true);
    setExamDetail(null);
    fetchExamDetail(userId, view.payload.examId)
      .then((data) => alive && setExamDetail(data))
      .catch(() => alive && setExamDetail(null))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [view.name, view.payload, userId]);

  const updateFilter = (patch) => {
    patchView({ filters: normalizeFilters({ ...filters, ...patch }) });
  };

  const handleBack = () => {
    switch (view.name) {
      case 'home':
        onBack?.();
        break;
      case 'subject':
      case 'questions':
      case 'exams':
        BEHAVIOR_VIEWS.includes(view.name) ? go('home') : go('home');
        break;
      case 'topic':
        go('subject', { subjectId: view.payload?.subjectId });
        break;
      case 'exam-detail':
        go('exams');
        break;
      default:
        go('home');
    }
  };

  const showBackHome = view.name !== 'home';

  return (
    <section
      dir="rtl"
      aria-label="تحلیل عملکرد تست‌ها"
      className="mx-auto w-[var(--content-width)] py-8 text-white [font-family:'Pinar','Vazir',Tahoma,sans-serif] md:py-10"
    >
      {/* سربرگ لایه — هم‌شکل بانک تست علوم پایه: فقط دکمهٔ بازگشت، بدون متن سمت چپ */}
      <header className="an-topbar">
        <button
          type="button"
          onClick={showBackHome ? handleBack : onBack}
          aria-label={showBackHome ? 'بازگشت' : 'بازگشت به تست'}
          className="an-topbar__back"
        >
          <Icon name="back" className="h-4 w-4" />
          {showBackHome ? 'بازگشت' : 'بازگشت به تست'}
        </button>
      </header>

      {/* سرتیتر هیرو لایه — بدون کادر بالا. پیشوند `an-status-hero` عمداً جداست تا با
          `.an-hero` مرکز تحلیل پنل (که سراسری بارگذاری می‌شود) قاطی نشود. */}
      {view.name === 'home' && (
        <header className="an-status-hero dashboard-layer-reveal--down">
          <div className="an-status-hero__content">
            <h1 className="an-status-hero__title">آنالیز وضعیت</h1>
            <p className="an-status-hero__kicker">هر عدد یک سرنخ — از تست‌های تو، برای تصمیم بعدی</p>
            <p className="an-status-hero__subtitle">
              روند، نقاط قوت و نقاط ضعفت از دادهٔ واقعی تست‌هایت ساخته می‌شود؛ هیچ عددی تزئینی نیست.
            </p>
          </div>
        </header>
      )}

      {/* فیلتر بازهٔ زمانی — هم‌قالب ردیف گزینه‌های بانک تست؛ وسط‌چین */}
      <div className="mb-4">
        <div className="an-chiprow flex-wrap justify-center" role="group" aria-label="بازهٔ زمانی">
          {TIME_RANGES.map((range) => {
            const active = filters.range === range.key;
            const meta = RANGE_META[range.key] ?? { icon: 'clock', accent: '#61D192' };
            return (
              <button
                key={range.key}
                type="button"
                aria-pressed={active}
                onClick={() => updateFilter({ range: range.key })}
                className={`flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2.5 text-[13px] transition-colors ${
                  active
                    ? 'text-white'
                    : 'border-white/8 bg-[var(--surface)] text-[var(--muted)] hover:border-white/20 hover:bg-[var(--surface-soft)] hover:text-white'
                }`}
                style={active ? { borderColor: 'rgba(97, 209, 146, 0.5)', background: 'rgba(97, 209, 146, 0.12)' } : undefined}
              >
                <Icon name={meta.icon} className="h-4 w-4 shrink-0" style={{ color: meta.accent }} />
                {range.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* لودینگ */}
      {(busy || (!bundle && view.name !== 'exam-detail')) && (
        <div className="space-y-4" aria-hidden="true">
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-52 rounded-3xl" />
            <Skeleton className="h-52 rounded-3xl" />
          </div>
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-48 rounded-3xl" />
        </div>
      )}

      {/* نماها */}
      {!busy && view.name === 'home' && (
        <AnalyticsHome data={bundle} onNavigate={go} onOpenExam={(examId) => go('exam-detail', { examId })} />
      )}

      {!busy && view.name === 'subject' && bundle && (
        <SubjectView
          subjectData={{ subjects: bundle.subjects }}
          topics={bundle.topics}
          subjectId={view.payload?.subjectId}
          onBack={() => go('home')}
          onOpenTopic={(topic) => go('topic', { ...topic, subjectId: topic.subjectId })}
        />
      )}

      {!busy && view.name === 'topic' && questionsData && view.payload && (
        <TopicView
          topic={questionsData.topics?.find((topic) => topic.key === view.payload.key) ?? view.payload}
          questions={questionsData.questions.filter((question) => question.topicPath.join(' › ') === view.payload.key)}
          onOpenQuestion={setSelectedQuestion}
          onBack={() => go('subject', { subjectId: view.payload.subjectId })}
          onStartPractice={(topic) => setToast('تمرین هدفمند این مبحث در بانک تست قابل اجراست؛ این دکمه در نسخهٔ کامل مستقیم سشن می‌سازد.')}
        />
      )}

      {!busy && view.name === 'questions' && questionsData && (
        <QuestionsView questions={questionsData.questions} onOpenQuestion={setSelectedQuestion} onBack={() => go('home')} />
      )}

      {!busy && view.name === 'exams' && (
        <ExamListView exams={examsData?.exams ?? bundle?.exams ?? []} onOpenExam={(examId) => go('exam-detail', { examId })} onBack={() => go('home')} />
      )}

      {!busy && view.name === 'exam-detail' && examDetail && (
        <ExamDetailView detail={examDetail} onBack={() => go('exams')} onOpenQuestion={setSelectedQuestion} />
      )}

      {!busy && view.name === 'exam-detail' && !examDetail && (
        <EmptyState icon="alert" title="کارنامهٔ این آزمون پیدا نشد" note="شاید در این بازه فیلتر شده باشد." action={<button type="button" onClick={() => go('exams')} className="mt-3 cursor-pointer rounded-xl bg-[var(--green-vivid)] px-5 py-2.5 text-sm font-bold text-[#12271a]">بازگشت به آزمون‌ها</button>} />
      )}

      {!busy && BEHAVIOR_VIEWS.includes(view.name) && bundle && (
        <div className="dashboard-layer-reveal">
          {view.name === 'errors' && <ErrorView errors={bundle.errors} patterns={bundle.patterns} />}
          {view.name === 'time' && <TimeView time={bundle.time} />}
          {view.name === 'confidence' && <ConfidenceView confidence={bundle.confidence} />}
          {view.name === 'unanswered' && <UnansweredView unanswered={bundle.unanswered} />}
          {view.name === 'difficulty' && <DifficultyView difficulty={bundle.difficulty} />}
        </div>
      )}

      {/* مودال تحلیل سؤال */}
      <QuestionAnalyticsModal question={selectedQuestion} onClose={() => setSelectedQuestion(null)} />

      {/* توست اطلاع‌رسانی اقدام‌های بین‌بخشی */}
      {toast && (
        <div className="an-fade fixed bottom-6 left-1/2 z-[96] -translate-x-1/2 rounded-2xl border border-white/10 bg-[var(--surface-soft)] px-5 py-3 text-[12.5px] text-[var(--muted)] shadow-2xl" role="status">
          {toast}
          <button type="button" onClick={() => setToast(null)} className="mr-3 cursor-pointer text-[var(--faint)] transition-colors hover:text-white" aria-label="بستن">
            <Icon name="x" className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </section>
  );
}

/* ─────────────── نمای سراسری سؤال‌ها (Question Analysis) ─────────────── */

function QuestionsView({ questions, onOpenQuestion, onBack }) {
  const [sort, setSort] = useState('wrong');
  const sorted = useMemo(() => {
    const list = [...questions];
    if (sort === 'wrong') return list.sort((a, b) => b.wrongCount - a.wrongCount || b.attemptCount - a.attemptCount);
    if (sort === 'slow') return list.sort((a, b) => (b.averageTime ?? 0) - (a.averageTime ?? 0));
    if (sort === 'repeated') return list.sort((a, b) => b.attemptCount - a.attemptCount);
    return list.sort((a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100));
  }, [questions, sort]);

  const struggling = questions.filter((question) => question.wrongCount >= 2 || (question.attemptCount >= 2 && question.accuracy !== null && question.accuracy < 50));

  return (
    <div className="space-y-5">
      <Card
        title="سؤال‌هایی که بیشترین مشکل را برایت ایجاد کرده‌اند"
        icon="alert"
        hint="چند بار اشتباه، شک، زمان بالا یا دقت پایین — این‌ها اولویت مرور نقطه‌ای‌اند"
        action={onBack && <BackButton onClick={onBack} label="بازگشت" />}
        className="dashboard-layer-reveal"
      >
        {struggling.length === 0 ? (
          <p className="text-[12.5px] text-[var(--faint)]">الگوی مشکل تکرارشونده پیدا نشد — وضعیت سؤال‌هایت سالم است.</p>
        ) : (
          <div className="space-y-2.5">
            {struggling.slice(0, 8).map((question) => (
              <button
                key={question.questionId}
                type="button"
                onClick={() => onOpenQuestion?.(question)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/8 bg-[var(--surface-soft)] p-3.5 text-right transition-colors hover:border-white/20 focus-visible:outline-2 focus-visible:outline-[var(--green-vivid)]"
              >
                <div className="min-w-0">
                  <h3 className="truncate text-[12.5px]">{question.timeline[0]?.stem ?? 'سؤال بانک تست'}</h3>
                  <p className="mt-0.5 text-[11px] text-[var(--faint)]">
                    {question.topicPath.join(' › ')} · {faNum(question.attemptCount)} تلاش · {faNum(question.wrongCount)} غلط
                    {question.errorTypes.length ? ` · ${question.errorTypes.map((type) => ({ KNOWLEDGE_GAP: 'خلأ دانشی', MEMORY_FAILURE: 'یادآوری ناموفق', CARELESS_MISTAKE: 'بی‌دقتی', UNCERTAIN_GUESS: 'حدس' })[type] ?? 'خطای دیگر').join('، ')}` : ''}
                  </p>
                </div>
                <Icon name="chevronLeft" className="h-4 w-4 shrink-0 text-[var(--ghost)]" />
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="همهٔ سؤال‌های حل‌شده"
        icon="card"
        action={
          <div className="an-chiprow" role="group" aria-label="مرتب‌سازی">
            {[
              { key: 'wrong', label: 'بیشترین غلط' },
              { key: 'accuracy', label: 'کم‌دقت‌ترین' },
              { key: 'slow', label: 'زمان‌گیرترین' },
              { key: 'repeated', label: 'بیشترین تلاش' },
            ].map((option) => (
              <FilterChip key={option.key} active={sort === option.key} onClick={() => setSort(option.key)}>
                {option.label}
              </FilterChip>
            ))}
          </div>
        }
        className="dashboard-layer-reveal"
      >
        <div className="overflow-x-auto">
          <table className="an-qtable min-w-[640px]">
            <thead>
              <tr>
                <th>سؤال</th>
                <th>درس / مبحث</th>
                <th>تلاش</th>
                <th>دقت</th>
                <th>زمان</th>
                <th>آخرین</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 40).map((question) => (
                <tr key={question.questionId} tabIndex={0} onClick={() => onOpenQuestion?.(question)} onKeyDown={(event) => event.key === 'Enter' && onOpenQuestion?.(question)}>
                  <td data-label="سؤال"><span className="line-clamp-1 max-w-[300px]">{question.timeline[0]?.stem ?? '—'}</span></td>
                  <td data-label="درس/مبحث"><span className="max-w-[180px] truncate text-[var(--muted)]">{question.topicPath.join(' › ')}</span></td>
                  <td data-label="تلاش">{faNum(question.attemptCount)}</td>
                  <td data-label="دقت"><strong style={{ color: (question.accuracy ?? 0) >= 70 ? '#61D192' : (question.accuracy ?? 0) >= 50 ? '#e0b45c' : '#e26d6d' }}>{question.accuracy === null ? '—' : `${faNum(Math.round(question.accuracy))}٪`}</strong></td>
                  <td data-label="زمان">{question.averageTime ? `${faNum(question.averageTime)} ثانیه` : '—'}</td>
                  <td data-label="آخرین">
                    <span className="an-status" style={{ background: question.lastCorrect ? 'rgba(97,209,146,0.13)' : 'rgba(226,109,109,0.12)', color: question.lastCorrect ? '#61D192' : '#e26d6d' }}>
                      {question.lastCorrect ? 'درست' : 'غلط'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function BackButton({ onClick, label = 'بازگشت' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--surface-soft)] px-3.5 py-2.5 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-strong)] hover:text-white focus-visible:outline-2 focus-visible:outline-[var(--green-vivid)]"
    >
      <Icon name="back" className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
