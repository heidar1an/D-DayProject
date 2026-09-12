import { useState } from 'react';
import DashboardHeader from './DashboardHeader';
import SettingHeader from './setting/SettingHeader';
import EditProfile from './setting/EditProfile';
import Pays from './setting/Pays';
import Security from './setting/Security';
import Soppurt from './setting/Soppurt';
import DashboardHome from './DashboardHome';
import CoursesSection from './CoursesSection';
import TestsSection from './TestsSection';
import OtherSections from './OtherSections';
import NotificationsSection from './NotificationsSection';
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
  };

  const handleSettingsToggle = () => {
    if (isSettingsOpen) {
      setIsSettingsOpen(false);
      return;
    }

    setSettingsTab('profile');
    setIsSettingsOpen(true);
    setAreNotificationsOpen(false);
  };

  const handleNotificationsToggle = () => {
    if (areNotificationsOpen) {
      setAreNotificationsOpen(false);
      return;
    }

    setIsSettingsOpen(false);
    setAreNotificationsOpen(true);
  };

  const sections = {
    dashboard: <DashboardHome userData={userData} />,
    courses: <CoursesSection />,
    tests: <TestsSection />,
    other: <OtherSections />,
    league: (
      <section
        dir="rtl"
        aria-label="لیگ"
        className="mx-auto w-[var(--content-width)] py-8 text-white md:py-10 [font-family:'Pinar',Tahoma,sans-serif]"
      >
        <div className="dash-stagger rounded-[2.5rem] bg-[#282828] p-10 text-center md:rounded-[3rem] md:p-14">
          <h2 className="text-2xl text-[#937fcd] md:text-3xl [font-family:'Doran',Tahoma,sans-serif]">
            لیگ
          </h2>
          <p className="mt-4 text-[#aaa]">این بخش به‌زودی اضافه می‌شود.</p>
        </div>
      </section>
    ),
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
      ) : (
        <div className="dashboard__section dashboard-layer-reveal" key={activeSection}>
          {sections[activeSection]}
        </div>
      )}
    </div>
  );
}
