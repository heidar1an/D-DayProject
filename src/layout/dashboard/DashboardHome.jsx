import { useEffect, useState } from 'react';
import UserProfileCard from './UserProfileCard';
import DashboardActionCards from './DashboardActionCards';
import PeersSection from './PeersSection';
import HeartChart from './heart-chart/HeartChart';
import RangeDropdown from './heart-chart/RangeDropdown';
import ChartModeToggle from './heart-chart/ChartModeToggle';
import { SolidIcon } from './heart-chart/chartIcons';
import { fetchHeartSummary } from '../../services/hearts/heartStatsService';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

export default function DashboardHome({ userData, onOpenFlashcards, onOpenNotes, onOpenReviewNotebook }) {
  const [heartRange, setHeartRange] = useState('daily');
  const [chartMode, setChartMode] = useState('bar');
  const [heartSummary, setHeartSummary] = useState({ today: 0, total: 0, streak: 0 });

  useEffect(() => {
    let alive = true;
    const refresh = () => fetchHeartSummary()
      .then((summary) => { if (alive) setHeartSummary(summary); })
      .catch(() => { if (alive) setHeartSummary({ today: 0, total: 0, streak: 0 }); });
    refresh();
    window.addEventListener('tapesh:hearts:changed', refresh);
    return () => {
      alive = false;
      window.removeEventListener('tapesh:hearts:changed', refresh);
    };
  }, [userData?.id]);

  return (
    <main className="dashboard__main dash-stagger">
      <div className="dashboard__top-row dash-stagger">
        <aside className="dashboard__profile">
          <UserProfileCard userData={userData} />
        </aside>

        <section className="dashboard__chart" aria-label="نمودار تعداد قلب">
          {/* تیتر حذف شده؛ خودِ اعداد با آیکون، سرِ کادر را می‌سازند */}
          <div className="dashboard__chart-header">
            <div className="dashboard__chart-stats">
              <span className="dashboard__chart-stat dashboard__chart-stat--hearts">
                <SolidIcon name="heart" size={18} />
                <span className="dashboard__chart-stat-text">
                  <b>{toFa(heartSummary.today)}</b>
                  <i>قلب امروز</i>
                </span>
              </span>

              <span className="dashboard__chart-stat dashboard__chart-stat--streak">
                <SolidIcon name="flame" size={18} />
                <span className="dashboard__chart-stat-text">
                  <b>{toFa(heartSummary.streak)}</b>
                  <i>روز متوالی</i>
                </span>
              </span>
            </div>

            <div className="dashboard__chart-tools">
              <ChartModeToggle value={chartMode} onChange={setChartMode} />
              <RangeDropdown value={heartRange} onChange={setHeartRange} />
            </div>
          </div>

          <div className="dashboard__chart-body">
            <HeartChart range={heartRange} mode={chartMode} />
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
