/*
 * خوانندهٔ میکرودرسنامه — پوستهٔ اصلی تجربهٔ مطالعه.
 *
 * چیدمان: فهرست کنار (راست) | محتوای صفحه (باقی عرض). پنل کناری حذف شده و ابزارهای
 * یادداشت/فلش‌کارت به نوار بالای صفحه (کنار سوییچ درس سریع/مطالعهٔ عمیق) منتقل شده‌اند.
 *
 * نقش‌های این کامپوننت:
 *   • جریان مطالعه (buildStudyFlow): صفحه‌ها و checkpointها در هم، با پیشروی واقعی
 *   • همگام‌سازی با مسیر داشبورد (view.pageId) برای رفرش و Back/Forward
 *   • اتصال به MicroProgressService (ذخیرهٔ وضعیت) و MicroTestEngine (انتخاب تست)
 *   • stateهای loading / error / not-published / topic-empty / completion و toast
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './microReader.css';
import { LAYER_IDS, useDashboardRoute } from '../../dashboardRoute';
import { MicroContentService, buildStudyFlow } from '../../../../services/micro/microContentService';
import { MicroProgressService } from '../../../../services/micro/microProgressService';
import { buildCompletionSummary } from '../../../../services/micro/microLearningEngine';
import {
  questionPoolOf,
  pickCheckpointQuestions,
  pickFinalAssessment,
  nextDifficulty,
  evaluateAnswer,
  difficultyLabel,
} from '../../../../services/micro/microTestEngine';
import { toFa } from '../learning/learningUtils';
import { FEEDBACK_SOURCES, sendFeedback } from '../../../../services/feedback/userFeedback';
import MicroBlocks from './MicroBlocks';
import MicroCheckpoint from './MicroCheckpoint';
import MicroOutline from './MicroOutline';
import { MicroCompletion, FinalAssessment, AssessmentResult } from './MicroCompletion';

const CONFIDENCE_LABELS = ['اصلاً', 'ضعیف', 'متوسط', 'خوب', 'کاملاً'];

/* کشوی ابزارهای نوار بالا: یادداشت + هایلایت‌ها، فلش‌کارت‌های من، گزارش ایراد */
const TOOL_DRAWERS = { note: 'note', flashcards: 'flashcards', report: 'report' };

/* نوع گزارش ایراد این صفحه — همان واژگان گزارش درسنامهٔ جامع */
const REPORT_KINDS = ['گزارش اشکال محتوایی', 'خطای فنی', 'پیشنهاد بهبود'];

