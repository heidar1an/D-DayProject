import { useState } from 'react';
import DashboardHeader from './DashboardHeader';
import SettingHeader from './setting/SettingHeader';
import EditProfile from './setting/EditProfile';
import Pays from './setting/Pays';
import Security from './setting/Security';
import Soppurt from './setting/Soppurt';
import DashboardHome from './DashboardHome';
import CoursesSection from './CoursesSection';
import ComprehensiveCourseLayer from './courses/ComprehensiveCourseLayer';
import MicroCourseLayer from './courses/MicroCourseLayer';
import ReferenceLayer from './courses/ReferenceLayer';
import TestsSection from './TestsSection';
import InternationalExamsLayer from './tests/InternationalExamsLayer';
import CoordinatedExamsLayer from './tests/coordinated/CoordinatedExamsLayer';
import TestBankLayer from './tests/bank/TestBankLayer';
import AnalyticsLayer from './analytics/AnalyticsLayer';
import OtherSections from './OtherSections';
import WikiLayer from './wiki/WikiLayer';
import KnowledgeLayer from './knowledge/KnowledgeLayer';
import NotificationsSection from './NotificationsSection';
import LeagueSection from './league/LeagueSection';
import FlashcardSection from './flashcards/FlashcardSection';
import NotesSection from './notes/NotesSection';
import ReviewNotebook from './review/ReviewNotebook';
import Pomodoro, { usePomodoro, formatTimer } from './Pomodoro';

const settingsTabLabels = {
  profile: 'ویرایش پروفایل',
  subscription: 'اشتراک',
  transactions: 'تراکنش ها',
  security: 'امنیت',
  support: 'راهنما و پشتیبان',
};

