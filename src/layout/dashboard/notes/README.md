# یادداشت تپش — معماری

دفترچهٔ یادداشت شخصی: دانشجو نکته‌ها، ترفندها و برنامه‌هایش را با موضوع، تگ، رنگ و
اتصال به منبع نگه می‌دارد؛ چک‌لیست‌ها پیشرفت جمع‌بندی را نشان می‌دهند.

## نقشهٔ فایل‌ها

```
src/services/notes/
├── mockData.js        ← موجودیت Note + SUBJECTS (همان لیست ویکی) + NOTE_COLORS + SOURCE_TYPES + seed
└── notesService.js    ← قرارداد API واقعی (فعلاً Mock + localStorage) + فیلتر/مرتب‌سازی/snippet

src/layout/dashboard/notes/
├── NotesSection.jsx   ← پوسته: هیرو + آمار + جست‌وجو/فیلتر/مرتب‌سازی + گلچین + گرید
├── NoteDetail.jsx     ← نمای کامل یادداشت: چک‌لیست تعاملی، منبع، تگ‌ها، متا
├── NoteEditor.jsx     ← مودال ساخت/ویرایش (متنی | چک‌لیست + موضوع + تگ + رنگ + منبع)
├── notesShared.jsx    ← آیکون‌ها، Modal، SubjectChip/KindBadge، DeleteButton دومرحله‌ای
├── notes.css          ← چیپ‌ها + انیمیشن‌های ورود + گارد prefers-reduced-motion
└── README.md
```

## ۱. مدل داده

- **Note** `{ id, userId, title, kind: 'text'|'checklist', body, items[{id,text,done}], subjectId, tags[], color, pinned, source: {sourceType, title} | null, createdAt, updatedAt }`
  - `kind='checklist'` → محتوا در `items` است و `body` خالی.
  - `source` پایهٔ «ساخت یادداشت از درسنامه/تست/مقاله/ویکی» در نسخه‌های بعدی است؛
    پنل‌های درسنامه/تست بعداً فقط `createNote(userData, { source: … })` را صدا می‌زنند.
- **SUBJECTS** دقیقاً همان لیست ویکی تپش است (id + label + accent) + `general` —
  تا بعداً رنگ موضوع در کل اکوسیستم یکی بماند.

## ۲. اصول سرویس

- منطق نمایشی (snippet، فیلتر، مرتب‌سازی، پیشرفت چک‌لیست) در سرویس است؛ UI فقط رندر می‌کند.
- جست‌وجو با نرمال‌سازی فارسی (ی/ي، ک/ك، نیم‌فاصله) روی عنوان/بدنه/تگ‌ها/آیتم‌ها/منبع.
- مرتب‌سازی: `updated | created | title`؛ **پین‌شده‌ها همیشه جلوتر**.
- toggle آیتم چک‌لیست `updatedAt` را بالا نمی‌برد (تیک‌زدن ویرایش محسوب نمی‌شود).
- seed فقط بار اولِ هر کاربر ساخته می‌شود؛ تاریخ‌ها نسبت به زمانِ اولین ورود واقعی‌اند.

## ۳. تجربهٔ کاربری

- ورود از اکشن‌کارت «یادداشت‌ها» صفحهٔ خانه (`DashboardActionCards`) — مثل فلش‌کارت
  عمداً در ناوبری هدر نیست. مسیر: `handleSectionChange('notes')` → `sections.notes`.
- آمار هیرو از همهٔ یادداشت‌ها (مستقل از فیلتر): کل، گلچین، موضوع فعال، ویرایشِ این هفته.
- کارت‌ها: نوار رنگ موضوع/کارت در لبهٔ شروع (RTL)، پیش‌نمایش، نوار پیشرفت چک‌لیست،
  تگ‌ها (حداکثر ۳ + «+n»)، اکشن‌های pin/ویرایش/حذف.
- حذف دومرحله‌ای: کلیک اول «مطمئنی؟»، کلیک دوم حذف؛ ۳ ثانیه بعد دکمه ریست می‌شود.
- Escape: در نمای یادداشت → بازگشت به فهرست؛ در مودال → بستن مودال (دو مسیر مستقل‌اند
  و Escape وقتی مودال باز است از نمای یادداشت عبور نمی‌کند).

## ۴. اپتیمستیک + Offline-ready

- هر تغییر اول `setNotes` محلی را عوض می‌کند و بعد سرویس در پس‌زمینه می‌رود؛
  در پایان `silentRefresh` دادهٔ واقعی را بدون روشن‌کردن اسکلت برمی‌گرداند.
  نتیجه: هیچ mutation لایه‌بندی (Layout Shift) ندارد.
- در نسخهٔ سرور همان توابع به fetch تبدیل می‌شوند؛ صف Sync مثل فلش‌کارت قابل افزودن است.

## ۵. API Contract (قرارداد با Backend)

- `GET    /api/notes?q=&subject=&sort=`
- `POST   /api/notes`
- `PATCH  /api/notes/:id`
- `DELETE /api/notes/:id`
- `POST   /api/notes/:id/pin`
- `POST   /api/notes/:id/checklist/:itemId/toggle`

اتصال واقعی فقط بدنهٔ توابع `notesService.js` عوض می‌شود؛ UI دست نمی‌خورد.

## ۶. پایداری و دسترس‌پذیری

- داده در `localStorage` با کلید `tapesh:notes:v1` به تفکیک `userId`
  (`u:<id>`، مهمان: `u:guest`). ریست کامل: `localStorage.removeItem('tapesh:notes:v1')`.
- تست حالت خطا از کنسول: `__notesService.__setFailure(true)` و تعویض بخش.
- `dir=rtl`، اعداد فارسی (`toFa` از leagueShared)، `aria-pressed` برای pin/تیک،
  `role=radiogroup/radio/progressbar/dialog`، گارد `prefers-reduced-motion`.
