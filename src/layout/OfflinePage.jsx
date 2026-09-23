import { useEffect, useRef, useState } from 'react';

import offlineIllustration from '../../images/pictures/ChatGPT Image ۲ شهریور ۱۴۰۵، ۱۱_۱۱_۵۸.png';

export default function OfflinePage() {
  const [isChecking, setIsChecking] = useState(false);
  const [retryMessage, setRetryMessage] = useState('');
  const retryTimerRef = useRef(null);

  useEffect(() => {
    return () => window.clearTimeout(retryTimerRef.current);
  }, []);

  const handleRetry = () => {
    if (isChecking) return;

    setIsChecking(true);
    setRetryMessage('');

    if (navigator.onLine) {
      window.location.reload();
      return;
    }

    retryTimerRef.current = window.setTimeout(() => {
      if (navigator.onLine) {
        window.location.reload();
        return;
      }

      setIsChecking(false);
      setRetryMessage('هنوز اتصال برقرار نشده است.');
    }, 700);
  };

  return (
    <main className="offline-page" dir="rtl">
      <section className="offline-page__content" aria-labelledby="offline-title">
        <div className="offline-page__illustration" aria-hidden="true">
          <img src={offlineIllustration} alt="" />
        </div>

        <h1 id="offline-title" className="offline-page__title">
          <span>نبض</span>{' '}
          <span className="offline-page__title-accent">اینترنتتون</span>{' '}
          <span>نمیزنه</span>
        </h1>

        <p className="offline-page__description">
          <span>اینترنت شما قطع می‌باشد</span>
          <span>لطفاً از اتصال دستگاه خود به اینترنت مطمئن شوید</span>
        </p>

        <button
          className={`offline-page__retry ${isChecking ? 'is-checking' : ''}`}
          type="button"
          onClick={handleRetry}
          disabled={isChecking}
          aria-describedby={retryMessage ? 'offline-retry-status' : undefined}
        >
          {isChecking ? 'در حال بررسی...' : 'تلاش مجدد'}
        </button>

        <p className="offline-page__status" id="offline-retry-status" role="status">
          {retryMessage}
        </p>
      </section>
    </main>
  );
}
