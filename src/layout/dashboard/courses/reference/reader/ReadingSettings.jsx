import { useEffect, useRef } from 'react';
import Icon from './icons';
import { useReader } from './readerContext';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

const LINE_HEIGHTS = [
  { id: 'compact', label: 'فشرده' },
  { id: 'normal', label: 'معمولی' },
  { id: 'relaxed', label: 'راحت' },
];

const WIDTHS = [
  { id: 'narrow', label: 'باریک' },
  { id: 'normal', label: 'معمولی' },
  { id: 'wide', label: 'پهن' },
];

const THEMES = [
  { id: 'light', label: 'روشن', swatch: '#f7f3ec' },
  { id: 'dark', label: 'تیره', swatch: '#141414' },
  { id: 'sepia', label: 'سپیا', swatch: '#f1e5cf' },
];

/* پاپ‌آور تنظیمات خواندن: اندازه فونت، فاصله خطوط، عرض متن و تم مطالعه */
export default function ReadingSettings({ onClose }) {
  const { settings, updateSettings } = useReader();
  const popRef = useRef(null);

  useEffect(() => {
    const onDown = (event) => {
      if (!popRef.current?.contains(event.target)) onClose();
    };
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="rdr-settings" ref={popRef} role="dialog" aria-label="تنظیمات مطالعه">
      <button type="button" className="rdr-settings__close rdr-icon-btn" onClick={onClose} aria-label="بستن تنظیمات" title="بستن تنظیمات">
        <Icon name="close" />
      </button>
      <div className="rdr-settings__row">
        <span className="rdr-settings__label">اندازه متن</span>
        <div className="rdr-settings__stepper">
          <button
            type="button"
            className="rdr-icon-btn"
            onClick={() => updateSettings({ fontSize: Math.max(14, settings.fontSize - 1) })}
            disabled={settings.fontSize <= 14}
            title="کوچک‌تر"
            aria-label="کوچک‌تر کردن متن"
          >
            <Icon name="minus" />
          </button>
          <strong>{toFa(settings.fontSize)}</strong>
          <button
            type="button"
            className="rdr-icon-btn"
            onClick={() => updateSettings({ fontSize: Math.min(23, settings.fontSize + 1) })}
            disabled={settings.fontSize >= 23}
            title="بزرگ‌تر"
            aria-label="بزرگ‌تر کردن متن"
          >
            <Icon name="plus" />
          </button>
        </div>
      </div>

      <div className="rdr-settings__row">
        <span className="rdr-settings__label">فاصله خطوط</span>
        <div className="rdr-settings__segment">
          {LINE_HEIGHTS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={settings.lineHeight === option.id ? 'is-active' : ''}
              onClick={() => updateSettings({ lineHeight: option.id })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rdr-settings__row">
        <span className="rdr-settings__label">عرض متن</span>
        <div className="rdr-settings__segment">
          {WIDTHS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={settings.width === option.id ? 'is-active' : ''}
              onClick={() => updateSettings({ width: option.id })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rdr-settings__row">
        <span className="rdr-settings__label">تم مطالعه</span>
        <div className="rdr-settings__themes">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`rdr-settings__theme ${settings.theme === theme.id ? 'is-active' : ''}`}
              onClick={() => updateSettings({ theme: theme.id })}
              title={theme.label}
            >
              <span style={{ background: theme.swatch }} aria-hidden="true" />
              {theme.label}
            </button>
          ))}
        </div>
      </div>

      <p className="rdr-settings__hint">تنظیمات به‌صورت خودکار ذخیره می‌شود.</p>
    </div>
  );
}
