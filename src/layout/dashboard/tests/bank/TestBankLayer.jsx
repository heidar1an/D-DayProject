/*
 * TestBankLayer — پوستهٔ لایهٔ «بانک تست علوم پایه».
 * نقش: روتر داخلی بین نماها (خانه، انتخاب درس، سال‌به‌سال، مبحثی، کاوشگر، آزمون‌ساز
 * شخصی، آزمون‌های من، تاریخچه، محیط حل، کارنامه) و حل‌کردن دادهٔ هر گذار از طریق
 * سرویس — هیچ نایی مستقیماً به منبع داده وابسته نیست؛ حلّهٔ سؤال همیشه سمت سرویس
 * ساخته می‌شود.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EMPTY_SCOPE,
  createSession,
  fetchBankOverview,
  fetchReviewSession,
  fetchSession,
  fetchSessionQuestions,
  normalizeFilters,
  scopeLabel,
  scopeToFilters,
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
import { LAYER_IDS, useLayerRoute } from '../../dashboardRoute';
import './bank.css';
import BankHome, { SubjectPicker } from './BankHome';
import BankYears from './BankYears';
import BankTopics from './BankTopics';
import BankExplorer from './BankExplorer';
import BankSubject from './BankSubject';
import BankHistory from './BankHistory';
import BankSession from './BankSession';
import BankResult from './BankResult';
import PersonalExamBuilder from '../builder/PersonalExamBuilder';
import SavedExamsView from '../builder/SavedExamsView';

const VIEW_LABELS = {
  subjects: 'بر اساس درس',
  years: 'آزمون‌های سال به سال',
  topics: 'تست مبحثی',
  subject: 'مباحث درس',
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

const BANK_KIND_SHORT = { national: 'کشوری', authored: 'تألیفی' };
const TRACK_SHORT = { medicine: 'پزشکی', dentistry: 'دندان‌پزشکی' };

/* نمای آغازین لایه و نماهایی که در آدرس نمی‌نشینند (محیط حل، چون سشن در حافظه است) */
const TEST_BANK_HOME = { name: 'home', payload: null };
const TEST_BANK_VOLATILE = ['live'];

/* «صفحه»ی لایه: نماهای مبحثی با شناسهٔ درس تفکیک می‌شوند تا رفتن از یک درس به درس
   دیگر یک ورودی تاریخچه بسازد و Back همان درس قبلی را برگرداند. */
const testBankScreenOf = (current) => {
  const name = current?.name ?? TEST_BANK_HOME.name;
  if (name === 'topics' || name === 'subject') {
    return `${name}:${current?.payload?.subjectId ?? ''}`;
  }
  return name;
};

/* ورودی کارت‌های بخش «تست» → نمای آغازین لایه (لینک عمیق کارت «آزمون‌های شخصی») */
export function testBankEntryView(entry) {
  if (entry === 'builder') return { name: 'builder', payload: { preset: null } };
  return null;
}

/* خلاصهٔ متنی فیلتر برای زیرعنوان سشن */
function summarizeFilters(filters) {
  const f = normalizeFilters(filters);
  const parts = [];
  if (f.bankKinds.length) parts.push(f.bankKinds.map((kind) => BANK_KIND_SHORT[kind]).join('، '));
  if (f.tracks.length) parts.push(f.tracks.map((track) => TRACK_SHORT[track]).join('، '));
  if (f.subjectIds.length) parts.push(f.subjectIds.length <= 3 ? f.subjectIds.join('، ') : `${toFa(f.subjectIds.length)} درس`);
  if (f.topicPaths.length) parts.push(f.topicPaths.join(' › '));
  if (f.yearFrom || f.yearTo) parts.push(`سال ${f.yearFrom ?? '…'} تا ${f.yearTo ?? '…'}`);
  if (f.difficulties.length) parts.push(f.difficulties.map((level) => DIFF_LABELS[level]).join('، '));
  if (f.status) parts.push(STATUS_LABELS[f.status]);
  if (f.search) parts.push(`«${f.search}»`);
  return parts.join(' · ');
}

