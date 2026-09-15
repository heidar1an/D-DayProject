/*
 * آیکن‌های بخش نمودار قلب — هم‌زبان با آیکن‌های لایهٔ «تحلیل عملکرد»
 * (svg سبک، viewBox ۲۴، رنگ از currentColor، بدون وابستگی به کتابخانه).
 *
 * دو خانواده:
 *   solid → نشان‌های آماری هدر (قلب، شعله) که در اندازهٔ کوچک باید پر و خوانا باشند.
 *   line  → آیکن‌های کنترلی سوییچ حالت نمودار (میله‌ای، خطی) با استایل خطی پروژه.
 */

const SOLID_PATHS = {
  heart: 'M12 20.6c-.4 0-.8-.15-1.1-.42C6.9 16.6 3 13.2 3 9.35A4.85 4.85 0 0 1 12 6.2a4.85 4.85 0 0 1 9 3.15c0 3.85-3.9 7.25-7.9 10.83-.3.27-.7.42-1.1.42z',
  flame:
    'M12.6 2.4c.62-.5 1.55-.05 1.55.75 0 3.4 4.35 5.2 4.35 9.6 0 3.75-2.9 6.75-6.5 6.75S5.5 16.5 5.5 12.75c0-2.6 1.2-4.5 2.6-6.05.5-.55 1.4-.2 1.42.55.03.9.22 1.6.58 2.05.35-2.4 1.3-5.1 2.5-6.9z',
};

const LINE_PATHS = {
  bars: (
    <>
      <path d="M5.5 20V12" />
      <path d="M12 20V4.5" />
      <path d="M18.5 20v-5.5" />
      <path d="M3 20h18" />
    </>
  ),
  line: (
    <>
      <path d="m3.5 16.8 5.2-5.6 3.6 3.1 8.2-8" />
      <path d="M3 20h18" />
      <circle cx="8.7" cy="11.2" r="1.6" />
      <circle cx="20.5" cy="6.3" r="1.6" />
    </>
  ),
};

export function SolidIcon({ name, size = 16, className, style }) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={SOLID_PATHS[name] ?? SOLID_PATHS.heart} />
    </svg>
  );
}

export function LineIcon({ name, size = 16, strokeWidth = 1.9, className, style }) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {LINE_PATHS[name] ?? LINE_PATHS.bars}
    </svg>
  );
}
