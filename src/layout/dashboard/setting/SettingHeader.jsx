import React, { useState, useRef, useEffect } from 'react';

const SettingHeader = ({ activeTab, onTabChange }) => {
  // لیست تب‌ها (ترتیب بر اساس تصویر شما از راست به چپ)
  const tabs = [
    { id: 'profile', label: 'ویرایش پروفایل' },
    { id: 'subscription', label: 'اشتراک' },
    { id: 'transactions', label: 'تراکنش ها' },
    { id: 'security', label: 'امنیت' },
    { id: 'support', label: 'راهنما و پشتیبان' },
  ];

  // استیت مربوط به موقعیت و عرضِ پس‌زمینه متحرک
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });

  const tabRefs = useRef([]);

  // این Effect هر بار که تب جدیدی انتخاب میشه، موقعیت پس‌زمینه رو آپدیت می‌کنه
  useEffect(() => {
    const activeIndex = tabs.findIndex(tab => tab.id === activeTab);
    const activeElement = tabRefs.current[activeIndex];

    if (activeElement) {
      setIndicatorStyle({
        left: activeElement.offsetLeft,
        width: activeElement.offsetWidth,
        opacity: 1, // روی ۱ تنظیم میشه تا بعد از محاسبه اولیه نمایش داده بشه
      });
    }
  }, [activeTab]);

  return (
    <div dir="rtl" className="w-full">
      {/* کانتینر اصلی هدر - رنگ پس زمینه حدودی از روی عکس انتخاب شده */}
      <div className="flex items-center justify-between bg-[#2d2d2d] rounded-full px-6 py-2 shadow-lg">
        
        {/* بخش تب‌ها (لینک‌های سمت چپ) */}
        <div className="relative flex items-center">
          
          {/* پس‌زمینه متحرک (انیمیشن حرکت رنگ #ab8e7c) */}
          <div
            className="absolute top-0 bottom-0 my-auto h-full bg-[#ab8e7c] rounded-full transition-all duration-300 ease-in-out"
            style={{
              left: `${indicatorStyle.left}px`,
              width: `${indicatorStyle.width}px`,
              opacity: indicatorStyle.opacity,
            }}
          />

          {/* دکمه‌های تب */}
          <div className="flex items-center gap-1 relative z-10">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                ref={(el) => (tabRefs.current[index] = el)}
                onClick={() => onTabChange(tab.id)}
                className={`px-5 py-2.5 rounded-full text-sm md:text-base transition-colors duration-300 ${
                  activeTab === tab.id
                    ? 'text-white font-medium' // متن تب فعال
                    : 'text-gray-300 hover:text-white' // متن تب‌های غیرفعال
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* عنوان تنظیمات (سمت راست) */}
        <div className="pl-4">
          <h2 className="text-white text-3xl font-doran m-0 leading-none tracking-wide">
            تنظیمات
          </h2>
        </div>
      </div>
    </div>
  );
};

export default SettingHeader;
