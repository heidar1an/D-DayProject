/* آیکون‌های پنل مدیریت — SVG خطی، هم‌وزن و هم‌رنگ با آیکون‌های بقیهٔ داشبورد تپش */

const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

export function IconDashboard(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </svg>
  );
}

export function IconArticle(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 4.5h9.5L19 9v10.5H5z" />
      <path d="M14.5 4.5V9H19" />
      <path d="M8 13h8M8 16.5h5" />
    </svg>
  );
}

export function IconPage(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 3.5h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
      <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
    </svg>
  );
}

export function IconNote(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 4.5h8.5L19 9v10.5H6z" />
      <path d="M14.5 4.5V9H19" />
      <path d="M9 13.5h6M9 16.5h3.5" />
    </svg>
  );
}

export function IconList(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10" />
      <path d="m4 6 1.3 1.3L7.5 5M4 11.5 5.3 12.8 7.5 10.5M4 17l1.3 1.3L7.5 16" />
    </svg>
  );
}

export function IconPin({ filled = false, ...props }) {
  return (
    <svg {...base} fill={filled ? 'currentColor' : 'none'} {...props}>
      <path d="M9.5 3.5h5l-.7 6 3 2.5v1.5H5.2v-1.5l3-2.5z" />
      <path d="M12 13.5v7" />
    </svg>
  );
}

export function IconMedia(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5" />
    </svg>
  );
}

export function IconBanner(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="6.5" rx="2" />
      <path d="M3 16h11M3 19h7" />
    </svg>
  );
}

export function IconUser(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
    </svg>
  );
}

export function IconShield(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5 19 6v6c0 4-3 7-7 8.5C8 19 5 16 5 12V6z" />
      <path d="M9.5 12l1.8 1.8 3.4-3.6" />
    </svg>
  );
}

export function IconSettings(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1" />
    </svg>
  );
}

export function IconLog(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 4.5h14v15H5z" />
      <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" />
    </svg>
  );
}

export function IconTag(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 11.5V5a1 1 0 0 1 1-1h6.5L20 12.5 12.5 20z" />
      <circle cx="8" cy="8" r="1.4" />
    </svg>
  );
}

export function IconSearch(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  );
}

export function IconPlus(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconEdit(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20h4l10-10-4-4L4 16z" />
      <path d="m14.5 5.5 4 4" />
    </svg>
  );
}

export function IconTrash(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    </svg>
  );
}

export function IconEye(props) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

export function IconClose(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconCheck(props) {
  return (
    <svg {...base} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

export function IconChevron(props) {
  return (
    <svg {...base} {...props}>
      <path d="m14 7-5 5 5 5" />
    </svg>
  );
}

export function IconMenu(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function IconLogout(props) {
  return (
    <svg {...base} {...props}>
      <path d="M14 4.5h4a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-4" />
      <path d="M11 8 7 12l4 4M7 12h9" />
    </svg>
  );
}

export function IconUpload(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 16V5m0 0-4 4m4-4 4 4" />
      <path d="M5 16v2.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V16" />
    </svg>
  );
}

export function IconLock(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4.5" y="10" width="15" height="10" rx="2" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </svg>
  );
}

export function IconLink(props) {
  return (
    <svg {...base} {...props}>
      <path d="M10 14a4 4 0 0 1 0-5.6l2.4-2.4a4 4 0 0 1 5.6 5.6L16.8 13" />
      <path d="M14 10a4 4 0 0 1 0 5.6L11.6 18A4 4 0 0 1 6 12.4L7.2 11" />
    </svg>
  );
}

export function IconImage(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m5 17 4.5-4 3.5 3 3-2.5 4 3.5" />
    </svg>
  );
}

export function IconRefresh(props) {
  return (
    <svg {...base} {...props}>
      <path d="M19 12a7 7 0 1 1-2.3-5.2" />
      <path d="M19 4v4h-4" />
    </svg>
  );
}

export function IconStar({ filled = false, ...props }) {
  return (
    <svg {...base} fill={filled ? 'currentColor' : 'none'} {...props}>
      <path d="m12 4.5 2.4 4.9 5.1.7-3.7 3.6.9 5.1-4.7-2.5-4.7 2.5.9-5.1L4.5 10l5.1-.7z" />
    </svg>
  );
}

export function IconEyeOff(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4l16 16" />
      <path d="M9.5 9.6A2.8 2.8 0 0 0 12 14.8c.8 0 1.5-.3 2-.8" />
      <path d="M6.3 6.6C4 8.2 2.5 12 2.5 12S6 17.5 12 17.5c1.5 0 2.8-.3 4-.9" />
      <path d="M18.4 15c1.8-1.5 3.1-3 3.1-3S18 6.5 12 6.5c-.6 0-1.2.1-1.7.2" />
    </svg>
  );
}

