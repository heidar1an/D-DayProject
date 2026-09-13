import { useMemo, useState } from 'react';
import { ProgressService, RecommendationService } from '../../../../services/learning';
import {
  Breadcrumb,
  ContinueLearning,
  LearningProgress,
  MasteryIndicator,
  RecommendationCard,
} from './LearningPrimitives';
import { getLearningStatus, toFa } from './learningUtils';

const MODULE_FILTERS = [
  { id: 'all', label: 'همه بخش‌ها' },
  { id: 'learning', label: 'در حال یادگیری' },
  { id: 'completed', label: 'تکمیل‌شده' },
  { id: 'fresh', label: 'شروع‌نشده' },
];

export function AnatomyModuleHeader({ title, subtitle, description, eyebrow = 'درسنامه جامع · علوم پایه', children }) {
  return (
    <header className="anatomy-header">
      <div className="anatomy-header__visual" aria-hidden="true">
        <svg viewBox="0 0 180 180" fill="none">
          <circle cx="90" cy="90" r="66" />
          <path d="M91 25v130M51 54c22 12 56 12 78 0M48 91h84M55 127c20-9 50-9 70 0" />
          <path d="M70 34c-19 25-25 75-4 111M110 34c19 25 25 75 4 111" opacity=".55" />
        </svg>
        <span>ANATOMY</span>
      </div>
      <div className="anatomy-header__copy">
        <small>{eyebrow}</small>
        <h1>{title}</h1>
        <h2>{subtitle}</h2>
        <p>{description}</p>
        {children}
      </div>
    </header>
  );
}

export function AnatomyModuleCard({ module, onOpen }) {
  const status = module.locked ? 'locked' : module.status;
  const statusMeta = getLearningStatus(status);
  const enabled = Boolean(module.available && !module.locked);

  return (
    <article className={`anatomy-module-card anatomy-module-card--${status}`}>
      <header>
        <span className="anatomy-module-card__number">{toFa(String(module.order).padStart(2, '0'))}</span>
        <span className={`status-pill status-pill--${statusMeta.tone}`}>{statusMeta.label}</span>
      </header>
      <div className="anatomy-module-card__body">
        <h3>{module.title}</h3>
        <p>{module.description}</p>
      </div>
      <div className="anatomy-module-card__meta">
        <span><b>{toFa(module.unitCount)}</b> واحد آموزشی</span>
        <span><b>{toFa(module.tests)}</b> تست</span>
      </div>
      <LearningProgress value={module.progress} label="پیشرفت بخش" compact />
      <div className="anatomy-module-card__activity">
        <small>آخرین فعالیت</small>
        <span>{module.lastActivity}</span>
      </div>
      <button
        type="button"
        className={`learn-button ${enabled ? 'learn-button--soft' : 'learn-button--quiet'}`}
        disabled={!enabled}
        onClick={() => onOpen?.(module.id)}
      >
        {module.locked ? 'پس از تکمیل مسیر' : enabled ? 'ادامه یادگیری' : status === 'completed' ? 'تکمیل‌شده' : 'به‌زودی'}
        {enabled && <span aria-hidden="true">←</span>}
      </button>
    </article>
  );
}

