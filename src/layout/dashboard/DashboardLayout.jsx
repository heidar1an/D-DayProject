import { useEffect, useMemo, useState } from 'react';
import DashboardHeader from './DashboardHeader';
import SettingHeader from './setting/SettingHeader';
import EditProfile from './setting/EditProfile';
import Pays from './setting/Pays';
import Security from './setting/Security';
import Soppurt from './setting/Soppurt';
import DashboardHome from './DashboardHome';
import CoursesSection from './CoursesSection';
import MyCoursesLayer from './MyCoursesLayer';
import ComprehensiveCourseLayer from './courses/ComprehensiveCourseLayer';
import MicroCourseLayer from './courses/MicroCourseLayer';
import ReferenceLayer from './courses/ReferenceLayer';
import InternationalCoursesLayer from './courses/InternationalCoursesLayer';
import TestsSection from './TestsSection';
import InternationalExamsLayer from './tests/InternationalExamsLayer';
import CoordinatedExamsLayer from './tests/coordinated/CoordinatedExamsLayer';
import TestBankLayer, { testBankEntryView } from './tests/bank/TestBankLayer';
import AnalyticsLayer from './analytics/AnalyticsLayer';
import OtherSections from './OtherSections';
import WikiLayer from './wiki/WikiLayer';
import KnowledgeLayer from './knowledge/KnowledgeLayer';
import AILayer from './ai/AILayer';
import NotificationsSection from './NotificationsSection';
import LeagueSection from './league/LeagueSection';
import FlashcardSection from './flashcards/FlashcardSection';
import NotesSection from './notes/NotesSection';
import ReviewNotebook from './review/ReviewNotebook';
import Pomodoro, { usePomodoro, formatTimer } from './Pomodoro';
import {
  DashboardRouteProvider,
  EMPTY_DASHBOARD_ROUTE,
  LAYER_IDS,
  OVERLAY_IDS,
  useDashboardRouteState,
} from './dashboardRoute';
import {
  fetchFriendsLeagueNotifications,
  fetchLeagueNotifications,
} from '../../services/league/leagueService';

const settingsTabLabels = {
  profile: 'ویرایش پروفایل',
  subscription: 'اشتراک',
  transactions: 'تراکنش ها',
  security: 'امنیت',
  support: 'راهنما و پشتیبان',
};

/* کارت‌های بخش دوره‌ها → لایهٔ مستقل همان دوره */
const COURSE_LAYERS = {
  comprehensive: LAYER_IDS.comprehensive,
  micro: LAYER_IDS.micro,
  reference: LAYER_IDS.reference,
  international: LAYER_IDS.intlCourses,
};

/*
 * شمارندهٔ اعلان‌های نخوانده برای بج زنگولهٔ هدر — همان دو سرویسی که لایهٔ اعلان‌ها تغذیه می‌کنند.
 * فقط تعداد لازم است؛ خود لایه دادهٔ کامل را جداگانه می‌گیرد.
 */
function useUnreadNotificationsCount(isLayerOpen) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    let timerId;

    const poll = () => {
      Promise.all([fetchFriendsLeagueNotifications(), fetchLeagueNotifications()])
        .then(([friends, league]) => {
          if (alive) setCount(friends.unreadCount + league.unreadCount);
        })
        .catch(() => {
          /* در حالت آفلاین آخرین تعداد حفظ می‌شود */
        });

      timerId = window.setTimeout(poll, 90 * 1000);
    };

    poll();

    return () => {
      alive = false;
      window.clearTimeout(timerId);
    };
  }, []);

  /* وقتی لایهٔ اعلان‌ها باز و خوانده شد، بج صفر می‌شود */
  useEffect(() => {
    if (isLayerOpen) setCount(0);
  }, [isLayerOpen]);

  return count;
}

const scrollTop = () => window.scrollTo({ top: 0, behavior: 'instant' });

/*
 * چیدمان داشبورد — بخش، لایه و پنل‌ها همه از یک «مسیر» می‌آیند (dashboardRoute) تا
 * دکمهٔ Back/Forward مرورگر بین لایه‌ها جابه‌جا شود و رفرش کاربر را در همان لایه نگه دارد.
 */
