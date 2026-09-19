/*
 * InternationalExamsLayer — پوستهٔ لایهٔ «آزمون‌های بین‌الملل».
 * نقش: روتر داخلی بین نماها (خانه، آزمون، محیط حل، نتیجه، مجموعه‌ها، آزمون‌ساز، اشتباهات)
 * و حل‌کردن دادهٔ هر گذار از طریق سرویس — هیچ نمای داخلی مستقیم به منبع داده وابسته نیست.
 *
 * جریان کاربر: خانه ← انتخاب آزمون ← محیط حل ← ثبت پاسخ ← تحلیل ← مرور/مجموعه/آزمون‌ساز.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchAttempt,
  fetchExam,
  fetchExams,
  fetchOverview,
  fetchQuestions,
  fetchQuestionPool,
  startAttempt,
} from '../../../services/international/internationalService';
import { Icon, Skeleton, toFa } from './intlShared';
import { LAYER_IDS, useLayerRoute } from '../dashboardRoute';
import './international.css';
import InternationalHome from './InternationalHome';
import ExamIntro from './ExamIntro';
import QuestionLab from './QuestionLab';
import ResultView from './ResultView';
import CollectionsView from './CollectionsView';
import ExamBuilderView from './ExamBuilderView';
import MistakesView from './MistakesView';

const HOME_VIEWS = [
  { id: 'home', label: 'نمای کلی', icon: 'globe' },
  { id: 'collections', label: 'مجموعه‌های من', icon: 'layers' },
  { id: 'builder', label: 'آزمون‌ساز', icon: 'target' },
  { id: 'mistakes', label: 'اشتباهات من', icon: 'flame' },
];

/* مرتب‌کردن سؤال‌های fetched بر اساس ترتیب واقعی Attempt */
function orderQuestionsByAttempt(fetchedQuestions, questionIds) {
  const byId = new Map(fetchedQuestions.map((question) => [question.id, question]));
  return questionIds.map((id) => byId.get(id)).filter(Boolean);
}

/* نمای آغازین لایه و نمای گذرا (محیط حل سشن در حافظه دارد و در آدرس نمی‌نشیند) */
const INT_EXAMS_VIEW = { name: 'home' };
const INT_EXAMS_VOLATILE = ['lab'];

