/*
 * TestBankLayer — پوستهٔ لایهٔ «بانک تست علوم پایه».
 * نقش: روتر داخلی بین نماها (خانه، انتخاب درس، سال‌به‌سال، مبحثی، کاوشگر، آزمون‌ساز
 * شخصی، آزمون‌های من، تاریخچه، محیط حل، کارنامه) و حل‌کردن دادهٔ هر گذار از طریق
 * سرویس — هیچ نایی مستقیماً به منبع داده وابسته نیست؛ حلّهٔ سؤال همیشه سمت سرویس
 * ساخته می‌شود.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  createSession,
  fetchBankOverview,
  fetchReviewSession,
  fetchSession,
  fetchSessionQuestions,
  normalizeFilters,
  trackEvent,
} from '../../../../services/testBank/testBankService';
import {
  buildExamPlan,
  buildSessionConfigFromExam,
  fetchExam,
  prefillFromSession,
  recordAttempt,
  saveExam,
} from '../../../../services/examBuilder/examBuilderService';
import { Icon, Skeleton, EmptyState, faNum, toFa } from './bankShared';
import './bank.css';
import BankHome, { SubjectPicker } from './BankHome';
import BankYears from './BankYears';
import BankTopics from './BankTopics';
import BankExplorer from './BankExplorer';
import BankHistory from './BankHistory';
import BankSession from './BankSession';
import BankResult from './BankResult';
import PersonalExamBuilder from '../builder/PersonalExamBuilder';
import SavedExamsView from '../builder/SavedExamsView';

const VIEW_LABELS = {
  home: 'خانهٔ بانک تست',
  subjects: 'بر اساس درس',
  years: 'آزمون‌های سال به سال',
  topics: 'تست مبحثی',
  browse: 'کاوشگر بانک تست',
  builder: 'آزمون‌ساز شخصی',
  'my-exams': 'آزمون‌های من',
  history: 'تاریخچه',
  live: 'محیط حل',
  result: 'کارنامه',
};

const STATUS_LABELS = {
  unsolved: 'حل‌نشده',
  solved: 'حل‌شده',
  wrong: 'غلط‌زده',
  weak: 'دقت پایین',
  bookmarked: 'نشان‌شده',
  review: 'نیاز به مرور',
};

const DIFF_LABELS = { easy: 'آسان', medium: 'متوسط', hard: 'سخت', very_hard: 'بسیار سخت' };

/* خلاصهٔ متنی فیلتر برای زیرعنوان سشن */
function summarizeFilters(filters) {
  const f = normalizeFilters(filters);
  const parts = [];
  if (f.subjectIds.length) parts.push(f.subjectIds.length <= 3 ? f.subjectIds.join('، ') : `${toFa(f.subjectIds.length)} درس`);
  if (f.topicPaths.length) parts.push(f.topicPaths.join(' › '));
  if (f.yearFrom || f.yearTo) parts.push(`سال ${f.yearFrom ?? '…'} تا ${f.yearTo ?? '…'}`);
  if (f.difficulties.length) parts.push(f.difficulties.map((level) => DIFF_LABELS[level]).join('، '));
  if (f.status) parts.push(STATUS_LABELS[f.status]);
  if (f.search) parts.push(`«${f.search}»`);
  return parts.join(' · ');
}

