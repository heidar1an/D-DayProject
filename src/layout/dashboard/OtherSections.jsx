import { Suspense, lazy } from 'react';
import './otherSections.css';

/* AI Card با lazy load بارگذاری می‌شود تا به سنگین‌شدن بخش «سایر بخش‌ها» دامن نزند */
const AICard = lazy(() => import('./ai/AICard'));

/* ── آیکون‌های بخش (stroke ساده، ۲۴×۲۴، هم‌زبان با aiShared) ───────────────── */

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

/* شبکه دانش — گره‌های به‌هم‌وصل */
function NetworkIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <circle cx="6.2" cy="6.8" r="2.3" />
      <circle cx="17.8" cy="8.6" r="2.3" />
      <circle cx="11" cy="18" r="2.3" />
      <path d="M8.3 7.4 15.6 8.5" />
      <path d="M7.3 9 9.9 15.9" />
      <path d="M16.4 10.7 12.3 16.2" />
    </svg>
  );
}

/* ویکی تپش — کتابِ بازِ دوصفحه‌ای */
function WikiIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M4 6a1.6 1.6 0 0 1 1.6-1.6H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-1.7H5.6A1.6 1.6 0 0 1 4 16.1V6Z" />
      <path d="M20 6a1.6 1.6 0 0 0-1.6-1.6H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-1.7h4.4A1.6 1.6 0 0 0 20 16.1V6Z" />
    </svg>
  );
}

/* مقالات — صفحهٔ نوشته */
function ArticleIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M4.5 6a1.5 1.5 0 0 1 1.5-1.5h12A1.5 1.5 0 0 1 19.5 6v12a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6Z" />
      <path d="M8 8.8h5.5" />
      <path d="M8 12.2h8" />
      <path d="M8 15.6h8" />
    </svg>
  );
}

/* درخواست پشتیبان — هدست */
function SupportIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M5 15.2v-3.4a7 7 0 0 1 14 0v3.4" />
      <rect x="3" y="13.4" width="4.3" height="6.6" rx="2.15" />
      <rect x="16.7" y="13.4" width="4.3" height="6.6" rx="2.15" />
    </svg>
  );
}

/* آناتومی سه‌بعدی — انسان وایرفریم‌گونه با برجستهٔ اسکلتی */
function AnatomyIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <circle cx="12" cy="4.4" r="2.1" />
      <path d="M12 6.5v7" />
      <path d="M12 8.3 7 10.6" />
      <path d="M12 8.3l5 2.3" />
      <path d="M12 13.5 9.2 20.6" />
      <path d="M12 13.5l2.8 7.1" />
      <path d="M6.6 20.8h4.6M12.8 20.8h4.6" />
    </svg>
  );
}

/* فلش ورود — در RTL رو به چپ */
function ArrowIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </svg>
  );
}

/* ── دادهٔ کارت‌های ثانویه ──────────────────────────────────────────────────── */

const SECONDARY_CARDS = [
  {
    id: 'anatomy-3d',
    title: 'آناتومی سه‌بعدی',
    description: 'مدل تعاملی بدن انسان با لایه‌های آناتومیک و جست‌وجوی ساختار',
    accent: 'red',
    Icon: AnatomyIcon,
  },
  {
    id: 'knowledge-network',
    title: 'شبکه دانش',
    description: 'گراف، درخت و مسیر یادگیری مفاهیم درسی',
    accent: 'blue',
    Icon: NetworkIcon,
  },
  {
    id: 'tapesh-wiki',
    title: 'ویکی تپش',
    description: 'جست‌وجوی سریع در دانشنامهٔ مفاهیم درسی',
    accent: 'green',
    Icon: WikiIcon,
  },
  {
    id: 'articles',
    title: 'مقالات',
    description: 'نوشته‌ها و یادداشت‌های آموزشی تپش',
    accent: 'brown',
    Icon: ArticleIcon,
  },
  {
    id: 'support-request',
    title: 'درخواست پشتیبان',
    description: 'سؤال یا مشکلت را با تیم تپش در میان بگذار',
    accent: 'gold',
    Icon: SupportIcon,
  },
];

function AICardSkeleton() {
  return <div className="other-sections__ai-skeleton" aria-hidden="true" />;
}

export default function OtherSections({ onOpenWiki, onOpenKnowledge, onOpenSmartAI, onOpenAnatomy }) {
  const handleSectionClick = (sectionId) => {
    /* مقالات به بخش عمومی سایت وصل است؛ دکمه Back کاربر را به داشبورد برمی‌گرداند */
    if (sectionId === 'articles') {
      window.location.hash = 'articles';
      return;
    }
    if (sectionId === 'tapesh-wiki') {
      onOpenWiki?.();
      return;
    }
    if (sectionId === 'knowledge-network') {
      onOpenKnowledge?.();
      return;
    }
    if (sectionId === 'anatomy-3d') {
      onOpenAnatomy?.();
      return;
    }
    console.log(`بخش انتخاب شد: ${sectionId}`);
  };

  return (
    <main
      dir="rtl"
      className="other-sections dash-stagger"
      aria-label="سایر بخش‌ها"
    >
      {/* تپش هوشمند — کارت ورودی به لایهٔ مستقل گفت‌وگو */}
      <div className="other-sections__ai">
        <Suspense fallback={<AICardSkeleton />}>
          <AICard onOpen={onOpenSmartAI} />
        </Suspense>
      </div>

      <div className="other-sections__grid dash-stagger">
        {SECONDARY_CARDS.map(({ id, title, description, accent, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleSectionClick(id)}
            className={`other-card other-card--${accent}`}
          >
            <span className="other-card__badge" aria-hidden="true">
              <Icon width={26} height={26} />
            </span>

            <span className="other-card__body">
              <strong className="other-card__title">{title}</strong>
              <span className="other-card__desc">{description}</span>
            </span>

            <span className="other-card__arrow" aria-hidden="true">
              <ArrowIcon width={16} height={16} />
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}
