import { usePrefersReducedMotion } from '../productsShared';

/*
 * ── برگه‌های پشت‌سرهمِ نمای بزرگ ──
 *
 * خانوادهٔ دوره‌ها مثل برگه‌هایی که پشت هم روی میز نشسته‌اند: برگهٔ فعال جلو
 * است، برگه‌های بعدی لبه‌شان از پشت پیداست و برگه‌های گذشته مثل ورقِ خورده
 * از سمتِ عطف (لبهٔ راست) کنار رفته‌اند.
 *
 * عددِ مرحله از بیرون می‌آید (`stage`) و والد آن را از اسکرول می‌خواند؛ پس
 * اینجا هیچ شنوندهٔ اسکرول و هیچ stateی نیست. اگر کاربر «کاهش حرکت» روشن
 * داشته باشد، والد مرحله را عوض نمی‌کند و CSS هم ورق‌زدن را خاموش می‌کند؛
 * در آن حالت همهٔ برگه‌ها زیر هم و کامل دیده می‌شوند (چیزی پنهان نمی‌ماند).
 */

export default function SheetStackPreview({ sheets = [], stage = 0 }) {
  const reduced = usePrefersReducedMotion();

  if (sheets.length === 0) return null;

  return (
    <div className="ps-sheets">
      <ul className="ps-sheets__stack">
        {sheets.map((sheet, index) => {
          const state = index === stage ? 'active' : index < stage ? 'past' : 'next';

          return (
            <li
              className={`ps-sheet ps-accent-${sheet.accent}`}
              key={sheet.id}
              data-state={state}
              style={{ '--ps-i': index - stage }}
              aria-hidden={reduced ? undefined : index !== stage}
            >
              <div className="ps-sheet__head">
                <h4 className="ps-sheet__title">{sheet.title}</h4>
              </div>

              <p className="ps-sheet__tagline">{sheet.tagline}</p>

              {sheet.cover ? (
                <span className="ps-sheet__cover">
                  <img src={sheet.cover} alt="" loading="lazy" decoding="async" />
                </span>
              ) : (
                <span className="ps-sheet__rule" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ul>

      <ol className="ps-sheets__dots" aria-hidden="true">
        {sheets.map((sheet, index) => (
          <li className={index === stage ? 'is-active' : ''} key={sheet.id} />
        ))}
      </ol>
    </div>
  );
}
