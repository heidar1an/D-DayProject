/*
 * CoordinatedExamsLayer — پوستهٔ لایهٔ «آزمون‌های هماهنگ تپش».
 * نقش: روتر داخلی بین نماها (خانه، جزئیات، محیط آزمون، کارنامه، مرور) و حل‌کردن
 * دادهٔ هر گذار از طریق سرویس — هیچ نایی مستقیماً به منبع داده وابسته نیست.
 *
 * جریان کاربر (سند محصول §۳۵):
 *   کشف ← جزئیات ← ثبت‌نام ← انتظار/Countdown ← شرکت ← ثبت نهایی ← کارنامه ← تحلیل ← مرور
 */
import { useCallback, useEffect, useState } from 'react';
import {
  cancelRegistration,
  fetchAttempt,
  fetchExam,
  fetchExamQuestions,
  fetchExams,
  fetchRanking,
  fetchResult,
  fetchReviewQuestions,
  registerUser,
  rewardOf,
  startAttempt,
} from '../../../../services/coordinatedExams/coordinatedExamService';
import { Icon, Skeleton, faNum, formatDuration, formatTime } from './coordinatedShared';
import { LAYER_IDS, useLayerRoute } from '../../dashboardRoute';
import './coordinated.css';
import ExamHub from './ExamHub';
import ExamDetail from './ExamDetail';
import ExamRoom from './ExamRoom';
import ExamResult from './ExamResult';
import ExamReview from './ExamReview';

/* نمای آغازین لایه و نماهای گذرا (دادهٔ زمان‌اجرا در حافظه است، نه در آدرس) */
const COORDINATED_VIEW = { name: 'home' };
const COORDINATED_VOLATILE = ['live', 'result', 'review'];

