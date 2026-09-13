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
  MODE_FILTERS,
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

const VIEW_LABELS = {
  home: 'تحلیل عملکرد',
  subject: 'تحلیل درس',
  topic: 'تحلیل مبحث',
  questions: 'تحلیل سؤال‌ها',
  exams: 'تحلیل آزمون‌ها',
  'exam-detail': 'کارنامهٔ آزمون',
  errors: 'تحلیل نوع خطا',
  time: 'تحلیل زمان',
  confidence: 'اطمینان در برابر دقت',
  unanswered: 'تحلیل بی‌پاسخ‌ها',
  difficulty: 'تحلیل دشواری',
};

const BEHAVIOR_VIEWS = ['errors', 'time', 'confidence', 'unanswered', 'difficulty'];

export default function AnalyticsLayer({ userData, onBack }) {
  const userId = userData?.id ?? userData?.phone ?? 'guest';
  const [view, setView] = useState({ name: 'home', payload: null });
  const [filters, setFilters] = useState(() => normalizeFilters({}));
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
    setView({ name, payload });
    setToast(null);
    scrollToTop();
  }, []);

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
    setFilters((current) => normalizeFilters({ ...current, ...patch }));
  };

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (filters.mode !== 'all') chips.push({ key: 'mode', label: MODE_FILTERS.find((mode) => mode.key === filters.mode)?.label, reset: { mode: 'all' } });
    filters.subjectIds.forEach((subjectId) => {
      const subject = bundle?.subjects.find((item) => item.subjectId === subjectId);
      chips.push({ key: `subject-${subjectId}`, label: subject?.name ?? subjectId, reset: { subjectIds: filters.subjectIds.filter((id) => id !== subjectId) } });
    });
    return chips;
  }, [filters, bundle]);

  const runRecommendation = (recommendation) => {
    if (recommendation.target === 'practice' && recommendation.payload?.subjectId) {
      go('subject', { subjectId: recommendation.payload.subjectId });
      return;
    }
    if (recommendation.target === 'lesson' && recommendation.payload?.subjectId) {
      go('subject', { subjectId: recommendation.payload.subjectId });
      return;
    }
    setToast('این اقدام در نسخهٔ کامل به بخش مربوطهٔ تپش وصل می‌شود؛ اینجا مسیرش را می‌بینی.');
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
      className="mx-auto w-[var(--content-width)] py-8 text-white [font-family:'Pinar',Tahoma,sans-serif] md:py-10"
    >
      {/* سربرگ لایه */}
      <header className="mb-6 flex items-center justify-between gap-3">
        {showBackHome ? (
          <button
            type="button"
            onClick={handleBack}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#282828] px-3.5 py-2.5 text-xs text-[#aaa] transition-colors hover:bg-[#333] hover:text-white"
          >
            <Icon name="back" className="h-3.5 w-3.5" />
            بازگشت
          </button>
        ) : (
          <button
            type="button"
            onClick={onBack}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#282828] px-3.5 py-2.5 text-xs text-[#aaa] transition-colors hover:bg-[#333] hover:text-white"
          >
            <Icon name="back" className="h-3.5 w-3.5" />
            بازگشت به تست
          </button>
        )}
        <span className="flex items-center gap-1.5 text-xs text-[#8a8a8a]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#61D192]" aria-hidden="true" />
          {VIEW_LABELS[view.name] ?? 'تحلیل عملکرد'}
        </span>
      </header>

      {/* عنوان صفحه (فقط خانه) */}
      {view.name === 'home' && (
        <div className="mb-5 dashboard-layer-reveal--down">
          <h1 className="text-2xl font-extrabold [font-family:'Doran',Tahoma,sans-serif] md:text-3xl">تحلیل عملکرد تست‌ها</h1>
          <p className="mt-2 text-[13px] leading-6 text-[#9a9a9a]">
            تست‌هایت را فقط بررسی نکن؛ از آن‌ها برای شناخت بهتر مسیر یادگیری‌ات استفاده کن.
          </p>
        </div>
      )}

      {/* فیلترها — در تمام نماها پایدار */}
      <div className="mb-6 space-y-2.5">
        <div className="an-chiprow" role="group" aria-label="بازهٔ زمانی">
          {TIME_RANGES.map((range) => (
            <button
              key={range.key}
              type="button"
              aria-pressed={filters.range === range.key}
              onClick={() => updateFilter({ range: range.key })}
              className={`an-chip ${filters.range === range.key ? 'an-chip--on' : ''}`}
            >
              {range.label}
            </button>
          ))}
        </div>
        <div className="an-chiprow" role="group" aria-label="نوع تست">
          {MODE_FILTERS.map((mode) => (
            <button
              key={mode.key}
              type="button"
              aria-pressed={filters.mode === mode.key}
              onClick={() => updateFilter({ mode: mode.key })}
              className={`an-chip ${filters.mode === mode.key ? 'an-chip--on' : ''}`}
            >
              {mode.label}
            </button>
          ))}
          {(bundle?.subjects ?? []).map((subject) => {
            const active = filters.subjectIds.includes(subject.subjectId);
            return (
              <button
                key={subject.subjectId}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  updateFilter({
                    subjectIds: active
                      ? filters.subjectIds.filter((id) => id !== subject.subjectId)
                      : [...filters.subjectIds, subject.subjectId],
                  })
                }
                className={`an-chip ${active ? 'an-chip--on' : ''}`}
                style={active ? { borderColor: `${subject.accent}80`, color: subject.accent, background: `${subject.accent}14` } : undefined}
              >
                {subject.name}
              </button>
            );
          })}
          {activeFilterChips.length > 1 && (
            <button type="button" onClick={() => setFilters(normalizeFilters({}))} className="an-chip text-[#e26d6d]">
              پاک کردن همه
            </button>
          )}
        </div>
      </div>

      {/* لودینگ */}
      {(busy || (!bundle && view.name !== 'exam-detail')) && (
        <div className="space-y-4" aria-hidden="true">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[...Array(5)].map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-[2rem]" />
          <Skeleton className="h-52 rounded-[2rem]" />
        </div>
      )}

      {/* نماها */}
      {!busy && view.name === 'home' && (
        <AnalyticsHome data={bundle} onNavigate={go} onRunRecommendation={runRecommendation} onOpenExam={(examId) => go('exam-detail', { examId })} />
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
        <EmptyState icon="alert" title="کارنامهٔ این آزمون پیدا نشد" note="شاید در این بازه فیلتر شده باشد." action={<button type="button" onClick={() => go('exams')} className="mt-3 cursor-pointer rounded-xl bg-[#61D192] px-5 py-2.5 text-sm font-bold text-[#12271a]">بازگشت به آزمون‌ها</button>} />
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
        <div className="an-fade fixed bottom-6 left-1/2 z-[96] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#2a2a2d] px-5 py-3 text-[12.5px] text-[#ddd] shadow-2xl" role="status">
          {toast}
          <button type="button" onClick={() => setToast(null)} className="mr-3 cursor-pointer text-[#777] transition-colors hover:text-white" aria-label="بستن">
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
          <p className="text-[12.5px] text-[#8a8a8a]">الگوی مشکل تکرارشونده پیدا نشد — وضعیت سؤال‌هایت سالم است.</p>
        ) : (
          <div className="space-y-2.5">
            {struggling.slice(0, 8).map((question) => (
              <button
                key={question.questionId}
                type="button"
                onClick={() => onOpenQuestion?.(question)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/8 bg-[#2a2a2d] p-3.5 text-right transition-colors hover:border-white/20 focus-visible:outline-2 focus-visible:outline-[#61D192]"
              >
                <div className="min-w-0">
                  <h3 className="truncate text-[12.5px]">{question.timeline[0]?.stem ?? 'سؤال بانک تست'}</h3>
                  <p className="mt-0.5 text-[11px] text-[#777]">
                    {question.topicPath.join(' › ')} · {faNum(question.attemptCount)} تلاش · {faNum(question.wrongCount)} غلط
                    {question.errorTypes.length ? ` · ${question.errorTypes.map((type) => ({ KNOWLEDGE_GAP: 'خلأ دانشی', MEMORY_FAILURE: 'یادآوری ناموفق', CARELESS_MISTAKE: 'بی‌دقتی', UNCERTAIN_GUESS: 'حدس' })[type] ?? 'خطای دیگر').join('، ')}` : ''}
                  </p>
                </div>
                <Icon name="chevronLeft" className="h-4 w-4 shrink-0 text-[#555]" />
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
                  <td data-label="درس/مبحث"><span className="max-w-[180px] truncate text-[#aaa]">{question.topicPath.join(' › ')}</span></td>
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
      className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#282828] px-3.5 py-2.5 text-xs text-[#aaa] transition-colors hover:bg-[#333] hover:text-white focus-visible:outline-2 focus-visible:outline-[#61D192]"
    >
      <Icon name="back" className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
