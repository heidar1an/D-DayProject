import { useState } from 'react';
import DashboardHeader from './DashboardHeader';
import SettingHeader from './setting/SettingHeader';
import EditProfile from './setting/EditProfile';
import DashboardHome from './DashboardHome';
import CoursesSection from './CoursesSection';
import TestsSection from './TestsSection';
import OtherSections from './OtherSections';

const settingsTabLabels = {
  profile: 'ویرایش پروفایل',
  subscription: 'اشتراک',
  transactions: 'تراکنش ها',
  security: 'امنیت',
  support: 'راهنما و پشتیبان',
};

export default function DashboardLayout({ userData }) {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('profile');

  const handleSectionChange = (sectionId) => {
    setActiveSection(sectionId);
    setIsSettingsOpen(false);
  };

  const handleSettingsToggle = () => {
    if (isSettingsOpen) {
      setIsSettingsOpen(false);
      return;
    }

    setSettingsTab('profile');
    setIsSettingsOpen(true);
  };

  const sections = {
    dashboard: <DashboardHome userData={userData} />,
    courses: <CoursesSection />,
    tests: <TestsSection />,
    other: <OtherSections />,
  };

  return (
    <div className="dashboard">
      <DashboardHeader
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        isSettingsOpen={isSettingsOpen}
        onSettingsToggle={handleSettingsToggle}
      />

      {isSettingsOpen ? (
        <div className="dashboard__settings">
          <div className="dashboard-settings-header">
            <SettingHeader activeTab={settingsTab} onTabChange={setSettingsTab} />
          </div>

          <div className="dashboard__settings-panel">
            {settingsTab === 'profile' ? (
              <EditProfile userData={userData} />
            ) : (
              <section
                dir="rtl"
                aria-label={settingsTabLabels[settingsTab]}
                className="mx-auto w-[var(--content-width)] py-8 text-white md:py-10 [font-family:'Pinar',Tahoma,sans-serif]"
              >
                <div className="rounded-[2.5rem] bg-[#282828] p-10 text-center md:rounded-[3rem] md:p-14">
                  <h2 className="text-2xl text-[#b99a86] md:text-3xl [font-family:'Doran',Tahoma,sans-serif]">
                    {settingsTabLabels[settingsTab]}
                  </h2>
                  <p className="mt-4 text-[#aaa]">این بخش به‌زودی اضافه می‌شود.</p>
                </div>
              </section>
            )}
          </div>
        </div>
      ) : (
        <div className="dashboard__section">{sections[activeSection]}</div>
      )}
    </div>
  );
}