export default function MicroCourseReader({ courseId, userId = 'local-user', view = {}, patchView, onExit }) {
  const dashboardRoute = useDashboardRoute();
  const [course, setCourse] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | error | not-published
  const [reloadToken, setReloadToken] = useState(0);
  const [progress, setProgress] = useState(null);

  const [flowIndex, setFlowIndex] = useState(0);
  const [screen, setScreen] = useState('flow'); // flow | assessment | assess-result
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [toolDrawer, setToolDrawer] = useState(null); // null | note | flashcards | report
  const [report, setReport] = useState({ kind: REPORT_KINDS[0], text: '', state: 'idle' });
  const [toast, setToast] = useState(null);
  const [cpQuestions, setCpQuestions] = useState(null); // سؤال‌های checkpoint جاری (هر ورود تازه)
  const [activeRetest, setActiveRetest] = useState(null); // { checkpointId, questions }
  const [assessmentQuestions, setAssessmentQuestions] = useState([]);
  const [assessmentAttempts, setAssessmentAttempts] = useState([]);
  const [confidencePending, setConfidencePending] = useState(false);
  const [newCard, setNewCard] = useState({ front: '', back: '' });

  const pageStartRef = useRef(Date.now());
  const noteTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const jumpTargetRef = useRef(null);

  /* ── بارگذاری درس و وضعیت پیشرفت ── */
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setLoadState('loading');
    MicroContentService.getCourse(courseId, { signal: controller.signal })
      .then((loaded) => {
        if (!alive) return;
        setCourse(loaded);
        const savedProgress = MicroProgressService.load(loaded, userId);
        setProgress(savedProgress);
        setLoadState('ready');
      })
      .catch((error) => {
        if (!alive || error?.name === 'AbortError') return;
        setLoadState(error?.code === 'course-not-published' ? 'not-published' : 'error');
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [courseId, userId, reloadToken]);

  const topic = course ? MicroContentService.getTopic(course, view.topicId) : null;
  const unit = topic?.units?.[0] ?? null;
  const flow = useMemo(() => (unit ? buildStudyFlow(unit) : []), [unit]);
  const pageConcepts = useMemo(() => (unit ? MicroContentService.conceptPageMap(unit) : new Map()), [unit]);
  const pool = useMemo(() => (unit ? questionPoolOf(unit, unit.concepts) : []), [unit]);

  /* ── نقطهٔ شروع: مسیر داشبورد ← آخرین نقطهٔ ذخیره ← ابتدای جریان ── */
  useEffect(() => {
    if (!unit || !flow.length || !progress) return;
    if (jumpTargetRef.current !== null) return;

    const fromRoute = view.pageId;
    const fromSaved = progress.lastLocation?.pageId;
    const targetId = fromRoute ?? fromSaved;
    const index = targetId
      ? flow.findIndex((item) => item.kind === 'page' && item.page.id === targetId)
      : -1;
    const resolvedIndex = index >= 0 ? index : 0;
    setFlowIndex(resolvedIndex);
    /* مسیر را با نقطهٔ واقعی شروع هم‌گام کن (مثلاً وقتی از lastLocation آمده) */
    const resolvedItem = flow[resolvedIndex];
    const resolvedPageId = resolvedItem?.kind === 'page'
      ? resolvedItem.page.id
      : resolvedItem?.checkpoint?.afterPage;
    if (resolvedPageId && view.pageId !== resolvedPageId) patchView?.({ pageId: resolvedPageId });
    jumpTargetRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit, flow, progress]);

  /* همگام‌سازی صفحهٔ جاری با مسیر داشبورد داخل خودِ ناوبری انجام می‌شود (goToIndex و
     اثر شروع)؛ اثر جدا با closure کهنه مسیر را خراب می‌کرد — پس اینجا فقط نگه‌داری می‌شود. */

  /* دیدن صفحه: unseen → seen (پایهٔ پیشرفت محتوایی) */
  useEffect(() => {
    if (!unit || !progress) return;
    const current = flow[flowIndex];
    if (current?.kind !== 'page') return;
    const pageState = progress.units?.[unit.id]?.pages?.[current.page.id];
    if (pageState?.status !== 'unseen') return;
    pageStartRef.current = Date.now();
    setProgress((previous) => MicroProgressService.save(course.id, MicroProgressService.markPageSeen(previous, unit, current.page.id), userId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowIndex, flow, unit, progress === null]);

  /* انتخاب سؤال‌های checkpoint — هر ورود، انتخاب تازه از بانک تست تا سؤال‌ها
     دوباره برای حل‌کردن نمایش داده شوند */
  useEffect(() => {
    if (!unit || !progress) return;
    const current = flow[flowIndex];
    if (current?.kind !== 'checkpoint') {
      setCpQuestions(null);
      return;
    }
    if (activeRetest) return;
    setCpQuestions(pickCheckpointQuestions(unit, current.checkpoint, progress, pageConcepts));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowIndex, flow, unit, progress === null, activeRetest]);

  const saveProgress = useCallback((updater) => {
    setProgress((previous) => MicroProgressService.save(courseId, updater(previous), userId));
  }, [courseId, userId]);

  const showToast = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  }, []);

  /* ── ناوبری جریان — همراه نوشتن pageId در مسیر داشبورد (رفرش همان‌جا می‌ماند) ── */
  const goToIndex = useCallback((index) => {
    const clamped = Math.max(0, Math.min(index, flow.length));
    const target = flow[clamped];
    const targetPageId = target
      ? (target.kind === 'page' ? target.page.id : target.checkpoint.afterPage)
      : flow[flow.length - 1]?.kind === 'page'
        ? flow[flow.length - 1].page.id
        : null;
    setScreen('flow');
    setActiveRetest(null);
    setConfidencePending(false);
    setToolDrawer(null);
    setFlowIndex(clamped);
    setOutlineOpen(false);
    if (targetPageId && view.pageId !== targetPageId) patchView?.({ pageId: targetPageId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [flow, view.pageId, patchView]);

  const goNext = () => goToIndex(flowIndex + 1);
  const goPrev = () => goToIndex(flowIndex - 1);

  const current = flow[flowIndex] ?? null;
  const isCompletion = flowIndex >= flow.length;
  const currentPage = current?.kind === 'page' ? current.page : null;
  const currentCheckpoint = current?.kind === 'checkpoint' ? current.checkpoint : null;

  const unitState = unit && progress ? MicroProgressService.getUnitState(progress, unit) : null;
  const pageState = currentPage && unitState
    ? MicroProgressService.getPageState(unitState, currentPage)
    : null;

  /* ── کنش‌های صفحه ── */
  const completeCurrentPage = ({ confidence = null } = {}) => {
    if (!currentPage) return;
    const readingTimeSec = Math.max(5, Math.round((Date.now() - pageStartRef.current) / 1000));
    saveProgress((previous) => MicroProgressService.completePage(previous, unit, currentPage.id, {
      readingTimeSec,
      confidence,
    }));
    pageStartRef.current = Date.now();
  };

  const handleCompleteAndNext = () => {
    if (!currentPage) return;
    /* صفحات مهم: درجهٔ اطمینان قبل از ادامه گرفته می‌شود */
    if (currentPage.confidenceCheck && (pageState?.confidence ?? null) === null) {
      setConfidencePending(true);
      return;
    }
    completeCurrentPage();
    if (flowIndex + 1 >= flow.length) {
      setScreen('flow');
      setFlowIndex(flow.length);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      goNext();
    }
  };

  const handleConfidencePick = (value) => {
    completeCurrentPage({ confidence: value });
    setConfidencePending(false);
    if (flowIndex + 1 >= flow.length) setFlowIndex(flow.length);
    else goNext();
  };

  const handleToggleBookmark = () => {
    if (!currentPage) return;
    saveProgress((previous) => MicroProgressService.toggleBookmark(previous, unit, currentPage.id));
  };

  const handleNoteChange = (text) => {
    if (!currentPage) return;
    clearTimeout(noteTimerRef.current);
    noteTimerRef.current = setTimeout(() => {
      saveProgress((previous) => MicroProgressService.setPageNote(previous, unit, currentPage.id, text));
      showToast('یادداشت ذخیره شد');
    }, 500);
  };

  const handleAddHighlight = ({ text, color }) => {
    if (!currentPage) return;
    saveProgress((previous) => MicroProgressService.addHighlight(previous, unit, currentPage.id, {
      id: `hl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      text,
      color,
      at: Date.now(),
    }));
    showToast('هایلایت ذخیره شد');
  };

  const handleRemoveHighlight = (highlightId) => {
    if (!currentPage) return;
    saveProgress((previous) => MicroProgressService.removeHighlight(previous, unit, currentPage.id, highlightId));
  };

  /* فلش‌کارت‌های ساختهٔ خود کاربر */
  const handleAddFlashcard = () => {
    if (!currentPage) return;
    const front = newCard.front.trim();
    const back = newCard.back.trim();
    if (!front || !back) return;
    saveProgress((previous) => MicroProgressService.addFlashcard(previous, unit, currentPage.id, {
      id: `fc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      front,
      back,
      at: Date.now(),
    }));
    setNewCard({ front: '', back: '' });
    showToast('فلش‌کارت اضافه شد');
  };

  const handleRemoveFlashcard = (cardId) => {
    if (!currentPage) return;
    saveProgress((previous) => MicroProgressService.removeFlashcard(previous, unit, currentPage.id, cardId));
  };

  /* گزارش ایراد همین صفحه — به سرور می‌رود تا در پنل با منبع «میکرو درسنامه» بنشیند */
  const submitReport = async () => {
    if (!report.text.trim() || report.state === 'sending') return;
    setReport((previous) => ({ ...previous, state: 'sending' }));

    const sent = await sendFeedback({
      source: FEEDBACK_SOURCES.micro,
      subject: `گزارش ایراد — ${currentPage?.title ?? course?.title ?? 'میکرو درسنامه'}`,
      category: report.kind,
      message: report.text.trim(),
      meta: { courseId, unitId: unit?.id ?? null, pageId: currentPage?.id ?? null },
    });

    setReport((previous) => ({ ...previous, text: sent ? '' : previous.text, state: sent ? 'sent' : 'error' }));
  };

  /* ── کنش‌های checkpoint ── */
  const checkpointQuestions = currentCheckpoint
    ? (activeRetest?.checkpointId === currentCheckpoint.id
        ? activeRetest.questions
        : cpQuestions)
    : null;

  /* ارسال سؤال به تپش هوشمند — رفتن به لایهٔ AI با پرامپت آماده */
  const askTapeshAI = useCallback((prompt) => {
    const currentRoute = dashboardRoute.routeRef?.current;
    if (!dashboardRoute.push || !currentRoute) return;
    dashboardRoute.push({
      ...currentRoute,
      layer: LAYER_IDS.ai,
      view: { conversationId: null, prompt },
      overlay: null,
    });
    window.scrollTo({ top: 0 });
  }, [dashboardRoute]);

  const handleCheckpointAnswer = (attempt) => {
    if (!currentCheckpoint) return;
    saveProgress((previous) => MicroProgressService.recordCheckpointAnswer(previous, unit, currentCheckpoint.id, attempt));
  };

  const handleCheckpointComplete = ({ requiredMet, weakConcepts }) => {
    if (!currentCheckpoint) return;
    saveProgress((previous) => {
      const next = MicroProgressService.closeCheckpoint(previous, unit, currentCheckpoint.id, {
        requiredMet,
        weakConcepts,
      });
      /* دشواری تطبیقی: بر اساس دو پاسخ آخر */
      const unitStateNext = MicroProgressService.getUnitState(next, unit);
      const difficulty = nextDifficulty(
        { difficulty: unitStateNext.difficulty, lastResults: (unitStateNext.lastResults ?? []).slice(0, -2) },
        (unitStateNext.lastResults ?? []).slice(-2),
      );
      return MicroProgressService.updateUnit(next, unit, {
        difficulty: difficulty.difficulty,
        lastResults: difficulty.lastResults,
      });
    });
  };

  const handleRetestStart = () => {
    if (!currentCheckpoint || !unit) return;
    const usedIds = (unitState?.checkpoints?.[currentCheckpoint.id]?.attempts ?? []).map((attempt) => attempt.questionId);
    const questions = pickCheckpointQuestions(
      unit,
      { ...currentCheckpoint, questionCount: 2 },
      progress,
      pageConcepts,
    ).filter((question) => !usedIds.includes(question.id));
    setActiveRetest({ checkpointId: currentCheckpoint.id, questions });
  };

  const handleReviewPage = (pageId) => {
    const index = flow.findIndex((item) => item.kind === 'page' && item.page.id === pageId);
    if (index >= 0) goToIndex(index);
  };

  /* ── آزمون جمع‌بندی ── */
  const startAssessment = () => {
    const questions = pickFinalAssessment(unit, progress, pageConcepts, {
      count: unit.finalAssessment?.questionCount ?? 10,
    });
    setAssessmentQuestions(questions);
    setAssessmentAttempts([]);
    setScreen('assessment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAssessmentAnswer = async (question, selected) => {
    /* PHASE 2 — درستی از سرور می‌آید؛ کلید پاسخ در کلاینت نیست. */
    const attempt = await evaluateAnswer(question, selected);
    setAssessmentAttempts((previous) => [...previous, attempt]);
  };

  const finishAssessment = () => {
    saveProgress((previous) => MicroProgressService.recordAssessment(previous, unit, {
      id: `as-${Date.now().toString(36)}`,
      at: Date.now(),
      questionIds: assessmentAttempts.map((attempt) => attempt.questionId),
      attempts: assessmentAttempts,
      correct: assessmentAttempts.filter((attempt) => attempt.correct).length,
      accuracy: assessmentAttempts.length
        ? Math.round((assessmentAttempts.filter((attempt) => attempt.correct).length / assessmentAttempts.length) * 100)
        : 0,
    }));
    setScreen('assess-result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── خروج به فهرست مبحث‌ها ── */
  const exitReader = () => {
    setOutlineOpen(false);
    setToolDrawer(null);
    onExit?.();
  };

  /* نوار پیشرفت اسکرول */
  const [scrollPct, setScrollPct] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setScrollPct(Math.round((window.scrollY / Math.max(1, max)) * 100));
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (toolDrawer) return setToolDrawer(null);
      if (outlineOpen) return setOutlineOpen(false);
      if (screen !== 'flow') return setScreen('flow');
      exitReader();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolDrawer, outlineOpen, screen]);

  /* ── stateهای بارگذاری و خطا ── */
  if (loadState === 'loading') {
    return (
      <div className="micr-reader" dir="rtl">
        <div className="micr-skeleton">
          <div className="micr-skeleton__bar" style={{ width: '42%' }} />
          <div className="micr-skeleton__bar" style={{ width: '72%' }} />
          <div className="micr-skeleton__bar" style={{ width: '88%' }} />
          <div className="micr-skeleton__bar" style={{ width: '64%' }} />
          <p>در حال آماده‌سازی میکرودرسنامه…</p>
        </div>
      </div>
    );
  }

  /* درس‌هایی که هنوز میکرودرسنامهٔ منتشرشده ندارند — به‌جای خطا، حالت «به‌زودی» */
  if (loadState === 'not-published') {
    return (
      <div className="micr-reader" dir="rtl">
        <div className="micr-empty">
          <strong>میکرودرسنامهٔ این درس به‌زودی منتشر می‌شود</strong>
          <p>خوانندهٔ صفحه‌به‌صفحه، تست‌های میان راه و نقشهٔ تسلط برای این درس آماده‌سازی می‌شود.</p>
          <button type="button" className="micr-button micr-button--soft" onClick={exitReader}>
            بازگشت به فهرست میکرودرس‌ها
          </button>
        </div>
      </div>
    );
  }

  if (loadState === 'error' || !course) {
    return (
      <div className="micr-reader" dir="rtl">
        <div className="micr-empty" role="alert">
          <strong>میکرودرسنامه بارگذاری نشد</strong>
          <p>ارتباط با محتوای درس برقرار نشد. یک‌بار دیگر تلاش کن.</p>
          <button type="button" className="micr-button micr-button--soft" onClick={() => setReloadToken((token) => token + 1)}>
            تلاش دوباره
          </button>
        </div>
      </div>
    );
  }

  /* مبحثی که هنوز واحد یادگیری و صفحه ندارد — خطای بارگذاری نیست، پس پیام روشن
     با راه بازگشت نشان داده می‌شود (مبحث‌های فهرست همه فعال‌اند). */
  if (!unit) {
    return (
      <div className="micr-reader" dir="rtl">
        <div className="micr-empty">
          <strong>صفحه‌های این مبحث هنوز آماده نشده</strong>
          <p>محتوای این مبحث در حال نوشته‌شدن است؛ تا آن زمان مبحث‌های آمادهٔ همین درس را بخوان.</p>
          <button type="button" className="micr-button micr-button--soft" onClick={exitReader}>
            بازگشت به فهرست مبحث‌ها
          </button>
        </div>
      </div>
    );
  }

  /* سوییچ «درس سریع / مطالعهٔ عمیق» حذف شد — همیشه همهٔ جزئیات نمایش داده می‌شود.
     موتور نمایش blockها همچنان دو حالت را پشتیبانی می‌کند (deepMode). */
  const deepMode = true;
  const userFlashcards = pageState?.flashcards ?? [];
  const highlights = pageState?.highlights ?? [];
  const pageNumbers = flow.filter((item) => item.kind === 'page').length;
  const currentOrder = currentPage?.order
    ?? (current?.kind === 'checkpoint'
      ? unit.pages.find((page) => page.id === current.checkpoint.afterPage)?.order ?? 1
      : isCompletion ? pageNumbers : 1);

  const summary = isCompletion
    ? buildCompletionSummary(unit, progress, pageConcepts, pool, { startedAt: unitState?.startedAt })
    : null;

  return (
    <div className={`micr-reader${outlineOpen ? ' has-outline' : ''}`} dir="rtl">
      {/* نوار پیشرفت اسکرول */}
      <div className="micr-scrollmeter" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(0, scrollPct))}%` }} /></div>

      <header className="micr-rhead">
        <button type="button" className="micr-rhead__back" onClick={exitReader} aria-label="بازگشت به فهرست مبحث‌ها">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          میکرو درس‌ها
        </button>

        <div className="micr-rhead__tools">
          <button
            type="button"
            className={`micr-rhead__tool micr-rhead__tool--note${toolDrawer === TOOL_DRAWERS.note ? ' is-active' : ''}${(pageState?.note ?? '').trim() ? ' has-content' : ''}`}
            onClick={() => setToolDrawer(toolDrawer === TOOL_DRAWERS.note ? null : TOOL_DRAWERS.note)}
            aria-expanded={toolDrawer === TOOL_DRAWERS.note}
            title="یادداشت و هایلایت‌های این صفحه"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            یادداشت
          </button>

          <button
            type="button"
            className={`micr-rhead__tool micr-rhead__tool--flash${toolDrawer === TOOL_DRAWERS.flashcards ? ' is-active' : ''}${userFlashcards.length ? ' has-content' : ''}`}
            onClick={() => setToolDrawer(toolDrawer === TOOL_DRAWERS.flashcards ? null : TOOL_DRAWERS.flashcards)}
            aria-expanded={toolDrawer === TOOL_DRAWERS.flashcards}
            title="فلش‌کارت‌های من در این صفحه"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="13" height="14" rx="2" /><path d="M8 3h11a2 2 0 0 1 2 2v11" /></svg>
            فلش‌کارت
            {userFlashcards.length > 0 && <i>{toFa(userFlashcards.length)}</i>}
          </button>

          <button
            type="button"
            className={`micr-rhead__tool micr-rhead__tool--report${toolDrawer === TOOL_DRAWERS.report ? ' is-active' : ''}`}
            onClick={() => setToolDrawer(toolDrawer === TOOL_DRAWERS.report ? null : TOOL_DRAWERS.report)}
            aria-expanded={toolDrawer === TOOL_DRAWERS.report}
            title="گزارش ایراد یا خطای این صفحه"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
            گزارش ایراد
          </button>

          <button type="button" className="micr-rhead__toggle" onClick={() => setOutlineOpen(!outlineOpen)} aria-expanded={outlineOpen}>
            فهرست
          </button>
        </div>
      </header>

      {/* کشوی یادداشت و فلش‌کارت — زیر نوار ابزار */}
      {toolDrawer && currentPage && (
        <div
          className={`micr-toolbox${toolDrawer === TOOL_DRAWERS.note ? ' micr-toolbox--note' : ''}${toolDrawer === TOOL_DRAWERS.flashcards ? ' micr-toolbox--flash' : ''}${toolDrawer === TOOL_DRAWERS.report ? ' micr-toolbox--report' : ''}`}
          role="dialog"
          aria-label={toolDrawer === TOOL_DRAWERS.note ? 'یادداشت' : (toolDrawer === TOOL_DRAWERS.report ? 'گزارش ایراد' : 'فلش‌کارت‌ها')}
        >
          {toolDrawer === TOOL_DRAWERS.note && (
            <>
              <h4>یادداشت من روی «{currentPage.title}»</h4>
              <textarea
                value={pageState?.note ?? ''}
                onChange={(event) => handleNoteChange(event.target.value)}
                placeholder="هرچه می‌خواهی برای خودت بنویس…"
                rows={4}
                autoFocus
              />
              {highlights.length > 0 && (
                <>
                  <h5>هایلایت‌های این صفحه</h5>
                  <ul className="micr-toolbox__highlights">
                    {highlights.map((item) => (
                      <li key={item.id}>
                        <span className="micr-toolbox__hldot" data-color={item.color} />
                        <span className="micr-toolbox__hltext">{item.text}</span>
                        <button type="button" onClick={() => handleRemoveHighlight(item.id)} aria-label="حذف هایلایت">×</button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <small>یادداشت خودکار ذخیره می‌شود. برای ساخت هایلایت، در متن یک عبارت را انتخاب کن.</small>
            </>
          )}

          {toolDrawer === TOOL_DRAWERS.flashcards && (
            <>
              <h4>فلش‌کارت‌های من — «{currentPage.title}»</h4>
              {userFlashcards.length === 0 && (
                <p className="micr-toolbox__empty">هنوز فلش‌کارتی نساخته‌ای؛ اولین کارتت را بساز.</p>
              )}
              {userFlashcards.length > 0 && (
                <ul className="micr-toolbox__cards">
                  {userFlashcards.map((card) => (
                    <li key={card.id}>
                      <b>{card.front}</b>
                      <span>{card.back}</span>
                      <button type="button" onClick={() => handleRemoveFlashcard(card.id)} aria-label="حذف فلش‌کارت">×</button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="micr-toolbox__form">
                <input
                  type="text"
                  value={newCard.front}
                  onChange={(event) => setNewCard((previous) => ({ ...previous, front: event.target.value }))}
                  placeholder="روی کارت: سؤال یا اصطلاح"
                  aria-label="روی کارت"
                />
                <input
                  type="text"
                  value={newCard.back}
                  onChange={(event) => setNewCard((previous) => ({ ...previous, back: event.target.value }))}
                  placeholder="پشت کارت: پاسخ"
                  aria-label="پشت کارت"
                />
                <button
                  type="button"
                  className="micr-button micr-button--primary"
                  onClick={handleAddFlashcard}
                  disabled={!newCard.front.trim() || !newCard.back.trim()}
                >
                  افزودن فلش‌کارت
                </button>
              </div>
            </>
          )}

          {toolDrawer === TOOL_DRAWERS.report && (
            <>
              <h4>گزارش ایراد — «{currentPage.title}»</h4>
              {report.state === 'sent' ? (
                <p className="micr-toolbox__empty">
                  ثبت شد؛ تیم تپش بررسی می‌کند و پاسخ را در بخش «اعلان‌ها» می‌بینی.
                </p>
              ) : (
                <>
                  <label className="micr-toolbox__field">
                    <span>نوع گزارش</span>
                    <select
                      value={report.kind}
                      onChange={(event) => setReport((previous) => ({ ...previous, kind: event.target.value }))}
                    >
                      {REPORT_KINDS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                  <textarea
                    value={report.text}
                    onChange={(event) => setReport((previous) => ({ ...previous, text: event.target.value, state: 'idle' }))}
                    rows={4}
                    placeholder={`چه ایرادی در «${currentPage.title}» دیدی؟`}
                    aria-label="متن گزارش"
                  />
                  {report.state === 'error' && <small className="micr-toolbox__error">ثبت نشد؛ دوباره تلاش کن.</small>}
                  <div className="micr-toolbox__form">
                    <button
                      type="button"
                      className="micr-button micr-button--primary"
                      onClick={submitReport}
                      disabled={!report.text.trim()}
                    >
                      ارسال گزارش
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      <div className="micr-reader__grid">
        <MicroOutline
          course={course}
          topic={topic}
          unit={unit}
          flow={flow}
          currentIndex={flowIndex}
          activeKind={current?.kind ?? 'page'}
          pageStates={unitState?.pages ?? {}}
          checkpointStates={unitState?.checkpoints ?? {}}
          onSelect={goToIndex}
        />

        <main className="micr-content" data-testid="micr-content">
          {screen === 'assessment' && (
            <div key="assessment" className="micr-enter">
              {assessmentQuestions.length ? (
                <FinalAssessment
                  questions={assessmentQuestions}
                  attempts={assessmentAttempts}
                  deepMode={deepMode}
                  onAnswer={handleAssessmentAnswer}
                  onFinish={finishAssessment}
                  onAskAI={askTapeshAI}
                />
              ) : (
                /* آزمون جمع‌بندی هم مثل ایستگاه‌ها از بانک تست تغذیه می‌شود؛ درسی که
                   هنوز سؤال گره‌خورده ندارد باید راه بازگشت بگیرد، نه صفحهٔ خالی. */
                <div className="micr-empty">
                  <strong>سؤال‌های آزمون جمع‌بندی این مبحث آماده نشده</strong>
                  <p>
                    آزمون از بانک تست تپش انتخاب می‌شود؛ برای این مبحث هنوز سؤالی با گرهٔ
                    مفهومی‌اش در بانک ثبت نشده است.
                  </p>
                  <button
                    type="button"
                    className="micr-button micr-button--soft"
                    onClick={() => { setScreen('flow'); setFlowIndex(flow.length); }}
                  >
                    بازگشت به کارنامهٔ مبحث
                  </button>
                </div>
              )}
            </div>
          )}

          {screen === 'assess-result' && (
            <div key="assess-result" className="micr-enter">
              <AssessmentResult attempts={assessmentAttempts} onExit={() => { setScreen('flow'); setFlowIndex(flow.length); }} />
            </div>
          )}

          {screen === 'flow' && isCompletion && summary && (
            <MicroCompletion
              key="completion"
              summary={summary}
              unit={unit}
              onReviewWeak={() => {
                const weakPage = summary.weakConcepts.map((concept) => concept.pageId).find(Boolean);
                if (weakPage) handleReviewPage(weakPage);
              }}
              onAssessment={startAssessment}
              onExit={exitReader}
            />
          )}

          {screen === 'flow' && currentPage && (
            <article key={currentPage.id} className="micr-page micr-enter" aria-label={currentPage.title}>
              <div className="micr-page__titlerow">
                <h1 className="micr-page__title">{currentPage.title}</h1>
                <button
                  type="button"
                  className={`micr-page__flag${pageState?.bookmark ? ' is-active' : ''}`}
                  onClick={handleToggleBookmark}
                  aria-pressed={pageState?.bookmark}
                  title="نشان‌گذاری صفحه"
                >
                  <svg viewBox="0 0 24 24" fill={pageState?.bookmark ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z" /></svg>
                </button>
              </div>
              <p className="micr-page__objective">
                <b>هدف این صفحه:</b> {currentPage.learningObjective}
              </p>

              <MicroBlocks
                page={currentPage}
                deepMode={deepMode}
                highlights={highlights}
                onAddHighlight={handleAddHighlight}
                onRemoveHighlight={handleRemoveHighlight}
              />

              {confidencePending && currentPage.confidenceCheck && (
                <section className="micr-confidence" aria-label="درجهٔ اطمینان">
                  <strong>چقدر به تسلط خودت روی این مبحث اطمینان داری؟</strong>
                  <div className="micr-confidence__scale">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button key={value} type="button" onClick={() => handleConfidencePick(value)}>
                        <i>{toFa(value)}</i>
                        {CONFIDENCE_LABELS[value - 1]}
                      </button>
                    ))}
                  </div>
                  <small>این پاسخ با عملکرد تست‌هایت مقایسه می‌شود تا نقشهٔ واقعی یادگیری‌ات ساخته شود.</small>
                </section>
              )}

              <footer className="micr-page__nav">
                <button type="button" className="micr-button micr-button--quiet" onClick={goPrev} disabled={flowIndex === 0}>
                  صفحهٔ قبلی
                </button>
                {pageState?.status !== 'completed' ? (
                  <button type="button" className="micr-button micr-button--primary" onClick={handleCompleteAndNext}>
                    {flowIndex + 1 >= flow.length ? 'فهمیدم — پایان مبحث' : flow[flowIndex + 1]?.kind === 'checkpoint' ? 'فهمیدم — بریم تست بزنیم' : 'فهمیدم، ادامه'}
                  </button>
                ) : (
                  <button type="button" className="micr-button micr-button--soft" onClick={goNext}>
                    {flowIndex + 1 >= flow.length ? 'دیدن کارنامهٔ مبحث' : flow[flowIndex + 1]?.kind === 'checkpoint' ? 'بریم سراغ تست‌ها' : 'صفحهٔ بعد'}
                  </button>
                )}
              </footer>
            </article>
          )}

          {screen === 'flow' && currentCheckpoint && checkpointQuestions && (
            <div key={currentCheckpoint.id} className="micr-enter">
              <MicroCheckpoint
                checkpoint={currentCheckpoint}
                unit={unit}
                questions={checkpointQuestions}
                deepMode={deepMode}
                pageConcepts={pageConcepts}
                onAnswer={handleCheckpointAnswer}
                onComplete={handleCheckpointComplete}
                onNext={goNext}
                onReviewPage={handleReviewPage}
                onRetestStart={handleRetestStart}
                onAskAI={askTapeshAI}
              />
            </div>
          )}
        </main>
      </div>

      {toast && <div className="micr-toast" role="status">{toast}</div>}
    </div>
  );
}
