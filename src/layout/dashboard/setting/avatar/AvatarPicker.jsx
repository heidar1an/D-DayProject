import { useEffect, useState } from 'react';

import { AVATAR_IMAGES, avatarSrc, isValidAvatar } from './avatarOptions';
import './avatar.css';

function CheckMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function UserPlaceholder() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-14 w-14 md:h-20 md:w-20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M6 21v-1a6 6 0 0 1 6-6 6 6 0 0 1 6 6v1" />
    </svg>
  );
}

/* یک آواتار در شبکهٔ انتخاب */
function AvatarOption({ avatar, index, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`آواتار شمارهٔ ${index + 1}`}
      title={`آواتار شمارهٔ ${index + 1}`}
      className={`group relative block aspect-square cursor-pointer overflow-hidden rounded-full border-2 transition-all duration-200 ${
        selected
          ? 'border-[var(--copper)] shadow-[0_0_0_4px_rgba(185,154,134,0.22)]'
          : 'border-white/10 hover:border-[#b99a86]/60'
      }`}
    >
      <img
        src={avatar.src}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
      {selected && (
        <span className="absolute inset-0 grid place-items-center bg-black/45 text-white">
          <CheckMark />
        </span>
      )}
    </button>
  );
}

/*
 * پاپ‌آپ انتخاب آواتار — کاربر یکی از آواتارهای تصویری کاتالوگ را انتخاب می‌کند.
 * فقط شناسهٔ انتخاب‌شده به بیرون داده می‌شود؛ ذخیره‌سازی بر عهدهٔ والد است.
 */
export default function AvatarPicker({ initialAvatar, onSave, onClose }) {
  const [selected, setSelected] = useState(() => (isValidAvatar(initialAvatar) ? initialAvatar : null));

  /* بستن با کلید Esc + قفل اسکرول صفحه هنگام باز بودن لایه */
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const previewSrc = avatarSrc(selected);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm md:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label="انتخاب آواتار"
        onClick={(event) => event.stopPropagation()}
        className="avatar-picker flex max-h-[94vh] w-[min(980px,100%)] flex-col overflow-hidden rounded-[2rem] bg-[var(--surface-soft)] shadow-[0_30px_80px_rgb(var(--shadow-rgb) / 0.5)] md:rounded-[2.5rem] [font-family:'Pinar','Vazir',Tahoma,sans-serif]"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/5 px-6 py-5 md:px-9 md:py-6">
          <h3 className="text-xl text-white md:text-2xl [font-family:'Doran','Vazir',Tahoma,sans-serif]">
            آواتار من
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[var(--background)] text-[var(--muted)] transition-colors duration-200 hover:bg-[#b99a86]/20 hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="avatar-picker__scroll flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-6 md:flex-row md:gap-9 md:p-9">
          {/* ستون پیش‌نمایش انتخاب */}
          <aside className="shrink-0 md:sticky md:top-0 md:self-start">
            <div className="flex flex-col items-center gap-4">
              <span className="block w-40 overflow-hidden rounded-full border-4 border-[#b99a86]/40 p-1.5 md:w-48">
                <span className="flex aspect-square items-center justify-center overflow-hidden rounded-full bg-[var(--background)] text-[#b99a86]/60">
                  {previewSrc ? (
                    <img
                      src={previewSrc}
                      alt="پیش‌نمایش آواتار"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserPlaceholder />
                  )}
                </span>
              </span>
              <span className="text-center text-sm text-[var(--faint)]">
                {selected ? 'آواتار انتخاب‌شده' : 'هنوز آواتاری انتخاب نکرده‌ای'}
              </span>
            </div>
          </aside>

          {/* شبکهٔ آواتارها */}
          <div className="min-w-0 flex-1">
            <h4 className="mb-4 text-base text-[var(--copper-ink)] [font-family:'Doran','Vazir',Tahoma,sans-serif]">
              یکی از آواتارها را انتخاب کن
            </h4>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 md:gap-4">
              {AVATAR_IMAGES.map((avatar, index) => (
                <AvatarOption
                  key={avatar.id}
                  avatar={avatar}
                  index={index}
                  selected={selected === avatar.id}
                  onClick={() => setSelected(avatar.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-white/5 px-6 py-5 md:px-9">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full border border-white/15 px-8 py-3 text-[var(--muted)] transition-colors duration-200 hover:border-[#b99a86]/60 hover:text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={() => onSave?.(selected)}
            className="cursor-pointer rounded-full bg-[var(--copper)] px-10 py-3 text-white transition-colors duration-200 hover:bg-[var(--copper)] [font-family:'Doran','Vazir',Tahoma,sans-serif]"
          >
            ذخیره آواتار
          </button>
        </footer>
      </div>
    </div>
  );
}
