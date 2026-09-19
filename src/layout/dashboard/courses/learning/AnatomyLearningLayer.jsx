import { useEffect, useState } from 'react';
import { ContentService, ProgressService } from '../../../../services/learning';
import { LAYER_IDS, useLayerRoute } from '../../dashboardRoute';
import AnatomyOverview from './AnatomyOverview';
import UnitPage from './UnitPage';
import { LearningStatePanel } from './LearningPrimitives';
import './learning.css';

/* مسیر داخلی لایهٔ یادگیری آناتومی داخل همان view لایهٔ درسنامهٔ جامع ذخیره می‌شود (slot)
   تا رفرش و Back/Forward همان ماژول/واحد را برگردانند. */
const ANATOMY_HOME = { name: 'overview' };

/* initialRoute فقط هنگام ورود از لینک عمیق (کارت‌های «کار امروز» صفحه دوره‌ها) مقدار دارد.
   نمای واسط «صفحهٔ بخش» حذف شده است؛ مسیر module قدیمی به overview با بخش پیش‌انتخابی مپ می‌شود. */
function normalizeRoute(route) {
  if (route?.name === 'unit' && route.moduleId && route.unitId) {
    return { name: 'unit', moduleId: route.moduleId, unitId: route.unitId, stepId: route.stepId };
  }
  if (route?.name === 'module' && route.moduleId) {
    return { name: 'overview', moduleId: route.moduleId };
  }
  return { name: 'overview' };
}

export default function AnatomyLearningLayer({ onBack, userId = 'local-user', initialRoute = null }) {
  const [course, setCourse] = useState(null);
  const [progressState, setProgressState] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');
  const [requestVersion, setRequestVersion] = useState(0);
  const [route, setRoute] = useLayerRoute(
    LAYER_IDS.comprehensive,
    initialRoute ? normalizeRoute(initialRoute) : ANATOMY_HOME,
    { slot: 'anatomy' },
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoadState('loading');
    setError('');

    ContentService.getCourse('anatomy', { signal: controller.signal })
      .then((loadedCourse) => {
        setCourse(loadedCourse);
        setProgressState(ProgressService.load(loadedCourse, userId));
        setLoadState('ready');
      })
      .catch((loadError) => {
        if (loadError.name === 'AbortError') return;
        setError(loadError.message || 'بارگذاری مسیر آناتومی با مشکل روبه‌رو شد.');
        setLoadState('error');
      });

    return () => controller.abort();
  }, [requestVersion, userId]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (normalizeRoute(route).name === 'unit') setRoute({ name: 'overview' });
      else onBack?.();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onBack, route, setRoute]);

  const navigate = (nextRoute) => {
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  if (loadState === 'loading') {
    return (
      <section className="anatomy-learning-layer" dir="rtl">
        <LearningStatePanel
          state="loading"
          title="در حال آماده‌سازی مسیر آناتومی"
          description="واحدها، پیشرفت و آخرین نقطه مطالعه در حال بازیابی است…"
        />
      </section>
    );
  }

  if (loadState === 'error') {
    return (
      <section className="anatomy-learning-layer" dir="rtl">
        <LearningStatePanel
          state="error"
          title="مسیر آناتومی بارگذاری نشد"
          description={error}
          onRetry={() => setRequestVersion((version) => version + 1)}
        />
      </section>
    );
  }

  if (!course || !progressState) {
    return (
      <section className="anatomy-learning-layer" dir="rtl">
        <LearningStatePanel state="empty" title="محتوایی پیدا نشد" description="هنوز واحدی برای این درس تعریف نشده است." />
      </section>
    );
  }

  const openUnit = (unitId, stepId) => {
    const unit = ContentService.getUnit(course, unitId);
    if (!unit) return;
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

  return (
    <section className="anatomy-learning-layer" dir="rtl" aria-label="سیستم یادگیری آناتومی">
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
