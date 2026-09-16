import AboutCTA from './AboutCTA';
import AboutHero from './AboutHero';
import AboutTimeline from './AboutTimeline';
import EcosystemVisualization from './EcosystemVisualization';
import FutureSection from './FutureSection';
import KnowledgeNetwork from './KnowledgeNetwork';
import LearningPhilosophy from './LearningPhilosophy';
import LearnerSection from './LearnerSection';
import Principles from './Principles';
import ProblemSection from './ProblemSection';
import TapeshEcosystem from './TapeshEcosystem';
import './about.css';

/*
 * ── صفحهٔ «دربارهٔ تپش» (مسیر `#about`) ──
 *
 * این صفحه یک About Us نیست؛ یک تجربهٔ روایی است. ترتیبِ بخش‌ها همان ترتیبِ
 * روایت است و هیچ متنی در این فایل نیست — همه از `services/about/aboutService`
 * می‌آید.
 *
 * ریتمِ عمدیِ صفحه (هر بخش با بخشِ قبل و بعد فرق دارد تا حسِ الگوی تکراری
 * پیش نیاید):
 *
 *   ۱. آغاز        تمام‌صفحه · چسبان · تایپوگرافیِ خیلی بزرگ
 *   ۲. مسئله       چسبان · فقط تایپوگرافی · بدون کارت
 *   ۳. چرا تپش     دوپاره · شبکهٔ تعاملی
 *   ۴. نگاه ما     چسبان · دوپاره · قوس‌های مرحله‌ای
 *   ۵. سیستم       چسبان (تعویض جمله) + میدانِ گره‌ها
 *   ۶. چرخه        چسبان · دایرهٔ مراحل + پانلِ ابزارها
 *   ۷. تاریخچه     ستونِ چسبان + ردیفِ مراحل
 *   ۸. اصول        عمودی · تایپوگرافیِ بسیار بزرگ · بدون چسبندگی
 *   ۹. مخاطب       دوپاره · تعاملی (صداها)
 *   ۱۰. آینده      فهرستِ افقی با وضعیت
 *   ۱۱. پایان      مرکزِ خالی و یک لینک
 *
 * قواعد پروژه رعایت شده: هیچ رنگِ ثابتی (فقط توکن‌ها)، هیچ وابستگیِ تازه‌ای،
 * همهٔ حرکت‌ها transform/opacity و همه گارد `prefers-reduced-motion` دارند.
 */

export default function AboutPage({ hasAccount = false, onStart, onOpenProduct }) {
  return (
    <main className="ab-page" id="about-page">
      <AboutHero />
      <ProblemSection />
      <KnowledgeNetwork />
      <LearningPhilosophy />
      <TapeshEcosystem onOpenProduct={onOpenProduct} />
      <EcosystemVisualization />
      <AboutTimeline />
      <Principles />
      <LearnerSection />
      <FutureSection />
      <AboutCTA hasAccount={hasAccount} onStart={onStart} />
    </main>
  );
}
