import { useEffect, useRef, useState } from 'react';

import { saveProfile } from '../../../services/userStorage';
import { UNIVERSITIES } from '../../../services/league/mockData';
import AvatarPicker from './avatar/AvatarPicker';
import { avatarSrc } from './avatar/avatarOptions';

const inputClass =
  'w-full rounded-2xl border border-transparent bg-[var(--background)] py-3.5 pl-5 pr-12 text-white outline-none transition-colors duration-200 placeholder:text-[var(--faint)] focus:border-[var(--copper)] [font-family:\'Pinar\',\'Vazir\',Tahoma,sans-serif]';

const selectClass = `${inputClass} cursor-pointer appearance-none pl-10`;

const labelClass =
  'mb-2 block text-right text-sm text-[var(--copper-ink)] [font-family:\'Doran\',\'Vazir\',Tahoma,sans-serif]';

/* فهرست کامل دانشگاه‌ها و دانشکده‌های علوم پزشکی کشور از منبع واحد (لیگ تپش) */
const universityOptions = UNIVERSITIES.map(({ name }) => name);

const normalizeSearch = (value) => value.trim().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ');
const toLatinDigits = (value) => String(value).replace(/[۰-۹]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit));
const toPersianDigits = (value) => String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
const persianCalendar = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  year: 'numeric', month: 'numeric', day: 'numeric',
});
const persianDateParts = (date) => Object.fromEntries(
  persianCalendar.formatToParts(date)
    .filter(({ type }) => ['year', 'month', 'day'].includes(type))
    .map(({ type, value }) => [type, Number(value)]),
);
const currentPersianDate = persianDateParts(new Date());
const monthNames = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

function daysInPersianMonth(year, month) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  // روز پیش از نوروز بعدی، آخرین روز اسفند این سال است.
  for (let day = 18; day <= 23; day += 1) {
    const nextYearStart = new Date(year + 622, 2, day);
    const parts = persianDateParts(nextYearStart);
    if (parts.year === year + 1 && parts.month === 1 && parts.day === 1) {
      return persianDateParts(new Date(year + 622, 2, day - 1)).day;
    }
  }
  return 29;
}

function parseBirthDate(value) {
  const match = toLatinDigits(value).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
}

const termOptions = ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹', '۱۰', '۱۱', '۱۲', '۱۳', '۱۴'];

const gradeOptions = [
  'دوره علوم پایه',
  'فیزیوپاتولوژی',
  'استاژ (کارآمینی)',
  'اینترنی',
  'دستیاری',
  'سایر',
];

const genderOptions = ['مرد', 'زن'];

