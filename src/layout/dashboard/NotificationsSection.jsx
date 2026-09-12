export default function NotificationsSection() {
  return (
    <section
      dir="rtl"
      aria-label="اعلان ها"
      className="notifications dashboard-layer-reveal"
    >
      <div className="notifications__panel dash-stagger">
        <h1 className="notifications__title">اعلان ها</h1>

        {/* آیتم‌های اعلان‌ها بعداً اینجا رندر می‌شوند */}
        <div className="notifications__list" />
      </div>
    </section>
  );
}
