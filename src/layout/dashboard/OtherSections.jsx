import { Suspense, lazy } from 'react';

/* AI Card با lazy load بارگذاری می‌شود تا به سنگین‌شدن بخش «سایر بخش‌ها» دامن نزند */
const AICard = lazy(() => import('./ai/AICard'));

function AICardSkeleton() {
  return <div className="h-72 w-full rounded-[2.5rem] bg-[#242426]" aria-hidden="true" />;
}

export default function OtherSections({ onOpenWiki, onOpenKnowledge }) {
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
    console.log(`بخش انتخاب شد: ${sectionId}`);
  };

  const secondaryCards = [
    { id: 'knowledge-network', title: 'شبکه دانش' },
    { id: 'tapesh-wiki', title: 'ویکی تپش' },
    { id: 'articles', title: 'مقالات', highlighted: true },
    { id: 'support-request', title: 'درخواست پشتیبان' },
  ];

  return (
    <main
      dir="rtl"
      className="dash-stagger mx-auto w-[var(--content-width)] bg-black py-8 text-white md:py-10 [font-family:'Pinar',Tahoma,sans-serif]"
    >
      {/* تپش هوشمند — کارت مینیمال که با تعامل باز می‌شود؛ لایهٔ جداگانه ندارد */}
      <div className="mb-6 md:mb-8">
        <Suspense fallback={<AICardSkeleton />}>
          <AICard />
        </Suspense>
      </div>
      <div className="dash-stagger grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {secondaryCards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => handleSectionClick(card.id)}
            className={`flex h-36 w-full cursor-pointer items-center justify-center rounded-[2.5rem] bg-[#242426] text-lg font-bold text-white transition-colors duration-300 hover:bg-[#2e2e30] md:h-40 md:text-xl [font-family:'Doran',Tahoma,sans-serif] ${
              card.highlighted ? 'border border-[#5b8cc7]' : ''
            }`}
          >
            <span className="flex items-center gap-3">
              <span>{card.title}</span>
              {card.highlighted && (
                <span
                  className="text-sm font-normal text-gray-500"
                  aria-hidden="true"
                >
                  ×
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}