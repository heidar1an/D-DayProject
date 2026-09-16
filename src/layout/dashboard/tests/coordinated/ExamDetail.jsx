/*
 * ExamDetail — صفحهٔ جزئیات آزمون.
 * همهٔ اطلاعات روایت آزمون (زمان‌ها، مباحث، جامعهٔ هدف، قوانین، ثبت‌نام) و CTA اصلی
 * کاملاً بر اساس وضعیت (Status) و وضعیت کاربر (Registration/Attempt) رندر می‌شود.
 * ثبت‌نام با یک مودال تأیید قوانین انجام می‌شود — بدون صفحهٔ اضافه.
 */
import { useState } from 'react';
import {
  DifficultyBadge,
  ExamCountdown,
  Icon,
  StatusBadge,
  TYPE_META,
  TypeBadge,
  faNum,
  formatDuration,
  formatFullDate,
  formatTime,
  formatWeekday,
} from './coordinatedShared';

function InfoItem({ icon, label, value }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] p-3.5">
      <dt className="flex items-center gap-1.5 text-[11px] text-[var(--faint)]">
        <Icon name={icon} className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-1.5 text-[13px] font-semibold leading-6 text-[var(--muted)]">{value}</dd>
    </div>
  );
}

/* دستورالعمل قوانین از Exam Configuration ساخته می‌شود — نه متن ثابت */
function rulesOf(exam) {
  const { rules } = exam;
  const negative = rules.negativeMarking ?? 0;
  const items = [
    {
      icon: 'info',
      text:
        negative < 0
          ? `نمرهٔ منفی فعال است؛ برای هر پاسخ غلط ${faNum(Math.abs(negative * 100) / 100)} نمره از نمرهٔ کل کسر می‌شود (۱ نمره برای هر سؤال).`
          : 'این آزمون نمرهٔ منفی ندارد؛ بدون ترس پاسخ بده.',
    },
    {
      icon: 'list',
      text: `این آزمون ${faNum(exam.effectiveQuestionCount)} سؤال و ${formatDuration(exam.duration)} زمان دارد.`,
    },
    {
      icon: 'timer',
      text:
        rules.deadlineMode === 'exam_end'
          ? 'پایان آزمون برای همهٔ شرکت‌کنندگان هم‌زمان است؛ بعد از ورود، باقی‌ماندهٔ زمان کل را خواهی داشت.'
          : 'زمان آزمون از لحظهٔ شروعِ خودت محاسبه می‌شود.',
    },
    {
      icon: 'back',
      text: rules.allowBackNavigation
        ? 'می‌توانی بین سؤال‌ها جابه‌جا شوی و تا پیش از ثبت نهایی پاسخ‌هایت را تغییر دهی.'
        : 'پس از ثبت پاسخ هر سؤال، امکان بازگشت وجود ندارد.',
    },
    {
      icon: 'flag',
      text: rules.allowMarking
        ? 'سؤال‌ها را می‌توانی برای مرور نهایی علامت بزنی.'
        : 'امکان علامت‌گذاری سؤال در این آزمون وجود ندارد.',
    },
    {
      icon: 'check',
      text:
        rules.attemptLimit === 1
          ? 'برای هر کاربر فقط یک بار شرکت در این آزمون ممکن است.'
          : `می‌توانی تا ${faNum(rules.attemptLimit)} بار در این آزمونک شرکت کنی.`,
    },
    {
      icon: 'card',
      text: exam.resultReleaseAt
        ? `کارنامه و نتایج حدوداً ${formatFullDate(exam.resultReleaseAt)} — ساعت ${formatTime(exam.resultReleaseAt)} اعلام می‌شود.`
        : 'نتیجهٔ این آزمونک بلافاصله بعد از پایان اعلام می‌شود.',
    },
  ];
  return items;
}

