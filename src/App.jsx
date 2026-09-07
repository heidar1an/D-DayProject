import { useEffect, useRef, useState } from 'react';

import blueRobot from '../images/pictures/ChatGPT Image ۲۷ مرداد ۱۴۰۵، ۱۷_۲۰_۲۷.png';
import greenTest from '../images/pictures/ChatGPT Image ۲۷ مرداد ۱۴۰۵، ۱۷_۱۵_۳۴.png';
import purpleBook from '../images/pictures/ChatGPT Image ۲۷ مرداد ۱۴۰۵، ۱۷_۰۹_۵۰.png';
import professor from '../images/pictures/images (1).jpeg';
import brownTest from '../images/pictures/01.png';
import heartbeatMark from '../images/pictures/600ppi/Asset 6.webp';
import friendsDoctorsIllustration from '../images/pictures/Asset 3.webp';
import greenPath from '../images/pictures/HeidarianMan 2026-08-19 at 19.19.22.png';
import microbiology from '../images/pictures/HeidarianMan 2026-08-19 at 19.38.37.png';
import physiology from '../images/pictures/tuberculosis-abstract-concept-vector-illustration-world-tuberculosis-day-mycobacterium-infection-diagnostics-treatment-infectious-lung-disease-contagious-infection-abstract-metaphor.png';
import tapeshCollage from '../images/pictures/Asset 7.webp';
import trophyIcon from '../images/icons/trophy.png';
import aiIcon from '../images/icons/ai-technology.png';
import checklistIcon from '../images/icons/checklist.png';
import distanceIcon from '../images/icons/distance.png';
import OfflinePage from './layout/OfflinePage';
import SecondaryRegistrationLayout from './layout/SecondaryRegistrationLayout';

const productCards = [
  {
    title: 'درسنامه جامع',
    description: 'یادگیری کامل دروس پزشکی با جدیدترین روش‌های یادگیری',
    image: purpleBook,
    accent: 'lavender',
    href: '#benefits',
  },
  {
    title: 'آزمون علوم پایه',
    description: 'خودتو در کوتاه‌ترین زمان ممکن برای قبولی در علوم پایه آماده کن',
    image: brownTest,
    accent: 'copper',
    href: '#benefits',
  },
  {
    title: 'بانک تست جامع',
    description: 'بزرگترین بانک تست کشوری در حوزه دروس پزشکی برای همه',
    image: greenTest,
    accent: 'sage',
    href: '#benefits',
  },
  {
    title: 'دستیار هوشمند',
    description: 'از دستیار سوال بپرس و خودتو برای امتحانات دانشگاه آماده کن',
    image: blueRobot,
    accent: 'sky',
    href: '#benefits',
  },
];

const authHighlights = [
  {
    title: 'خودتو برای علوم پایه آماده کن',
    description: 'در کوتاه‌ترین زمان و با کیفیت بالا خودتو برای علوم پایه آماده کن؛ بهترین دوره‌ها منتظر تو هستند.',
    image: brownTest,
    accent: 'copper',
  },
  {
    title: 'یادگیری نوین دروس پزشکی',
    description: 'با استفاده از جدیدترین متدهای یادگیری و با یک رابط گرافیکی جذاب، دیگه درس خوندن سخت نخواهد بود.',
    image: purpleBook,
    accent: 'lavender',
  },
  {
    title: 'درساتو از یک حرفه‌ای بپرس',
    description: 'جایی رو متوجه نشدی؟ با چند کلیک اطلاعات پزشکیت رو بروز کن؛ دستیار هوشمند کنار توست.',
    image: blueRobot,
    accent: 'sky',
  },
  {
    title: 'با بهترین‌ها رقابت کن',
    description: 'با همکلاسی‌هات و دانشجوهای سراسر کشور رقابت کن؛ به همراه آزمون‌های تالیفی.',
    image: greenTest,
    accent: 'mint',
  },
];

const authAnimatedPhrases = [
  { text: 'درسنامه های جامع داره', accent: 'blue' },
  { text: 'روان توضیح میده', accent: 'green' },
  { text: 'مطالب رو سریع جمع میکنه', accent: 'brown' },
  { text: 'بانک تست کاملی داره', accent: 'purple' },
];

