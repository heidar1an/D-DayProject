/*
 * BankYears — نمای «آزمون‌های سال به سال». هر سال یک کارت با آمار واقعی بانک است؛
 * شروع آزمون در حالت Exam با نمرهٔ منفی وزارت بهداشت (-۰٫۲۵) انجام می‌شود.
 *
 * این نما فقط روی سؤال‌های رسمی (کشوری) ساخته می‌شود؛ اگر دامنهٔ فعال «تألیفی» باشد
 * یا رشتی سؤال رسمی نداشته باشد، به‌جای فهرست خالی، راهنمای تغییر دامنه نشان داده می‌شود.
 */
import { EmptyState, Icon, Skeleton, faNum, toFa } from './bankShared';

export default function BankYears({ overview, scope, onStartYearExam }) {
  if (!overview) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-64 rounded-[2rem]" />
        ))}
      </div>
    );
  }

  if (!overview.years.length) {
    return (
      <EmptyState
        icon="calendar"
        title="در این دامنه آزمون سال‌به‌سال وجود ندارد"
        note={
          scope?.bankKind === 'authored'
            ? 'آزمون‌های سال‌به‌سال فقط از سؤال‌های رسمی آزمون کشوری ساخته می‌شوند؛ برای دیدنشان دامنه را روی «کشوری» بگذار.'
            : 'برای این رشته هنوز سؤال رسمی در بانک ثبت نشده است؛ دامنهٔ رشته را تغییر بده یا از «تست مبحثی» شروع کن.'
        }
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold [font-family:'Doran',Tahoma,sans-serif]">آزمون‌های سال به سال</h2>
          <p className="mt-1.5 text-sm text-[#9a9a9a]">
            سؤال‌های رسمی هر سال، در قالب آزمون زمان‌دار با نمرهٔ منفی (۳/۱ −). پاسخ‌ها فقط در پایان اعلام می‌شود.
          </p>
        </div>
        <span className="tb-badge tb-badge--plain">
          <Icon name="info" className="h-3.5 w-3.5" />
          {faNum(overview.years.length)} سال · سؤال‌های رسمی کشوری
        </span>
      </div>

      {/* Timeline سال‌ها */}
      <ol className="relative grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="سال‌های آزمون علوم پایه">
        {overview.years.map((entry) => (
          <li
            key={entry.year}
            className="dash-stagger group relative overflow-hidden rounded-[2rem] border border-white/8 bg-[#242426] p-5 transition-colors hover:border-white/16"
          >
            {/* شمارهٔ سال پس‌زمینه */}
            <span
              className="pointer-events-none absolute -left-3 -top-6 select-none text-[6.5rem] font-extrabold leading-none text-white/[0.045] [font-family:'Doran',Tahoma,sans-serif]"
              aria-hidden="true"
            >
              {entry.year}
            </span>

            <div className="relative">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-2xl font-extrabold text-[#61D192] [font-family:'Doran',Tahoma,sans-serif]">{toFa(entry.year)}</h3>
                {entry.userBestPercent !== null ? (
                  <span className="rounded-full bg-[#937fcd]/15 px-3 py-1.5 text-xs text-[#c9bdf0]">
                    بهترین من: {toFa(entry.userBestPercent)}٪
                  </span>
                ) : (
                  <span className="rounded-full bg-white/6 px-3 py-1.5 text-xs text-[#8a8a8a]">شرکت نکرده‌ای</span>
                )}
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-white/[0.04] px-2 py-2.5">
                  <dt className="text-[10px] text-[#8a8a8a]">تعداد سؤال</dt>
                  <dd className="mt-0.5 text-sm font-bold [font-family:'Doran',Tahoma,sans-serif]">{toFa(entry.questionCount)}</dd>
                </div>
                <div className="rounded-2xl bg-white/[0.04] px-2 py-2.5">
                  <dt className="text-[10px] text-[#8a8a8a]">زمان</dt>
                  <dd className="mt-0.5 text-sm font-bold [font-family:'Doran',Tahoma,sans-serif]">{toFa(entry.durationMinutes)}′</dd>
                </div>
                <div className="rounded-2xl bg-white/[0.04] px-2 py-2.5">
                  <dt className="text-[10px] text-[#8a8a8a]">میانگین کاربران</dt>
                  <dd className="mt-0.5 text-sm font-bold text-[#e0b45c] [font-family:'Doran',Tahoma,sans-serif]">{toFa(entry.communityCorrectPercent)}٪</dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={() => onStartYearExam(entry)}
                className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#61D192] py-3 text-sm font-bold text-[#12271a] transition-all hover:-translate-y-0.5 hover:bg-[#7ee0ac]"
              >
                <Icon name="play" className="h-4 w-4" />
                شروع آزمون {toFa(entry.year)}
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
