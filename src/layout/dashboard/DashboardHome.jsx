import { useState } from 'react';
import UserProfileCard from './UserProfileCard';
import DashboardActionCards from './DashboardActionCards';
import PeersSection from './PeersSection';
import HeartChart from './heart-chart/HeartChart';
import RangeDropdown from './heart-chart/RangeDropdown';

export default function DashboardHome({ userData, onOpenFlashcards, onOpenNotes, onOpenReviewNotebook, onOpenLeague }) {
  const [heartRange, setHeartRange] = useState('daily');
  return (
    <main className="dashboard__main dash-stagger">
      <div className="dashboard__top-row dash-stagger">
        <aside className="dashboard__profile">
          <UserProfileCard userData={userData} onOpenLeague={onOpenLeague} />
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

            <RangeDropdown value={heartRange} onChange={setHeartRange} />
          </div>

          <div className="dashboard__chart-body">
            <HeartChart range={heartRange} />
          </div>
        </section>
      </div>

      <div className="dashboard__cards-row dash-stagger" aria-label="ابزارهای مطالعه و همخوان‌ها">
        <PeersSection />
        <DashboardActionCards
          onOpenFlashcards={onOpenFlashcards}
          onOpenNotes={onOpenNotes}
          onOpenReviewNotebook={onOpenReviewNotebook}
        />
      </div>
    </main>
  );
}
