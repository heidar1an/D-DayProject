import { useEffect, useState } from 'react';
import { ContentService, ProgressService } from '../../../../services/learning';
import { LAYER_IDS, useLayerRoute } from '../../dashboardRoute';
import AnatomyOverview from './AnatomyOverview';
import UnitPage from './UnitPage';
import MicroCourseReader from '../micro/MicroCourseReader';
import { LearningStatePanel } from './LearningPrimitives';
import './learning.css';

/*
 * لایهٔ یادگیری هر درس داخل درسنامهٔ جامع — برای همهٔ درس‌ها یکی است:
 *   • درس با مسیر دست‌نویس (آناتومی) → واحدها با موتور یادگیری باز می‌شوند (UnitPage).
 *   • درس بدون مسیر دست‌نویس → لایهٔ جامعش از میکرودرسنامهٔ همان درس ساخته شده و هر
 *     واحد به خوانندهٔ همان مبحث در میکرودرسنامه می‌رسد.
 * مسیر داخلی هر درس جدا در همان view لایهٔ درسنامهٔ جامع ذخیره می‌شود (slot = شناسهٔ درس)
 * تا رفرش و Back/Forward همان بخش/واحد را برگردانند.
 */
const LAYER_HOME = { name: 'overview' };

/* initialRoute فقط هنگام ورود از لینک عمیق (کارت‌های «کار امروز» و «دوره‌های من») مقدار
   دارد. نمای واسط «صفحهٔ بخش» حذف شده است؛ مسیر module قدیمی به overview با بخش
   پیش‌انتخابی مپ می‌شود. */
function normalizeRoute(route) {
  if (route?.name === 'unit' && route.moduleId && route.unitId) {
    return { name: 'unit', moduleId: route.moduleId, unitId: route.unitId, stepId: route.stepId };
  }
  if (route?.name === 'reader' && route.topicId) {
    return { name: 'reader', topicId: route.topicId, moduleId: route.moduleId, pageId: route.pageId };
  }
  if (route?.name === 'module' && route.moduleId) {
    return { name: 'overview', moduleId: route.moduleId };
  }
  return { name: 'overview' };
}

/* رنگ اکسنت درس (همان رنگ کادر کارتش در درسنامهٔ جامع) → سه‌گانهٔ RGB، تا تینت‌ها و
   سایه‌های نیمه‌شفاف لایه هم با همان رنگ بیایند. رنگ نامعتبر ⇒ لایه روی آبی پروژه می‌ماند. */
function accentRgbOf(hex) {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex ?? '');
  if (!match) return null;
  return `${parseInt(match[1], 16)} ${parseInt(match[2], 16)} ${parseInt(match[3], 16)}`;
}