export default function AnatomyOverview({ course, progressState, onBack, onOpenModule, onOpenUnit, onRestartUnit }) {
  const [filter, setFilter] = useState('all');
  const upperSummary = ProgressService.getModuleSummary(course, progressState, 'upper-limb');
  const courseSummary = ProgressService.getCourseSummary(course, progressState);
  const modules = useMemo(
    () => course.modules.map((module) => module.id === 'upper-limb'
      ? {
          ...module,
          progress: Math.max(module.progress, upperSummary.progress),
          status: upperSummary.completed === upperSummary.total && upperSummary.total ? 'completed' : upperSummary.learning ? 'learning' : module.status,
        }
      : module),
    [course.modules, upperSummary.completed, upperSummary.learning, upperSummary.progress, upperSummary.total],
  );
  const visibleModules = filter === 'all' ? modules : modules.filter((module) => module.status === filter);
  const overallProgress = Math.round(modules.reduce((sum, module) => sum + module.progress, 0) / modules.length);
  const recommendation = RecommendationService.forCourse(course, progressState);
  const completedFoundationUnits = course.modules
    .filter((module) => module.status === 'completed')
    .reduce((sum, module) => sum + module.unitCount, 0);
  const recentUnit = course.unitsByModule['upper-limb']?.find((unit) => unit.id === progressState.lastLocation?.unitId);

  const handleRecommendation = () => {
    if (recommendation.target?.type === 'unit') {
      onOpenUnit(recommendation.target.unitId, recommendation.target.stepId);
      return;
    }
    onOpenModule(recommendation.target?.moduleId || 'upper-limb');
  };

  return (
    <section className="anatomy-overview">
      <Breadcrumb items={[
        { label: 'درسنامه جامع', onClick: onBack },
        { label: 'آناتومی' },
      ]} />

      <AnatomyModuleHeader
        title={course.title}
        subtitle={course.subtitle}
        description={course.description}
      >
        <div className="anatomy-header__actions">
          <button type="button" className="learn-button learn-button--primary" onClick={() => onOpenModule('upper-limb')}>
            ورود به مسیر اندام فوقانی
            <span aria-hidden="true">←</span>
          </button>
          <span>{toFa(course.modules.length)} بخش · {toFa(course.modules.reduce((sum, module) => sum + module.unitCount, 0))} واحد</span>
        </div>
      </AnatomyModuleHeader>

      <section className="learning-algorithm" aria-labelledby="algorithm-title">
        <header>
          <div>
            <small>TAPESH LEARNING ENGINE</small>
            <h2 id="algorithm-title">هر واحد، یک چرخه کامل یادگیری</h2>
          </div>
          <p>محتوا → اقدام → بازخورد → حافظه → تسلط</p>
        </header>
        <div>
          {course.algorithm.map((step, index) => (
            <span key={step.id}>
              <i>{toFa(index + 1)}</i>
              <b>{step.label}</b>
              <small lang="en">{step.english}</small>
            </span>
          ))}
        </div>
      </section>

      <ContinueLearning
        location={progressState.lastLocation}
        onContinue={() => onOpenUnit(progressState.lastLocation.unitId, progressState.lastLocation.stepId)}
        onRestart={() => onRestartUnit(recentUnit)}
      />

      <section className="anatomy-dashboard" aria-labelledby="my-learning-title">
        <header>
          <div>
            <small>MY LEARNING</small>
            <h2 id="my-learning-title">وضعیت یادگیری من</h2>
          </div>
          <span>آخرین فعالیت: {progressState.lastLocation?.detail || 'هنوز فعالیتی ثبت نشده'}</span>
        </header>
        <div className="anatomy-dashboard__grid">
          <article className="anatomy-dashboard__progress">
            <LearningProgress
              value={overallProgress}
              label="پیشرفت کلی آناتومی"
              detail={`${toFa(modules.filter((module) => module.progress > 0).length)} بخش از ${toFa(modules.length)} بخش آغاز شده`}
            />
          </article>
          <article className="anatomy-dashboard__mastery">
            <MasteryIndicator value={Math.max(courseSummary.mastery, 18)} />
          </article>
          <article className="anatomy-dashboard__metric">
            <small>واحدهای تکمیل‌شده</small>
            <strong>{toFa(completedFoundationUnits + courseSummary.completed)}</strong>
            <span>از کل مسیر آناتومی</span>
          </article>
          <article className="anatomy-dashboard__metric">
            <small>مفاهیم نیازمند مرور</small>
            <strong>{toFa(courseSummary.weakConcepts || 2)}</strong>
            <span>اولویت مرور امروز</span>
          </article>
          <article className="anatomy-dashboard__recent">
            <small>فعالیت اخیر</small>
            <strong>{progressState.lastLocation?.unitTitle || 'هنوز واحدی شروع نشده'}</strong>
            <p>{progressState.lastLocation?.detail || 'برای ساختن مسیر شخصی، یک واحد را آغاز کن.'}</p>
          </article>
        </div>
      </section>

      <RecommendationCard recommendation={recommendation} onAction={handleRecommendation} />

      <section className="anatomy-catalog" aria-labelledby="anatomy-modules-title">
        <header className="anatomy-section-heading">
          <div>
            <small>LEARNING MODULES</small>
            <h2 id="anatomy-modules-title">بخش‌های اصلی آناتومی</h2>
            <p>هر بخش یک مسیر مستقل با واحدها، تمرین‌ها، تشخیص و مرور هوشمند است.</p>
          </div>
          <div className="anatomy-filters" role="tablist" aria-label="فیلتر بخش‌های آناتومی">
            {MODULE_FILTERS.map((item) => {
              const count = item.id === 'all' ? modules.length : modules.filter((module) => module.status === item.id).length;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.id}
                  className={filter === item.id ? 'is-active' : ''}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}<span>{toFa(count)}</span>
                </button>
              );
            })}
          </div>
        </header>
        {visibleModules.length ? (
          <div className="anatomy-modules-grid">
            {visibleModules.map((module) => (
              <AnatomyModuleCard key={module.id} module={module} onOpen={onOpenModule} />
            ))}
          </div>
        ) : (
          <div className="anatomy-catalog__empty">بخشی با این وضعیت وجود ندارد.</div>
        )}
      </section>
    </section>
  );
}
