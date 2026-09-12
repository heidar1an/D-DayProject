import { useEffect, useState } from 'react';

const STORAGE_KEY = 'tapesh:security-settings';

function loadStoredSettings() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const sectionTitleClass =
  'm-0 text-3xl font-bold text-white md:text-4xl [font-family:\'Doran\',Tahoma,sans-serif]';

const rowLabelClass =
  'm-0 text-xl font-medium text-white md:text-2xl [font-family:\'Pinar\',Tahoma,sans-serif]';

const inputClass =
  'h-14 w-full max-w-[420px] rounded-full border border-[#666] bg-transparent px-6 text-white outline-none transition-colors duration-200 [font-family:\'Pinar\',Tahoma,sans-serif] focus:border-[#b99a86]';

/* کلید روشن/خاموش مطابق طرح: خاموش = قاب سفید و کاب سفید سمت چپ،
   روشن = پس‌زمینه سفید و کاب تیره سمت راست */
function ToggleSwitch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[54px] w-[106px] shrink-0 cursor-pointer rounded-full border-2 border-white transition-colors duration-300 ${
        checked ? 'bg-white' : 'bg-transparent'
      }`}
    >
      <span
        className={`absolute top-1/2 h-10 w-10 -translate-y-1/2 rounded-full duration-300 transition-[inset-inline-start] ${
          checked ? 'bg-[#141414]' : 'bg-white'
        }`}
        style={{ insetInlineStart: checked ? '6px' : 'calc(100% - 46px)' }}
      />
    </button>
  );
}

export default function Security() {
  const storedSettings = loadStoredSettings();
  const [shareProgress, setShareProgress] = useState(
    () => storedSettings.shareProgress ?? false,
  );
  const [showProfileInLink, setShowProfileInLink] = useState(
    () => storedSettings.showProfileInLink ?? true,
  );
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ shareProgress, showProfileInLink }),
    );
  }, [shareProgress, showProfileInLink]);

  const handleFieldChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setError('');
    setIsSaved(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.current || !form.next || !form.confirm) {
      setError('لطفا همه بخش‌ها را پر کنید.');
      return;
    }

    if (form.next !== form.confirm) {
      setError('رمز عبور جدید و تکرار آن یکسان نیستند.');
      return;
    }

    // TODO: اتصال تغییر رمز عبور به سرویس کاربران
    setIsSaved(true);
    setForm({ current: '', next: '', confirm: '' });
  };

  return (
    <section
      dir="rtl"
      aria-label="امنیت"
      className="mx-auto w-[var(--content-width)] py-8 text-white md:py-10 [font-family:'Pinar',Tahoma,sans-serif]"
    >
      <h2 className={sectionTitleClass}>اشتراک گذاری اطلاعات</h2>

      <div className="mt-10 flex flex-col gap-9">
        <div className="flex items-center justify-between gap-6">
          <p className={rowLabelClass}>ارسال دستاوردها و پیشرفت‌های شما به نزدیکانتان</p>
          <ToggleSwitch
            checked={shareProgress}
            onChange={setShareProgress}
            label="ارسال دستاوردها و پیشرفت‌های شما به نزدیکانتان"
          />
        </div>

        <div className="flex items-center justify-between gap-6">
          <p className={rowLabelClass}>نشان داده شدن پروفایل در بخش لینک</p>
          <ToggleSwitch
            checked={showProfileInLink}
            onChange={setShowProfileInLink}
            label="نشان داده شدن پروفایل در بخش لینک"
          />
        </div>
      </div>

      <h2 className={`${sectionTitleClass} mt-16`}>تغییر رمز عبور</h2>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="me-auto mt-10 flex w-full max-w-[860px] flex-col gap-6"
      >
        <div className="flex items-center justify-between gap-6">
          <label className={rowLabelClass} htmlFor="security-current-password">
            رمز عبور حال حاضر
          </label>
          <input
            id="security-current-password"
            type="password"
            className={inputClass}
            value={form.current}
            onChange={handleFieldChange('current')}
            autoComplete="current-password"
          />
        </div>

        <div className="flex items-center justify-between gap-6">
          <label className={rowLabelClass} htmlFor="security-new-password">
            رمز عبور جدید
          </label>
          <input
            id="security-new-password"
            type="password"
            className={inputClass}
            value={form.next}
            onChange={handleFieldChange('next')}
            autoComplete="new-password"
          />
        </div>

        <div className="flex items-center justify-between gap-6">
          <label className={rowLabelClass} htmlFor="security-confirm-password">
            تکرار رمز عبور
          </label>
          <input
            id="security-confirm-password"
            type="password"
            className={inputClass}
            value={form.confirm}
            onChange={handleFieldChange('confirm')}
            autoComplete="new-password"
          />
        </div>

        {error && (
          <p role="alert" className="m-0 text-[#ff6969]">
            {error}
          </p>
        )}
        {isSaved && <p className="m-0 text-[#67ba85]">رمز عبور با موفقیت تغییر کرد.</p>}

        <div className="mt-2 flex items-center gap-4">
          <button
            type="submit"
            className="cursor-pointer rounded-full bg-[#b99a86] px-10 py-3.5 text-white transition-colors duration-200 hover:bg-[#a3826e] md:text-lg [font-family:'Doran',Tahoma,sans-serif]"
          >
            تغییر رمز عبور
          </button>
        </div>
      </form>
    </section>
  );
}
