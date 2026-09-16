/*
 * ── سرآغاز بخش محصولات ──
 *
 * فقط سه سطر: eyebrow، عنوان، زیرعنوان. بقیهٔ کار را فضای خالی می‌کند.
 *
 * `as` سطحِ تیتر را تعیین می‌کند: در صفحهٔ مستقل محصولات `h1` است (تیترِ
 * صفحه) و هر جای دیگری که بخش به‌تنهایی بنشیند `h2`. شناسهٔ عنوان همان
 * `products-title` است که کل بخش با آن برچسب می‌خورد
 * (`aria-labelledby` روی `<section>`).
 */

export default function ProductIntro({ intro, as: Heading = 'h2', headingId = 'products-title' }) {
  return (
    <header className="ps-intro" data-reveal>
      <p className="ps-intro__eyebrow">{intro.eyebrow}</p>
      <Heading className="ps-intro__title" id={headingId}>
        {intro.heading}
      </Heading>
      <p className="ps-intro__lead">{intro.subheading}</p>
    </header>
  );
}