/* مرکز تحلیل — میله‌های رو به رشد */
export function IconAnalytics(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 19.5h16" />
      <path d="M7 19.5v-6.5M12 19.5V6.5M17 19.5v-9.5" />
    </svg>
  );
}

/* لحظه‌ای — موج ضربان */
export function IconPulse(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12h3.5l2-5 3 10 2.5-5H21" />
    </svg>
  );
}

/* هوش مصنوعی — جرقه */
export function IconSpark(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4l1.7 4.3L18 10l-4.3 1.7L12 16l-1.7-4.3L6 10l4.3-1.7z" />
      <path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </svg>
  );
}

/* انتشار در کانال — کاغذپران */
export function IconSend(props) {
  return (
    <svg {...base} {...props}>
      <path d="M20.5 3.5 3.5 10.2l6.2 2.4 2.4 6.2z" />
      <path d="M20.5 3.5 9.7 12.6" />
    </svg>
  );
}

/* ────────────────── مرکز رسانه و فضای مجازی ────────────────── */

/* مرکز رسانه — موج پخش */
export function IconBroadcast(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="2.2" />
      <path d="M8.4 8.4a5 5 0 0 0 0 7.2M15.6 15.6a5 5 0 0 0 0-7.2" />
      <path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 18.4a9 9 0 0 0 0-12.8" />
    </svg>
  );
}

/* تقویم محتوایی */
export function IconCalendar(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.6h17M8.2 3.5v3.2M15.8 3.5v3.2" />
      <path d="M8 13.2h2M14 13.2h2M8 16.6h2M14 16.6h2" />
    </svg>
  );
}

/* کمپین — بلندگو */
export function IconCampaign(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 10.2v3.6a1.6 1.6 0 0 0 1.6 1.6h1.6l7.6 4V4.6l-7.6 4H5.6A1.6 1.6 0 0 0 4 10.2z" />
      <path d="M18.6 8.8a4.4 4.4 0 0 1 0 6.4" />
    </svg>
  );
}

/* اینباکس — صندوق پیام */
export function IconInbox(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 13.2 5.6 5.4A1.8 1.8 0 0 1 7.3 4h9.4a1.8 1.8 0 0 1 1.7 1.4l2.1 7.8" />
      <path d="M3.5 13.2h4l1.2 2.3h6.6l1.2-2.3h4v4.1a1.9 1.9 0 0 1-1.9 1.9H5.4a1.9 1.9 0 0 1-1.9-1.9z" />
    </svg>
  );
}

/* تیم رسانه — چند نفر */
export function IconTeam(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9.2" cy="8.6" r="3.1" />
      <path d="M3.6 19.4a5.6 5.6 0 0 1 11.2 0" />
      <path d="M16.4 6.2a3 3 0 0 1 0 5.6M17.6 19.4a5.4 5.4 0 0 0-1.6-3.8" />
    </svg>
  );
}

/* هشتگ و موضوع */
export function IconHashtag(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9.4 3.8 7.6 20.2M16.4 3.8l-1.8 16.4M4.2 8.8h15.6M3.4 15.2h15.6" />
    </svg>
  );
}

/* گزارش — سند با نمودار */
export function IconReport(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6.2 3.5h8.1l4 4v13H6.2z" />
      <path d="M14 3.5v4.3h4.3" />
      <path d="M9 17.2v-3.4M12 17.2v-6M15 17.2v-2" />
    </svg>
  );
}

/* ساعت / زمان‌بندی */
export function IconClock(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.3" />
      <path d="M12 7.4V12l3.2 1.9" />
    </svg>
  );
}

/* هشدار — برای اعلان و خطای انتشار */
export function IconWarning(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4.4 21 19.6H3z" />
      <path d="M12 9.6v4.2M12 16.9h.01" />
    </svg>
  );
}

/* آرشیو */
export function IconArchive(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.4" y="4.4" width="17.2" height="4.2" rx="1.4" />
      <path d="M5.2 8.6v9.4a1.8 1.8 0 0 0 1.8 1.8h10a1.8 1.8 0 0 0 1.8-1.8V8.6" />
      <path d="M10 12.4h4" />
    </svg>
  );
}