export default function DashboardLayout({ userData, onUserDataChange, onLogout }) {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('profile');
  const [areNotificationsOpen, setAreNotificationsOpen] = useState(false);
  const [openCourseLayer, setOpenCourseLayer] = useState(null); // null | { id, target }
  const [openInternationalLayer, setOpenInternationalLayer] = useState(false);
  const [openCoordinatedLayer, setOpenCoordinatedLayer] = useState(false);
  const [openTestBankLayer, setOpenTestBankLayer] = useState(null); // null | {initialView}
  const [openAnalyticsLayer, setOpenAnalyticsLayer] = useState(false);
  const [openWikiLayer, setOpenWikiLayer] = useState(false);
  const [openKnowledgeLayer, setOpenKnowledgeLayer] = useState(false);
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

  const handleSectionChange = (sectionId) => {
    setActiveSection(sectionId);
    setIsSettingsOpen(false);
    setAreNotificationsOpen(false);
    setOpenCourseLayer(null);
    setOpenInternationalLayer(false);
    setOpenCoordinatedLayer(false);
    setOpenTestBankLayer(null);
    setOpenAnalyticsLayer(false);
    setOpenWikiLayer(false);
    setOpenKnowledgeLayer(false);
  };

  const handleSettingsToggle = () => {
    if (isSettingsOpen) {
      setIsSettingsOpen(false);
      return;
    }

    setSettingsTab('profile');
    setIsSettingsOpen(true);
    setAreNotificationsOpen(false);
    setOpenCourseLayer(null);
    setOpenInternationalLayer(false);
    setOpenCoordinatedLayer(false);
    setOpenTestBankLayer(null);
    setOpenAnalyticsLayer(false);
    setOpenWikiLayer(false);
  };

  const handleNotificationsToggle = () => {
    if (areNotificationsOpen) {
      setAreNotificationsOpen(false);
      return;
    }

    setIsSettingsOpen(false);
    setAreNotificationsOpen(true);
    setOpenCourseLayer(null);
    setOpenInternationalLayer(false);
    setOpenCoordinatedLayer(false);
    setOpenTestBankLayer(null);
    setOpenAnalyticsLayer(false);
    setOpenWikiLayer(false);
    setOpenKnowledgeLayer(false);
  };

  /* «درسنامه جامع»، «میکرو درسنامه» و «رفرنس» لایه دارند؛ بقیه دوره‌ها به‌زودی.
     target برای لینک عمیق است: { subject, moduleId?, unitId?, stepId? } */
  const handleOpenCourse = (courseId, target = null) => {
    if (courseId !== 'comprehensive' && courseId !== 'micro' && courseId !== 'reference') return;

    setOpenCourseLayer({ id: courseId, target });
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const sections = {
    dashboard: (
      <DashboardHome
        userData={userData}
        onOpenFlashcards={() => handleSectionChange('flashcards')}
        onOpenNotes={() => handleSectionChange('notes')}
        onOpenReviewNotebook={() => handleSectionChange('review-notebook')}
        onOpenLeague={() => handleSectionChange('league')}
      />
    ),
    courses: <CoursesSection onOpenCourse={handleOpenCourse} />,
    tests: (
      <TestsSection
        onOpenAnalytics={() => {
          setOpenAnalyticsLayer(true);
          window.scrollTo({ top: 0, behavior: 'instant' });
        }}
        onOpenInternational={() => setOpenInternationalLayer(true)}
        onOpenCoordinated={() => setOpenCoordinatedLayer(true)}
        onOpenTestBank={(initialView) => {
          setOpenTestBankLayer({ initialView: initialView ?? null });
          window.scrollTo({ top: 0, behavior: 'instant' });
        }}
      />
    ),
    flashcards: <FlashcardSection userData={userData} />,
    notes: <NotesSection userData={userData} />,
    'review-notebook': (
      <ReviewNotebook
        userData={userData}
        onOpenLearning={() => {
          setActiveSection('courses');
          setOpenCourseLayer({ id: 'comprehensive', target: null });
          window.scrollTo({ top: 0, behavior: 'instant' });
        }}
      />
    ),
    other: <OtherSections onOpenWiki={() => {
      setOpenWikiLayer(true);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }} onOpenKnowledge={() => {
      setOpenKnowledgeLayer(true);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }} />,
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

  return (
    <div className="dashboard">
      <DashboardHeader
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        isSettingsOpen={isSettingsOpen}
        onSettingsToggle={handleSettingsToggle}
        areNotificationsOpen={areNotificationsOpen}
        onNotificationsToggle={handleNotificationsToggle}
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
            <SettingHeader activeTab={settingsTab} onTabChange={setSettingsTab} />
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
                className="mx-auto w-[var(--content-width)] py-8 text-white md:py-10 [font-family:'Pinar',Tahoma,sans-serif]"
              >
                <div className="dash-stagger rounded-[2.5rem] bg-[#282828] p-10 text-center md:rounded-[3rem] md:p-14">
                  <h2 className="text-2xl text-[#b99a86] md:text-3xl [font-family:'Doran',Tahoma,sans-serif]">
                    {settingsTabLabels[settingsTab]}
                  </h2>
                  <p className="mt-4 text-[#aaa]">این بخش به‌زودی اضافه می‌شود.</p>
                </div>
              </section>
            )}
          </div>
        </div>
      ) : areNotificationsOpen ? (
        <NotificationsSection />
      ) : openCourseLayer ? (
        <div
          className="dashboard__section dashboard-layer-reveal"
          key={`course-${openCourseLayer.id}-${openCourseLayer.target?.subject ?? ''}-${openCourseLayer.target?.unitId ?? ''}`}
        >
          {openCourseLayer.id === 'micro' ? (
            <MicroCourseLayer
              onBack={() => setOpenCourseLayer(null)}
              onOpenComprehensive={() => setOpenCourseLayer({ id: 'comprehensive', target: null })}
              initialSubject={openCourseLayer.target?.subject}
            />
          ) : openCourseLayer.id === 'reference' ? (
            <ReferenceLayer onBack={() => setOpenCourseLayer(null)} />
          ) : (
            <ComprehensiveCourseLayer
              userId={userData?.id ?? userData?.phone ?? 'guest'}
              onBack={() => setOpenCourseLayer(null)}
              deepLink={openCourseLayer.target}
            />
          )}
        </div>
      ) : openInternationalLayer ? (
        <div className="dashboard__section dashboard-layer-reveal" key="international-exams">
          <InternationalExamsLayer
            userData={userData}
            onBack={() => setOpenInternationalLayer(false)}
          />
        </div>
      ) : openCoordinatedLayer ? (
        <div className="dashboard__section dashboard-layer-reveal" key="coordinated-exams">
          <CoordinatedExamsLayer
            userData={userData}
            onBack={() => setOpenCoordinatedLayer(false)}
          />
        </div>
      ) : openTestBankLayer ? (
        <div className="dashboard__section dashboard-layer-reveal" key="test-bank">
          <TestBankLayer
            userData={userData}
            initialView={openTestBankLayer.initialView}
            onBack={() => setOpenTestBankLayer(null)}
          />
        </div>
      ) : openAnalyticsLayer ? (
        <div className="dashboard__section dashboard-layer-reveal" key="analytics">
          <AnalyticsLayer
            userData={userData}
            onBack={() => setOpenAnalyticsLayer(false)}
          />
        </div>
      ) : openWikiLayer ? (
        <div className="dashboard__section dashboard-layer-reveal" key="tapesh-wiki">
          <WikiLayer onBack={() => setOpenWikiLayer(false)} />
        </div>
      ) : openKnowledgeLayer ? (
        <div className="dashboard__section dashboard-layer-reveal" key="knowledge-network">
          <KnowledgeLayer
            userData={userData}
            onBack={() => setOpenKnowledgeLayer(false)}
          />
        </div>
      ) : (
        <div className="dashboard__section dashboard-layer-reveal" key={activeSection}>
          {sections[activeSection]}
        </div>
      )}
    </div>
  );
}
