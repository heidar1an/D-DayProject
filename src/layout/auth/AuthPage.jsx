/*
 * صفحهٔ ورود/ثبت‌نام و داده‌ها و قلاب تایپ‌رایترش.
 *
 * از `src/App.jsx` جدا شد تا آن فایل غولِ تک‌فایلی نماند.
 */

import { CheckIcon, GoogleIcon, SparkIcon, normalizeDigits } from '../site/siteIcons.jsx';
import authThumbBase from '../../../images/pictures/auth-thumb-base.webp';
import authThumbBook from '../../../images/pictures/auth-thumb-book.webp';
import authThumbRobot from '../../../images/pictures/auth-thumb-robot.webp';
import authThumbTest from '../../../images/pictures/auth-thumb-test.webp';
import { avatarSrc } from '../dashboard/setting/avatar/avatarOptions';
import { useEffect, useRef, useState } from 'react';
import {
  PASSWORD_MIN_LENGTH,
  authErrorMessage,
  clearGoogleReturn,
  consumeGoogleHandoff,
  describePasswordPolicy,
  getGoogleAuthStatus,
  loginUser,
  readGoogleReturn,
  registerUser,
  startGoogleAuth,
} from '../../services/userStorage';
import heartbeatMark from '../../../images/pictures/600ppi/logo-mark.webp';
import authHero from '../../../images/pictures/auth-hero.webp';

const authHighlights = [
  {
    title: 'خودتو برای علوم پایه آماده کن',
    description: 'در کوتاه‌ترین زمان و با کیفیت بالا خودتو برای علوم پایه آماده کن؛ بهترین دوره‌ها منتظر تو هستند.',
    image: authThumbBase,
    accent: 'copper',
  },
  {
    title: 'یادگیری نوین دروس پزشکی',
    description: 'با استفاده از جدیدترین متدهای یادگیری و با یک رابط گرافیکی جذاب، دیگه درس خوندن سخت نخواهد بود.',
    image: authThumbBook,
    accent: 'lavender',
  },
  {
    title: 'درساتو از یک حرفه‌ای بپرس',
    description: 'جایی رو متوجه نشدی؟ با چند کلیک اطلاعات پزشکیت رو بروز کن؛ دستیار هوشمند کنار توست.',
    image: authThumbRobot,
    accent: 'sky',
  },
  {
    title: 'با بهترین‌ها رقابت کن',
    description: 'با همکلاسی‌هات و دانشجوهای سراسر کشور رقابت کن؛ به همراه آزمون‌های تالیفی.',
    image: authThumbTest,
    accent: 'mint',
  },
];

/*
 * چهره‌های پشتهٔ آواتارِ کارت شناور. شناسه‌ها از کاتالوگ آواتار پروژه می‌آیند تا
 * آدرس فایل‌ها بعد از هر بیلد (که hash عوض می‌شود) نشکند.
 */
const authCommunityAvatars = ['07', '12', '21', '05']
  .map((id) => avatarSrc(id))
  .filter(Boolean);

const authAnimatedPhrases = [
  { text: 'درسنامه های جامع داره', accent: 'blue' },
  { text: 'روان توضیح میده', accent: 'green' },
  { text: 'مطالب رو سریع جمع میکنه', accent: 'brown' },
  { text: 'بانک تست کاملی داره', accent: 'purple' },
];

/*
 * پیام‌های بازگشت از گوگل. کدها را سرور در آدرس می‌گذارد (`database/googleAuth.js`)
 * و هر کدام باید کاربر را به «کار درست» بفرستد، نه به یک پیام مبهم — همان قاعدهٔ
 * ترجمهٔ خطای انتشار: اول متنِ سرویس، بعد کد وضعیت.
 */