function SvgIcon({ children, className = 'h-5 w-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const UserIcon = ({ className }) => (
  <SvgIcon className={className}>
    <circle cx="12" cy="8" r="4" />
    <path d="M6 21v-1a6 6 0 0 1 6-6 6 6 0 0 1 6 6v1" />
  </SvgIcon>
);

const UserRoundIcon = ({ className }) => (
  <SvgIcon className={className}>
    <circle cx="12" cy="8" r="4" />
    <path d="M18 21a6 6 0 0 0-12 0" />
  </SvgIcon>
);

const PhoneIcon = ({ className }) => (
  <SvgIcon className={className}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  </SvgIcon>
);

const MailIcon = ({ className }) => (
  <SvgIcon className={className}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-10 5L2 7" />
  </SvgIcon>
);

const CalendarIcon = ({ className }) => (
  <SvgIcon className={className}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </SvgIcon>
);

const GenderIcon = ({ className }) => (
  <SvgIcon className={className}>
    <circle cx="10.5" cy="13.5" r="5.5" />
    <path d="M14.5 9.5 20 4M15 4h5v5" />
  </SvgIcon>
);

const FemaleGenderIcon = ({ className }) => (
  <SvgIcon className={className}>
    <circle cx="12" cy="9" r="5.5" />
    <path d="M12 14.5V22M8.5 18.5h7" />
  </SvgIcon>
);

const BuildingIcon = ({ className }) => (
  <SvgIcon className={className}>
    <path d="M3 22h18" />
    <path d="M6 18v-7M10 18v-7M14 18v-7M18 18v-7" />
    <path d="m12 2 9 5H3z" />
  </SvgIcon>
);

const LayersIcon = ({ className }) => (
  <SvgIcon className={className}>
    <path d="m12 2 8.5 4.5L12 11 3.5 6.5 12 2z" />
    <path d="m3.5 12 8.5 4.5 8.5-4.5" />
    <path d="m3.5 17 8.5 4.5 8.5-4.5" />
  </SvgIcon>
);

const GradCapIcon = ({ className }) => (
  <SvgIcon className={className}>
    <path d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z" />
    <path d="M22 10v6" />
    <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
  </SvgIcon>
);

const InfoIcon = ({ className }) => (
  <SvgIcon className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </SvgIcon>
);

const AtIcon = ({ className }) => (
  <SvgIcon className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
  </SvgIcon>
);

const PaletteIcon = ({ className }) => (
  <SvgIcon className={className}>
    <path d="M12 22a1 1 0 0 1-1-1v-3H8a2 2 0 0 1-2-2v-2h10.5a2.5 2.5 0 0 0 2.45-2.9A2.5 2.5 0 0 0 16.5 7H13V4a1 1 0 0 1 1-1h2.5A5.5 5.5 0 0 1 22 8.66c0 2.34-1.5 4.4-3.34 5.98-1.55 1.33-3.32 2.3-4.66 2.86V21a1 1 0 0 1-2 0Z" />
    <path d="M4 21v-3" />
    <path d="M8 12a3 3 0 1 1 0-6" />
  </SvgIcon>
);

const ChevronDownIcon = ({ className }) => (
  <SvgIcon className={className}>
    <path d="m6 9 6 6 6-6" />
  </SvgIcon>
);

const CheckIcon = ({ className }) => (
  <SvgIcon className={className}>
    <path d="M20 6 9 17l-5-5" />
  </SvgIcon>
);

const LogoutIcon = ({ className }) => (
  <SvgIcon className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </SvgIcon>
);

function FieldIcon({ icon: Icon }) {
  return (
    <span
      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--gold-ink)] transition-colors duration-200 group-focus-within:text-[var(--copper-ink)]"
      aria-hidden="true"
    >
      <Icon />
    </span>
  );
}

function FormField({ id, label, icon, children, onBlur }) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <div className="group relative" onBlur={onBlur}>
        <FieldIcon icon={icon} />
        {children}
      </div>
    </div>
  );
}

function SelectChevron() {
  return (
    <span
      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold-ink)]"
      aria-hidden="true"
    >
      <ChevronDownIcon />
    </span>
  );
}

function SectionTitle({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#b99a86]/15 text-[var(--copper-ink)]">
        <Icon />
      </span>
      <h3 className="text-lg text-white md:text-xl [font-family:'Doran','Vazir',Tahoma,sans-serif]">
        {title}
      </h3>
    </div>
  );
}