export default function DashboardLayout({ userData, onUserDataChange, onLogout }) {
  const { route, routeRef, applyRoute } = useDashboardRouteState();
  const activeSection = route.section;
  const activeLayer = route.layer;
  const isSettingsOpen = route.overlay === OVERLAY_IDS.settings;
  const areNotificationsOpen = route.overlay === OVERLAY_IDS.notifications;
  const settingsTab = route.tab;
  const unreadNotificationsCount = useUnreadNotificationsCount(areNotificationsOpen);
  const {
    secondsLeft,
    isRunning,
    isBreak,
    isFinished,
    todayCount,
    todayMinutes,
    toggle: togglePomodoro,
    finish: finishPomodoro,
    startBreak,
  } = usePomodoro();

  /* ── ناوبری ── */

  const handleSectionChange = (sectionId) => {
    applyRoute({ ...EMPTY_DASHBOARD_ROUTE, section: sectionId });
    scrollTop();
  };

  const handleSettingsToggle = () => {
    if (isSettingsOpen) {
      applyRoute({ ...route, overlay: null });
      return;
    }

    applyRoute({
      ...route,
      overlay: OVERLAY_IDS.settings,
      tab: EMPTY_DASHBOARD_ROUTE.tab,
      layer: null,
      view: null,
    });
  };

  const handleSettingsTabChange = (tab) => {
    applyRoute({ ...route, overlay: OVERLAY_IDS.settings, tab, layer: null, view: null });
  };

  const handleNotificationsToggle = () => {
    if (areNotificationsOpen) {
      applyRoute({ ...route, overlay: null });
      return;
    }

    applyRoute({ ...route, overlay: OVERLAY_IDS.notifications, layer: null, view: null });
  };

  /* باز کردن لایه — extra برای حالت‌هایی است که همان‌جا بخش زیرین هم عوض می‌شود */
  const openLayer = (layerId, view = null, extra = null) => {
    applyRoute({ ...route, ...extra, layer: layerId, view, overlay: null });
    scrollTop();
  };

  const closeLayer = () => {
    applyRoute({ ...route, layer: null, view: null });
    scrollTop();
  };

  const handleOpenMyCourses = () => openLayer(LAYER_IDS.myCourses);

  /* دوره‌های دارای لایهٔ مستقل؛ target برای لینک عمیق دوره‌های آموزشی است. */
  const handleOpenCourse = (courseId, target = null) => {
    const layerId = COURSE_LAYERS[courseId];
    if (!layerId) return;
    openLayer(layerId, target ? { deep: target } : null);
  };

  const handleOpenSmartAI = () => openLayer(LAYER_IDS.ai);

  /* زمینهٔ مسیر برای لایه‌ها — useLayerRoute از route/routeRef و push/replace می‌خواند */
  const routeContext = useMemo(
    () => ({
      route,
      routeRef,
      push: (next) => applyRoute(next),
      replace: (next) => applyRoute(next, { replace: true }),
    }),
    [route, routeRef, applyRoute],
  );

  const sections = {
    dashboard: (
      <DashboardHome
        userData={userData}
        onOpenFlashcards={() => handleSectionChange('flashcards')}
        onOpenNotes={() => handleSectionChange('notes')}
        onOpenReviewNotebook={() => handleSectionChange('review-notebook')}
      />
    ),
    courses: (
      <CoursesSection
        onOpenCourse={handleOpenCourse}
        onOpenAllCourses={handleOpenMyCourses}
      />
    ),
    tests: (
      <TestsSection
        onOpenAnalytics={() => openLayer(LAYER_IDS.analytics)}
        onOpenInternational={() => openLayer(LAYER_IDS.intlExams)}
        onOpenCoordinated={() => openLayer(LAYER_IDS.coordinated)}
        onOpenTestBank={(initialView) => openLayer(LAYER_IDS.testBank, testBankEntryView(initialView))}
      />
    ),
    flashcards: <FlashcardSection userData={userData} />,
    notes: <NotesSection userData={userData} />,
    'review-notebook': (
      <ReviewNotebook
        userData={userData}
        onOpenLearning={() =>
          openLayer(LAYER_IDS.comprehensive, null, { section: 'courses' })
        }
      />
    ),
    other: (
      <OtherSections
        onOpenSmartAI={handleOpenSmartAI}
        onOpenWiki={() => openLayer(LAYER_IDS.wiki)}
        onOpenKnowledge={() => openLayer(LAYER_IDS.knowledge)}
      />
    ),
    league: <LeagueSection userData={userData} />,
    pomodoro: (
      <Pomodoro
        secondsLeft={secondsLeft}
        isRunning={isRunning}
        isBreak={isBreak}
        isFinished={isFinished}
        todayCount={todayCount}
        todayMinutes={todayMinutes}
        onToggle={togglePomodoro}
        onFinish={finishPomodoro}
        onStartBreak={startBreak}
      />
    ),
  };

  const handlePomodoroOpen = () => handleSectionChange('pomodoro');

  /* وقتی پومودو تمام شده ولی کاربر لایه پومودو را نمی‌بیند، کادر زمان هدر چشمک می‌زند */
  const isPomodoroHidden =
    activeSection !== 'pomodoro' || isSettingsOpen || areNotificationsOpen;

  const layerContent = (() => {
    switch (activeLayer) {
      case LAYER_IDS.ai:
        return <AILayer onBack={closeLayer} />;

      case LAYER_IDS.comprehensive:
        return (
          <ComprehensiveCourseLayer
            userId={userData?.id ?? userData?.phone ?? 'guest'}
            onBack={closeLayer}
          />
        );

      case LAYER_IDS.micro:
        return (
          <MicroCourseLayer
            onBack={closeLayer}
            onOpenComprehensive={(subjectId) =>
              openLayer(LAYER_IDS.comprehensive, subjectId ? { deep: { subject: subjectId } } : null)
            }
          />
        );

      case LAYER_IDS.reference:
        return <ReferenceLayer onBack={closeLayer} />;

      case LAYER_IDS.intlCourses:
        return <InternationalCoursesLayer onBack={closeLayer} />;

      case LAYER_IDS.myCourses:
        return <MyCoursesLayer onBack={closeLayer} onOpenCourse={handleOpenCourse} />;

      case LAYER_IDS.intlExams:
        return <InternationalExamsLayer userData={userData} onBack={closeLayer} />;

      case LAYER_IDS.coordinated:
        return <CoordinatedExamsLayer userData={userData} onBack={closeLayer} />;

      case LAYER_IDS.testBank:
        return <TestBankLayer userData={userData} onBack={closeLayer} />;

      case LAYER_IDS.analytics:
        return <AnalyticsLayer userData={userData} onBack={closeLayer} />;

      case LAYER_IDS.wiki:
        return <WikiLayer onBack={closeLayer} />;

      case LAYER_IDS.knowledge:
        return <KnowledgeLayer userData={userData} onBack={closeLayer} />;

      default:
        return null;
    }
  })();

  return (
    <DashboardRouteProvider value={routeContext}>
      <div className="dashboard">
        <DashboardHeader
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          isSettingsOpen={isSettingsOpen}
          onSettingsToggle={handleSettingsToggle}
          areNotificationsOpen={areNotificationsOpen}
          onNotificationsToggle={handleNotificationsToggle}
          notificationsUnreadCount={unreadNotificationsCount}
          headerTime={formatTimer(secondsLeft)}
          isPomodoroActive={activeSection === 'pomodoro'}
          isPomodoroRunning={isRunning}
          isPomodoroBreak={isBreak}
          isPomodoroFinished={isFinished && isPomodoroHidden}
          onPomodoroOpen={handlePomodoroOpen}
        />

        {isSettingsOpen ? (
          <div className="dashboard__settings">
            <div className="dashboard-settings-header dashboard-layer-reveal--down">
              <SettingHeader activeTab={settingsTab} onTabChange={handleSettingsTabChange} />
            </div>

            <div className="dashboard__settings-panel dashboard-layer-reveal" key={settingsTab}>
              {settingsTab === 'profile' ? (
                <EditProfile
                  userData={userData}
                  onUserDataChange={onUserDataChange}
                  onLogout={onLogout}
                />
              ) : settingsTab === 'transactions' ? (
                <Pays transactions={userData?.transactions} />
              ) : settingsTab === 'security' ? (
                <Security />
              ) : settingsTab === 'support' ? (
                <Soppurt />
              ) : (
                <section
                  dir="rtl"
                  aria-label={settingsTabLabels[settingsTab]}
                  className="mx-auto w-[var(--content-width)] py-8 text-white md:py-10 [font-family:'Pinar','Vazir',Tahoma,sans-serif]"
                >
                  <div className="dash-stagger rounded-[2.5rem] bg-[var(--surface-soft)] p-10 text-center md:rounded-[3rem] md:p-14">
                    <h2 className="text-2xl text-[var(--copper-ink)] md:text-3xl [font-family:'Doran','Vazir',Tahoma,sans-serif]">
                      {settingsTabLabels[settingsTab]}
                    </h2>
                    <p className="mt-4 text-[var(--muted)]">این بخش به‌زودی اضافه می‌شود.</p>
                  </div>
                </section>
              )}
            </div>
          </div>
        ) : areNotificationsOpen ? (
          <NotificationsSection />
        ) : activeLayer ? (
          <div className="dashboard__section dashboard-layer-reveal" key={activeLayer}>
            {layerContent}
          </div>
        ) : (
          <div className="dashboard__section dashboard-layer-reveal" key={activeSection}>
            {sections[activeSection]}
          </div>
        )}
      </div>
    </DashboardRouteProvider>
  );
}
