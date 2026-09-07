import { useState } from 'react';
import DashboardHeader from './DashboardHeader';
import DashboardHome from './DashboardHome';
import CoursesSection from './CoursesSection';
import TestsSection from './TestsSection';
import OtherSections from './OtherSections';

export default function DashboardLayout({ userData }) {
  const [activeSection, setActiveSection] = useState('dashboard');
  const sections = {
    dashboard: <DashboardHome userData={userData} />,
    courses: <CoursesSection />,
    tests: <TestsSection />,
    other: <OtherSections />,
  };

  return (
    <div className="dashboard">
      <DashboardHeader activeSection={activeSection} onSectionChange={setActiveSection} />
      {sections[activeSection]}
    </div>
  );
}
