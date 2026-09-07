import Brand from './Brand';
import settingsIcon from '../../../images/icons/icons8-setting-500.png';

const navigationItems = [
  { id: 'dashboard', label: 'داشبورد' },
  { id: 'courses', label: 'دوره‌ها' },
  { id: 'tests', label: 'تست' },
  { id: 'other', label: 'سایر بخش‌ها' },
];

export default function DashboardHeader({ activeSection, onSectionChange }) {
  return (
    <header className="dashboard-header">
      <div className="dashboard-header__inner">
        <Brand />
        
        <nav className="dashboard-nav" aria-label="ناوبری داشبورد">
          {navigationItems.map((item) => (
            <button
              className={`dashboard-nav__link ${
                activeSection === item.id ? 'dashboard-nav__link--active' : ''
              }`}
              type="button"
              aria-current={activeSection === item.id ? 'page' : undefined}
              key={item.id}
              onClick={() => onSectionChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="dashboard-header__actions">
          <button className="dashboard-header__time" aria-label="زمان فعلی">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span>۱۵:۱۰:۰۰</span>
          </button>
          
          <button className="dashboard-header__icon-btn" aria-label="اعلان‌ها">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>
          </button>
          
          <button className="dashboard-header__icon-btn" aria-label="تنظیمات">
            <img src={settingsIcon} alt="" />
          </button>
        </div>
      </div>
    </header>
  );
}