/* گفت‌وگو — پاسخ در اینباکس */
export function IconMessage(props) {
  return (
    <svg {...base} {...props}>
      <path d="M20.5 12.6c0 4-3.8 7.2-8.5 7.2a9.8 9.8 0 0 1-2.6-.35L4.5 21l1.2-3.6a6.9 6.9 0 0 1-2.2-4.8c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2z" />
    </svg>
  );
}

/* بازخورد و گزارش کاربران — حباب گفت‌وگو با خطوط متن */
export function IconFeedback(props) {
  return (
    <svg {...base} {...props}>
      <path d="M20 4.5H4v10h4v4l4.5-4H20z" />
      <path d="M8 8h8M8 11.5h4.5" />
    </svg>
  );
}

/* صف انتشار — لیست زمان‌بندی‌شده */
export function IconQueue(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6.4h11M4 12h11M4 17.6h7" />
      <circle cx="18.4" cy="16.4" r="3" />
      <path d="M18.4 15.1v1.4l1 .7" />
    </svg>
  );
}

/* UTM — برچسب پیوند */
export function IconUtm(props) {
  return (
    <svg {...base} {...props}>
      <path d="M10.2 13.8a3.6 3.6 0 0 0 5.1 0l3-3a3.6 3.6 0 1 0-5.1-5.1L11.7 7" />
      <path d="M13.8 10.2a3.6 3.6 0 0 0-5.1 0l-3 3a3.6 3.6 0 1 0 5.1 5.1L12.3 17" />
    </svg>
  );
}

/* روند صعودی — نرخ رشد */
export function IconTrendUp(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 16.6 9 11l3.6 3.6L20.5 6.7" />
      <path d="M15.4 6.7h5.1v5.1" />
    </svg>
  );
}

/* ─── آیکون‌های لایه‌های تپش — رجیستری بخش «صفحات» ─── */

/* فلش کارت — کارت جلوی کارت */
export function IconFlashcard(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="6.5" width="14" height="11" rx="2" />
      <path d="M20.5 8.5v7.5a2.5 2.5 0 0 1-2.5 2.5H8" />
      <path d="M7 10.5h7M7 13.5h4.5" />
    </svg>
  );
}

/* درسنامه جامع — کتاب باز */
export function IconBookOpen(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 7C10.5 5.6 8.5 5 6.3 5c-.9 0-1.9.1-2.8.4v12.8c.9-.3 1.9-.4 2.8-.4 2.2 0 4.2.6 5.7 2 1.5-1.4 3.5-2 5.7-2 .9 0 1.9.1 2.8.4V5.4C19.6 5.1 18.6 5 17.7 5c-2.2 0-4.2.6-5.7 2Z" />
      <path d="M12 7v12.8" />
    </svg>
  );
}

/* میکرو درسنامه — برگهٔ کوتاه با آذرخش.
   آذرخش عیناً همان چندضلعیِ بستهٔ `CatalogIcon('micro')` است؛ نسخهٔ قبلی یک خطِ
   شکستهٔ باز و نامتقارن بود و کج دیده می‌شد. */
export function IconMicroLesson(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 3.5h7.5l4 4v13H7z" />
      <path d="M14.5 3.5v4h4" />
      <path d="M13.4 6.2 10.6 12.4h2.5l-.3 4.2 2.8-6.2h-2.5z" />
    </svg>
  );
}

/* مسیر سبز — مسیر پرپیچ‌وخم با نشان مقصد */
export function IconGreenPath(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 19.5c4 0 3.5-5 7-5s3-5 7-5" />
      <circle cx="4.5" cy="19.5" r="1.7" />
      <path d="M18.5 3.5a3.4 3.4 0 0 1 3.4 3.4c0 2.5-3.4 5.4-3.4 5.4s-3.4-2.9-3.4-5.4A3.4 3.4 0 0 1 18.5 3.5Z" />
    </svg>
  );
}

/* رفرنس — نشان‌صفحهٔ مرجع */
export function IconReference(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6.5 4.6a1.1 1.1 0 0 1 1.1-1.1h8.8a1.1 1.1 0 0 1 1.1 1.1v15.9L12 16.4l-5.5 4.1z" />
      <path d="M9.5 8h5" />
    </svg>
  );
}

/* کرهٔ زمین — دوره‌های بین‌الملل */
export function IconGlobe(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M3.8 12h16.4" />
      <path d="M12 3.8c2.3 2.2 3.5 5 3.5 8.2s-1.2 6-3.5 8.2c-2.3-2.2-3.5-5-3.5-8.2s1.2-6 3.5-8.2Z" />
    </svg>
  );
}

/* بانک تست — انبار داده */
export function IconTestBank(props) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="12" cy="6" rx="7" ry="2.6" />
      <path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6" />
      <path d="M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6" />
    </svg>
  );
}