export default function TestBankLayer({ userData, onBack }) {
  const userId = userData?.id ?? userData?.phone ?? 'guest';
  /* نمای لایه روی مسیر داشبورد می‌نشیند: Back/Forward بین نماها و رفرش در همان نما */
  const [view, setView] = useLayerRoute(LAYER_IDS.testBank, TEST_BANK_HOME, {
    volatile: TEST_BANK_VOLATILE,
    screenOf: testBankScreenOf,
  });
  const [returnView, setReturnView] = useState(null); // مقصد بازگشت پس از خروج از محیط حل
  const [scope, setScope] = useState(EMPTY_SCOPE); // دامنهٔ بانک: نوع بانک (کشوری/تألیفی) × رشته
  const [overview, setOverview] = useState(null);
  const [room, setRoom] = useState(null); // { session, questions }
  const [resultSession, setResultSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'instant' });

  /* تغییر دامنه — اگر مقدار عوض نشده باشد همان state قبلی برمی‌گردد تا نمای کلی
     بی‌دلیل دوباره واکشی نشود. */
  const updateScope = useCallback((patch) => {
    setScope((prev) => {
      const next = { ...prev, ...patch };
      return next.bankKind === prev.bankKind && next.track === prev.track ? prev : next;
    });
  }, []);

  /* هر فیلتری که به سرویس می‌رود، اول با دامنهٔ فعلی ترکیب می‌شود؛ پس همهٔ
     مسیرها (تمرین، آزمون، مبحثی، سال‌به‌سال، کاوشگر) خودکار داخل دامنه می‌مانند. */
  const withScope = useCallback(
    (filters) => ({ ...scopeToFilters(scope), ...(filters ?? {}) }),
    [scope],
  );

  const refreshOverview = useCallback(() => {
    let alive = true;
    fetchBankOverview(userId, scope)
      .then((data) => alive && setOverview(data))
      .catch(() => alive && setOverview(null));
    return () => {
      alive = false;
    };
  }, [userId, scope]);

  useEffect(() => refreshOverview(), [refreshOverview]);

  const go = useCallback((nextView, payload = null) => {
    setView({ name: nextView, payload });
    setError(null);
    scrollToTop();
  }, [setView]);

  /* ── بازگشت سرد به کارنامه (رفرش روی کارنامه) — سشن از سرویس خوانده می‌شود ── */
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (view.name !== 'result' || !view.payload?.sessionId) return;
    openResult(view.payload.sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const filters = withScope(payload?.filters ? normalizeFilters(payload.filters) : null);
    return launchSession(
      {
        mode: 'practice',
        title: payload?.singleQuestion ? 'حل تک‌سؤال' : 'تمرین بانک تست',
        subtitle: payload?.singleQuestion ? '' : summarizeFilters(filters),
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
        filters: withScope(payload?.filters ? normalizeFilters(payload.filters) : null),
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

  /* آزمون سال‌به‌سال — فقط سؤال‌های رسمی همان سال، داخل دامنهٔ فعلی (نوع بانک/رشته) */
  const startYearExam = (entry) => {
    trackEvent('bank_year_exam_opened', { year: entry.year, scope: scopeLabel(scope) });
    return launchSession(
      {
        mode: 'exam',
        title: `آزمون علوم پایه ${toFa(entry.year)}`,
        subtitle: `${faNum(entry.questionCount)} سؤال رسمی · ${toFa(entry.durationMinutes)} دقیقه · نمرهٔ منفی ۳/۱−`,
        blueprint: { kind: 'year', year: entry.year },
        questionIds: null,
        filters: withScope({ yearFrom: entry.year, yearTo: entry.year, sources: ['official'] }),
        durationMinutes: entry.durationMinutes,
        negativeMarking: -0.25,
      },
      { originView: { name: 'years' } },
    );
  };

  /* تمرین مبحثی */
  const startTopicPractice = (config, originView = { name: 'topics' }) => {
    const filters = withScope({
      subjectIds: [config.subjectId],
      topicPaths: config.topic ? (config.subtopic ? [config.topic, config.subtopic] : [config.topic]) : [],
    });
    return launchSession(
      {
        mode: 'practice',
        title: 'تمرین مبحثی',
        subtitle: [config.subjectName, config.topic, config.subtopic].filter(Boolean).join(' › '),
        filters,
        count: config.count ?? null,
        shuffle: config.shuffle ?? false,
      },
      { originView },
    );
  };

  /* ── پایان سشن ──
     آزمون → کارنامه. تمرین‌های آموزشی کارنامه ندارند؛ تلاش‌ها ثبت می‌شود و بی‌سر‌و‌صدا
     به همان نمایی که از آن آمده‌ایم برمی‌گردیم (مثلاً فهرست مباحث همان درس). */
  const finishSession = (submitted) => {
    setRoom(null);
    refreshOverview();
    if (submitted.blueprint?.examId) {
      recordAttempt(userId, submitted.blueprint.examId, submitted);
    }

    if (submitted.mode === 'practice') {
      const target = returnView && returnView.name !== 'result' ? returnView : { name: 'home' };
      go(target.name, target.payload ?? null);
      return;
    }

    setResultSession(submitted);
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
      go('result', { sessionId });
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
      go('result', target.payload ?? null);
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
  const activeScopeLabel = scopeLabel(scope);

  return (
    <section
      dir="rtl"
      aria-label="بانک تست علوم پایه"
      className="mx-auto w-[var(--content-width)] py-8 text-white [font-family:'Pinar','Vazir',Tahoma,sans-serif] md:py-10"
    >
      {/* سربرگ لایه */}
      <header className="mb-6 flex items-center justify-between gap-3">
        {showBackToHome ? (
          <button
            type="button"
            onClick={handleBack}
            aria-label={view.name === 'live' ? 'خروج از محیط حل' : 'بازگشت'}
            className={`flex cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--surface-soft)] py-2.5 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-strong)] hover:text-white ${
              view.name === 'live' ? 'px-2.5' : 'px-3.5'
            }`}
          >
            <Icon name="back" className="h-3.5 w-3.5" />
            {/* در «محیط حل» فقط آیکن — عنوان حذف شده است */}
            {view.name !== 'live' && 'بازگشت'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onBack}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--surface-soft)] px-3.5 py-2.5 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-strong)] hover:text-white"
          >
            <Icon name="back" className="h-3.5 w-3.5" />
            بازگشت به تست
          </button>
        )}
        {/* سمت راست: برچسب نما (جز خانه/محیط حل/مباحث درس) + دامنهٔ فعال */}
        <span className="flex items-center gap-2.5">
          {!['home', 'live', 'subject'].includes(view.name) && (
            <span className="flex items-center gap-1.5 text-xs text-[var(--faint)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--green-vivid)]" aria-hidden="true" />
              {VIEW_LABELS[view.name] ?? 'بانک تست'}
            </span>
          )}
          {/* دامنهٔ فعال (نوع بانک/رشته) — روی نماها یادآوری می‌شود تا کاربر بداند داخل کدام بانک است */}
          {activeScopeLabel && !['home', 'live'].includes(view.name) && (
            <span className="tb-badge tb-badge--plain" title="دامنهٔ فعال این بانک">
              <Icon name="filter" className="h-3 w-3" />
              {activeScopeLabel}
            </span>
          )}
        </span>
      </header>

      {busy && (
        <div className="space-y-4" aria-hidden="true">
          <Skeleton className="h-40 rounded-[2.2rem]" />
          <Skeleton className="h-64 rounded-[2.2rem]" />
        </div>
      )}

      {!busy && error && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-[#e26d6d]/10 px-4 py-3 text-sm text-[var(--red-ink)]" role="alert">
          <Icon name="alert" className="h-4 w-4" />
          {error}
        </div>
      )}

      {!busy && view.name === 'home' && (
        <div className="dashboard-layer-reveal">
          <BankHome overview={overview} scope={scope} onScopeChange={updateScope} onNavigate={navigate} />
        </div>
      )}

      {!busy && view.name === 'subjects' && (
        <div className="dashboard-layer-reveal rounded-[2rem] border border-white/8 bg-[var(--surface)] p-5 md:p-7">
          <SubjectPicker overview={overview} onPick={(subjectId) => go('browse', { filters: { subjectIds: [subjectId] } })} />
        </div>
      )}

      {!busy && view.name === 'years' && (
        <div className="dashboard-layer-reveal">
          <BankYears overview={overview} scope={scope} onStartYearExam={startYearExam} />
        </div>
      )}

      {!busy && view.name === 'topics' && (
        <div className="dashboard-layer-reveal">
          <BankTopics
            userId={userId}
            scope={scope}
            initialSubjectId={view.payload?.subjectId ?? null}
            onStartPractice={startTopicPractice}
          />
        </div>
      )}

      {!busy && view.name === 'subject' && (
        <div className="dashboard-layer-reveal">
          <BankSubject
            userId={userId}
            scope={scope}
            subjectId={view.payload?.subjectId ?? null}
            subjectTitle={view.payload?.subjectTitle ?? null}
            onStartTopic={(config) =>
              startTopicPractice(config, {
                name: 'subject',
                payload: { subjectId: view.payload?.subjectId ?? null, subjectTitle: view.payload?.subjectTitle ?? null },
              })
            }
          />
        </div>
      )}

      {!busy && view.name === 'browse' && (
        <div className="dashboard-layer-reveal">
          <BankExplorer
            userId={userId}
            overview={overview}
            initialFilters={withScope(view.payload?.filters)}
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
            <button type="button" onClick={() => go('home')} className="mt-3 cursor-pointer rounded-xl bg-[var(--green-vivid)] px-5 py-2.5 text-sm font-bold text-[#12271a]">
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
