/*
 * این تب همان UI انتشار موجود است. آن را در مرکز رسانه embed می‌کنیم و منبع
 * انتشار را عوض نمی‌کنیم تا کانال بلهٔ قبلی و تاریخچه‌اش دقیقاً حفظ شود.
 */
import AdminPublishing from '../../views/AdminPublishing';

export default function PublishingSection({ admin }) {
  return <AdminPublishing admin={admin} />;
}
