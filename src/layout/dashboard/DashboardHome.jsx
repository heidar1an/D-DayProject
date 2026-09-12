import UserProfileCard from './UserProfileCard';
import DashboardActionCards from './DashboardActionCards';
import PeersSection from './PeersSection';

export default function DashboardHome({ userData }) {
  return (
    <main className="dashboard__main dash-stagger">
      <div className="dashboard__top-row dash-stagger">
        <aside className="dashboard__profile">
          <UserProfileCard userData={userData} />
        </aside>

        <section className="dashboard__chart" aria-label="نمودار تعداد قلب">
          <div className="dashboard__chart-header">
            <h2 className="dashboard__chart-title">تعداد قلب</h2>

            <div className="dashboard__chart-stats">
              <span className="dashboard__chart-stat dashboard__chart-stat--streak">
                ۳ روز متوالی 🔥
              </span>
              <span className="dashboard__chart-stat dashboard__chart-stat--hearts">
                ۱۱۳ قلب ❤️
              </span>
            </div>

            <button type="button" className="dashboard__chart-period">
              روزانه
              <span className="dashboard__chart-period-arrow" aria-hidden="true">
                ▾
              </span>
            </button>
          </div>

          <div className="dashboard__chart-body">
            {/* TODO: نمودار تعداد قلب اینجا اضافه می‌شود */}
          </div>
        </section>
      </div>

      <div className="dashboard__cards-row dash-stagger" aria-label="ابزارهای مطالعه و همخوان‌ها">
        <PeersSection />
        <DashboardActionCards />
      </div>
    </main>
  );
}