//export default function TestsSection() {
///  return null;
//}
import searchImage from "../../../images/pictures/character-search.png";
import personalExam from "../../../images/pictures/personalExam.png";
import groupExam from "../../../images/pictures/groupExam.png";
import universalExam from "../../../images/pictures/universalExam.png";
import testBank from "../../../images/pictures/testBank.jpg";

const doranFont = "[font-family:'Doran','Vazir',Tahoma,sans-serif]";

export default function TestsSection({ onOpenAnalytics, onOpenInternational, onOpenCoordinated, onOpenTestBank }) {
  const examCards = [
    {
      id: 1,
      title: 'آنالیز وضعیت',
      description: 'بررسی، تحلیل و آنالیز وضعیت آزمون ها و تست ها',
      // TODO: آدرس عکس کاراکتر با ذره‌بین
      imageSrc: searchImage ,
      onClick: () => onOpenAnalytics?.(),
    },
    {
      id: 2,
      title: 'آزمون های شخصی',
      description: 'با آزمون‌ساز شخصی، آزمونی دقیقاً به‌اندازهٔ نیازت بساز',
      // TODO: آدرس عکس کاراکتر در حال فکر کردن
      imageSrc: personalExam ,
      onClick: () => onOpenTestBank?.('builder'),
    },
    {
      id: 3,
      title: 'آزمون های هماهنگ',
      description: 'شامل آزمون های جامع و آزمون های درس به درس',
      // TODO: آدرس عکس کاراکترهای سر کلاس
      imageSrc: groupExam,
      onClick: () => onOpenCoordinated?.(),
    },
    {
      id: 4,
      title: 'آزمون های بین الملل',
      description: 'آزمون های USMLE ، PLAB و MCCQE',
      // TODO: آدرس عکس کاراکتر با کره زمین
      imageSrc: universalExam,
      onClick: () => onOpenInternational?.(),
    },
  ];

  return (
    <div
      className="mx-auto w-[var(--content-width)] bg-[var(--background)] py-6 text-white md:py-10 lg:h-full lg:py-6"
      dir="rtl"
    >

      {/* ---------- Main Content (Grid) ---------- */}
      <main className="dash-stagger grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">

        {/* کارت بزرگ بانک تست (نیمی از عرض محتوا) */}
        <div
          role="button"
          tabIndex={0}
          aria-label="ورود به بانک تست علوم پایه"
          onClick={() => onOpenTestBank?.()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpenTestBank?.();
            }
          }}
          className="lg:col-span-6 lg:min-h-0 relative w-full h-150 lg:h-auto rounded-[2.5rem] overflow-hidden group cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--green-vivid)]"
        >

          {/* TODO: عکس پس‌زمینه فرم و گوشی پزشکی */}
          <img
            src={testBank}
            alt="بانک تست علوم پایه"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-linear-to-t from-black via-black/60 to-transparent"></div>

          <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center text-center px-4">
            <h2 className={`text-[var(--green-ink)] text-3xl md:text-4xl font-extrabold mb-8 leading-tight ${doranFont}`}>
              بانک تست علوم پایه و<br />
              تست های تالیفی اختصاصی
            </h2>

            <span className="bg-[var(--surface-strong)] text-[var(--green-ink)] px-10 py-3 rounded-2xl text-lg font-bold transition-colors group-hover:bg-[var(--surface-strong)]">
              بزن بریم
            </span>
          </div>

        </div>

        {/* ستون چهار کارت کوچک */}
        <div className="lg:col-span-6 lg:min-h-0 flex flex-col gap-4">
          {examCards.map((card) => (
            <div
              key={card.id}
              role={card.onClick ? 'button' : undefined}
              tabIndex={card.onClick ? 0 : undefined}
              aria-label={card.onClick ? `ورود به ${card.title}` : undefined}
              onClick={card.onClick}
              onKeyDown={
                card.onClick
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        card.onClick();
                      }
                    }
                  : undefined
              }
              className="bg-[var(--surface)] rounded-[2.5rem] p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-[var(--surface-soft)] transition-colors duration-300 h-40 lg:h-auto lg:min-h-0 lg:flex-1 overflow-hidden"
            >
              <div className="flex-1">
                <h3 className={`text-[var(--green-ink)] text-2xl font-bold mb-2 ${doranFont}`}>{card.title}</h3>
                <p className="text-gray-300 text-base leading-relaxed">{card.description}</p>
              </div>

              <div className="h-full max-h-44 aspect-square shrink-0 flex items-center justify-center">
                <img
                  src={card.imageSrc}
                  alt={card.title}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}