/* آزمون هماهنگ — پاسخ‌برگ با تیک */
export function IconExamSheet(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6.5 3.5h8l4 4v13h-12z" />
      <path d="M14.5 3.5v4h4" />
      <path d="m9 13 1.6 1.6 3.2-3.4" />
      <path d="M9 17.5h6" />
    </svg>
  );
}

/* آزمون بین‌الملل — کره با تیک */
export function IconGlobeExam(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="12" r="7.5" />
      <path d="M3.5 12h15" />
      <path d="M11 4.5c2 2 3.2 4.6 3.2 7.5s-1.2 5.5-3.2 7.5c-2-2-3.2-4.6-3.2-7.5s1.2-5.5 3.2-7.5Z" />
      <path d="m16.2 17 1.8 1.8 3.4-3.6" />
    </svg>
  );
}

/* لیگ — جام قهرمانی */
export function IconTrophy(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 4.5h8V10a4 4 0 0 1-8 0z" />
      <path d="M8 6.5H5.5V8A3 3 0 0 0 8 11" />
      <path d="M16 6.5h2.5V8A3 3 0 0 1 16 11" />
      <path d="M12 14v3" />
      <path d="M8.5 19.5c0-1.4 1.6-2.5 3.5-2.5s3.5 1.1 3.5 2.5z" />
    </svg>
  );
}

/* شبکه دانش — گره‌های گراف */
export function IconKnowledgeGraph(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="6" cy="6.5" r="2.2" />
      <circle cx="18" cy="8" r="2.2" />
      <circle cx="10.5" cy="17.5" r="2.2" />
      <path d="m8.2 7 7.6.8M7.1 8.6l2.4 6.8M16.7 9.8l-4.9 5.8" />
    </svg>
  );
}

/* ویکی — کتاب قطور */
export function IconWiki(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 3.5h11.5v15.2H7a2.2 2.2 0 0 0-2.2 2.2V5.7A2.2 2.2 0 0 1 7 3.5Z" />
      <path d="M4.8 20.9A2.2 2.2 0 0 1 7 18.7h11.5" />
      <path d="M9.2 8h6.3M9.2 11.5h4.3" />
    </svg>
  );
}

/* پاپ‌آپ — پنجرهٔ بازشو روی پنجرهٔ پشت */
export function IconPopup(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6.5 14.5H5A1.5 1.5 0 0 1 3.5 13V5A1.5 1.5 0 0 1 5 3.5h8A1.5 1.5 0 0 1 14.5 5v1.5" />
      <rect x="9.5" y="9.5" width="11" height="10" rx="1.5" />
      <path d="M9.5 12.5h11" />
    </svg>
  );
}

/* برگهٔ تبلیغاتی — بلندگوی اعلان */
export function IconFlyer(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 9.5v5H7l8 4.5v-14L7 9.5z" />
      <path d="M18.5 9a4.5 4.5 0 0 1 0 6" />
      <path d="M7 14.5v4" />
    </svg>
  );
}

/* ─────────────── ماژول برنامه‌ریزی و مدیریت ─────────────── */

/* برنامه‌ریزی — مسیر با نقطه‌های ایستگاه */
export function IconPlanning(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 19.5V6.5" />
      <path d="M4.5 7h9.5l-1.4 3 1.4 3H4.5" />
      <circle cx="18.5" cy="17.5" r="2.4" />
      <path d="M18.5 9.5v5.6" />
      <circle cx="18.5" cy="6.6" r="1.8" />
    </svg>
  );
}

/* برد کانبان — ستون‌های کنار هم */
export function IconKanban(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="4.5" width="5" height="15" rx="1.6" />
      <rect x="9.5" y="4.5" width="5" height="10.5" rx="1.6" />
      <rect x="15.5" y="4.5" width="5" height="13" rx="1.6" />
    </svg>
  );
}

/* یادآوری — زنگ */
export function IconBell(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6.5 10.5a5.5 5.5 0 0 1 11 0c0 3.2.8 4.7 1.6 5.6.4.4.1 1.1-.5 1.1H5.4c-.6 0-.9-.7-.5-1.1.8-.9 1.6-2.4 1.6-5.6z" />
      <path d="M10 20a2.2 2.2 0 0 0 4 0" />
    </svg>
  );
}

/* مالی — سکه‌های روی هم */
export function IconCoins(props) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="12" cy="6.6" rx="6.6" ry="2.6" />
      <path d="M5.4 6.6v4.2c0 1.4 3 2.6 6.6 2.6s6.6-1.2 6.6-2.6V6.6" />
      <path d="M5.4 10.8v4.2c0 1.4 3 2.6 6.6 2.6s6.6-1.2 6.6-2.6v-4.2" />
    </svg>
  );
}