export default function InternationalExamsLayer({ userData, onBack }) {
  const userId = userData?.id;
  /* نمای لایه روی مسیر داشبورد می‌نشیند: Back/Forward بین نماها و رفرش در همان نما */
  const [view, setView] = useLayerRoute(LAYER_IDS.intlExams, INT_EXAMS_VIEW, {
    volatile: INT_EXAMS_VOLATILE,
  });
  const [exams, setExams] = useState(null);
  const [overview, setOverview] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [examDetail, setExamDetail] = useState(null); // { exam, questions }
  const [lab, setLab] = useState(null); // { attempt, questions, exam }
  const [result, setResult] = useState(null); // { attempt, questions }
  const [busy, setBusy] = useState(false);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'instant' });

  /* داده‌های پایهٔ لایه */
  useEffect(() => {
    let alive = true;
    fetchExams().then((items) => alive && setExams(items));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchOverview(userId).then((payload) => alive && setOverview(payload));
    return () => {
      alive = false;
    };
  }, [userId, dataVersion]);

  const go = useCallback(
    (nextView) => {
      setView(nextView);
      scrollToTop();
      if (nextView.name === 'home') setDataVersion((version) => version + 1);
    },
    [setView],
  );

  /* رفرش روی صفحهٔ تحلیل یک Attempt → همان تحلیل از سرویس بازخوانی می‌شود */
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (view.name !== 'result' || !view.attemptId) return;
    openResult(view.attemptId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── باز کردن صفحهٔ آزمون ── */
  const openExam = async (examId) => {
    setBusy(true);
    const exam = await fetchExam(examId);
    const questions = await fetchQuestions({ examId });
    setExamDetail({ exam, questions });
    setBusy(false);
    go({ name: 'exam', examId });
  };

  /* ── ساخت Attempt و ورود به محیط حل (مسیر واحد همهٔ منابع) ── */
  const startLab = async (attemptConfig, { exam = null } = {}) => {
    setBusy(true);
    try {
      const attempt = await startAttempt(userId, attemptConfig);
      const fetched = await fetchQuestions({ ids: attempt.questionIds });
      const questions = orderQuestionsByAttempt(fetched, attempt.questionIds);
      setLab({ attempt, questions, exam });
      go({ name: 'lab', attemptId: attempt.id });
    } finally {
      setBusy(false);
    }
  };

  const startExamAll = (examId) => {
    const exam = exams?.find((item) => item.id === examId);
    const detail = examDetail?.exam?.id === examId ? examDetail : null;
    const questions = detail?.questions ?? [];
    startLab(
      {
        title: `${exam?.shortName ?? 'آزمون'} — تمرین آزاد`,
        source: 'exam',
        mode: 'practice',
        questionIds: questions.map((question) => question.id),
        shuffleQuestions: false,
      },
      { exam: detail?.exam ?? exam },
    );
  };

  const startExamSection = (examId, sectionId) => {
    const exam = exams?.find((item) => item.id === examId);
    const detail = examDetail?.exam?.id === examId ? examDetail : null;
    const section = detail?.exam?.sections?.find((item) => item.id === sectionId);
    const questions = (detail?.questions ?? []).filter((question) => question.sectionId === sectionId);
    startLab(
      {
        title: `${exam?.shortName ?? 'آزمون'} — ${section?.nameFa ?? sectionId}`,
        source: 'exam',
        mode: 'practice',
        questionIds: questions.map((question) => question.id),
        shuffleQuestions: false,
      },
      { exam: detail?.exam ?? exam },
    );
  };

  const practiceSingleQuestion = (examId, questionId) => {
    const exam = exams?.find((item) => item.id === examId);
    startLab(
      {
        title: `${exam?.shortName ?? 'سؤال'} — تمرین تکی`,
        source: 'exam',
        mode: 'practice',
        questionIds: [questionId],
        shuffleQuestions: false,
      },
      { exam },
    );
  };

  /* ادامهٔ آزمونِ نیمه‌کاره از خانه */
  const resumeAttempt = async (attemptId) => {
    setBusy(true);
    try {
      const attempt = await fetchAttempt(userId, attemptId);
      const fetched = await fetchQuestions({ ids: attempt.questionIds });
      const questions = orderQuestionsByAttempt(fetched, attempt.questionIds);
      const exam = exams?.find((item) => item.id === attempt.examId) ?? null;
      setLab({ attempt, questions, exam });
      go({ name: 'lab', attemptId: attempt.id });
    } finally {
      setBusy(false);
    }
  };

  /* پایان آزمون در محیط حل → صفحهٔ تحلیل */
  const finishLab = (submittedAttempt) => {
    setResult({ attempt: submittedAttempt, questions: lab?.questions ?? [] });
    setDataVersion((version) => version + 1);
    go({ name: 'result', attemptId: submittedAttempt.id });
  };

  /* ── خروج از محیط حل: آزمون نیمه‌کاره در خانه قابل ادامه است ── */
  const exitLab = () => {
    setDataVersion((version) => version + 1); // وضعیت سؤال‌ها (صحیح/غلط/گلچین) تازه شود
    if (lab?.attempt?.source === 'exam' && lab?.exam) {
      go({ name: 'exam', examId: lab.exam.id });
    } else {
      go({ name: 'home' });
    }
  };

  /* بازکردن صفحهٔ نتیجهٔ یک Attempt قبلی (مثلاً از خانه) */
  const openResult = async (attemptId) => {
    setBusy(true);
    try {
      const attempt = await fetchAttempt(userId, attemptId);
      const fetched = await fetchQuestions({ ids: attempt.questionIds });
      setResult({ attempt, questions: orderQuestionsByAttempt(fetched, attempt.questionIds) });
      go({ name: 'result', attemptId });
    } finally {
      setBusy(false);
    }
  };

  /* مرور اشتباهات (از خانه یا از صفحهٔ نتیجه) */
  const reviewMistakes = (questionIds, title = 'مرور اشتباهات') => {
    if (!questionIds?.length) return;
    startLab({
      title,
      source: 'mistakes',
      mode: 'review',
      questionIds,
      shuffleQuestions: false,
    });
  };

  /* مرور فاصله‌دار سؤال‌های سررسید */
  const startSpacedReview = (dueQuestionIds) => {
    if (!dueQuestionIds?.length) return;
    startLab({
      title: 'مرور فاصله‌دار سؤال‌ها',
      source: 'review',
      mode: 'review',
      questionIds: dueQuestionIds,
      shuffleQuestions: true,
    });
  };

  /* حل یک مجموعه به‌شکل آزمون */
  const startCollectionExam = (collection) => {
    startLab({
      title: collection.name,
      source: 'collection',
      mode: 'practice',
      questionIds: collection.questionIds,
      shuffleQuestions: false,
    });
  };

  /* ساخت آزمون از آزمون‌ساز */
  const startBuiltExam = async (config) => {
    setBusy(true);
    try {
      const pool = await fetchQuestionPool(userId, config.sources, { difficulties: config.difficulties });
      const poolIds = pool.map((question) => question.id);
      await startLab(
        {
          title: config.title,
          source: 'custom',
          mode: 'exam',
          questionIds: poolIds,
          questionCount: config.questionCount,
          durationMinutes: config.durationMinutes,
          shuffleQuestions: config.shuffleQuestions,
        },
        {},
      );
    } finally {
      setBusy(false);
    }
  };

  const activeExamDetail = view.name === 'exam' && examDetail?.exam?.id === view.examId ? examDetail : null;
  /* چیپ‌های ناوبری در هر چهار بخش خانه همیشه دیده می‌شوند تا جابه‌جایی مستقیم ممکن باشد */
  const showSubNav = ['home', 'collections', 'builder', 'mistakes'].includes(view.name);
  const backTarget = view.name === 'exam' || view.name === 'collections' || view.name === 'builder' || view.name === 'mistakes' ? 'home' : null;

  return (
    <section
      dir="rtl"
      aria-label="آزمون‌های بین‌الملل"
      className="intl-layer mx-auto w-[var(--content-width)] py-8 text-white md:py-10 [font-family:'Pinar','Vazir',Tahoma,sans-serif]"
    >
      {/* نوار بالای لایه — هم‌خانوادهٔ فلش‌کارت: بازگشت راست، اقدام چپ */}
      <div className="intl-topbar dash-stagger">
        {view.name === 'home' ? (
          <button type="button" onClick={onBack} className="intl-topbar__back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
            بازگشت به تست
          </button>
        ) : (
          <button
            type="button"
            onClick={() => (backTarget === 'home' ? go({ name: 'home' }) : onBack?.())}
            className="intl-topbar__back"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
            بازگشت
          </button>
        )}
        {view.name === 'home' && (
          <button
            type="button"
            onClick={() => exams?.[0] && openExam(exams[0].id)}
            className="intl-topbar__cta flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm transition-colors hover:border-[#937fcd]/50 hover:bg-[#937fcd]/12 [font-family:'Doran','Vazir',Tahoma,sans-serif]"
          >
            <Icon name="play" className="h-4 w-4 text-[var(--purple-soft-ink)]" />
            شروع حل سؤال
          </button>
        )}
      </div>

      {/* سربرگ وسط‌چین — همان ساختار سرتیتر فلش‌کارت */}
      <header className="intl-hero-head dash-stagger">
        <h1 className="intl-hero-head__title">
          <span className="intl-hero-head__title-top">تمرین با استانداردهای جهانی پزشکی</span>
          <span className="intl-hero-head__title-accent">آزمون‌های بین‌الملل</span>
        </h1>
        <p className="intl-hero-head__subtitle">
          سؤال‌های استاندارد جهانی را حل کن، تحلیل بگیر، اشتباه‌هات را بفهم و از دل همین سؤال‌ها برای خودت آزمون بساز.
        </p>
      </header>

      {/* ناوبری زیربخش‌های خانه — چیپ‌های هم‌شکل فلش‌کارت */}
      {showSubNav && (
        <nav className="intl-scroll-x dash-stagger mb-6 overflow-x-auto pb-2" aria-label="بخش‌های آزمون‌های بین‌الملل">
          <div className="mx-auto flex w-max gap-2.5">
            {HOME_VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={view.name === item.id ? 'page' : undefined}
                onClick={() => go({ name: item.id })}
                className={`flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2.5 text-[13px] transition-colors [font-family:'Doran','Vazir',Tahoma,sans-serif] ${
                  view.name === item.id
                    ? 'border-[#937fcd]/60 bg-[#937fcd]/15 text-white'
                    : 'border-white/8 bg-[var(--surface)] text-[var(--muted)] hover:border-white/20 hover:bg-[var(--surface-soft)] hover:text-white'
                }`}
              >
                <Icon name={item.icon} className="h-4 w-4 shrink-0 text-[var(--purple-soft-ink)]" />
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* محتوای نماها */}
      {busy ? (
        <div className="space-y-4" aria-hidden="true">
          <Skeleton className="h-40 rounded-[2.5rem]" />
          <Skeleton className="h-72 rounded-[2.5rem]" />
        </div>
      ) : view.name === 'home' ? (
        <InternationalHome
          exams={exams}
          overview={overview}
          onOpenExam={openExam}
          onResume={resumeAttempt}
          onStartReview={startSpacedReview}
          onOpenMistakes={() => go({ name: 'mistakes' })}
        />
      ) : view.name === 'exam' ? (
        <ExamIntro
          exam={activeExamDetail?.exam}
          questions={activeExamDetail?.questions ?? []}
          states={overview?.states}
          onStartAll={() => startExamAll(view.examId)}
          onStartSection={(sectionId) => startExamSection(view.examId, sectionId)}
          onPracticeQuestion={(questionId) => practiceSingleQuestion(view.examId, questionId)}
        />
      ) : view.name === 'lab' ? (
        <QuestionLab
          userData={userData}
          exam={lab?.exam}
          questions={lab?.questions ?? []}
          attempt={lab?.attempt}
          onExit={exitLab}
          onFinish={finishLab}
        />
      ) : view.name === 'result' ? (
        <ResultView
          attempt={result?.attempt}
          questions={result?.questions ?? []}
          onReviewMistakes={(ids) => reviewMistakes(ids, 'مرور اشتباهات این آزمون')}
          onNewExam={() => go({ name: 'builder' })}
          onHome={() => go({ name: 'home' })}
        />
      ) : view.name === 'collections' ? (
        <CollectionsView
          userData={userData}
          onStartCollection={startCollectionExam}
          onOpenBuilder={(collection) => go({ name: 'builder', presetCollectionId: collection.id })}
        />
      ) : view.name === 'builder' ? (
        <ExamBuilderView userData={userData} exams={exams ?? []} onStart={startBuiltExam} presetCollectionId={view.presetCollectionId} />
      ) : view.name === 'mistakes' ? (
        <MistakesView userData={userData} onStartReview={reviewMistakes} />
      ) : null}

      {/* پیشرفت کلی ریز در سربرگ لایه */}
      {view.name === 'home' && overview && (
        <p className="mt-8 text-center text-[11px] text-[var(--ghost)]">
          تا الان {toFa(overview.stats.totalAnswers)} پاسخ در آزمون‌های بین‌الملل ثبت کرده‌ای؛ ادامه بده.
        </p>
      )}
    </section>
  );
}