export default function TestBankLayer({ userData, initialView = null, onBack }) {
  const userId = userData?.id ?? userData?.phone ?? 'guest';
  const [view, setView] = useState(() => ({ name: initialView ?? 'home', payload: initialView === 'builder' ? { preset: null } : null }));
  const [returnView, setReturnView] = useState(null); // مقصد بازگشت پس از خروج از محیط حل
  const [overview, setOverview] = useState(null);
  const [room, setRoom] = useState(null); // { session, questions }
  const [resultSession, setResultSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'instant' });

  const refreshOverview = useCallback(() => {
    let alive = true;
    fetchBankOverview(userId)
      .then((data) => alive && setOverview(data))
      .catch(() => alive && setOverview(null));
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => refreshOverview(), [refreshOverview]);

  const go = useCallback((nextView, payload = null) => {
    setView({ name: nextView, payload });
    setError(null);
    scrollToTop();
  }, []);

  /* ── شروع تمرین/آزمون — حلّهٔ سؤال سمت سرویس ساخته می‌شود ── */
  const launchSession = async (config, { originView }) => {
    setBusy(true);
    setError(null);
    try {
      const session = await createSession(userId, config);
      const questions = await fetchSessionQuestions(session);
      setReturnView(originView);
      setRoom({ session, questions });
      go('live');
    } catch (serviceError) {
      setError(
        serviceError?.message === 'no-questions-matched'
          ? 'سؤالی با این تنظیمات پیدا نشد؛ تنظیمات را تغییر بده.'
          : 'شروع سشن ممکن نشد؛ دوباره تلاش کن.',
      );
    } finally {
      setBusy(false);
    }
  };

  /* تمرین از کاوشگر (فیلترها) یا تک‌سؤال */
  const startPractice = (payload, originView) => {
    const filters = payload?.filters ? normalizeFilters(payload.filters) : null;
    return launchSession(
      {
        mode: 'practice',
        title: payload?.singleQuestion ? 'حل تک‌سؤال' : 'تمرین بانک تست',
        subtitle: payload?.singleQuestion ? '' : summarizeFilters(filters ?? {}),
        filters,
        questionIds: payload?.singleQuestion ? [payload.singleQuestion] : null,
      },
      { originView },
    );
  };

  /* آزمون از کاوشگر / سازنده / تصادفی */
  const startExam = (payload, originView) => {
    return launchSession(
      {
        mode: 'exam',
        title: payload?.title ?? 'آزمون شخصی',
        subtitle: payload?.subtitle ?? '',
        filters: payload?.filters ? normalizeFilters(payload.filters) : null,
        count: payload?.count ?? null,
        durationMinutes: payload?.durationMinutes ?? null,
        negativeMarking: payload?.negativeMarking ?? 0,
      },
      { originView },
    );
  };

  /* ── شروع Attempt یک آزمون ذخیره‌شدهٔ آزمون‌ساز شخصی (snapshot سؤال‌های خودش) ──
     ورودی ممکن است خلاصهٔ فهرست «آزمون‌های من» باشد؛ رکورد کامل واکشی می‌شود. */
  const launchPersonalExam = async (examRef) => {
    setBusy(true);
    setError(null);
    try {
      const exam = examRef?.questionIds ? examRef : await fetchExam(userId, examRef.id);
      const config = buildSessionConfigFromExam(exam);
      const session = await createSession(userId, config);
      const questions = await fetchSessionQuestions(session);
      setReturnView({ name: 'builder' });
      setRoom({ session, questions });
      go('live');
    } catch {
      setError('شروع آزمون ممکن نشد؛ دوباره تلاش کن.');
    } finally {
      setBusy(false);
    }
  };

  /* ── تولید دوبارهٔ آزمون ذخیره‌شده با سؤال‌های تازه از همان تنظیمات ── */
  const regenerateExam = async (examRef) => {
    setBusy(true);
    setError(null);
    try {
      const full = examRef?.questionIds ? examRef : await fetchExam(userId, examRef.id);
      const plan = await buildExamPlan(userId, {
        ...full.config,
        seed: Math.floor(Math.random() * 2 ** 30),
      });
      const freshExam = await saveExam(userId, { config: full.config, plan, title: full.title });
      await launchPersonalExam(freshExam);
    } catch {
      setError('تولید دوبارهٔ آزمون ممکن نشد؛ دوباره تلاش کن.');
    } finally {
      setBusy(false);
    }
  };

  /* ── CTA کارنامه: آزمون بعدی بر اساس نقاط ضعف همین کارنامه ── */
  const buildNextFromResult = async (session) => {
    setBusy(true);
    setError(null);
    try {
      const prefill = await prefillFromSession(session);
      go('builder', { prefill });
    } catch {
      setError('ساخت پیش‌تنظیم آزمون بعدی ممکن نشد.');
    } finally {
      setBusy(false);
    }
  };

  /* آزمون سال‌به‌سال */
  const startYearExam = (entry) => {
    trackEvent('bank_year_exam_opened', { year: entry.year });
    return launchSession(
      {
        mode: 'exam',
        title: `آزمون علوم پایه ${toFa(entry.year)}`,
        subtitle: `${faNum(entry.questionCount)} سؤال رسمی · ${toFa(entry.durationMinutes)} دقیقه · نمرهٔ منفی ۳/۱−`,
        blueprint: { kind: 'year', year: entry.year },
        questionIds: null,
        filters: { yearFrom: entry.year, yearTo: entry.year, sources: ['official'] },
        durationMinutes: entry.durationMinutes,
        negativeMarking: -0.25,
      },
      { originView: { name: 'years' } },
    );
  };

  /* تمرین مبحثی */
  const startTopicPractice = (config) => {
    const filters = {
      subjectIds: [config.subjectId],
      topicPaths: config.topic ? (config.subtopic ? [config.topic, config.subtopic] : [config.topic]) : [],
    };
    return launchSession(
      {
        mode: 'practice',
        title: 'تمرین مبحثی',
        subtitle: [config.subjectName, config.topic, config.subtopic].filter(Boolean).join(' › '),
        filters,
        count: config.count ?? null,
        shuffle: config.shuffle ?? false,
      },
      { originView: { name: 'topics' } },
    );
  };

  /* ── پایان سشن → کارنامه (+ ثبت Attempt برای آزمون شخصیِ منبع سشن) ── */
  const finishSession = (submitted) => {
    setRoom(null);
    setResultSession(submitted);
    refreshOverview();
    if (submitted.blueprint?.examId) {
      recordAttempt(userId, submitted.blueprint.examId, submitted);
    }
    go('result');
  };

  /* ── مرور سشن ثبت‌شده ── */
  const openReview = async (session) => {
    setBusy(true);
    try {
      const payload = await fetchReviewSession(userId, session.id);
      setReturnView({ name: 'result', payload: { sessionId: session.id } });
      setRoom({
        session: { ...payload.session, mode: 'review' },
        questions: payload.questions,
      });
      go('live');
    } catch {
      setError('مرور این سشن در دسترس نیست.');
    } finally {
      setBusy(false);
    }
  };

  /* ── بازکردن کارنامهٔ ذخیره‌شده ── */
  const openResult = async (sessionId) => {
    setBusy(true);
    try {
      const session = await fetchSession(userId, sessionId);
      setResultSession(session);
      go('result');
    } catch {
      setError('کارنامه پیدا نشد.');
    } finally {
      setBusy(false);
    }
  };

  /* خروج از محیط حل — سشن در حال جریان ذخیره می‌ماند */
  const exitRoom = () => {
    const target = returnView ?? { name: 'home' };
    setRoom(null);
    if (target.name === 'result') {
      go('result');
      return;
    }
    refreshOverview();
    go(target.name, target.payload ?? null);
  };

  const handleBack = () => {
    if (view.name === 'live' || view.name === 'result') {
      exitRoom();
      return;
    }
    if (view.name === 'my-exams') {
      go('builder');
      return;
    }
    go('home');
  };

  const navigate = (name, payload = null) => {
    if (name === 'result' && payload?.sessionId) {
      openResult(payload.sessionId);
      return;
    }
    if (name === 'topics' && payload?.subjectId) {
      go('topics', payload);
      return;
    }
    go(name, payload);
  };

  const showBackToHome = !['home'].includes(view.name);

  return (
    <section
      dir="rtl"
      aria-label="بانک تست علوم پایه"
      className="mx-auto w-[var(--content-width)] py-8 text-white [font-family:'Pinar',Tahoma,sans-serif] md:py-10"
    >
      {/* سربرگ لایه */}
      <header className="mb-6 flex items-center justify-between gap-3">
        {showBackToHome ? (
          <button
            type="button"
            onClick={handleBack}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#282828] px-3.5 py-2.5 text-xs text-[#aaa] transition-colors hover:bg-[#333] hover:text-white"
          >
            <Icon name="back" className="h-3.5 w-3.5" />
            {view.name === 'live' ? 'خروج از محیط حل' : view.name === 'result' ? 'بازگشت' : 'بازگشت'}
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
          {VIEW_LABELS[view.name] ?? 'بانک تست'}
        </span>
      </header>

      {busy && (
        <div className="space-y-4" aria-hidden="true">
          <Skeleton className="h-40 rounded-[2.2rem]" />
          <Skeleton className="h-64 rounded-[2.2rem]" />
        </div>
      )}

      {!busy && error && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-[#e26d6d]/10 px-4 py-3 text-sm text-[#e26d6d]" role="alert">
          <Icon name="alert" className="h-4 w-4" />
          {error}
        </div>
      )}

      {!busy && view.name === 'home' && (
        <div className="dashboard-layer-reveal">
          <BankHome overview={overview} onNavigate={navigate} />
        </div>
      )}

      {!busy && view.name === 'subjects' && (
        <div className="dashboard-layer-reveal rounded-[2rem] border border-white/8 bg-[#242426] p-5 md:p-7">
          <SubjectPicker overview={overview} onPick={(subjectId) => go('browse', { filters: { subjectIds: [subjectId] } })} />
        </div>
      )}

      {!busy && view.name === 'years' && (
        <div className="dashboard-layer-reveal">
          <BankYears overview={overview} onStartYearExam={startYearExam} />
        </div>
      )}

      {!busy && view.name === 'topics' && (
        <div className="dashboard-layer-reveal">
          <BankTopics
            userId={userId}
            initialSubjectId={view.payload?.subjectId ?? null}
            onStartPractice={startTopicPractice}
          />
        </div>
      )}

      {!busy && view.name === 'browse' && (
        <div className="dashboard-layer-reveal">
          <BankExplorer
            userId={userId}
            overview={overview}
            initialFilters={view.payload?.filters ?? {}}
            onSolve={(questionId) => startPractice({ singleQuestion: questionId }, { name: 'browse', payload: view.payload })}
            onStartPractice={(filters) => startPractice({ filters }, { name: 'browse', payload: view.payload })}
            onStartExam={(filters) =>
              startExam(
                {
                  filters,
                  title: 'آزمون از نتایج فیلترشده',
                  subtitle: summarizeFilters(filters),
                  count: 10,
                  durationMinutes: 20,
                  negativeMarking: -0.25,
                },
                { name: 'browse', payload: view.payload },
              )
            }
          />
        </div>
      )}

      {!busy && view.name === 'builder' && (
        <div className="dashboard-layer-reveal">
          <PersonalExamBuilder
            userId={userId}
            payload={view.payload}
            onLaunchExam={launchPersonalExam}
            onOpenMyExams={() => go('my-exams')}
          />
        </div>
      )}

      {!busy && view.name === 'my-exams' && (
        <div className="dashboard-layer-reveal">
          <SavedExamsView
            userId={userId}
            onAttempt={launchPersonalExam}
            onOpenResult={(sessionId) => openResult(sessionId)}
            onRegenerate={regenerateExam}
            onBackToBuilder={() => go('builder')}
          />
        </div>
      )}

      {!busy && view.name === 'history' && (
        <div className="dashboard-layer-reveal">
          <BankHistory userId={userId} onNavigate={navigate} onOpenResult={(sessionId) => openResult(sessionId)} />
        </div>
      )}

      {!busy && view.name === 'result' && resultSession && (
        <div className="dashboard-layer-reveal">
          <BankResult
            session={resultSession}
            onReview={openReview}
            onBuildNext={buildNextFromResult}
            onBack={() => {
              const target = returnView ?? { name: 'home' };
              if (target.name === 'result') {
                go('home');
                return;
              }
              refreshOverview();
              go(target.name, target.payload ?? null);
            }}
            onNavigate={navigate}
            onRetake={(session) => {
              /* بازتولد با همان blueprint سشن قبلی؛ آزمون شخصی همان سؤال‌های snapshot را می‌گیرد */
              const blueprint = session.blueprint ?? {};
              const isPersonal = blueprint.kind === 'personal' && Array.isArray(blueprint.questionIds);
              launchSession(
                {
                  mode: session.mode,
                  title: session.title,
                  subtitle: session.subtitle,
                  filters: isPersonal ? null : (blueprint.filters ?? null),
                  questionIds: isPersonal ? blueprint.questionIds : null,
                  count: isPersonal ? null : (blueprint.requested ?? null),
                  durationMinutes: session.endsAt ? Math.round((session.endsAt - session.startedAt) / 60000) : null,
                  negativeMarking: session.negativeMarking ?? 0,
                  shuffle: !isPersonal && blueprint.kind === 'filters' ? false : true,
                },
                { originView: { name: 'result', payload: { sessionId: session.id } } },
              );
            }}
          />
        </div>
      )}

      {!busy && view.name === 'result' && !resultSession && (
        <EmptyState
          icon="alert"
          title="کارنامه‌ای برای نمایش نیست"
          note="این کارنامه پیدا نشد یا حذف شده است."
          action={
            <button type="button" onClick={() => go('home')} className="mt-3 cursor-pointer rounded-xl bg-[#61D192] px-5 py-2.5 text-sm font-bold text-[#12271a]">
              بازگشت به خانهٔ بانک
            </button>
          }
        />
      )}

      {/* محیط حل — روکش تمام‌صفحه، مستقل از چیدمان داشبورد */}
      {view.name === 'live' && room && (
        <BankSession
          userId={userId}
          session={room.session}
          questions={room.questions}
          onFinished={finishSession}
          onExit={exitRoom}
        />
      )}
    </section>
  );
}