/* فیلتر — قیف */
export function IconFilter(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5h16l-6.2 7v5.6l-3.6 2V12.5z" />
    </svg>
  );
}

/* دانلود / خروجی */
export function IconDownload(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4.5v11m0 0-4-4m4 4 4-4" />
      <path d="M5 17.5v1.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-1.5" />
    </svg>
  );
}

/* پرچم — اولویت */
export function IconFlag(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 20.5V4.2" />
      <path d="M6 4.8h11l-1.7 3.6L17 12H6" />
    </svg>
  );
}

/* پیوست — گیرهٔ کاغذ */
export function IconPaperclip(props) {
  return (
    <svg {...base} {...props}>
      <path d="M17.5 10.5 11 17a3.5 3.5 0 0 1-5-5l6.8-6.8a2.4 2.4 0 0 1 3.4 3.4l-6.8 6.8a1.2 1.2 0 0 1-1.7-1.7l6-6" />
    </svg>
  );
}

/* تاریخچه — ساعت با فلش بازگشت */
export function IconHistory(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4.5V10h5.5" />
      <path d="M12 8v4.3l3 1.8" />
    </svg>
  );
}

/* جدول — شبکهٔ خانه‌ها */
export function IconTable(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="1.8" />
      <path d="M3.5 9.6h17M3.5 14.2h17M9.5 5v14M15 5v14" />
    </svg>
  );
}

/* تأیید کاربر — پرونده با تیک */
export function IconUserCheck(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9.6" cy="8.4" r="3.2" />
      <path d="M3.6 19.4a6 6 0 0 1 9.3-5.1" />
      <path d="m14.6 17.4 1.8 1.8 3.4-3.6" />
    </svg>
  );
}

/* سند استاندارد — برگه با خط‌های بند */
export function IconStandard(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6.4 3.5h7.8l4.2 4.2v12.8H6.4z" />
      <path d="M14 3.5v4.4h4.4" />
      <path d="M9.2 12h5.6M9.2 15h5.6M9.2 18h3.4" />
    </svg>
  );
}

/* نمودار مقایسه‌ای — میله‌های کنار هم */
export function IconCompare(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 19.5h16" />
      <path d="M6.5 19.5v-7M11 19.5V8M15.5 19.5v-4.5M20 19.5V4.5" />
    </svg>
  );
}

/* تنظیمات برنامه‌ریزی — لغزنده‌های کنترل */
export function IconSliders(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 8h10M18.5 8h1M4.5 16h3M11.5 16h8" />
      <circle cx="16.4" cy="8" r="2.1" />
      <circle cx="9.5" cy="16" r="2.1" />
    </svg>
  );
}

/* کیف پول — ثبت هزینه و پرداخت */
export function IconWallet(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.6 8.2c0-1.2 1-2.2 2.2-2.2h11.2c1.2 0 2.2 1 2.2 2.2v8.4c0 1.2-1 2.2-2.2 2.2H5.8a2.2 2.2 0 0 1-2.2-2.2z" />
      <path d="M3.6 9.6h13.4a2 2 0 0 1 2 2v1.6a2 2 0 0 1-2 2H3.6" />
      <circle cx="16.4" cy="12.4" r="1.05" />
    </svg>
  );
}

/* سند مالی — ریز تراکنش */
export function IconReceipt(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6.2 3.6h11.6v16.8l-2.4-1.5-2.3 1.5-2.3-1.5-2.3 1.5-2.3-1.5z" />
      <path d="M9 8.4h6M9 11.8h6M9 15.2h3.4" />
    </svg>
  );
}

/* بانک — حالت پرداخت بانکی */
export function IconBank(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.6 9.4 12 4.4l8.4 5" />
      <path d="M5.6 10.4v7.2M9.6 10.4v7.2M14.4 10.4v7.2M18.4 10.4v7.2" />
      <path d="M4.2 19.6h15.6" />
    </svg>
  );
}

/* تسویهٔ مستقیم — دست و سکه */
export function IconHandCoins(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 13.6h3.4l4.2 3.1h4.1a1.6 1.6 0 0 0 0-3.2h-3.2" />
      <path d="M11.6 13.6 8.9 11.7a1.7 1.7 0 0 0-2.2.3" />
      <circle cx="16.6" cy="6.6" r="2.8" />
      <path d="M16.6 5.2v2.8M15.6 6.6h2" />
    </svg>
  );
}

