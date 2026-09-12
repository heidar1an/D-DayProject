
export default function OtherSections() {
  const handleSectionClick = (sectionId) => {
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
      <button
        type="button"
        onClick={() => handleSectionClick('ai-assistant')}
        className="mb-6 flex h-[26rem] w-full cursor-pointer items-center justify-center rounded-[2.5rem] bg-[#242426] text-2xl font-bold text-white transition-colors duration-300 hover:bg-[#2e2e30] md:mb-8 md:h-[32rem] md:rounded-[3rem] md:text-3xl [font-family:'Doran',Tahoma,sans-serif]"
      >
        هوش مصنوعی
      </button>
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