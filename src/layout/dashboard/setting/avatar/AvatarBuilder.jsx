import { useEffect, useState } from 'react';

import AvatarSvg from './AvatarSvg';
import {
  ACCESSORY_STYLES,
  BG_COLORS,
  BODY_SIZES,
  BROW_STYLES,
  CLOTH_COLORS,
  CLOTH_STYLES,
  COVERING_COLORS,
  COVERING_STYLES,
  EYE_COLORS,
  EYE_STYLES,
  FACE_SHAPES,
  FACIAL_HAIR_STYLES,
  GENDERS,
  HAIR_COLORS,
  HAIR_STYLES,
  MOUTH_STYLES,
  NOSE_STYLES,
  SKIN_TONES,
  configForGender,
  defaultAvatarConfig,
  randomAvatarConfig,
} from './avatarOptions';
import './avatar.css';

/* دسته‌بندی تب‌های آواتارساز */
const CATEGORIES = [
  { id: 'face', label: 'پوست و صورت' },
  { id: 'hair', label: 'مو' },
  { id: 'eyes', label: 'چشم و ابرو' },
  { id: 'mouth', label: 'بینی و لب' },
  { id: 'body', label: 'بدن و لباس' },
  { id: 'covering', label: 'پوشش سر' },
  { id: 'accessories', label: 'اکسسوری' },
  { id: 'bg', label: 'پس‌زمینه' },
];

function CheckMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
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

/* دکمه گزینه با پیش‌نمایش زنده آواتار */
function PreviewOption({ label, previewConfig, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={label}
      className={`group flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-3 transition-colors duration-200 ${
        selected
          ? 'border-[#b99a86] bg-[#b99a86]/10'
          : 'border-transparent bg-[#1d1d1d] hover:border-[#b99a86]/40'
      }`}
    >
      <span className="block h-16 w-16 overflow-hidden rounded-full border-2 border-[#b99a86]/25 transition-colors duration-200 group-hover:border-[#b99a86]/50 md:h-[4.5rem] md:w-[4.5rem]">
        <AvatarSvg config={previewConfig} title={label} />
      </span>
      <span
        className={`text-center text-xs leading-5 md:text-sm ${
          selected ? 'text-[#e8d9cd]' : 'text-[#aaa]'
        }`}
      >
        {label}
      </span>
    </button>
  );
}

