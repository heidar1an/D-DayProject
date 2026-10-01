/*
 * پوستهٔ سایت: سرصفحه، فوتر و نوار متحرک.
 *
 * از `src/App.jsx` جدا شد تا آن فایل غولِ تک‌فایلی نماند.
 */

import { FOOTER_PRODUCT_LINKS, FOOTER_SECTION_LINKS, FOOTER_SOCIAL_LINKS, motionItems } from './siteData.js';
import { Brand, HeaderUserIcon } from './siteIcons.jsx';
import { useEffect, useRef } from 'react';
import ThemeToggle from '../ThemeToggle';
import { getDisplayName } from '../../services/userStorage';
import { avatarSrc } from '../dashboard/setting/avatar/avatarOptions';

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
    const totalLoops = 12;

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
        {[0, 1, 2, 3, 4].map((sequenceIndex) => {
          /*
           * پنج نسخهٔ یکسان برای بی‌درز شدن چرخش تکرار می‌شوند؛ فقط نسخهٔ اول
           * «واقعی» است. چهار نسخهٔ تکراری از درخت دسترس‌پذیری و ترتیب تب بیرون
           * می‌مانند (aria-hidden + tabIndex=-1) وگرنه فوتر بیست وقفهٔ تبی می‌ساخت
           * در حالی که کاربر فقط چهار مقصد می‌بیند. کلیک روی نسخه‌های تکراری
           * دست‌نخورده کار می‌کند.
           */
          const isClone = sequenceIndex > 0;

          return (
            <div
              className="motion-sequence"
              ref={sequenceIndex === 0 ? sequenceRef : undefined}
              key={sequenceIndex}
              aria-hidden={isClone || undefined}
            >
              {motionItems.map((item) => (
                <a
                  className={`motion-pill motion-pill--${item.accent}`}
                  href={item.href}
                  tabIndex={isClone ? -1 : undefined}
                  key={`${sequenceIndex}-${item.title}`}
                >
                  {item.title}
                </a>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* هدر سایت — یک نسخه واحد برای صفحه اصلی و صفحه مقالات */
function SiteHeader({ menuOpen, onMenuOpenChange, userData, onOpenDashboard, onOpenAuth }) {
  const closeMenu = () => onMenuOpenChange(false);

  return (
    <header className="site-header" data-reveal="header">
      <Brand />

      <button
        className={`menu-toggle ${menuOpen ? 'is-open' : ''}`}
        type="button"
        aria-label={menuOpen ? 'بستن منو' : 'باز کردن منو'}
        aria-expanded={menuOpen}
        onClick={() => onMenuOpenChange(!menuOpen)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav className={`site-nav ${menuOpen ? 'is-open' : ''}`} aria-label="ناوبری اصلی">
        <a className="site-nav__link site-nav__link--products" href="#products" onClick={closeMenu}>
          محصولات
        </a>
        <a className="site-nav__link site-nav__link--pricing" href="#pricing" onClick={closeMenu}>
          تعرفه‌ها
        </a>
        <a className="site-nav__link site-nav__link--about" href="#about" onClick={closeMenu}>
          درباره ما
        </a>
        {/* مقالات یک مسیر مستقل است (`#articles`) — مثل سه لینک دیگر، فقط hash
            عوض می‌شود و روتر خودش صفحه را بالا می‌آورد. */}
        <a className="site-nav__link site-nav__link--articles" href="#articles" onClick={closeMenu}>
          مقالات
        </a>
      </nav>

      <div className="site-header__actions">
        <ThemeToggle />

        {userData ? (
          <button
            className="auth-link auth-link--user"
            type="button"
            aria-label={`ورود به داشبورد ${getDisplayName(userData)}`}
            onClick={onOpenDashboard}
          >
            <span className="auth-link__avatar">
              {avatarSrc(userData.profile?.avatar) ? (
                <img src={avatarSrc(userData.profile?.avatar)} alt="" />
              ) : (
                <HeaderUserIcon />
              )}
            </span>
            <span className="auth-link__name">{getDisplayName(userData)}</span>
          </button>
        ) : (
          <a className="auth-link auth-link--login" href="#auth" onClick={onOpenAuth}>
            ورود / ثبت نام
          </a>
        )}
      </div>
    </header>
  );
}

/* فوتر سایت — مشترک بین صفحهٔ اصلی و بقیهٔ لایه‌های عمومی.
   `onProductLink` لینک‌های ستون «محصولات» را به منطقِ ورود/ثبت‌نام گره می‌زند:
   کاربرِ ثبت‌نام‌نکرده به فرم ثبت‌نام و کاربرِ ثبت‌نام‌شده به لایهٔ همان محصول. */
function SiteFooter({ onProductLink }) {
  return (
    <footer className="site-footer" id="footer" data-reveal>
      <div className="site-footer__inner section-shell">
        <div className="site-footer__brand">
          {/* نشانِ فوتر شمارندهٔ ایستر اگ ندارد؛ activation فقط روی هدرهاست. */}
          <Brand interactive={false} />
          <small>نسخه ۱.۵.۵.۲۷</small>
          <div className="site-footer__about">
            <p>
              والا ما اومدیم دور هم یک چایی بخوریم گفتیم ی پلتفرم نزنیم بچه‌های
              پزشکی رو دور هم جمع کنیم؟ اینجوری شد که بار نیسان سر از اینجا در
              آوردیم. اگه بازم این حوالی راهت خورد بیا پیش خودمون ی چایی مهمون ما
            </p>
          </div>
        </div>

        <nav className="site-footer__column" aria-label="محصولات">
          <h2>محصولات</h2>
          {FOOTER_PRODUCT_LINKS.map((link) => (
            <a
              key={link.title}
              href={link.href}
              onClick={(event) => onProductLink?.(event, link.href)}
            >
              {link.title}
            </a>
          ))}
        </nav>

        <nav className="site-footer__column" aria-label="سایر بخش‌ها">
          <h2>سایر بخش‌ها</h2>
          {FOOTER_SECTION_LINKS.map((link) => (
            <a key={link.title} href={link.href}>
              {link.title}
            </a>
          ))}
        </nav>

        <nav className="site-footer__social" aria-label="فضاهای مجازی تپش">
          <h2>ما را دنبال کنید</h2>
          <div className="site-footer__social-links">
            {FOOTER_SOCIAL_LINKS.map((item) => (
              <a
                key={item.id}
                className={`site-footer__social-link site-footer__social-link--${item.id}`}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                aria-label={item.label}
                title={item.label}
              >
                <img src={item.image} alt="" />
              </a>
            ))}
          </div>
        </nav>
      </div>
    </footer>
  );
}


export { MotionStrip, SiteHeader, SiteFooter };