const GOOGLE_RETURN_MESSAGES = {
  unconfigured:
    'ورود با گوگل روی این سرور فعال نشده است (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).',
  offline: 'سرور ورود با گوگل در دسترس نیست؛ اتصال خود را بررسی کنید.',
  cancelled: 'ورود با گوگل لغو شد.',
  state: 'نشست ورود با گوگل منقضی شد؛ یک‌بار دیگر تلاش کنید.',
  failed: 'ورود با گوگل انجام نشد؛ یک‌بار دیگر تلاش کنید.',
};

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

/*
 * `export` عمدی است — مثل `SignupPromptModal` و `AdminShell`: صفحهٔ ورود پشت
 * state (`authOpen`) قفل است و در رندر سرور به آن نمی‌رسیم، پس هارنس
 * `scripts/verify-render.mjs` باید بتواند همین کامپوننت را مستقیم رندر کند.
 */
function AuthPage({ onBack, onLoginSuccess, onRegisterSuccess, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const [isEntered, setIsEntered] = useState(false);
  const [isFormSwitching, setIsFormSwitching] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  /* خطای سطح فرم — «سرور در دسترس نیست»، «Rate Limit»، «شماره تکراری» */
  const [formError, setFormError] = useState('');
  /* کدام ورودی «پُر و درست» است — همان تیک سبزِ چهارچوب مرجع */
  const [validFields, setValidFields] = useState({});
  /* وضعیت گوگل: `null` یعنی هنوز از سرور نپرسیده‌ایم — با `false` اشتباه نشود */
  const [googleStatus, setGoogleStatus] = useState(null);
  const [googleNotice, setGoogleNotice] = useState('');
  const [isGooglePending, setIsGooglePending] = useState(false);
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

  /*
   * اعتبارسنجیِ زندهٔ فیلدها. ورودی‌ها کنترل‌شده نیستند (فرم با `FormData` خوانده
   * می‌شود)، پس مقدار را از خودِ DOM می‌خوانیم — از جمله رمز عبور برای سنجش
   * «تکرار رمز». یک حالت را برای هر سه فیلد هم‌زمان می‌سازیم تا ترتیب تایپ
   * (مثلا اصلاح رمز بعد از تکرارش) تیک کهنه باقی نگذارد.
   */
  const handleFieldInput = (event) => {
    const form = event.currentTarget.form;
    if (!form) return;

    const phone = normalizeDigits(String(form.elements.phone?.value || '').trim());
    const password = String(form.elements.password?.value || '');
    const confirmation = String(form.elements['password-confirm']?.value || '');

    clearFieldError(event.currentTarget.name);
    setFormError('');
    setValidFields({
      phone: phone.replace(/\D/g, '').length >= 10,
      password: password.length >= PASSWORD_MIN_LENGTH,
      'password-confirm': confirmation.length >= PASSWORD_MIN_LENGTH && confirmation === password,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const phoneInput = form.querySelector('#auth-phone');
    const passwordInput = form.querySelector('#auth-password');
    const confirmationInput = form.querySelector('#auth-password-confirm');
    const requiredFields = isRegistering
      ? ['phone', 'password', 'password-confirm', 'consent']
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

    /* چک‌باکسِ قوانین با پیام «این بخش را پر کنید» گمراه‌کننده است */
    if (nextErrors.consent) {
      nextErrors.consent = 'برای ساختن حساب باید قوانین تپش را بپذیرید.';
    }

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      const firstInvalidField = form.querySelector(
        `[name="${Object.keys(nextErrors)[0]}"]`,
      );
      requestAnimationFrame(() => firstInvalidField?.focus({ preventScroll: true }));
      return;
    }

    const phone = normalizeDigits(String(formData.get('phone') || '').trim());
    const password = String(formData.get('password') || '');
    const confirmation = String(formData.get('password-confirm') || '');

    if (isRegistering && password !== confirmation) {
      confirmationInput?.setCustomValidity('رمز عبور و تکرار آن یکسان نیستند.');
      confirmationInput?.reportValidity();
      return;
    }

    setFormError('');

    if (isRegistering) {
      try {
        const user = await registerUser({ phone, password });
        onRegisterSuccess?.(user);
      } catch (error) {
        /*
         * خطای سرور هرگز به «ورود» تبدیل نمی‌شود: نه کاربری ساخته می‌شود و نه
         * سشنی. پیام از `code` سرور می‌آید (شمارهٔ تکراری / رمز ضعیف / …).
         */
        setFormError(authErrorMessage(error));
        passwordInput?.focus({ preventScroll: true });
      }
      return;
    }

    let user = null;
    try {
      user = await loginUser({ phone, password });
    } catch (error) {
      setFormError(authErrorMessage(error));
      return;
    }

    if (!user) {
      setFieldErrors({ password: 'شماره تلفن یا رمز عبور نادرست است.' });
      passwordInput?.focus({ preventScroll: true });
      return;
    }

    onLoginSuccess?.(user);
  };

  const switchMode = () => {
    if (isFormSwitching) return;

    setFieldErrors({});
    setFormError('');
    setValidFields({});
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

  /*
   * callbackها در ref می‌مانند چون `deps` این افکت عمداً خالی است:
   * `onLoginSuccess`/`onRegisterSuccess` در App توابع inline تازه‌اند و اگر در
   * deps بیایند، هر رندر یک‌بار دیگر اجرا می‌شد؛ `setGoogleStatus` هم شیء تازه
   * می‌سازد ⇒ حلقهٔ بی‌پایان fetch (همان تلهٔ `useAsync(loader, deps)` در README).
   */
  const authCallbacksRef = useRef({ onLoginSuccess, onRegisterSuccess });

  useEffect(() => {
    authCallbacksRef.current = { onLoginSuccess, onRegisterSuccess };
  });

  /*
   * ورود با گوگل — دو کار در زمان mount:
   *   ۱. پرسیدن وضعیت پیکربندی سرور، تا دکمه چیزی را که نیست ادعا نکند.
   *   ۲. اگر با `?google=…` برگشتیم: نشانه را از آدرس پاک کنیم (تا رفرش جریان را
   *      تکرار نکند) و کاربرِ «دست‌دادن» را تحویل بگیریم.
   *
   * پروفایل ناقص ⇒ همان مسیر ثبت‌نام (آنبوردینگ)؛ حساب کامل ⇒ ورود مستقیم.
   * یعنی کاربر گوگلیِ تازه هم «ثبت نام اولیه» را همان‌جا تمام می‌کند.
   *
   * ⚠️ گاردِ `googleBootRef` یک‌بارمصرف است، نه فلگ `active`: پروژه زیر
   * `StrictMode` اجرا می‌شود و افکت در توسعه دو بار اجرا می‌شود
   * (mount → cleanup → mount). با فلگ `active`، ادامهٔ async اجرای اول دور
   * ریخته می‌شد و اجرای دوم — چون اجرای اول پارامتر آدرس را پاک کرده بود —
   * `returned = null` می‌دید؛ یعنی «دست‌دادن» هیچ‌وقت تحویل نمی‌شد و کاربر
   * بی‌هیچ خطایی روی `#auth` می‌ماند.
   */
  const googleBootRef = useRef(false);

  useEffect(() => {
    if (googleBootRef.current) return;
    googleBootRef.current = true;

    const returned = readGoogleReturn();
    if (returned) clearGoogleReturn();

    const boot = async () => {
      const status = await getGoogleAuthStatus();
      setGoogleStatus(status);

      if (!returned) return;

      if (returned !== 'handoff') {
        setGoogleNotice(GOOGLE_RETURN_MESSAGES[returned] ?? GOOGLE_RETURN_MESSAGES.failed);
        return;
      }

      setIsGooglePending(true);
      const user = await consumeGoogleHandoff();
      setIsGooglePending(false);

      if (!user) {
        setGoogleNotice(GOOGLE_RETURN_MESSAGES.failed);
        return;
      }

      if (user.profile?.username) authCallbacksRef.current.onLoginSuccess?.(user);
      else authCallbacksRef.current.onRegisterSuccess?.(user);
    };

    boot();
  }, []);

  const handleGoogleAuth = () => {
    if (isGooglePending) return;

    /* پیکربندی‌نشده را همین‌جا می‌گوییم؛ رفتن به سرور و برگشتن فقط وقت می‌برد */
    if (googleStatus && !googleStatus.configured) {
      setGoogleNotice(GOOGLE_RETURN_MESSAGES.unconfigured);
      return;
    }

    setIsGooglePending(true);
    startGoogleAuth();
  };

  const googleNote =
    googleNotice ||
    (googleStatus && !googleStatus.configured
      ? googleStatus.reachable
        ? GOOGLE_RETURN_MESSAGES.unconfigured
        : GOOGLE_RETURN_MESSAGES.offline
      : '');

  const isGoogleReady = googleStatus?.configured !== false;

  return (
    <main className="auth-page" dir="rtl">
      <div className="auth-page__aura" aria-hidden="true" />
      <svg
        className="auth-page__curves"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M-40 210C180 60 320 300 540 176s300-236 520-96 320 372 460 268" />
        <path d="M-60 760c220-150 360 90 580-34s300-236 520-96 300 250 460 190" />
        <path d="M980 -40c-70 170 96 226 40 386s-210 150-176 320" />
      </svg>

      <div className={`auth-page__shell ${isEntered ? 'is-visible' : ''}`}>
        <section className="auth-panel" aria-labelledby="auth-title">
          <header className="auth-panel__head">
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
                  من عضو تپش هستم چون{' '}
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

            <p className="auth-panel__subtitle">
              {isRegistering
                ? 'به تپش خوش آمدی؛ حسابت را بساز و مسیر مطالعه‌ات را از همین‌جا شروع کن.'
                : 'خوش برگشتی؛ از همان‌جایی که رها کردی ادامه بده.'}
            </p>
          </header>

          <form
            className={`auth-form ${isFormSwitching ? 'is-switching' : ''}`}
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="auth-form__social">
              <button
                className={`auth-form__google${isGoogleReady ? '' : ' is-unavailable'}`}
                type="button"
                onClick={handleGoogleAuth}
                disabled={isGooglePending}
                aria-busy={isGooglePending}
              >
                <GoogleIcon />
                <span>
                  {isGooglePending ? 'در حال ورود با گوگل…' : 'ورود / ثبت نام با گوگل'}
                </span>
              </button>
            </div>

            {googleNote && (
              <p className="auth-form__google-note" role="status">
                {googleNote}
              </p>
            )}

            <div className="auth-form__fields">
              <label htmlFor="auth-phone">شماره تلفن</label>
              <div className={`auth-field${validFields.phone ? ' is-valid' : ''}`}>
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
                  onChange={handleFieldInput}
                  required
                />
                <span className="auth-field__check" aria-hidden="true">
                  <CheckIcon />
                </span>
              </div>
              {fieldErrors.phone && (
                <span className="auth-form__error" id="auth-phone-error" role="alert">
                  {fieldErrors.phone}
                </span>
              )}

              <label htmlFor="auth-password">رمز عبور</label>
              <div className={`auth-field${validFields.password ? ' is-valid' : ''}`}>
                <input
                  id="auth-password"
                  name="password"
                  className={fieldErrors.password ? 'is-error' : ''}
                  type="password"
                  placeholder="رمز عبور"
                  autoComplete={isRegistering ? 'new-password' : 'current-password'}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'auth-password-error' : undefined}
                  onChange={handleFieldInput}
                  required
                />
                <span className="auth-field__check" aria-hidden="true">
                  <CheckIcon />
                </span>
              </div>
              {fieldErrors.password && (
                <span className="auth-form__error" id="auth-password-error" role="alert">
                  {fieldErrors.password}
                </span>
              )}

              {/* سیاست رمز — نمایشی؛ مرجع امنیت همان اعتبارسنجی سرور است */}
              {isRegistering && !fieldErrors.password && (
                <span className="auth-form__google-note" role="status">
                  {describePasswordPolicy()}
                </span>
              )}

              {isRegistering && (
                <>
                  <label htmlFor="auth-password-confirm">تکرار رمز عبور</label>
                  <div
                    className={`auth-field${
                      validFields['password-confirm'] ? ' is-valid' : ''
                    }`}
                  >
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
                      onChange={handleFieldInput}
                      required
                    />
                    <span className="auth-field__check" aria-hidden="true">
                      <CheckIcon />
                    </span>
                  </div>
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

            {isRegistering && (
              <div className="auth-form__consent">
                <label className="auth-consent">
                  <input
                    type="checkbox"
                    name="consent"
                    onChange={() => clearFieldError('consent')}
                  />
                  <span className="auth-consent__box" aria-hidden="true">
                    <CheckIcon />
                  </span>
                  <span className="auth-consent__text">
                    قوانین استفاده و سیاست حفظ حریم خصوصی تپش را می‌پذیرم.
                  </span>
                </label>
                {fieldErrors.consent && (
                  <span className="auth-form__error" role="alert">
                    {fieldErrors.consent}
                  </span>
                )}
              </div>
            )}

            {formError && (
              <p className="auth-form__google-note" role="alert">
                {formError}
              </p>
            )}

            <div className="auth-form__actions">
              <button className="auth-form__submit" type="submit">
                {isRegistering ? 'ثبت نام' : 'ورود'}
              </button>

              <button className="auth-form__switch" type="button" onClick={switchMode}>
                {isRegistering ? 'قبلا ثبت نام کرده‌ای؟ وارد شو' : 'حساب کاربری نداری؟ ثبت نام کن'}
              </button>
            </div>
          </form>
        </section>

        <aside className="auth-visual" aria-label="مزایای تپش">
          <div className="auth-visual__stage">
            <img className="auth-visual__image" src={authHero} alt="" />
          </div>

          <div className="auth-visual__card">
            <span className="auth-visual__spark" aria-hidden="true">
              <SparkIcon />
            </span>

            <h2 className="auth-visual__title">
              مسیر <em>یادگیری</em> خودت را پیدا کن
            </h2>
            <p className="auth-visual__text">
              از درسنامه‌های جامع تا بانک تست و دستیار هوشمند؛ همه‌چیز یک‌جا تا با تمرکز جلو بروی.
            </p>

            <ul className="auth-visual__features">
              {authHighlights.map((card) => (
                <li
                  className={`auth-visual__feature auth-visual__feature--${card.accent}`}
                  key={card.title}
                  title={card.description}
                >
                  <img className="auth-visual__feature-art" src={card.image} alt="" />
                  <h3>{card.title}</h3>
                </li>
              ))}
            </ul>

            <div className="auth-visual__people">
              <span className="auth-visual__avatars">
                {authCommunityAvatars.map((src) => (
                  <img key={src} src={src} alt="" />
                ))}
              </span>
              <span className="auth-visual__people-label">
                دانشجویان پزشکی، همراه تپش در مسیر درس
              </span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

/*
 * لنگرهای داخلی لایهٔ تعرفه‌ها. نگاشت صریح است، نه حدس پیشوندی — چون پیشوند
 * `#pr-` با هیچ مسیر دیگری شریک نیست ولی تکیه بر پیشوند همان تلهٔ تأییدشدهٔ
 * پروژه است (دو آیتم هم‌زمان فعال می‌شوند). هر لنگر تازه باید این‌جا اضافه شود.
 */

export { authHighlights, authCommunityAvatars, authAnimatedPhrases, GOOGLE_RETURN_MESSAGES, useAuthTypewriter, AuthPage };