/* دکمه انتخاب رنگ */
function SwatchOption({ label, hex, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={label}
      className={`flex cursor-pointer flex-col items-center gap-2 ${
        selected ? 'text-[#e8d9cd]' : 'text-[#999] hover:text-[#ccc]'
      }`}
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all duration-200 md:h-12 md:w-12 ${
          selected ? 'border-[#b99a86] shadow-[0_0_0_3px_rgba(185,154,134,0.25)]' : 'border-white/15'
        }`}
        style={{ backgroundColor: hex }}
      >
        {selected && (
          <span className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
            <CheckMark />
          </span>
        )}
      </span>
      <span className="text-center text-[0.68rem] leading-4 md:text-xs">{label}</span>
    </button>
  );
}

function OptionGroup({ title, children }) {
  return (
    <section className="mt-7 first:mt-0">
      <h4 className="mb-4 text-base text-[#b99a86] [font-family:'Doran',Tahoma,sans-serif]">
        {title}
      </h4>
      {children}
    </section>
  );
}

const optionGridClass =
  'grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 md:gap-4';
const swatchGridClass =
  'grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8 md:gap-4';

export default function AvatarBuilder({ initialConfig, onSave, onClose }) {
  const [draft, setDraft] = useState(() => initialConfig ?? defaultAvatarConfig());
  const [activeCategory, setActiveCategory] = useState('face');

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

  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  const handleGenderChange = (gender) => {
    setDraft((current) => configForGender(current, gender));
  };

  const handleRandom = () => setDraft(randomAvatarConfig(draft.gender));

  const handleReset = () => setDraft(defaultAvatarConfig(draft.gender));

  const toggleAccessory = (id) => {
    setDraft((current) => ({
      ...current,
      accessories: current.accessories.includes(id)
        ? current.accessories.filter((item) => item !== id)
        : [...current.accessories, id],
    }));
  };

  const hairStyles = HAIR_STYLES.filter((style) => style.genders.includes(draft.gender));
  const clothStyles = CLOTH_STYLES.filter((style) => style.genders.includes(draft.gender));
  const coveringStyles = COVERING_STYLES.filter((style) => style.genders.includes(draft.gender));

  const renderCategory = () => {
    switch (activeCategory) {
      case 'face':
        return (
          <>
            <OptionGroup title="رنگ پوست">
              <div className={swatchGridClass}>
                {SKIN_TONES.map((tone) => (
                  <SwatchOption
                    key={tone.id}
                    label={tone.label}
                    hex={tone.hex}
                    selected={draft.skin === tone.id}
                    onClick={() => set('skin', tone.id)}
                  />
                ))}
              </div>
            </OptionGroup>
            <OptionGroup title="فرم صورت">
              <div className={optionGridClass}>
                {FACE_SHAPES.map((shape) => (
                  <PreviewOption
                    key={shape.id}
                    label={shape.label}
                    selected={draft.face === shape.id}
                    previewConfig={{ ...draft, face: shape.id }}
                    onClick={() => set('face', shape.id)}
                  />
                ))}
              </div>
            </OptionGroup>
          </>
        );

      case 'hair':
        return (
          <>
            <OptionGroup title="حالت مو">
              <div className={optionGridClass}>
                {hairStyles.map((style) => (
                  <PreviewOption
                    key={style.id}
                    label={style.label}
                    selected={draft.hair === style.id}
                    previewConfig={{ ...draft, hair: style.id, covering: 'none' }}
                    onClick={() => set('hair', style.id)}
                  />
                ))}
              </div>
            </OptionGroup>
            <OptionGroup title="رنگ مو">
              <div className={swatchGridClass}>
                {HAIR_COLORS.map((color) => (
                  <SwatchOption
                    key={color.id}
                    label={color.label}
                    hex={color.hex}
                    selected={draft.hairColor === color.id}
                    onClick={() => set('hairColor', color.id)}
                  />
                ))}
              </div>
            </OptionGroup>
            {draft.gender === 'male' && (
              <OptionGroup title="ریش و سبیل">
                <div className={optionGridClass}>
                  {FACIAL_HAIR_STYLES.map((style) => (
                    <PreviewOption
                      key={style.id}
                      label={style.label}
                      selected={draft.facialHair === style.id}
                      previewConfig={{
                        ...draft,
                        facialHair: style.id,
                        hair: style.id === 'none' ? draft.hair : 'buzz',
                      }}
                      onClick={() => set('facialHair', style.id)}
                    />
                  ))}
                </div>
              </OptionGroup>
            )}
          </>
        );

      case 'eyes':
        return (
          <>
            <OptionGroup title="شکل چشم">
              <div className={optionGridClass}>
                {EYE_STYLES.map((style) => (
                  <PreviewOption
                    key={style.id}
                    label={style.label}
                    selected={draft.eyes === style.id}
                    previewConfig={{ ...draft, eyes: style.id }}
                    onClick={() => set('eyes', style.id)}
                  />
                ))}
              </div>
            </OptionGroup>
            <OptionGroup title="رنگ چشم">
              <div className={swatchGridClass}>
                {EYE_COLORS.map((color) => (
                  <SwatchOption
                    key={color.id}
                    label={color.label}
                    hex={color.hex}
                    selected={draft.eyeColor === color.id}
                    onClick={() => set('eyeColor', color.id)}
                  />
                ))}
              </div>
            </OptionGroup>
            <OptionGroup title="ابرو">
              <div className={optionGridClass}>
                {BROW_STYLES.map((style) => (
                  <PreviewOption
                    key={style.id}
                    label={style.label}
                    selected={draft.brows === style.id}
                    previewConfig={{ ...draft, brows: style.id }}
                    onClick={() => set('brows', style.id)}
                  />
                ))}
              </div>
            </OptionGroup>
          </>
        );

      case 'mouth':
        return (
          <>
            <OptionGroup title="حالت لب">
              <div className={optionGridClass}>
                {MOUTH_STYLES.map((style) => (
                  <PreviewOption
                    key={style.id}
                    label={style.label}
                    selected={draft.mouth === style.id}
                    previewConfig={{ ...draft, mouth: style.id }}
                    onClick={() => set('mouth', style.id)}
                  />
                ))}
              </div>
            </OptionGroup>
            <OptionGroup title="بینی">
              <div className={optionGridClass}>
                {NOSE_STYLES.map((style) => (
                  <PreviewOption
                    key={style.id}
                    label={style.label}
                    selected={draft.nose === style.id}
                    previewConfig={{ ...draft, nose: style.id }}
                    onClick={() => set('nose', style.id)}
                  />
                ))}
              </div>
            </OptionGroup>
          </>
        );

      case 'body':
        return (
          <>
            <OptionGroup title="سایز بدن">
              <div className={optionGridClass}>
                {BODY_SIZES.map((size) => (
                  <PreviewOption
                    key={size.id}
                    label={size.label}
                    selected={draft.body === size.id}
                    previewConfig={{ ...draft, body: size.id }}
                    onClick={() => set('body', size.id)}
                  />
                ))}
              </div>
            </OptionGroup>
            <OptionGroup title="لباس">
              <div className={optionGridClass}>
                {clothStyles.map((style) => (
                  <PreviewOption
                    key={style.id}
                    label={style.label}
                    selected={draft.cloth === style.id}
                    previewConfig={{ ...draft, cloth: style.id }}
                    onClick={() => set('cloth', style.id)}
                  />
                ))}
              </div>
            </OptionGroup>
            <OptionGroup title="رنگ لباس">
              <div className={swatchGridClass}>
                {CLOTH_COLORS.map((color) => (
                  <SwatchOption
                    key={color.id}
                    label={color.label}
                    hex={color.hex}
                    selected={draft.clothColor === color.id}
                    onClick={() => set('clothColor', color.id)}
                  />
                ))}
              </div>
            </OptionGroup>
          </>
        );

      case 'covering':
        return (
          <>
            <OptionGroup title="پوشش سر">
              <div className={optionGridClass}>
                {coveringStyles.map((style) => (
                  <PreviewOption
                    key={style.id}
                    label={style.label}
                    selected={draft.covering === style.id}
                    previewConfig={{ ...draft, covering: style.id }}
                    onClick={() => set('covering', style.id)}
                  />
                ))}
              </div>
            </OptionGroup>
            {draft.covering !== 'none' && (
              <OptionGroup title="رنگ پوشش">
                <div className={swatchGridClass}>
                  {COVERING_COLORS.map((color) => (
                    <SwatchOption
                      key={color.id}
                      label={color.label}
                      hex={color.hex}
                      selected={draft.coveringColor === color.id}
                      onClick={() => set('coveringColor', color.id)}
                    />
                  ))}
                </div>
              </OptionGroup>
            )}
          </>
        );

      case 'accessories':
        return (
          <OptionGroup title="اکسسوری (انتخاب چندگانه)">
            <div className={optionGridClass}>
              {ACCESSORY_STYLES.map((style) => (
                <PreviewOption
                  key={style.id}
                  label={style.label}
                  selected={draft.accessories.includes(style.id)}
                  previewConfig={{
                    ...draft,
                    accessories: draft.accessories.includes(style.id)
                      ? draft.accessories.filter((item) => item !== style.id)
                      : [...draft.accessories, style.id],
                  }}
                  onClick={() => toggleAccessory(style.id)}
                />
              ))}
            </div>
          </OptionGroup>
        );

      case 'bg':
        return (
          <OptionGroup title="رنگ پس‌زمینه">
            <div className={swatchGridClass}>
              {BG_COLORS.map((color) => (
                <SwatchOption
                  key={color.id}
                  label={color.label}
                  hex={color.hex}
                  selected={draft.bg === color.id}
                  onClick={() => set('bg', color.id)}
                />
              ))}
            </div>
          </OptionGroup>
        );

      default:
        return null;
    }
  };

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
        aria-label="ساخت آواتار"
        onClick={(event) => event.stopPropagation()}
        className="avatar-builder flex max-h-[94vh] w-[min(1080px,100%)] flex-col overflow-hidden rounded-[2rem] bg-[#282828] shadow-[0_30px_80px_rgba(0,0,0,0.5)] md:rounded-[2.5rem] [font-family:'Pinar',Tahoma,sans-serif]"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/5 px-6 py-5 md:px-9 md:py-6">
          <h3 className="text-xl text-white md:text-2xl [font-family:'Doran',Tahoma,sans-serif]">
            آواتار من
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#1d1d1d] text-[#aaa] transition-colors duration-200 hover:bg-[#b99a86]/20 hover:text-white"
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

        <div className="avatar-builder__scroll flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-6 md:flex-row md:gap-9 md:p-9 lg:flex-row">
          {/* ستون پیش‌نمایش */}
          <aside className="shrink-0 md:sticky md:top-0 md:self-start">
            <div className="flex flex-col items-center gap-5">
              <span className="block w-40 overflow-hidden rounded-full border-4 border-[#b99a86]/40 p-1.5 md:w-52">
                <span className="block overflow-hidden rounded-full">
                  <AvatarSvg config={draft} className="block h-auto w-full" title="پیش‌نمایش آواتار" />
                </span>
              </span>

              <div className="flex w-full gap-2" role="group" aria-label="جنسیت چهره">
                {GENDERS.map((gender) => (
                  <button
                    key={gender.id}
                    type="button"
                    onClick={() => handleGenderChange(gender.id)}
                    aria-pressed={draft.gender === gender.id}
                    className={`flex-1 cursor-pointer rounded-2xl py-2.5 text-sm transition-colors duration-200 md:text-base ${
                      draft.gender === gender.id
                        ? 'bg-[#b99a86] text-white'
                        : 'bg-[#1d1d1d] text-[#aaa] hover:text-white'
                    }`}
                  >
                    {gender.label}
                  </button>
                ))}
              </div>

              <div className="flex w-full gap-2">
                <button
                  type="button"
                  onClick={handleRandom}
                  className="flex-1 cursor-pointer rounded-full border border-white/15 py-2.5 text-sm text-[#ccc] transition-colors duration-200 hover:border-[#b99a86]/60 hover:text-white"
                >
                  ساخت تصادفی 🎲
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 cursor-pointer rounded-full border border-white/15 py-2.5 text-sm text-[#ccc] transition-colors duration-200 hover:border-[#b99a86]/60 hover:text-white"
                >
                  بازنشانی
                </button>
              </div>
            </div>
          </aside>

          {/* ستون گزینه‌ها */}
          <div className="min-w-0 flex-1">
            <nav className="flex flex-wrap gap-2" aria-label="دسته‌بندی آواتار">
              {CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  aria-pressed={activeCategory === category.id}
                  className={`cursor-pointer rounded-full px-4 py-2 text-sm transition-colors duration-200 md:px-5 [font-family:'Doran',Tahoma,sans-serif] ${
                    activeCategory === category.id
                      ? 'bg-[#b99a86] text-white'
                      : 'bg-[#1d1d1d] text-[#aaa] hover:text-white'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </nav>

            <div className="mt-6">{renderCategory()}</div>
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-white/5 px-6 py-5 md:px-9">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full border border-white/15 px-8 py-3 text-[#ccc] transition-colors duration-200 hover:border-[#b99a86]/60 hover:text-white [font-family:'Doran',Tahoma,sans-serif]"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={() => onSave?.(draft)}
            className="cursor-pointer rounded-full bg-[#b99a86] px-10 py-3 text-white transition-colors duration-200 hover:bg-[#a3826e] [font-family:'Doran',Tahoma,sans-serif]"
          >
            ذخیره آواتار
          </button>
        </footer>
      </div>
    </div>
  );
}
