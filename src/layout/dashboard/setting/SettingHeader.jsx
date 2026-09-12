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
      {/* کانتینر اصلی هدر - عنوان سمت راست، تب‌ها دقیقاً وسط (ستون‌های 1fr دو طرف قرینه‌اند) */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-[#2d2d2d] rounded-full px-6 py-2 shadow-lg">

        {/* عنوان تنظیمات (سمت راست) */}
        <div className="min-w-0 justify-self-start">
          <h2 className="m-0 text-2xl leading-none tracking-wide text-white font-extrabold md:text-3xl [font-family:'Doran',Tahoma,sans-serif]">
            تنظیمات
          </h2>
        </div>

        {/* بخش تب‌ها (وسط) */}
        <div className="relative flex min-w-0 items-center">

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
          <div className="relative z-10 flex items-center gap-1">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                ref={(el) => (tabRefs.current[index] = el)}
                onClick={() => onTabChange(tab.id)}
                className={`px-5 py-2.5 rounded-full text-sm whitespace-nowrap transition-colors duration-300 md:text-base ${
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

        {/* ستون سوم خالی تا تب‌ها نسبت به کل نوار وسط‌چین بمانند */}
        <div aria-hidden="true" />
      </div>
    </div>
  );
};

export default SettingHeader;
