import { useRef, useState } from 'react';

import { saveUserRecord } from '../../../services/userStorage';

const inputClass =
  'w-full rounded-2xl border border-transparent bg-[#1d1d1d] py-3.5 pl-5 pr-12 text-white outline-none transition-colors duration-200 placeholder:text-[#777] focus:border-[#b99a86] [font-family:\'Pinar\',Tahoma,sans-serif]';

const selectClass = `${inputClass} cursor-pointer appearance-none pl-10`;

const labelClass =
  'mb-2 block text-right text-sm text-[#b99a86] [font-family:\'Doran\',Tahoma,sans-serif]';

const universityOptions = [
  'دانشگاه علوم پزشکی تهران',
  'دانشگاه علوم پزشکی ایران',
  'دانشگاه علوم پزشکی شهید بهشتی',
  'سایر دانشگاه‌ها',
];

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

/* آواتار به‌صورت مربعی برش خورده و کوک‌شده ذخیره می‌شود تا حجم localStorage کنترل بماند */
const AVATAR_SIZE = 256;

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

const CameraIcon = ({ className }) => (
  <SvgIcon className={className}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
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
      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8a7d73] transition-colors duration-200 group-focus-within:text-[#b99a86]"
      aria-hidden="true"
    >
      <Icon />
    </span>
  );
}

function FormField({ id, label, icon, children }) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <div className="group relative">
        <FieldIcon icon={icon} />
        {children}
      </div>
    </div>
  );
}

function SelectChevron() {
  return (
    <span
      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8a7d73]"
      aria-hidden="true"
    >
      <ChevronDownIcon />
    </span>
  );
}

function SectionTitle({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#b99a86]/15 text-[#b99a86]">
        <Icon />
      </span>
      <h3 className="text-lg text-white md:text-xl [font-family:'Doran',Tahoma,sans-serif]">
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
  const avatarInputRef = useRef(null);

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setIsSaved(false);
  };

  const handleCancel = () => {
    setForm(initialForm);
    setIsSaved(false);
  };

  /* تصویر انتخابی از وسط به مربع تبدیل و کوچک می‌شود تا آواتار همیشه بدون کشیدگی نمایش داده شود */
  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const minSide = Math.min(image.width, image.height);
        const sourceX = (image.width - minSide) / 2;
        const sourceY = (image.height - minSide) / 2;
        const canvas = document.createElement('canvas');

        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;

        canvas
          .getContext('2d')
          .drawImage(
            image,
            sourceX,
            sourceY,
            minSide,
            minSide,
            0,
            0,
            AVATAR_SIZE,
            AVATAR_SIZE,
          );

        setForm((current) => ({ ...current, avatar: canvas.toDataURL('image/jpeg', 0.85) }));
        setIsSaved(false);
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const { phone, ...profileChanges } = form;
    const updatedUser = await saveUserRecord({
      phone: phone.trim() || userData?.phone,
      profile: profileChanges,
    });

    onUserDataChange?.(updatedUser);
    setIsSaved(true);
  };

  return (
    <section
      dir="rtl"
      aria-label="ویرایش پروفایل"
      className="mx-auto w-[var(--content-width)] py-8 text-white md:py-10 [font-family:'Pinar',Tahoma,sans-serif]"
    >
      <form onSubmit={handleSubmit} className="rounded-[2.5rem] bg-[#282828] p-8 md:rounded-[3rem] md:p-12">
        <header className="flex items-center gap-5">
          {/* جای آواتار: اندازه بزرگ و دایره‌ای تا تصویر بعدا دقیق دیده شود */}
          <div className="relative shrink-0">
            <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-[#b99a86]/30 bg-[#b99a86]/15 text-[#b99a86] md:h-28 md:w-28">
              {form.avatar ? (
                <img src={form.avatar} alt="آواتار کاربر" className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-12 w-12 md:h-14 md:w-14" />
              )}
            </span>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              aria-label="ویرایش آواتار"
              title="ویرایش آواتار"
              className="absolute bottom-0 left-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#b99a86] text-white shadow-[0_4px_12px_rgba(0,0,0,0.4)] transition-colors duration-200 hover:bg-[#a3826e]"
            >
              <CameraIcon className="h-4 w-4" />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <h2 className="text-2xl text-white md:text-3xl [font-family:'Doran',Tahoma,sans-serif]">
              ویرایش پروفایل
            </h2>
            <p className="mt-1 text-sm text-[#999]">مشخصات کاربری</p>
          </div>
        </header>

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
              className="mt-8 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-red-500/40 py-3.5 text-red-400 transition-colors duration-200 hover:border-red-500/70 hover:bg-red-500/10 md:text-lg [font-family:'Doran',Tahoma,sans-serif]"
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
                >
                  <>
                    <select
                      id="edit-profile-university"
                      className={selectClass}
                      value={form.university}
                      onChange={handleChange('university')}
                    >
                      <option value="" disabled>
                        انتخاب دانشگاه
                      </option>
                      {universityOptions.map((university) => (
                        <option key={university} value={university}>
                          {university}
                        </option>
                      ))}
                    </select>
                    <SelectChevron />
                  </>
                </FormField>

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
                <FormField id="edit-profile-gender" label="جنسیت" icon={GenderIcon}>
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

                <FormField
                  id="edit-profile-birth-date"
                  label="تاریخ تولد"
                  icon={CalendarIcon}
                >
                  <input
                    id="edit-profile-birth-date"
                    type="text"
                    inputMode="numeric"
                    className={inputClass}
                    value={form.birthDate}
                    onChange={handleChange('birthDate')}
                    placeholder="مثلا: ۱۳۸۲/۰۴/۱۵"
                  />
                </FormField>
              </div>
            </section>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            className="cursor-pointer rounded-full bg-[#b99a86] px-10 py-3.5 text-white transition-colors duration-200 hover:bg-[#a3826e] md:text-lg [font-family:'Doran',Tahoma,sans-serif]"
          >
            ذخیره تغییرات
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="cursor-pointer rounded-full border border-white/15 px-10 py-3.5 text-[#ccc] transition-colors duration-200 hover:border-[#b99a86]/60 hover:text-white md:text-lg [font-family:'Doran',Tahoma,sans-serif]"
          >
            انصراف
          </button>
          {isSaved && (
            <span className="flex items-center gap-1.5 text-sm text-[#67ba85]">
              <CheckIcon className="h-4 w-4" />
              تغییرات ذخیره شد.
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