export default function ExamDetail({ exam, onRegister, onCancelRegistration, onStart, onResume, onViewResult }) {
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [rulesAccepted, setRulesAccepted] = useState(false);

  if (!exam) return null;
  const user = exam.userState;
  const typeMeta = TYPE_META[exam.type] ?? {};
  const ruleItems = rulesOf(exam);

  const primaryCta = (() => {
    switch (user.status) {
      case 'LIVE':
      case 'AVAILABLE':
        if (user.activeAttemptId) return { label: user.status === 'LIVE' ? 'ادامه آزمون' : 'ادامهٔ آزمونک', action: onResume, accent: '#e26d6d', icon: 'play' };
        if (user.canStart) return { label: user.status === 'LIVE' ? 'ورود به آزمون' : 'شروع آزمونک', action: onStart, accent: '#61D192', icon: 'play' };
        return null;
      case 'REGISTRATION_OPEN':
        if (user.registered) return { label: 'ثبت‌نام انجام شد — آماده باش', action: null, accent: '#61D192', icon: 'check', disabled: true };
        return { label: 'ثبت‌نام در آزمون', action: () => setShowRegisterModal(true), accent: '#61D192', icon: 'check' };
      case 'RESULTS_AVAILABLE':
        return { label: 'مشاهده کارنامه', action: onViewResult, accent: '#937fcd', icon: 'card' };
      default:
        return null;
    }
  })();

  const handleRegister = async () => {
    if (!rulesAccepted) return;
    await onRegister();
    setShowRegisterModal(false);
    setRulesAccepted(false);
  };

  return (
    <div className="dash-stagger space-y-6">
      {/* ── سربرگ آزمون ── */}
      <header className="relative overflow-hidden rounded-[2.2rem] border border-white/[0.07] bg-[var(--surface)] p-6 md:p-8">
        <div
          className="absolute -right-20 -top-24 h-60 w-60 rounded-full blur-3xl"
          style={{ background: `${exam.accent}14` }}
          aria-hidden="true"
        />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={user.status} />
            <TypeBadge type={exam.type} />
            <DifficultyBadge difficulty={exam.difficulty} />
          </div>

          <h1 className="text-2xl leading-snug text-white md:text-[1.7rem] [font-family:'Doran','Vazir',Tahoma,sans-serif]">
            {exam.title}
          </h1>

          <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">{exam.description}</p>

          <p className="text-xs text-[var(--faint)]">
            برگزارکننده: {exam.organizer} • {typeMeta.label}
            {exam.universities && exam.universities.length > 0 && (
              <>
                {' '}
                • با حضور دانشجویان {exam.universities.slice(0, 4).join('، ')} و سایر دانشگاه‌ها
              </>
            )}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-6">
          {/* ── اطلاعات کلیدی ── */}
          <section aria-label="اطلاعات آزمون">
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <InfoItem icon="calendar" label="تاریخ برگزاری" value={`${formatWeekday(exam.startTime)}، ${formatFullDate(exam.startTime)}`} />
              <InfoItem icon="clock" label="ساعت برگزاری" value={`${formatTime(exam.startTime)} تا ${formatTime(exam.endTime)}`} />
              <InfoItem icon="timer" label="مدت آزمون" value={formatDuration(exam.duration)} />
              <InfoItem icon="list" label="تعداد سؤال" value={`${faNum(exam.effectiveQuestionCount)} سؤال چهارگزینه‌ای`} />
              <InfoItem icon="book" label="درس" value={exam.subject} />
              <InfoItem icon="users" label="جامعهٔ هدف" value={exam.audience} />
            </dl>
          </section>

          {/* ── مباحث ── */}
          <section aria-label="مباحث آزمون" className="rounded-[1.6rem] border border-white/[0.06] bg-[var(--surface)] p-5">
            <h2 className="text-sm text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]">مباحث پوشش داده‌شده</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {exam.topics.map((topic) => (
                <span key={topic} className="rounded-full bg-white/[0.05] px-3 py-1.5 text-xs text-[var(--muted)]">
                  {topic}
                </span>
              ))}
            </div>
          </section>

          {/* ── قوانین ── */}
          <section aria-label="قوانین آزمون" className="rounded-[1.6rem] border border-white/[0.06] bg-[var(--surface)] p-5">
            <h2 className="flex items-center gap-2 text-sm text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]">
              <Icon name="shield" className="h-4 w-4 text-[var(--green-ink)]" />
              قوانین آزمون
            </h2>
            <ul className="mt-3 space-y-2.5">
              {ruleItems.map((rule, index) => (
                <li key={index} className="flex items-start gap-2.5 text-[13px] leading-6 text-[var(--muted)]">
                  <Icon name={rule.icon} className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--faint)]" />
                  {rule.text}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── ستون اقدام (CTA) ── */}
        <aside className="space-y-4 lg:sticky lg:top-4">
          <div className="space-y-4 rounded-[1.8rem] border border-white/[0.07] bg-[var(--surface)] p-5">
            {/* Countdown برای آزمون‌های آینده و منتظر نتایج */}
            {(user.status === 'REGISTRATION_OPEN' || user.status === 'UPCOMING' || user.status === 'REGISTRATION_CLOSED') && (
              <div className="space-y-3 rounded-2xl bg-black/30 p-4 text-center">
                <p className="text-xs text-[var(--faint)]">شروع آزمون در:</p>
                <ExamCountdown targetTs={exam.startTime} compact />
              </div>
            )}

            {user.status === 'LIVE' && (
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-[#e26d6d]/10 p-3.5 text-sm font-bold text-[var(--red-ink)]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--red)]" aria-hidden="true" />
                آزمون همین حالا در حال برگزاری است
              </div>
            )}

            {primaryCta && (
              <button
                type="button"
                onClick={primaryCta.action ?? undefined}
                disabled={primaryCta.disabled}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold transition-colors ${
                  primaryCta.disabled ? 'cursor-default opacity-70' : 'cursor-pointer hover:brightness-110'
                }`}
                style={{ background: primaryCta.accent, color: 'var(--ink-deep)' }}
              >
                <Icon name={primaryCta.icon} className="h-4 w-4" />
                {primaryCta.label}
              </button>
            )}

            {user.status === 'REGISTRATION_OPEN' && user.registered && (
              <button
                type="button"
                onClick={onCancelRegistration}
                className="w-full cursor-pointer rounded-xl py-2 text-[11px] text-[var(--faint)] transition-colors hover:text-[var(--red-ink)]"
              >
                لغو ثبت‌نام
              </button>
            )}

            {user.status === 'REGISTRATION_OPEN' && !user.registered && (
              <p className="text-center text-[11px] text-[var(--faint)]">
                مهلت ثبت‌نام تا {formatFullDate(exam.registrationDeadline)} — ساعت {formatTime(exam.registrationDeadline)}
              </p>
            )}

            {user.status === 'REGISTRATION_CLOSED' && (
              <div className="flex items-start gap-2 rounded-2xl bg-[#e0b45c]/10 p-3.5 text-xs leading-6 text-[var(--gold-ink)]">
                <Icon name="warn" className="mt-0.5 h-4 w-4 shrink-0" />
                ثبت‌نام این آزمون بسته است؛ برای آزمون‌های بعدی در همین صفحه به‌موقع اطلاع‌رسانی می‌شود.
              </div>
            )}

            {user.status === 'FINISHED' && (
              <div className="flex items-start gap-2 rounded-2xl bg-white/[0.04] p-3.5 text-xs leading-6 text-[var(--faint)]">
                <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
                {exam.resultReleaseAt
                  ? `کارنامه‌ها در حال پردازش است و ${formatFullDate(exam.resultReleaseAt)} — ساعت ${formatTime(exam.resultReleaseAt)} اعلام می‌شود.`
                  : 'نتایج این آزمون به‌زودی اعلام می‌شود.'}
              </div>
            )}

            {user.status === 'CANCELLED' && (
              <div className="flex items-start gap-2 rounded-2xl bg-[#e26d6d]/10 p-3.5 text-xs leading-6 text-[var(--red-ink)]">
                <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                این آزمون لغو شده است.
              </div>
            )}

            {user.activeAttemptId && (
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/[0.04] px-4 py-3 text-xs text-[var(--muted)]">
                <span>آزمون نیمه‌کاره داری</span>
                <span className="text-[var(--green-ink)]">
                  {faNum(user.activeProgress.answeredCount)} از {faNum(user.activeProgress.totalQuestions)} پاسخ داده‌شده
                </span>
              </div>
            )}

            {/* آمار شرکت‌کنندگان */}
            <div className="flex items-center justify-between border-t border-white/[0.06] pt-3.5 text-xs text-[var(--faint)]">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="users" className="h-4 w-4" />
                {user.status === 'FINISHED' || user.status === 'RESULTS_AVAILABLE' ? 'شرکت‌کننده' : 'ثبت‌نام‌کننده'}
              </span>
              <strong className="text-[var(--muted)]">{faNum(exam.participantsCount || 0)} نفر</strong>
            </div>
          </div>

          {/* گره به چرخهٔ یادگیری: برای آزمون‌های موضوعی منابع مرتبط پیشنهاد می‌شود */}
          {exam.resultReady && (
            <div className="rounded-[1.6rem] border border-white/[0.06] bg-[var(--surface)] p-5 text-center">
              <p className="text-xs leading-6 text-[var(--faint)]">
                کارنامه‌ات آماده است؛ مرور سؤال به سؤال و افزودن نکته‌ها به فلش‌کارت از داخل کارنامه انجام می‌شود.
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* ── مودال ثبت‌نام ── */}
      {showRegisterModal && (
        <div className="exm-modal__scrim" role="dialog" aria-modal="true" aria-label="ثبت‌نام در آزمون">
          <div className="exm-modal space-y-4">
            <h2 className="text-lg text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]">ثبت‌نام در آزمون</h2>
            <p className="text-[13px] leading-7 text-[var(--muted)]">
              <strong className="text-white">{exam.title}</strong>
              <br />
              {formatWeekday(exam.startTime)} {formatFullDate(exam.startTime)} — ساعت {formatTime(exam.startTime)}
            </p>
            <ul className="space-y-2 rounded-2xl bg-black/30 p-4 text-xs leading-6 text-[var(--faint)]">
              <li>• با ثبت‌نام، یادآور آزمون به اعلان‌های داشبورد اضافه می‌شود.</li>
              <li>• حضور در آزمون رایگان است و فقط یک بار امکان شرکت دارد.</li>
              <li>• قوانین آزمون در همین صفحه را می‌پذیرم.</li>
            </ul>
            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-6 text-[var(--muted)]">
              <input
                type="checkbox"
                checked={rulesAccepted}
                onChange={(event) => setRulesAccepted(event.target.checked)}
                className="mt-1 h-4 w-4 accent-[var(--green-ink)]"
              />
              قوانین آزمون را خوانده‌ام و می‌پذیرم.
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={!rulesAccepted}
                onClick={handleRegister}
                className={`flex-1 rounded-2xl bg-[var(--green-vivid)] py-3 text-sm font-bold text-[#0d1f16] transition-all ${
                  rulesAccepted ? 'cursor-pointer hover:bg-[#74dd9f]' : 'cursor-not-allowed opacity-40'
                }`}
              >
                تأیید و ثبت‌نام
              </button>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="cursor-pointer rounded-2xl bg-white/[0.06] px-5 py-3 text-sm text-[var(--muted)] transition-colors hover:bg-white/[0.1] hover:text-white"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