export default function CoordinatedExamsLayer({ userData, onBack }) {
  /* شناسهٔ پایدار کاربر برای فضای دادهٔ آزمون‌ها؛ بعضی سشن‌ها id ندارند */
  const userId = userData?.id ?? userData?.phone;
  /* نمای لایه روی مسیر داشبورد می‌نشیند: Back/Forward بین نماها و رفرش در همان نما.
     محیط آزمون/کارنامه/مرور دادهٔ در حافظه دارند، پس در آدرس نمی‌نشینند. */
  const [view, setView] = useLayerRoute(LAYER_IDS.coordinated, COORDINATED_VIEW, {
    volatile: COORDINATED_VOLATILE,
  });
  const [exams, setExams] = useState(null);
  const [examDetail, setExamDetail] = useState(null);
  const [room, setRoom] = useState(null); // { exam, attempt, questions }
  const [resultPayload, setResultPayload] = useState(null); // { variant, exam, result, reward, releaseAt, ranking }
  const [reviewPayload, setReviewPayload] = useState(null); // { exam, questions }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  /* تأییدیهٔ شروع/ادامهٔ آزمون — پیش از هر ورود به محیط آزمون نشان داده می‌شود */
  const [pendingStart, setPendingStart] = useState(null); // { slug, resume }

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'instant' });

  const refreshExams = useCallback(() => {
    let alive = true;
    fetchExams(userId)
      .then((items) => alive && setExams(items))
      .catch(() => alive && setExams([]));
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => refreshExams(), [refreshExams]);

  const go = useCallback(
    (nextView) => {
      setView(nextView);
      scrollToTop();
    },
    [setView],
  );

  /* ── کشف: باز کردن جزئیات آزمون ── */
  const openExam = async (slug) => {
    setBusy(true);
    setError(null);
    try {
      const exam = await fetchExam(slug, userId);
      setExamDetail(exam);
      go({ name: 'detail', slug });
    } catch {
      setError('این آزمون پیدا نشد.');
    } finally {
      setBusy(false);
    }
  };

  const goHome = () => {
    refreshExams();
    go({ name: 'home' });
  };

  /* ── ثبت‌نام / لغو ثبت‌نام ── */
  const handleRegister = async () => {
    await registerUser(userId, examDetail.slug);
    const exam = await fetchExam(examDetail.slug, userId);
    setExamDetail(exam);
    refreshExams();
  };

  const handleCancelRegistration = async () => {
    await cancelRegistration(userId, examDetail.slug);
    const exam = await fetchExam(examDetail.slug, userId);
    setExamDetail(exam);
    refreshExams();
  };

  /* ── ورود به محیط آزمون (شروع یا ادامه) ── */
  const enterRoom = async (attempt) => {
    const exam = await fetchExam(attempt.examSlug ?? examDetail?.slug, userId);
    const questions = await fetchExamQuestions(attempt.examSlug ?? examDetail?.slug);
    const ordered = attempt.questionIds
      .map((id) => questions.find((question) => question.id === id))
      .filter(Boolean);
    setRoom({ exam, attempt, questions: ordered });
    go({ name: 'live', slug: attempt.examSlug });
  };

  const startExam = async (slug) => {
    setBusy(true);
    try {
      const attempt = await startAttempt(userId, slug);
      await enterRoom(attempt);
    } catch (serviceError) {
      setError(serviceError?.message === 'not-registered' ? 'ثبت‌نام این آزمون بسته است.' : 'شروع آزمون ممکن نشد.');
      if (examDetail?.slug === slug) setExamDetail(await fetchExam(slug, userId));
    } finally {
      setBusy(false);
    }
  };

  const resumeExam = async (slug) => {
    setBusy(true);
    try {
      const exam = await fetchExam(slug, userId);
      const attemptId = exam.userState.activeAttemptId;
      if (!attemptId) return;
      const attempt = await fetchAttempt(userId, attemptId);
      await enterRoom({ ...attempt, examSlug: slug });
    } finally {
      setBusy(false);
    }
  };

  /* ── خروج از محیط: Attempt نیمه‌کاره باقی می‌ماند ── */
  const exitRoom = () => {
    const slug = view.slug;
    setRoom(null);
    setBusy(true);
    fetchExam(slug, userId)
      .then((exam) => {
        setExamDetail(exam);
        go({ name: 'detail', slug });
      })
      .finally(() => setBusy(false));
    refreshExams();
  };

  /* ── پایان آزمون → کارنامه ── */
  const finishAttempt = (payload) => {
    setRoom(null);
    setResultPayload({
      variant: 'ready',
      exam: room?.exam ?? null,
      result: payload.result,
      reward: payload.reward,
    });
    refreshExams();
    go({ name: 'result', slug: payload.result.examSlug });
  };

  /* ── مشاهدهٔ کارنامهٔ ذخیره‌شده ── */
  const viewResult = async (slug) => {
    setBusy(true);
    try {
      const payload = await fetchResult(userId, slug);
      const next = { ...payload, reward: null };

      if (payload.state === 'ready') {
        next.reward = rewardOf(payload.result, payload.exam);
      } else if (payload.state === 'not_participated') {
        next.ranking = await fetchRanking(userId, slug);
      }
      setResultPayload(next);
      go({ name: 'result', slug });
    } finally {
      setBusy(false);
    }
  };

  /* ── مرور سؤال به سؤال ── */
  const openReview = async () => {
    const slug = resultPayload?.exam?.slug ?? view.slug;
    setBusy(true);
    try {
      const payload = await fetchReviewQuestions(userId, slug);
      setReviewPayload(payload);
      go({ name: 'review', slug });
    } catch {
      setError('مرور این آزمون در دسترس نیست.');
    } finally {
      setBusy(false);
    }
  };

  const backTarget =
    view.name === 'detail' || view.name === 'result' ? 'home' : view.name === 'review' ? 'result' : null;

  /* ── تأییدیهٔ ورود به آزمون: خلاصهٔ آزمون برای مودال از فهرست/جزئیات موجود ── */
  const confirmPendingStart = async () => {
    const pending = pendingStart;
    setPendingStart(null);
    if (!pending) return;
    if (pending.resume) await resumeExam(pending.slug);
    else await startExam(pending.slug);
  };

  const pendingExam = pendingStart
    ? (examDetail?.slug === pendingStart.slug
        ? examDetail
        : exams?.find((exam) => exam.slug === pendingStart.slug) ?? null)
    : null;

  const handleBack = () => {
    if (view.name === 'review' && resultPayload) {
      go({ name: 'result', slug: view.slug });
      return;
    }
    if (backTarget === 'home') {
      goHome();
      return;
    }
    onBack?.();
  };

  return (
    <section
      dir="rtl"
      aria-label="آزمون‌های هماهنگ تپش"
      className="mx-auto w-[var(--content-width)] py-8 text-white md:py-10 [font-family:'Pinar','Vazir',Tahoma,sans-serif]"
    >
      {/* سربرگ لایه — فقط دکمهٔ بازگشت؛ در نمای کارنامه دکمهٔ سربرگ نمی‌آید چون
          کارنامه خودش «بازگشت به آزمون‌ها» دارد و دو دکمه تکراری می‌شد */}
      {view.name !== 'result' && (
        <header className="exm-topbar dash-stagger">
          <button
            type="button"
            onClick={view.name === 'home' ? onBack : handleBack}
            className="exm-topbar__back"
            aria-label={view.name === 'home' ? 'بازگشت به تست' : 'بازگشت'}
          >
            <Icon name="back" className="h-4.5 w-4.5" />
            {view.name === 'home'
              ? 'بازگشت به تست'
              : view.name === 'review'
                ? 'بازگشت به کارنامه'
                : 'بازگشت'}
          </button>
        </header>
      )}

      {busy && (
        <div className="space-y-4" aria-hidden="true">
          <Skeleton className="h-44 rounded-[2.2rem]" />
          <Skeleton className="h-72 rounded-[2.2rem]" />
        </div>
      )}

      {!busy && error && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-[#e26d6d]/10 px-4 py-3 text-sm text-[var(--red-ink)]" role="alert">
          <Icon name="alert" className="h-4 w-4" />
          {error}
        </div>
      )}

      {!busy &&
        (view.name === 'home' ? (
          <ExamHub
            exams={exams}
            onOpenExam={openExam}
            onQuickStart={(slug) => setPendingStart({ slug, resume: false })}
          />
        ) : view.name === 'detail' ? (
          <ExamDetail
            exam={examDetail?.slug === view.slug ? examDetail : null}
            onRegister={handleRegister}
            onCancelRegistration={handleCancelRegistration}
            onStart={() => setPendingStart({ slug: view.slug, resume: false })}
            onResume={() => setPendingStart({ slug: view.slug, resume: true })}
            onViewResult={() => viewResult(view.slug)}
          />
        ) : view.name === 'result' ? (
          <ExamResult
            variant={resultPayload?.variant ?? 'processing'}
            exam={resultPayload?.exam ?? null}
            result={resultPayload?.result ?? null}
            reward={resultPayload?.reward ?? null}
            releaseAt={resultPayload?.releaseAt ?? null}
            ranking={resultPayload?.ranking ?? null}
            onReview={openReview}
            onBack={goHome}
          />
        ) : view.name === 'review' ? (
          <ExamReview
            exam={reviewPayload?.exam ?? null}
            questions={reviewPayload?.questions ?? []}
            userData={userData}
            onBack={() => go({ name: 'result', slug: view.slug })}
          />
        ) : null)}

      {/* ── تأییدیهٔ شروع/ادامهٔ آزمون ── */}
      {pendingStart && pendingExam && (
        <div className="exm-modal__scrim" role="dialog" aria-modal="true" aria-label={pendingStart.resume ? 'ادامهٔ آزمون' : 'شروع آزمون'}>
          <div className="exm-modal space-y-4">
            <h2 className="text-lg text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]">
              {pendingStart.resume ? 'ادامهٔ آزمون نیمه‌کاره' : 'آمادهٔ شروع آزمون هستی؟'}
            </h2>
            <p className="text-[13px] leading-7 text-[var(--muted)]">
              <strong className="text-white">{pendingExam.title}</strong>
              <br />
              {faNum(pendingExam.effectiveQuestionCount ?? pendingExam.questionCount)} سؤال • {formatDuration(pendingExam.duration)}
              {pendingExam.status === 'LIVE' && ` • تا ${formatTime(pendingExam.endTime)} فرصت داری`}
            </p>
            <ul className="space-y-2 rounded-2xl bg-black/30 p-4 text-xs leading-6 text-[var(--faint)]">
              <li>• به‌محض ورود، زمان‌سنج فعال می‌شود و توقف ندارد.</li>
              {pendingExam.status !== 'LIVE' && pendingExam.status !== 'AVAILABLE' && (
                <li>• آزمون بین {formatTime(pendingExam.startTime)} تا {formatTime(pendingExam.endTime)} قابل شروع است.</li>
              )}
              <li>
                {pendingStart.resume
                  ? '• به پاسخ‌های قبلیت برمی‌گردی و می‌توانی ادامه بدهی.'
                  : pendingExam.rules?.attemptLimit === 1
                    ? '• فقط یک بار امکان شرکت در این آزمون وجود دارد؛ پس آرام و آماده وارد شو.'
                    : `• می‌توانی تا ${faNum(pendingExam.rules?.attemptLimit ?? 1)} بار در این آزمون شرکت کنی.`}
              </li>
            </ul>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={confirmPendingStart}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--green-vivid)] py-3 text-sm font-bold text-[#0d1f16] transition-colors hover:bg-[#74dd9f]"
              >
                <Icon name="play" className="h-4 w-4" />
                {pendingStart.resume ? 'ادامهٔ آزمون' : 'می‌دانم؛ شروع کن'}
              </button>
              <button
                type="button"
                onClick={() => setPendingStart(null)}
                className="cursor-pointer rounded-2xl bg-white/[0.06] px-5 py-3 text-sm text-[var(--muted)] transition-colors hover:bg-white/[0.1] hover:text-white"
              >
                هنوز نه
              </button>
            </div>
          </div>
        </div>
      )}

      {/* محیط آزمون: روکش تمام‌صفحه، مستقل از چیدمان داشبورد */}
      {view.name === 'live' && room && (
        <ExamRoom
          userData={userData}
          exam={room.exam}
          attempt={room.attempt}
          questions={room.questions}
          onFinished={finishAttempt}
          onExit={exitRoom}
        />
      )}
    </section>
  );
}
