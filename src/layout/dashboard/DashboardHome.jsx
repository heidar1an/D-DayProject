import UserProfileCard from './UserProfileCard';
import DashboardActionCards from './DashboardActionCards';

export default function DashboardHome({ userData }) {
  return (
    <main className="dashboard__main">
      <section className="dashboard__tools" aria-label="ابزارهای مطالعه">
        <DashboardActionCards />
      </section>

      <aside className="dashboard__profile">
        <UserProfileCard userData={userData} />
      </aside>
    </main>
  );
}
