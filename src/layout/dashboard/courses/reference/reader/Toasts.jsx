import Icon from './icons';

/* اعلان‌های کوتاه عملیات (هایلایت/نوت/نشان/کپی غیرفعال) */
export default function Toasts({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="rdr-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`rdr-toast rdr-toast--${toast.variant}`}>
          <Icon name={toast.variant === 'success' ? 'check' : 'info'} size={15} />
          {toast.message}
        </div>
      ))}
    </div>
  );
}
