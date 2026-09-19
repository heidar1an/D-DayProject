/*
 * useOverflowFlag — تشخیص سرریز عمودیِ نویگیتور سؤال‌ها از کادر سمت چپ.
 *
 * ref را روی ظرفِ ارتفاع‌محدودِ گرید سؤال‌ها می‌گذاریم؛ هر وقت محتوا (scrollHeight)
 * از ارتفاع ظرف (clientHeight) عبور کند — یعنی تعداد سؤال‌ها از ظرفیت کادر بیشتر
 * شده باشد — پرچم true می‌شود تا دکمهٔ «لیست کامل سؤال‌ها» (پاپ‌آپ) نمایش داده شود.
 *
 * اندازه‌گیری در دو نقطه انجام می‌شود:
 *  ۱) با هر تغییر `dep` (مثلاً تعداد سؤال‌های فیلترشده) — قطعی و هم‌زمان با رندر؛
 *  ۲) با ResizeObserver برای تغییر عرض/ارتفاع ظرف (ریسایز پنجره) — چون این تغییرها
 *     به `dep` گره خورده‌اند نیست. RO به چرخهٔ رندر وابسته است و در تب مخفی/throttle
 *     delay می‌خورد؛ به همین دلیل اتکای اصلی روی measure نقطة ۱ است.
 */
import { useEffect, useRef, useState } from 'react';

export default function useOverflowFlag(dep = 0) {
  const ref = useRef(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => setOverflowing(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, [dep]);

  return [ref, overflowing];
}