const benefitRows = [
  [
    {
      title: 'یادگیری نوین دروس پزشکی',
      description: 'با استفاده از جدیدترین متدهای یادگیری و یک رابط گرافیکی جذاب، دیگه درس خوندن سخت نخواهد بود.',
      accent: 'lavender',
      size: 'wide',
    },
    {
      title: 'درساتو از یک حرفه‌ای بپرس',
      description: 'جایی در مورد چیزی سوال داشتی؟ با چند کلیک اطلاعات پزشکی‌تو بروز کن؛ دستیار هوشمند کنار توست.',
      accent: 'sky',
      size: 'regular',
    },
  ],
  [
    {
      title: 'بهترین‌ها رقابت کن',
      description: 'با همکلاسی‌هات و دانشجوهای سراسر کشور رقابت کن؛ به همراه آزمون‌های آنلاین.',
      accent: 'mint',
      size: 'regular',
    },
    {
      title: 'خودتو برای علوم پایه آماده کن',
      description: 'در کوتاه‌ترین زمان و با کیفیت بالا خودتو برای علوم پایه آماده کن؛ بهترین دوره‌ها منتظر تو هستند.',
      accent: 'copper',
      size: 'wide',
    },
  ],
];

const courseCards = [
  {
    title: 'جمع بندی جامع فیزیولوژی',
    image: physiology,
    accent: 'lavender',
    tags: ['درسنامه جامع', 'تست', 'خلاصه نکات', 'یادگیری با پوشش مفهومی'],
  },
  {
    title: 'جمع بندی میکروب شناسی',
    image: microbiology,
    accent: 'copper',
    tags: ['میکرو درسنامه', 'تست هدفمند', 'متن روان', 'یادگیری با پوشش مفهومی'],
  },
];

const greenPathTags = [
  'درسنامه مبتنی بر ویدیوهای درسی',
  'خلاصه نکات',
  'یادگیری در طول ترم',
  'بانک تست جامع',
  'آمادگی برای علوم پایه',
  'یادگیری با پوشش مفهومی',
  'منتورینگ',
];

const greenPathBenefits = [
  'مسیری جامع برای معدل الف شدن',
  'مسیری برای یادگیری ساده و هدفمند',
  'قابلیت استفاده جدا از طرح اشتراکی و برای همه',
];

const tapeshFeatures = [
  {
    title: 'با بهترین‌ها رقابت کن',
    icon: trophyIcon,
    accent: 'green',
  },
  {
    title: 'با یک دستیار هوشمند درس بخون',
    icon: aiIcon,
    accent: 'blue',
  },
  {
    title: 'از بانک تست استفاده کن',
    icon: checklistIcon,
    accent: 'brown',
  },
  {
    title: 'با مسیر سبز یادبگیر',
    icon: distanceIcon,
    accent: 'purple',
  },
];

const articles = [
  {
    title: 'مقاله اول',
    description: 'متن خلاصه‌ای درباره مقاله که اینجا قرار می‌گیرد. لطفاً منتظر باشید.',
  },
  {
    title: 'مقاله دوم',
    description: 'متن خلاصه‌ای درباره مقاله که اینجا قرار می‌گیرد. لطفاً منتظر باشید.',
  },
  {
    title: 'مقاله سوم',
    description: 'متن خلاصه‌ای درباره مقاله که اینجا قرار می‌گیرد. لطفاً منتظر باشید.',
  },
];

const faqItems = [
  {
    question: 'تپش برای چه دانشجویانی مناسب است؟',
    answer: 'تپش برای دانشجویان علوم پزشکی طراحی شده است؛ از شروع ترم و یادگیری مفهومی تا جمع‌بندی و آمادگی آزمون.',
  },
  {
    question: 'دوره مسیر رشد چیست؟',
    answer: 'مسیر رشد یک برنامه مرحله‌به‌مرحله برای ساختن عادت مطالعه، یادگیری هدفمند و پیشرفت پیوسته در دروس پزشکی است.',
  },
  {
    question: 'محتوای آموزشی تپش شامل چه چیزهایی است؟',
    answer: 'درسنامه‌های جامع، خلاصه نکات، بانک تست، آزمون‌های آنلاین و ابزارهای هوشمند یادگیری در تپش قرار دارند.',
  },
  {
    question: 'تپش چگونه به من کمک می‌کند نقاط ضعفم را پیدا کنم؟',
    answer: 'با تحلیل پاسخ‌ها، آزمون‌های هدفمند و مرور مباحث، بخش‌هایی که نیاز به تمرین بیشتری دارند برای شما مشخص می‌شوند.',
  },
  {
    question: 'آیا محتوای تپش به درد امتحانات دانشگاه می‌خورد؟',
    answer: 'بله؛ محتوای تپش برای مطالعه طول ترم، امتحانات دانشگاه و آمادگی آزمون‌های علوم پزشکی قابل استفاده است.',
  },
  {
    question: 'چگونه اشتراک تپش را تهیه کنم؟',
    answer: 'از بخش محصولات، دوره موردنظر خود را انتخاب کنید و پس از ورود یا ثبت‌نام، مراحل تهیه اشتراک را ادامه دهید.',
  },
];

const motionItems = [
  { title: 'دستیار', accent: 'blue' },
  { title: 'علوم پایه', accent: 'brown' },
  { title: 'بانک تست', accent: 'green' },
  { title: 'درسنامه جامع', accent: 'purple' },
];

