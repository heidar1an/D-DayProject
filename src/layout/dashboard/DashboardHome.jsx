import { useState } from 'react';
import UserProfileCard from './UserProfileCard';
import DashboardActionCards from './DashboardActionCards';
import PeersSection from './PeersSection';
import HeartChart from './heart-chart/HeartChart';
import RangeDropdown from './heart-chart/RangeDropdown';
import ChartModeToggle from './heart-chart/ChartModeToggle';
import { SolidIcon } from './heart-chart/chartIcons';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

/* آمار هدر نمودار — فعلاً Mock؛ وقتی سرویس قلب خلاصهٔ امروز را داد، از همان خوانده می‌شود. */
const HEARTS_TODAY = 113;
const STREAK_DAYS = 3;

export default function DashboardHome({ userData, onOpenFlashcards, onOpenNotes, onOpenReviewNotebook }) {
  const [heartRange, setHeartRange] = useState('daily');
  const [chartMode, setChartMode] = useState('bar');

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
                  <b>{toFa(HEARTS_TODAY)}</b>
                  <i>قلب</i>
                </span>
              </span>

              <span className="dashboard__chart-stat dashboard__chart-stat--streak">
                <SolidIcon name="flame" size={18} />
                <span className="dashboard__chart-stat-text">
                  <b>{toFa(STREAK_DAYS)}</b>
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
