export default function NotificationsSection() {
  return (
    <section
      dir="rtl"
      aria-label="اعلان ها"
      className="notifications"
    >
      <div className="notifications__panel">
        <h1 className="notifications__title">اعلان ها</h1>

        {/* آیتم‌های اعلان‌ها بعداً اینجا رندر می‌شوند */}
        <div className="notifications__list" />
      </div>
    </section>
  );
}