function Brand() {
  return (
    <a className="brand" href="#top" aria-label="بازگشت به ابتدای صفحه">
      <span className="brand__mark">
        <img src={heartbeatMark} alt="" />
      </span>
      <span className="brand__word">تپش</span>
    </a>
  );
}

function ArrowIcon() {
  return (
    <span className="arrow-icon" aria-hidden="true">
      <svg viewBox="0 0 48 48" focusable="false">
        <path d="M10 38 38 10M19 10h19v19" />
      </svg>
    </span>
  );
}

function ArrowLeftIcon() {
  return <span aria-hidden="true">←</span>;
}

function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.42Z"
      />
      <path
        fill="#34A853"
        d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.55 0-4.7-1.72-5.47-4.03H3.28v2.53A9.74 9.74 0 0 0 12 21.75Z"
      />
      <path
        fill="#FBBC05"
        d="M6.53 13.83A5.85 5.85 0 0 1 6.22 12c0-.64.11-1.26.31-1.83V7.64H3.28A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.03 4.36l3.25-2.53Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.14c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.23 14.63 2.25 12 2.25a9.74 9.74 0 0 0-8.72 5.39l3.25 2.53C7.3 7.86 9.45 6.14 12 6.14Z"
      />
    </svg>
  );
}

function MotionStrip() {
  const trackRef = useRef(null);
  const sequenceRef = useRef(null);
  const loopWidthRef = useRef(0);
  const offsetRef = useRef(0);
  const velocityRef = useRef(0);
  const targetVelocityRef = useRef(1);
  const completedLoopsRef = useRef(0);
  const finishedRef = useRef(false);
  const stoppingRef = useRef(false);

  useEffect(() => {
    const track = trackRef.current;
    const sequence = sequenceRef.current;
    if (!track || !sequence) return undefined;

    const measureLoop = () => {
      const trackStyles = window.getComputedStyle(track);
      const sequenceGap = parseFloat(trackStyles.columnGap || trackStyles.gap) || 0;

      loopWidthRef.current = sequence.getBoundingClientRect().width + sequenceGap;
    };

    measureLoop();
    const resizeObserver =
      'ResizeObserver' in window ? new ResizeObserver(measureLoop) : null;

    resizeObserver?.observe(sequence);
    document.fonts?.ready.then(measureLoop);
    window.addEventListener('resize', measureLoop);

    let animationFrame = 0;
    let lastTime = performance.now();
    const loopDuration = 24000;
    const totalLoops = 6;

    const animate = (time) => {
      const delta = Math.min(time - lastTime, 50);
      lastTime = time;

      if (!finishedRef.current && loopWidthRef.current > 0) {
        const loopWidth = loopWidthRef.current;
        const targetSpeed = targetVelocityRef.current * (loopWidth / loopDuration);
        const easing = 1 - Math.exp(-delta / (stoppingRef.current ? 900 : 420));

        velocityRef.current += (targetSpeed - velocityRef.current) * easing;
        offsetRef.current -= velocityRef.current * delta;

        if (offsetRef.current <= -loopWidth) {
          offsetRef.current += loopWidth;
          completedLoopsRef.current += 1;

          if (completedLoopsRef.current >= totalLoops) {
            completedLoopsRef.current = totalLoops;
            stoppingRef.current = true;
            targetVelocityRef.current = 0;
          }
        }

        if (stoppingRef.current && Math.abs(velocityRef.current) < 0.0001) {
          velocityRef.current = 0;
          finishedRef.current = true;
        }

        track.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measureLoop);
    };
  }, []);

  const pauseMotion = () => {
    if (!finishedRef.current) targetVelocityRef.current = 0;
  };

  const resumeMotion = () => {
    if (!finishedRef.current && !stoppingRef.current) targetVelocityRef.current = 1;
  };

  return (
    <div
      className="motion-strip"
      aria-label="دسته‌بندی‌های تپش"
      onPointerEnter={pauseMotion}
      onPointerLeave={resumeMotion}
    >
      <div className="motion-track" ref={trackRef}>
        {[0, 1, 2, 3, 4].map((sequenceIndex) => (
          <div className="motion-sequence" ref={sequenceIndex === 0 ? sequenceRef : undefined} key={sequenceIndex}>
            {motionItems.map((item) => (
              <span className={`motion-pill motion-pill--${item.accent}`} key={`${sequenceIndex}-${item.title}`}>
                {item.title}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function useAuthTypewriter(phrases, enabled) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayedPhrase, setDisplayedPhrase] = useState('');
  const [phase, setPhase] = useState('typing');

  useEffect(() => {
    if (!enabled) {
      setPhraseIndex(0);
      setDisplayedPhrase('');
      setPhase('typing');
      return undefined;
    }

    const phraseCharacters = Array.from(phrases[phraseIndex].text);
    let timer;

    if (phase === 'typing') {
      if (displayedPhrase.length < phraseCharacters.length) {
        timer = window.setTimeout(() => {
          setDisplayedPhrase(
            phraseCharacters.slice(0, displayedPhrase.length + 1).join(''),
          );
        }, 140);
      } else {
        setPhase('holding');
      }
    }

    if (phase === 'holding') {
      timer = window.setTimeout(() => setPhase('deleting'), 10000);
    }

    if (phase === 'deleting') {
      if (displayedPhrase.length > 0) {
        timer = window.setTimeout(() => {
          setDisplayedPhrase(
            phraseCharacters.slice(0, displayedPhrase.length - 1).join(''),
          );
        }, 90);
      } else {
        timer = window.setTimeout(() => {
          setPhraseIndex((currentIndex) => (currentIndex + 1) % phrases.length);
          setPhase('typing');
        }, 2000);
      }
    }

    return () => window.clearTimeout(timer);
  }, [displayedPhrase, enabled, phase, phraseIndex, phrases]);

  return { displayedPhrase, phraseIndex };
}

function AuthPage({ onBack, onRegisterSuccess }) {
  const [mode, setMode] = useState('login');
  const [isEntered, setIsEntered] = useState(false);
  const [isFormSwitching, setIsFormSwitching] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const modeSwitchTimerRef = useRef(null);
  const isRegistering = mode === 'register';
  const {
    displayedPhrase: animatedPhrase,
    phraseIndex: animatedPhraseIndex,
  } = useAuthTypewriter(authAnimatedPhrases, !isRegistering);

  const clearFieldError = (fieldName) => {
    setFieldErrors((currentErrors) => {
      if (!currentErrors[fieldName]) return currentErrors;

      const nextErrors = { ...currentErrors };
      delete nextErrors[fieldName];
      return nextErrors;
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const phoneInput = form.querySelector('#auth-phone');
    const passwordInput = form.querySelector('#auth-password');
    const confirmationInput = form.querySelector('#auth-password-confirm');
    const requiredFields = isRegistering
      ? ['phone', 'password', 'password-confirm']
      : ['phone', 'password'];
    const nextErrors = {};

    [phoneInput, passwordInput, confirmationInput].forEach((input) => {
      input?.setCustomValidity('');
    });

    requiredFields.forEach((fieldName) => {
      const value = String(formData.get(fieldName) || '').trim();

      if (!value) {
        nextErrors[fieldName] = 'لطفا این بخش را پر کنید.';
      }
    });

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      const firstInvalidField = form.querySelector(
        `[name="${Object.keys(nextErrors)[0]}"]`,
      );
      requestAnimationFrame(() => firstInvalidField?.focus({ preventScroll: true }));
      return;
    }

    if (!isRegistering) return;

    const normalizeDigits = (value) =>
      value
        .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
        .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
    const phone = normalizeDigits(String(formData.get('phone') || '').trim());
    const password = String(formData.get('password') || '');
    const confirmation = String(formData.get('password-confirm') || '');

    if (phone !== '3148') {
      phoneInput?.setCustomValidity('برای ورود به نسخه‌ی آزمایشی، شماره تلفن را 3148 وارد کنید.');
      phoneInput?.reportValidity();
      return;
    }

    if (password !== '3148') {
      passwordInput?.setCustomValidity('برای ورود به نسخه‌ی آزمایشی، رمز عبور را 3148 وارد کنید.');
      passwordInput?.reportValidity();
      return;
    }

    if (password !== confirmation) {
      confirmationInput?.setCustomValidity('رمز عبور و تکرار آن یکسان نیستند.');
      confirmationInput?.reportValidity();
      return;
    }

    onRegisterSuccess?.();
  };

  const switchMode = () => {
    if (isFormSwitching) return;

    setFieldErrors({});
    setIsFormSwitching(true);
    window.clearTimeout(modeSwitchTimerRef.current);
    modeSwitchTimerRef.current = window.setTimeout(() => {
      setMode((currentMode) => (currentMode === 'login' ? 'register' : 'login'));
      requestAnimationFrame(() => setIsFormSwitching(false));
    }, 240);
  };

  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setIsEntered(true));
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(modeSwitchTimerRef.current);
  }, []);

  return (
    <main className="auth-page" dir="rtl">
      <div className={`auth-page__shell ${isEntered ? 'is-visible' : ''}`}>
        <section className="auth-highlights" aria-label="مزایای تپش">
          {authHighlights.map((card) => (
            <article className={`auth-highlight auth-highlight--${card.accent}`} key={card.title}>
              <img className="auth-highlight__image" src={card.image} alt="" />
              <div className="auth-highlight__copy">
                <h2>{card.title}</h2>
                <p>{card.description}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="auth-panel" aria-labelledby="auth-title">
          <button
            className="auth-panel__logo-button"
            type="button"
            aria-label="بازگشت به صفحه اصلی"
            onClick={onBack}
          >
            <img src={heartbeatMark} alt="تپش" />
          </button>

          <h1
            id="auth-title"
            className={`auth-panel__title ${
              isRegistering ? 'auth-panel__title--register' : 'auth-panel__title--login'
            } ${isFormSwitching ? 'is-switching' : ''}`}
          >
            {isRegistering ? (
              <>
                ثبت نام در <span>تپش</span>
              </>
            ) : (
              <>
                من عضو تپش هستم
                <br />
                چون{' '}
                <span
                  className={`auth-animated-phrase auth-animated-phrase--${authAnimatedPhrases[animatedPhraseIndex].accent}`}
                  aria-live="polite"
                >
                  {animatedPhrase}
                  <span className="auth-typewriter__cursor" aria-hidden="true" />
                </span>
              </>
            )}
          </h1>

          <form
            className={`auth-form ${isFormSwitching ? 'is-switching' : ''}`}
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="auth-form__fields">
              <label htmlFor="auth-phone">شماره تلفن</label>
              <input
                id="auth-phone"
                name="phone"
                className={fieldErrors.phone ? 'is-error' : ''}
                type="tel"
                inputMode="tel"
                placeholder="مثلا: ۰۹۱۲۳۴۵۶۷۸۹"
                autoComplete="tel"
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? 'auth-phone-error' : undefined}
                onChange={() => clearFieldError('phone')}
                required
              />
              {fieldErrors.phone && (
                <span className="auth-form__error" id="auth-phone-error" role="alert">
                  {fieldErrors.phone}
                </span>
              )}

              <label htmlFor="auth-password">رمز عبور</label>
              <input
                id="auth-password"
                name="password"
                className={fieldErrors.password ? 'is-error' : ''}
                type="password"
                placeholder="رمز عبور"
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'auth-password-error' : undefined}
                onChange={() => clearFieldError('password')}
                required
              />
              {fieldErrors.password && (
                <span className="auth-form__error" id="auth-password-error" role="alert">
                  {fieldErrors.password}
                </span>
              )}

              {isRegistering && (
                <>
                  <label htmlFor="auth-password-confirm">تکرار رمز عبور</label>
                  <input
                    id="auth-password-confirm"
                    name="password-confirm"
                    className={fieldErrors['password-confirm'] ? 'is-error' : ''}
                    type="password"
                    placeholder="تکرار رمز عبور"
                    autoComplete="new-password"
                    aria-invalid={Boolean(fieldErrors['password-confirm'])}
                    aria-describedby={
                      fieldErrors['password-confirm']
                        ? 'auth-password-confirm-error'
                        : undefined
                    }
                    onChange={() => clearFieldError('password-confirm')}
                    required
                  />
                  {fieldErrors['password-confirm'] && (
                    <span
                      className="auth-form__error"
                      id="auth-password-confirm-error"
                      role="alert"
                    >
                      {fieldErrors['password-confirm']}
                    </span>
                  )}
                </>
              )}

              {!isRegistering && (
                <button className="auth-form__forgot" type="button">
                  فراموشی رمز / ارسال پیامک
                </button>
              )}
            </div>

            <div className="auth-form__actions">
              <button className="auth-form__submit" type="submit">
                {isRegistering ? 'ثبت نام' : 'ورود'}
              </button>

              {isRegistering && (
                <button className="auth-form__google" type="button">
                  <GoogleIcon />
                  <span>ثبت نام از طریق گوگل</span>
                </button>
              )}

              <button className="auth-form__switch" type="button" onClick={switchMode}>
                {isRegistering ? 'ورود' : 'ثبت نام'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

function getAppRoute() {
  if (typeof window === 'undefined') return 'home';

  if (
    window.location.hash === '#onboarding' ||
    window.history.state?.tapeshRoute === 'onboarding' ||
    window.history.state?.tapeshOnboarding === true
  ) {
    return 'onboarding';
  }

  if (
    window.location.hash === '#auth' ||
    window.history.state?.tapeshRoute === 'auth' ||
    window.history.state?.tapeshAuth === true
  ) {
    return 'auth';
  }

  return 'home';
}

function getRouteUrl(route) {
  if (typeof window === 'undefined' || route === 'home') {
    return typeof window === 'undefined'
      ? ''
      : `${window.location.pathname}${window.location.search}`;
  }

  return `${window.location.pathname}${window.location.search}#${route}`;
}

function getRouteState(route, previousState = {}) {
  return {
    ...previousState,
    tapeshRoute: route,
    tapeshAuth: route === 'auth',
    tapeshOnboarding: route === 'onboarding',
  };
}

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [authOpen, setAuthOpen] = useState(
    () => getAppRoute() === 'auth',
  );
  const [onboardingOpen, setOnboardingOpen] = useState(
    () => getAppRoute() === 'onboarding',
  );
  const isOnline = useOnlineStatus();

  const closeMenu = () => setMenuOpen(false);
  const openAuth = (event) => {
    event.preventDefault();
    closeMenu();
    window.history.pushState(
      getRouteState('auth'),
      '',
      getRouteUrl('auth'),
    );
    setAuthOpen(true);
    setOnboardingOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const closeAuth = () => {
    if (getAppRoute() === 'auth') {
      window.history.back();
      return;
    }

    window.history.replaceState(
      getRouteState('home'),
      '',
      getRouteUrl('home'),
    );
    setAuthOpen(false);
    setOnboardingOpen(false);
  };

  useEffect(() => {
    const syncAuthRoute = () => {
      const route = getAppRoute();
      setAuthOpen(route === 'auth');
      setOnboardingOpen(route === 'onboarding');
    };

    const initialRoute = getAppRoute();
    const currentState = window.history.state || {};
    const hasManagedRoute =
      currentState.tapeshRoute ||
      currentState.tapeshAuth === true ||
      currentState.tapeshOnboarding === true;

    if (!hasManagedRoute && initialRoute !== 'home') {
      window.history.replaceState(getRouteState('home', currentState), '', getRouteUrl('home'));

      if (initialRoute === 'onboarding') {
        window.history.pushState(getRouteState('auth'), '', getRouteUrl('auth'));
      }

      window.history.pushState(getRouteState(initialRoute), '', getRouteUrl(initialRoute));
    } else if (!currentState.tapeshRoute) {
      window.history.replaceState(
        getRouteState(initialRoute, currentState),
        '',
        window.location.href,
      );
    }

    syncAuthRoute();
    window.addEventListener('popstate', syncAuthRoute);
    window.addEventListener('hashchange', syncAuthRoute);

    return () => {
      window.removeEventListener('popstate', syncAuthRoute);
      window.removeEventListener('hashchange', syncAuthRoute);
    };
  }, []);

  useEffect(() => {
    if (authOpen) return undefined;

    const revealElements = Array.from(document.querySelectorAll('[data-reveal]'));
    const pendingFrames = new Set();

    const revealElement = (element) => {
      if (
        element.classList.contains('is-visible') ||
        element.dataset.revealQueued === 'true'
      ) {
        return;
      }

      element.dataset.revealQueued = 'true';

      const firstFrame = requestAnimationFrame(() => {
        pendingFrames.delete(firstFrame);

        const secondFrame = requestAnimationFrame(() => {
          element.classList.add('is-visible');
          delete element.dataset.revealQueued;
          pendingFrames.delete(secondFrame);
        });

        pendingFrames.add(secondFrame);
      });

      pendingFrames.add(firstFrame);
    };

    if (!('IntersectionObserver' in window)) {
      revealElements.forEach(revealElement);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          revealElement(entry.target);
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -8% 0px',
      },
    );

    revealElements.forEach((element) => observer.observe(element));

    const initialCheck = window.setTimeout(() => {
      const viewportHeight = window.innerHeight;

      revealElements.forEach((element) => {
        const bounds = element.getBoundingClientRect();

        if (bounds.top < viewportHeight * 0.94 && bounds.bottom > 0) {
          revealElement(element);
        }
      });
    }, 0);

    return () => {
      window.clearTimeout(initialCheck);
      observer.disconnect();
      pendingFrames.forEach((frame) => cancelAnimationFrame(frame));
    };
  }, [authOpen]);

  const openOnboarding = () => {
    window.history.pushState(
      getRouteState('onboarding'),
      '',
      getRouteUrl('onboarding'),
    );
    setAuthOpen(false);
    setOnboardingOpen(true);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const closeOnboarding = () => {
    if (getAppRoute() === 'onboarding') {
      window.history.back();
      return;
    }

    window.history.replaceState(
      getRouteState('home'),
      '',
      getRouteUrl('home'),
    );
    setOnboardingOpen(false);
    setAuthOpen(false);
  };

  const finishOnboarding = () => {
    window.history.replaceState(
      getRouteState('home'),
      '',
      getRouteUrl('home'),
    );
    setOnboardingOpen(false);
    setAuthOpen(false);
  };

  if (!isOnline) {
    return <OfflinePage />;
  }

  if (onboardingOpen) {
    return (
      <SecondaryRegistrationLayout
        onBack={closeOnboarding}
        onComplete={finishOnboarding}
      />
    );
  }

  if (authOpen) {
    return <AuthPage onBack={closeAuth} onRegisterSuccess={openOnboarding} />;
  }

  return (
    <div className="app" id="top">
      <header className="site-header" data-reveal="header">
        <Brand />

        <button
          className={`menu-toggle ${menuOpen ? 'is-open' : ''}`}
          type="button"
          aria-label={menuOpen ? 'بستن منو' : 'باز کردن منو'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`site-nav ${menuOpen ? 'is-open' : ''}`} aria-label="ناوبری اصلی">
          <a className="site-nav__link site-nav__link--products" href="#products" onClick={closeMenu}>
            محصولات
          </a>
          <a className="site-nav__link site-nav__link--pricing" href="#benefits" onClick={closeMenu}>
            تعرفه‌ها
          </a>
          <a className="site-nav__link site-nav__link--about" href="#quote" onClick={closeMenu}>
            درباره ما
          </a>
        </nav>

        <a className="auth-link auth-link--login" href="#auth" onClick={openAuth}>
          ورود / ثبت نام
        </a>
      </header>

      <main>
        <section className="hero" data-reveal="hero" aria-labelledby="hero-title">
          <div className="hero__glow hero__glow--one" />
          <div className="hero__glow hero__glow--two" />
          <div className="hero__content">
            <h1 id="hero-title">
              <span>یادگیری پزشکی</span>
              <span>ساده‌تر از هر زمان دیگری</span>
            </h1>
            <p>
              دروس پزشکی، آمادگی برای علوم پایه، جمع‌بندی هوشمند و خیلی چیزهای
              دیگر منتظر شما هستند.
            </p>
            <a className="button button--primary" href="#products">
              از الان شروع کنید
            </a>
          </div>
        </section>

        <section
          className="products section-shell"
          id="products"
          data-reveal
          aria-labelledby="products-title"
        >
          <div className="product-grid">
            {productCards.map((card) => (
              <article className={`product-card product-card--${card.accent}`} key={card.title}>
                <div className="product-card__copy">
                  <h2>{card.title}</h2>
                  <p>{card.description}</p>
                </div>
                <img className="product-card__image" src={card.image} alt="" />
                <a className="product-card__arrow" href={card.href} aria-label={`مشاهده ${card.title}`}>
                  <ArrowIcon />
                </a>
              </article>
            ))}
          </div>
          <h2 className="sr-only" id="products-title">
            محصولات و خدمات تپش
          </h2>
        </section>

        <section
          className="benefits section-shell"
          id="benefits"
          data-reveal
          aria-labelledby="benefits-title"
        >
          <h2 className="section-title" id="benefits-title">
            تپش؛ ضربان زندگی دانشجویان علوم پزشکی
          </h2>
          <div className="benefits__rows">
            {benefitRows.map((row, rowIndex) => (
              <div className="benefits__row" key={`benefit-row-${rowIndex}`}>
                {row.map((card) => (
                  <article
                    className={`benefit-card benefit-card--${card.size} benefit-card--${card.accent}`}
                    key={card.title}
                  >
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section
          className="quote section-shell"
          id="quote"
          data-reveal
          aria-labelledby="quote-title"
        >
          <div className="quote__mark quote__mark--open" aria-hidden="true">
            “
          </div>
          <blockquote id="quote-title">
            پزشک باید درد بیمار را بفهمد و با او همدرد باشد، نه اینکه تنها به
            فکر درمان یک عضو یا یک آزمایشگاه باشد
          </blockquote>
          <div className="quote__mark quote__mark--close" aria-hidden="true">
            ”
          </div>
          <div className="quote__author">
            <img src={professor} alt="پروفسور علیرضا یلدا" />
            <div>
              <strong>پروفسور علیرضا یلدا</strong>
              <span>پدر بیماری‌های عفونی ایران</span>
            </div>
          </div>
        </section>

        <section className="continuation section-shell" aria-label="مسیرهای یادگیری تپش">
          <article className="friends-banner" id="start" data-reveal>
            <div className="friends-banner__visual">
              <img
                src={friendsDoctorsIllustration}
                alt="دو پزشک در حال گفت‌وگو"
                className="friends-banner__image"
              />
            </div>
            <div className="friends-banner__content">
              <h2>با رفقا درس بخون</h2>
              <p>
                با تهیه اشتراک گروهی می‌توانید تا ۳۰٪ تخفیف بین ۲ الی ۳ نفر به
                همراه دوستانتان مطالعه داشته باشید.
              </p>
              <a className="button button--orange" href="#courses">
                از الان شروع کنید
              </a>
            </div>
          </article>

          <div className="course-grid" id="courses" data-reveal>
            {courseCards.map((card) => (
              <article className={`course-card course-card--${card.accent}`} key={card.title}>
                <div className="course-card__tags" aria-label="ویژگی‌های دوره">
                  {card.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <div className="course-card__visual">
                  <img src={card.image} alt="" />
                </div>
                <a className="course-card__footer" href="#green-path">
                  <span>{card.title}</span>
                  <ArrowIcon />
                </a>
              </article>
            ))}
          </div>

          <article className="green-path-card" id="green-path" data-reveal>
            <div className="green-path-card__visual">
              <img src={greenPath} alt="تصویر مفهومی مسیر یادگیری علوم پزشکی" />
            </div>
            <div className="green-path-card__content">
              <div className="green-path-card__tags" aria-label="ویژگی‌های دوره مسیر سبز">
                {greenPathTags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <ul>
                {greenPathBenefits.map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
              <a className="green-path-card__button" href="#tapesh-intro">
                <span>دوره کامل مسیر سبز</span>
                <ArrowIcon />
              </a>
            </div>
          </article>

          <article className="tapesh-intro" id="tapesh-intro" data-reveal>
            <div className="tapesh-intro__visual">
              <img
                src={tapeshCollage}
                alt="کلاژی از دانشجو، هوش مصنوعی و مفاهیم پزشکی"
                className="tapesh-intro__image"
              />
            </div>
            <div className="tapesh-intro__content">
              <h2>هر آنچه همه خوبان دارند ما یکجا داریم</h2>
              <p>
                با طرح‌های اختصاصی برای شما به یک پزشک متخصص و حرفه‌ای تبدیل
                شوید؛ با استفاده از منابع و تست‌های تپش از پس هر امتحانی برمی‌آیید.
              </p>
              <div className="tapesh-features">
                {tapeshFeatures.map((feature) => (
                  <div className="tapesh-feature" key={feature.title}>
                    <span className={`tapesh-feature__icon tapesh-feature__icon--${feature.accent}`}>
                      <img src={feature.icon} alt="" />
                    </span>
                    <span>{feature.title}</span>
                  </div>
                ))}
              </div>
              <a className="button button--blue" href="#products">
                از الان شروع کنید
              </a>
            </div>
          </article>
        </section>

        <section
          className="articles section-shell"
          id="articles"
          data-reveal
          aria-labelledby="articles-title"
        >
          <h2 className="lower-section-title" id="articles-title">
            مقالات
          </h2>
          <div className="article-grid">
            {articles.map((article) => (
              <article className="article-card" key={article.title}>
                <div className="article-card__image" aria-hidden="true" />
                <div className="article-card__content">
                  <h3>{article.title}</h3>
                  <p>{article.description}</p>
                  <a href="#articles" aria-label={`مطالعه ${article.title}`}>
                    <ArrowLeftIcon />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          className="faq section-shell"
          id="faq"
          data-reveal
          aria-labelledby="faq-title"
        >
          <h2 className="lower-section-title" id="faq-title">
            سوالات متداول
          </h2>
          <div className="faq-grid">
            {faqItems.map((item, index) => {
              const isOpen = openFaq === index;

              return (
                <div className={`faq-item ${isOpen ? 'is-open' : ''}`} key={item.question}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                  >
                    <span>{item.question}</span>
                    <span className="faq-item__plus" aria-hidden="true">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  <div className="faq-item__answer" aria-hidden={!isOpen}>
                    <p>{item.answer}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="site-footer" id="footer" data-reveal>
        <div className="site-footer__inner section-shell">
          <div className="site-footer__brand">
            <Brand />
            <small>نسخه ۱.۵.۵.۲۷</small>
          </div>

          <nav className="site-footer__column" aria-label="محصولات">
            <h2>محصولات</h2>
            <a href="#courses">درسنامه جامع</a>
            <a href="#courses">میکرو درسنامه</a>
            <a href="#courses">بانک تست</a>
            <a href="#tapesh-intro">دستیار هوشمند</a>
            <a href="#green-path">مسیر سبز</a>
          </nav>

          <nav className="site-footer__column" aria-label="بخش‌ها">
            <h2>بخش‌ها</h2>
            <a href="#products">علوم پایه</a>
            <a href="#articles">پره انترنی</a>
            <a href="#faq">المپیاد</a>
            <a href="#faq">کمک و راهنمایی</a>
          </nav>

          <div className="site-footer__about">
            <p>
              ما می‌خواهیم دانش پزشکی را از حالت پراکنده و فرسایشی خارج کنیم و
              آن را به یک مسیر منسجم، قابل‌فهم و قابل‌اعتماد تبدیل کنیم؛ مسیری
              که دانشجو بداند امروز چه بخواند، چرا بخواند، چطور تمرین کند و کجا
              باید بهتر شود
            </p>
          </div>
        </div>
      </footer>

      <MotionStrip />
    </div>
  );
}

export default App;
