import { useState } from 'react';

const STORAGE_KEY = 'tapesh:support-requests';

const categoryOptions = [
  'گزارش اشکال',
  'پیشنهاد و انتقاد',
  'اشتراک و پرداخت',
  'دوره‌ها و آزمون‌ها',
  'سایر',
];

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

const LifeBuoyIcon = ({ className }) => (
  <SvgIcon className={className}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
    <path d="m4.93 4.93 4.24 4.24" />
    <path d="m14.83 14.83 4.24 4.24" />
    <path d="m14.83 9.17 4.24-4.24" />
    <path d="m4.93 19.07 4.24-4.24" />
  </SvgIcon>
);

const MessageSquareIcon = ({ className }) => (
  <SvgIcon className={className}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </SvgIcon>
);

const FolderIcon = ({ className }) => (
  <SvgIcon className={className}>
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </SvgIcon>
);

const SparklesIcon = ({ className }) => (
  <SvgIcon className={className}>
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    <path d="M20 3v4" />
    <path d="M22 5h-4" />
  </SvgIcon>
);

const SendIcon = ({ className }) => (
  <SvgIcon className={className}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </SvgIcon>
);

const PenLineIcon = ({ className }) => (
  <SvgIcon className={className}>
    <path d="M12 20h9" />
    <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
  </SvgIcon>
);

const ChevronDownIcon = ({ className }) => (
  <SvgIcon className={className}>
    <path d="m6 9 6 6 6-6" />
  </SvgIcon>
);

/* قرص‌های ستون راست: موضوع پیام و دسته بندی */
const pillClass =
  'h-20 w-full rounded-full border border-[var(--border-solid)] bg-transparent pr-16 pl-8 text-xl text-white outline-none transition-colors duration-200 placeholder:text-white focus:border-[var(--copper)]';

export default function Soppurt() {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState(null);

  /* پیش‌نویس اولیه پیام با هوش مصنوعی (فعلاً به‌صورت محلی) */
  const handleAiDraft = () => {
    const topic = subject.trim() || 'موضوع درخواستی';
    const categoryPart = category ? ` در دسته‌بندی «${category}»` : '';
    setMessage(
      `با سلام و احترام،\nدر رابطه با «${topic}»${categoryPart}، درخواست بررسی دارم:\n\nمتن درخواست خود را اینجا بنویسید...\n\nپیشاپیش از پیگیری شما ممنونم.`,
    );
    setStatus(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!subject.trim() || !message.trim()) {
      setStatus({ type: 'error', text: 'لطفاً موضوع پیام و متن درخواست را کامل کنید.' });
      return;
    }

    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      stored.push({ subject, category, message, createdAt: new Date().toISOString() });
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      /* اگر حافظه محلی در دسترس نبود، ثبت محلی را نادیده بگیر */
    }

    setSubject('');
    setCategory('');
    setMessage('');
    setStatus({ type: 'success', text: 'درخواست شما ثبت شد و به‌زودی بررسی می‌شود.' });
  };

  return (
    <section
      dir="rtl"
      aria-label="راهنما و پشتیبانی"
      className="dash-stagger mx-auto w-[var(--content-width)] py-8 text-white md:py-10 [font-family:'Pinar','Vazir',Tahoma,sans-serif]"
    >
      {/* عنوان بخش */}
      <header className="flex items-center gap-5">
        <LifeBuoyIcon className="h-11 w-11 shrink-0 text-white md:h-12 md:w-12" />
        <h2 className="m-0 text-3xl font-extrabold leading-none md:text-4xl [font-family:'Doran','Vazir',Tahoma,sans-serif]">
          راهنمای و پشتیبانی
        </h2>
      </header>

      <p className="mt-5 text-lg leading-9 text-[var(--white)] md:text-xl md:leading-10">
        برای دریافت دفترچه راهنما میتوانید{' '}
        <a
          href="#"
          onClick={(event) => event.preventDefault()}
          title="دفترچه راهنما"
          className="text-[var(--copper-ink)] transition-colors duration-200 hover:text-[var(--gold-ink)]"
        >
          اینجا
        </a>{' '}
        را کلیک کنید
        <br />
        در صورت پیدا نکردن راه حل میتوانید از طریق باکس زیر درخواست خود را ثبت کنید
      </p>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-6 lg:grid-cols-[1fr_2fr]">
        {/* ستون راست: موضوع پیام، دسته بندی و دکمه هوش مصنوعی */}
        <div className="flex flex-col gap-6">
          <div className="relative">
            <span
              className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 text-white"
              aria-hidden="true"
            >
              <MessageSquareIcon className="h-6 w-6" />
            </span>
            <input
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="موضوع پیام"
              className={pillClass}
            />
          </div>

          <div className="relative">
            <span
              className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 text-white"
              aria-hidden="true"
            >
              <FolderIcon className="h-6 w-6" />
            </span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={`${pillClass} cursor-pointer appearance-none`}
            >
              <option value="">دسته بندی</option>
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span
              className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-white"
              aria-hidden="true"
            >
              <ChevronDownIcon className="h-5 w-5" />
            </span>
          </div>

          <button
            type="button"
            onClick={handleAiDraft}
            className="mt-auto flex h-20 items-center justify-center gap-4 rounded-full bg-[var(--purple-bright)] px-6 text-xl font-medium text-white shadow-lg transition-colors duration-200 hover:bg-[var(--purple-bright)]"
          >
            <SparklesIcon className="h-6 w-6 shrink-0" />
            نوشتن با هوش مصنوعی
          </button>
        </div>

        {/* کادر ادیتور متن */}
        <div className="flex min-h-[520px] flex-col rounded-[2.5rem] border border-[var(--border-solid)] bg-[var(--background)] p-6 md:min-h-[560px] md:p-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-[var(--muted)]">
              <PenLineIcon className="h-5 w-5" />
              <span className="text-lg">ادیتور متن</span>
            </div>
            {/* جایگاه آیکون‌های متن — طبق طرح، دست‌نخورده باقی می‌ماند */}
            <div className="flex h-11 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-white text-center font-medium leading-[1.15] text-black">
              <span className="text-[10px]">آیکون های</span>
              <span className="text-[10px]">متن</span>
            </div>
          </div>

          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="متن پیام خود را اینجا بنویسید..."
            className="mt-4 min-h-0 flex-1 resize-none bg-transparent text-lg leading-8 text-white outline-none placeholder:text-[var(--faint)]"
          />

          {status && (
            <p
              className={`mb-3 text-sm ${
                status.type === 'success' ? 'text-[var(--copper-ink)]' : 'text-[var(--red-ink)]'
              }`}
            >
              {status.text}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-3 rounded-full border border-[var(--border-solid)] px-7 py-3 text-lg transition-colors duration-200 hover:bg-white hover:text-black"
            >
              ارسال کردن
              <SendIcon className="h-5 w-5 -scale-x-100" />
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
