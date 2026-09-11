//export default function TestsSection() {
///  return null;
//}
import searchImage from "../../../images/pictures/character-search.png";
import personalExam from "../../../images/pictures/personalExam.png";
import groupExam from "../../../images/pictures/groupExam.png";
import universalExam from "../../../images/pictures/universalExam.png";
import testBank from "../../../images/pictures/testBank.jpg";


export default function TestsSection() {
  const examCards = [
    {
      id: 1,
      title: 'آنالیز وضعیت',
      description: 'بررسی، تحلیل و آنالیز وضعیت آزمون ها و تست ها',
      // TODO: آدرس عکس کاراکتر با ذره‌بین
      imageSrc: searchImage , 
    },
    {
      id: 2,
      title: 'آزمون های شخصی',
      description: 'ساخت آزمون اختصاصی خودتان',
      // TODO: آدرس عکس کاراکتر در حال فکر کردن
      imageSrc: personalExam ,
    },
    {
      id: 3,
      title: 'آزمون های هماهنگ',
      description: 'شامل آزمون های جامع و آزمون های درس به درس',
      // TODO: آدرس عکس کاراکترهای سر کلاس
      imageSrc: groupExam,
    },
    {
      id: 4,
      title: 'آزمون های بین الملل',
      description: 'آزمون های USMLE ، PLAB و MCCQE',
      // TODO: آدرس عکس کاراکتر با کره زمین
      imageSrc: universalExam,
    },
  ];

  return (
    <div className="mx-auto w-[var(--content-width)] bg-black py-6 text-white md:py-10" dir="rtl">
      
      {/* ---------- Main Content (Grid) ---------- */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        
        {/* ستون راست (شامل 4 کارت کوچک) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {examCards.map((card) => (
            <div 
              key={card.id} 
              className="bg-[#242426] rounded-[2.5rem] p-6 flex items-center justify-between cursor-pointer hover:bg-[#2e2e30] transition-colors duration-300 h-36"
            >
              <div className="flex-1">
                <h3 className="text-[#61D192] text-xl font-bold mb-2">{card.title}</h3>
                <p className="text-gray-300 text-sm">{card.description}</p>
              </div>
              
              <div className="w-24 h-24 shrink-0 flex items-center justify-center">
                <img 
                  src={card.imageSrc} 
                  alt={card.title} 
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
          ))}
        </div>

        {/* ستون چپ (کارت بزرگ) */}
        <div className="lg:col-span-7 relative w-full h-150 lg:h-auto rounded-[2.5rem] overflow-hidden group cursor-pointer">
          
          {/* TODO: عکس پس‌زمینه فرم و گوشی پزشکی */}
          <img 
            src="../../../images/pictures/testBank.jpg" 
            alt="بانک تست علوم پایه" 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          
          <div className="absolute inset-0 bg-linear-to-t from-black via-black/60 to-transparent"></div>
          
          <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center text-center px-4">
            <h2 className="text-[#61D192] text-3xl md:text-4xl font-extrabold mb-8 leading-tight">
              بانک تست علوم پایه و<br />
              تست های تالیفی اختصاصی
            </h2>
            
            <button className="bg-[#2F3034] text-[#61D192] px-10 py-3 rounded-2xl text-lg font-bold hover:bg-[#3f4045] transition-colors">
              بزن بریم
            </button>
          </div>
          
        </div>

      </main>
    </div>
  );
}