export default function EditProfile({ userData, onUserDataChange, onLogout }) {
  const profile = userData?.profile ?? {};
  const initialForm = {
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
    phone: userData?.phone ?? '',
    email: profile.email ?? '',
    username: profile.username ?? '',
    university: profile.university ?? '',
    term: profile.term ?? '',
    grade: profile.grade ?? '',
    gender: profile.gender ?? '',
    birthDate: profile.birthDate ?? '',
    avatar: profile.avatar ?? '',
  };
  const [form, setForm] = useState(initialForm);
  const [isSaved, setIsSaved] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [universityQuery, setUniversityQuery] = useState(initialForm.university);
  const [isUniversityOpen, setIsUniversityOpen] = useState(false);
  const [universityError, setUniversityError] = useState(false);
  const universityInputRef = useRef(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [birthParts, setBirthParts] = useState(
    parseBirthDate(initialForm.birthDate) ?? { year: currentPersianDate.year - 20, month: 1, day: 1 },
  );

  /*
   * همگام‌سازی با ورود دیرهنگام `userData`.
   *
   * باگ واقعی (کشف‌شده با E2E مرورگری، جریان F5): با رفرش کامل روی
   * `#dashboard?o=settings&t=profile`، این کامپوننت **پیش از** رسیدن پاسخ
   * `/api/users/me` سوار می‌شود. `useState(initialForm)` فقط یک بار مقدار می‌گیرد،
   * پس فرم برای کاربرِ واردشده خالی می‌ماند و پروفایلش را نشان نمی‌دهد.
   *
   * این اثر وقتی `userData` می‌رسد یک بار فرم را از دادهٔ تازه پر می‌کند؛ ولی اگر
   * کاربر در همین فاصله چیزی تایپ کرده باشد، مقدارش دست‌نخورده می‌ماند.
   */
  const syncedUserRef = useRef(userData);
  /* مقادیر لحظهٔ سوارشدن — مرجع تشخیص «دست‌نخورده بودن» فرم */
  const mountFormRef = useRef(initialForm);
  useEffect(() => {
    if (!userData || syncedUserRef.current === userData) return;
    syncedUserRef.current = userData;

    const touched = Object.entries(form).some(
      ([key, value]) => String(value ?? '') !== String(mountFormRef.current[key] ?? ''),
    );
    if (touched) return;

    mountFormRef.current = initialForm;
    setForm(initialForm);
    setUniversityQuery(initialForm.university);
  }, [userData, form, initialForm]);

  const matchingUniversities = universityOptions.filter((name) =>
    normalizeSearch(name).includes(normalizeSearch(universityQuery)),
  );

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setIsSaved(false);
  };

  /* شناسهٔ آواتار انتخاب‌شده از پاپ‌آپ برمی‌گردد؛ ذخیرهٔ نهایی با دکمهٔ فرم انجام می‌شود */
  const handleAvatarSave = (avatarId) => {
    setForm((current) => ({ ...current, avatar: avatarId ?? '' }));
    setIsPickerOpen(false);
    setIsSaved(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!universityOptions.includes(form.university) || universityQuery !== form.university) {
      setUniversityError(true);
      universityInputRef.current?.focus();
      return;
    }

    /*
     * پروفایل سشن‌محور ذخیره می‌شود؛ شمارهٔ تلفن به سرور نمی‌رود چون کلید هویت
     * نیست (سرور خودش کاربر را از کوکی سشن می‌شناسد).
     */
    const { phone: _phone, ...profileChanges } = form;
    const updatedUser = await saveProfile({ profile: profileChanges });

    /* ذخیره نشد ⇒ تیک «ذخیره شد» نشان داده نمی‌شود (کاربر واردنشده نمی‌ماند) */
    if (!updatedUser) return;

    onUserDataChange?.(updatedUser);
    setIsSaved(true);
  };

  const openCalendar = () => {
    setBirthParts(parseBirthDate(form.birthDate) ?? {
      year: currentPersianDate.year - 20, month: 1, day: 1,
    });
    setIsCalendarOpen((open) => !open);
  };

  const updateBirthParts = (key, value) => {
    setBirthParts((current) => {
      const next = { ...current, [key]: Number(value) };
      return { ...next, day: Math.min(next.day, daysInPersianMonth(next.year, next.month)) };
    });
  };

  const saveBirthDate = () => {
    const { year, month, day } = birthParts;
    setForm((current) => ({
      ...current,
      birthDate: toPersianDigits(`${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`),
    }));
    setIsSaved(false);
    setIsCalendarOpen(false);
  };

  return (
    <section
      dir="rtl"
      aria-label="ویرایش پروفایل"
      className="dash-stagger mx-auto w-[var(--content-width)] py-8 text-white md:py-10 [font-family:'Pinar','Vazir',Tahoma,sans-serif]"
    >
      <form onSubmit={handleSubmit} className="rounded-[2.5rem] bg-[var(--surface-soft)] p-8 md:rounded-[3rem] md:p-12">
        <header className="flex items-center gap-5">
          {/* جای آواتار: پیش‌نمایش آواتار انتخاب‌شده یا نمای پیش‌فرض */}
          <div className="relative shrink-0">
            <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-[#b99a86]/30 bg-[#b99a86]/15 text-[var(--copper-ink)] md:h-28 md:w-28">
              {avatarSrc(form.avatar) ? (
                <img
                  src={avatarSrc(form.avatar)}
                  alt="آواتار کاربر"
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserIcon className="h-12 w-12 md:h-14 md:w-14" />
              )}
            </span>
            <button
              type="button"
              onClick={() => setIsPickerOpen(true)}
              aria-label="انتخاب آواتار"
              title="انتخاب آواتار"
              className="absolute bottom-0 left-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[var(--copper)] text-white shadow-[0_4px_12px_rgb(var(--shadow-rgb) / 0.4)] transition-colors duration-200 hover:bg-[var(--copper)]"
            >
              <PaletteIcon className="h-4 w-4" />
            </button>
          </div>
          <div>
            <h2 className="text-2xl text-white md:text-3xl [font-family:'Doran','Vazir',Tahoma,sans-serif]">
              ویرایش پروفایل
            </h2>
            <p className="mt-1 text-sm text-[var(--faint)]">مشخصات کاربری</p>
          </div>
        </header>

        {isPickerOpen && (
          <AvatarPicker
            initialAvatar={form.avatar}
            onSave={handleAvatarSave}
            onClose={() => setIsPickerOpen(false)}
          />
        )}

        <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-12">
          {/* اطلاعات شخصی */}
          <section aria-label="اطلاعات شخصی">
            <SectionTitle icon={UserIcon} title="اطلاعات شخصی" />

            <div className="mt-6 grid gap-5 sm:grid-cols-2 md:gap-6">
              <FormField id="edit-profile-first-name" label="نام" icon={UserIcon}>
                <input
                  id="edit-profile-first-name"
                  type="text"
                  className={inputClass}
                  value={form.firstName}
                  onChange={handleChange('firstName')}
                  placeholder="نام خود را وارد کنید"
                  required
                />
              </FormField>

              <FormField id="edit-profile-last-name" label="نام خانوادگی" icon={UserRoundIcon}>
                <input
                  id="edit-profile-last-name"
                  type="text"
                  className={inputClass}
                  value={form.lastName}
                  onChange={handleChange('lastName')}
                  placeholder="نام خانوادگی خود را وارد کنید"
                  required
                />
              </FormField>

              <FormField id="edit-profile-phone" label="شماره تلفن" icon={PhoneIcon}>
                <input
                  id="edit-profile-phone"
                  type="tel"
                  inputMode="tel"
                  className={inputClass}
                  value={form.phone}
                  onChange={handleChange('phone')}
                  placeholder="مثلا: ۰۹۱۲۳۴۵۶۷۸۹"
                  required
                />
              </FormField>

              <FormField id="edit-profile-email" label="ایمیل" icon={MailIcon}>
                <input
                  id="edit-profile-email"
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={handleChange('email')}
                  placeholder="مثلا: user@tapesh.ir"
                  dir="ltr"
                />
              </FormField>

              <FormField id="edit-profile-username" label="نام کاربری" icon={AtIcon}>
                <input
                  id="edit-profile-username"
                  type="text"
                  className={inputClass}
                  value={form.username}
                  onChange={handleChange('username')}
                  placeholder="مثلا: tapesh_user"
                  required
                />
              </FormField>
            </div>

            <button
              type="button"
              onClick={() => onLogout?.()}
              className="mt-8 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-red-500/40 py-3.5 text-red-400 transition-colors duration-200 hover:border-red-500/70 hover:bg-red-500/10 md:text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]"
            >
              <LogoutIcon className="h-5 w-5" />
              خروج از حساب کاربری
            </button>
          </section>

          <div className="space-y-10">
            {/* اطلاعات تحصیلی */}
            <section aria-label="اطلاعات تحصیلی">
              <SectionTitle icon={GradCapIcon} title="اطلاعات تحصیلی" />

              <div className="mt-6 grid gap-5 sm:grid-cols-2 md:gap-6">
                <FormField
                  id="edit-profile-university"
                  label="دانشگاه"
                  icon={BuildingIcon}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setIsUniversityOpen(false);
                  }}
                >
                  <>
                    <input
                      ref={universityInputRef}
                      id="edit-profile-university"
                      type="text"
                      className={inputClass}
                      value={universityQuery}
                      placeholder="نام دانشگاه را جست‌وجو کنید"
                      autoComplete="off"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={isUniversityOpen}
                      aria-controls="edit-profile-university-options"
                      aria-invalid={universityError}
                      onFocus={() => setIsUniversityOpen(true)}
                      onChange={(event) => {
                        setUniversityQuery(event.target.value);
                        setForm((current) => ({ ...current, university: '' }));
                        setUniversityError(false);
                        setIsUniversityOpen(true);
                        setIsSaved(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') setIsUniversityOpen(false);
                        if (event.key === 'ArrowDown' && isUniversityOpen) {
                          event.preventDefault();
                          event.currentTarget.parentElement.querySelector('[role="option"]')?.focus();
                        }
                      }}
                    />
                    {isUniversityOpen && (
                      <div
                        id="edit-profile-university-options"
                        role="listbox"
                        className="absolute inset-x-0 top-full z-30 mt-2 max-h-52 overflow-y-auto rounded-2xl border border-white/15 bg-[var(--surface-soft)] p-1 shadow-xl"
                      >
                        {matchingUniversities.length ? matchingUniversities.map((university) => (
                          <button
                            key={university}
                            type="button"
                            role="option"
                            aria-selected={form.university === university}
                            className="block w-full cursor-pointer rounded-xl px-3 py-2 text-right text-sm text-white hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                            onClick={() => {
                              setUniversityQuery(university);
                              setForm((current) => ({ ...current, university }));
                              setUniversityError(false);
                              setIsUniversityOpen(false);
                              setIsSaved(false);
                            }}
                          >
                            {university}
                          </button>
                        )) : (
                          <p className="px-3 py-2 text-sm text-[var(--faint)]">دانشگاهی پیدا نشد</p>
                        )}
                      </div>
                    )}
                  </>
                </FormField>
                {universityError && (
                  <p className="text-sm text-[var(--red-ink)] sm:col-span-2" role="alert">
                    یک دانشگاه را از فهرست انتخاب کنید.
                  </p>
                )}

                <FormField id="edit-profile-term" label="ترم" icon={LayersIcon}>
                  <>
                    <select
                      id="edit-profile-term"
                      className={selectClass}
                      value={form.term}
                      onChange={handleChange('term')}
                    >
                      <option value="" disabled>
                        انتخاب ترم
                      </option>
                      {termOptions.map((term) => (
                        <option key={term} value={term}>
                          ترم {term}
                        </option>
                      ))}
                    </select>
                    <SelectChevron />
                  </>
                </FormField>

                <FormField id="edit-profile-grade" label="مقطع" icon={GradCapIcon}>
                  <>
                    <select
                      id="edit-profile-grade"
                      className={selectClass}
                      value={form.grade}
                      onChange={handleChange('grade')}
                    >
                      <option value="" disabled>
                        انتخاب مقطع
                      </option>
                      {gradeOptions.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </select>
                    <SelectChevron />
                  </>
                </FormField>
              </div>
            </section>

            {/* اطلاعات تکمیلی */}
            <section aria-label="اطلاعات تکمیلی">
              <SectionTitle icon={InfoIcon} title="اطلاعات تکمیلی" />

              <div className="mt-6 grid gap-5 sm:grid-cols-2 md:gap-6">
                <FormField id="edit-profile-gender" label="جنسیت" icon={form.gender === 'زن' ? FemaleGenderIcon : GenderIcon}>
                  <>
                    <select
                      id="edit-profile-gender"
                      className={selectClass}
                      value={form.gender}
                      onChange={handleChange('gender')}
                    >
                      <option value="" disabled>
                        انتخاب جنسیت
                      </option>
                      {genderOptions.map((gender) => (
                        <option key={gender} value={gender}>
                          {gender}
                        </option>
                      ))}
                    </select>
                    <SelectChevron />
                  </>
                </FormField>

                <div>
                  <label className={labelClass} htmlFor="edit-profile-birth-date">تاریخ تولد</label>
                  <div
                    className="relative"
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) setIsCalendarOpen(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setIsCalendarOpen(false);
                    }}
                  >
                    <input
                      id="edit-profile-birth-date"
                      type="text"
                      className={inputClass}
                      value={form.birthDate}
                      placeholder="مثلا: ۱۳۸۲/۰۴/۱۵"
                      readOnly
                      onClick={openCalendar}
                    />
                    <button
                      type="button"
                      aria-label="انتخاب تاریخ تولد"
                      aria-expanded={isCalendarOpen}
                      onClick={openCalendar}
                      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-[var(--gold-ink)] hover:bg-white/10"
                    >
                      <CalendarIcon />
                    </button>
                    {isCalendarOpen && (
                      <div className="absolute right-0 top-full z-30 mt-2 w-min min-w-[280px] max-w-[90vw] rounded-2xl border border-white/15 bg-[var(--surface-soft)] p-4 shadow-xl">
                        <p className="mb-3 text-sm text-[var(--copper-ink)]">تاریخ تولد (شمسی)</p>
                        <div className="flex gap-2">
                          <select aria-label="سال تولد" value={birthParts.year} onChange={(event) => updateBirthParts('year', event.target.value)} className="min-w-0 flex-1 rounded-lg bg-[var(--background)] p-2 text-white">
                            {Array.from({ length: 121 }, (_, index) => currentPersianDate.year - index).map((year) => (
                              <option key={year} value={year}>{toPersianDigits(year)}</option>
                            ))}
                          </select>
                          <select aria-label="ماه تولد" value={birthParts.month} onChange={(event) => updateBirthParts('month', event.target.value)} className="min-w-0 flex-1 rounded-lg bg-[var(--background)] p-2 text-white">
                            {monthNames.map((month, index) => (
                              <option key={month} value={index + 1}>{month}</option>
                            ))}
                          </select>
                          <select aria-label="روز تولد" value={birthParts.day} onChange={(event) => updateBirthParts('day', event.target.value)} className="min-w-0 w-14 rounded-lg bg-[var(--background)] p-2 text-white">
                            {Array.from({ length: daysInPersianMonth(birthParts.year, birthParts.month) }, (_, index) => index + 1).map((day) => (
                              <option key={day} value={day}>{toPersianDigits(day)}</option>
                            ))}
                          </select>
                        </div>
                        <button type="button" onClick={saveBirthDate} className="mt-3 w-full cursor-pointer rounded-xl bg-[var(--copper)] px-3 py-2 text-white">
                          ثبت تاریخ
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            className="cursor-pointer rounded-full bg-[var(--copper)] px-10 py-3.5 text-white transition-colors duration-200 hover:bg-[var(--copper)] md:text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]"
          >
            ذخیره تغییرات
          </button>
          {isSaved && (
            <span className="flex items-center gap-1.5 text-sm text-[var(--green-ink)]">
              <CheckIcon className="h-4 w-4" />
              تغییرات ذخیره شد.
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