export default function AnatomyLearningLayer({
  subjectId = 'anatomy',
  subjectTitle,
  accent,
  onBack,
  userId = 'local-user',
  initialRoute = null,
}) {
  const [course, setCourse] = useState(null);
  const [progressState, setProgressState] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');
  const [requestVersion, setRequestVersion] = useState(0);
  const [route, setRoute] = useLayerRoute(
    LAYER_IDS.comprehensive,
    initialRoute ? normalizeRoute(initialRoute) : LAYER_HOME,
    { slot: subjectId },
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoadState('loading');
    setError('');

    /* `force` ⇒ کتابخانهٔ منتشرشدهٔ پنل هر بار تازه خوانده می‌شود؛ وگرنه کش ۱۵
       ثانیه‌ای سرویس باعث می‌شد ویرایش تازهٔ مدیر در ورود بعدی دیده نشود. */
    ContentService.getCourse(subjectId, { signal: controller.signal, force: true })
      .then((loadedCourse) => {
        setCourse(loadedCourse);
        setProgressState(ProgressService.load(loadedCourse, userId));
        setLoadState('ready');
      })
      .catch((loadError) => {
        if (loadError.name === 'AbortError') return;
        setError(loadError.message || 'بارگذاری مسیر این درس با مشکل روبه‌رو شد.');
        setLoadState('error');
      });

    return () => controller.abort();
  }, [subjectId, requestVersion, userId]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      const current = normalizeRoute(route);
      if (current.name !== 'overview') setRoute({ name: 'overview', moduleId: current.moduleId });
      else onBack?.();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onBack, route, setRoute]);

  const navigate = (nextRoute) => {
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const subjectLabel = subjectTitle ?? 'این درس';
  /* تم لایه = رنگ همان درس؛ روی خودِ بخش می‌نشیند تا کارت‌ها، درصدها و نوارها همرنگ شوند. */
  const accentRgb = accentRgbOf(accent);
  const themeStyle = accentRgb ? { '--learn-accent': accent, '--learn-accent-rgb': accentRgb } : undefined;

  if (loadState === 'loading') {
    return (
      <section className="anatomy-learning-layer" dir="rtl" style={themeStyle}>
        <LearningStatePanel
          state="loading"
          title={`در حال آماده‌سازی مسیر ${subjectLabel}`}
          description="واحدها، پیشرفت و آخرین نقطه مطالعه در حال بازیابی است…"
        />
      </section>
    );
  }

  if (loadState === 'error') {
    return (
      <section className="anatomy-learning-layer" dir="rtl" style={themeStyle}>
        <LearningStatePanel
          state="error"
          title={`مسیر ${subjectLabel} بارگذاری نشد`}
          description={error}
          onRetry={() => setRequestVersion((version) => version + 1)}
        />
      </section>
    );
  }

  if (!course || !progressState) {
    return (
      <section className="anatomy-learning-layer" dir="rtl" style={themeStyle}>
        <LearningStatePanel state="empty" title="محتوایی پیدا نشد" description="هنوز واحدی برای این درس تعریف نشده است." />
      </section>
    );
  }

  /* واحدهای دست‌نویس با موتور یادگیری باز می‌شوند؛ واحدهای برگرفته از میکرودرسنامه به
     خوانندهٔ همان مبحث می‌روند (تنها محتوای واقعیِ آن درس). */
  const openUnit = (unitId, stepId) => {
    const unit = ContentService.getUnit(course, unitId);
    if (!unit) return;
    if (unit.micro) {
      navigate({ name: 'reader', moduleId: unit.moduleId, topicId: unit.micro.topicId, unitId });
      return;
    }
    navigate({ name: 'unit', moduleId: unit.moduleId, unitId, stepId });
  };
  const restartUnit = (unit) => {
    if (!unit) return;
    setProgressState((current) => ProgressService.save(
      course.id,
      ProgressService.resetUnit(current, unit),
      userId,
    ));
    openUnit(unit.id, 'activate');
  };

  const activeUnit = route.unitId ? ContentService.getUnit(course, route.unitId) : null;
  /* view ذخیره‌شده در URL ممکن است شکل قدیمی (module) باشد؛ قبل از رندر نرمال می‌شود */
  const currentRoute = normalizeRoute(route);

  /* خوانندهٔ میکرودرسنامه عرض خودش را دارد و باید در سطح خودِ لایه بنشیند، نه داخل
     قالب لایهٔ یادگیری — وگرنه دو بار ۸۰٪ می‌شود. */
  if (currentRoute.name === 'reader') {
    return (
      <MicroCourseReader
        courseId={course.id}
        userId={userId}
        view={{ topicId: currentRoute.topicId, pageId: currentRoute.pageId }}
        patchView={(partial) => setRoute({ ...currentRoute, ...partial })}
        onExit={() => navigate({ name: 'overview', moduleId: currentRoute.moduleId })}
      />
    );
  }

  return (
    <section className="anatomy-learning-layer" dir="rtl" style={themeStyle} aria-label={`درسنامهٔ جامع ${subjectLabel}`}>
      {currentRoute.name === 'overview' && (
        <AnatomyOverview
          course={course}
          progressState={progressState}
          initialModuleId={currentRoute.moduleId}
          onBack={onBack}
          onOpenUnit={openUnit}
        />
      )}

      {currentRoute.name === 'unit' && activeUnit && (
        <UnitPage
          course={course}
          unit={activeUnit}
          progressState={progressState}
          setProgressState={setProgressState}
          userId={userId}
          initialStep={route.stepId}
          onAnatomyBack={() => navigate({ name: 'overview' })}
        />
      )}
    </section>
  );
}

export { AnatomyLearningLayer };
