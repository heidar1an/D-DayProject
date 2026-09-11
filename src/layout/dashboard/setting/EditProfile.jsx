import { useState } from 'react';

const inputClass =
  'w-full rounded-2xl border border-transparent bg-[#1d1d1d] px-5 py-3.5 text-white outline-none transition-colors duration-200 placeholder:text-[#777] focus:border-[#b99a86] [font-family:\'Pinar\',Tahoma,sans-serif]';

const labelClass =
  'mb-2 block text-right text-sm text-[#b99a86] [font-family:\'Doran\',Tahoma,sans-serif]';

export default function EditProfile({ userData }) {
  const profile = userData?.profile ?? {};
  const [form, setForm] = useState({
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
    username: profile.username ?? '',
    phone: userData?.phone ?? '',
  });
  const [isSaved, setIsSaved] = useState(false);

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setIsSaved(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    // TODO: اتصال ذخیره پروفایل به سرویس کاربران
    setIsSaved(true);
  };

  return (
    <section
      dir="rtl"
      aria-label="ویرایش پروفایل"
      className="mx-auto w-[var(--content-width)] py-8 text-white md:py-10 [font-family:'Pinar',Tahoma,sans-serif]"
    >
      <div className="rounded-[2.5rem] bg-[#282828] p-8 md:rounded-[3rem] md:p-12">
        <h2 className="text-2xl text-[#b99a86] md:text-3xl [font-family:'Doran',Tahoma,sans-serif]">
          ویرایش پروفایل
        </h2>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-5 md:grid-cols-2 md:gap-6">
          <div>
            <label className={labelClass} htmlFor="edit-profile-first-name">
              نام
            </label>
            <input
              id="edit-profile-first-name"
              type="text"
              className={inputClass}
              value={form.firstName}
              onChange={handleChange('firstName')}
              placeholder="نام خود را وارد کنید"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="edit-profile-last-name">
              نام خانوادگی
            </label>
            <input
              id="edit-profile-last-name"
              type="text"
              className={inputClass}
              value={form.lastName}
              onChange={handleChange('lastName')}
              placeholder="نام خانوادگی خود را وارد کنید"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="edit-profile-username">
              نام کاربری
            </label>
            <input
              id="edit-profile-username"
              type="text"
              className={inputClass}
              value={form.username}
              onChange={handleChange('username')}
              placeholder="مثلا: tapesh_user"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="edit-profile-phone">
              شماره تلفن
            </label>
            <input
              id="edit-profile-phone"
              type="tel"
              className={`${inputClass} cursor-not-allowed text-[#999]`}
              value={form.phone}
              readOnly
            />
          </div>

          <div className="flex items-center gap-4 md:col-span-2">
            <button
              type="submit"
              className="cursor-pointer rounded-full bg-[#b99a86] px-10 py-3.5 text-white transition-colors duration-200 hover:bg-[#a3826e] md:text-lg [font-family:'Doran',Tahoma,sans-serif]"
            >
              ذخیره تغییرات
            </button>
            {isSaved && <span className="text-sm text-[#67ba85]">تغییرات ذخیره شد.</span>}
          </div>
        </form>
      </div>
    </section>
  );
}
