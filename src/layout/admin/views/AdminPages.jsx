/*
 * بخش «صفحات» پنل — رجیستری لایه‌های تپش.
 *
 * این بخش فهرست صفحات عمومی نیست؛ مجموعهٔ ثابتِ لایه‌های واقعی محصول است
 * (فلش کارت، بانک تست، مسیر سبز و…) که هر لایه یک رکورد محتوا دارد: متن معرفی
 * + سئو + وضعیت انتشار. رکوردها از seed می‌آیند و فرادادهٔ گروه/آیکون/مسیرشان
 * فقط همین‌جا نمایش داده می‌شود؛ محتوای هر لایه با همان ویرایشگر صفحات ادیت می‌شود.
 *
 * چیدمان: فقط کارت‌های گروه‌بندی‌شده. نوار آمار و نوار فیلتر (جست‌وجو، وضعیت،
 * گروه) به درخواست کاربر برداشته شدند؛ صفحه مستقیم با عنوان نخستین گروه
 * («یادگیری و آموزش») شروع می‌شود. گروه‌های ثابت `LAYER_GROUPS` همان ترتیب seed
 * را دارند و گروه خالی اصلاً رندر نمی‌شود.
 *
 * دکمهٔ «ورود به لایه» فقط روی کارت‌هایی کار می‌کند که در `LAYER_VIEWS` مقصد
 * دارند (فلش‌کارت → کتابخانهٔ فلش‌کارت تپش، رفرنس → مراجع تپش، مقالات تپش →
 * مدیریت مقالات، میکرو درسنامه → میکرو درسنامه تپش، بانک تست → بانک تست علوم
 * پایه، درسنامه جامع → درسنامه جامع علوم پایه)؛ بقیهٔ کارت‌ها عمداً بی‌عمل‌اند.
 */

import { useCallback } from 'react';

import { pages as pagesApi } from '../../../services/admin/adminService';
import {
  Badge, Button, EmptyState, ErrorState, LoadingBlock, faDateTime, faNumber, useAsync,
} from '../adminShared';
import {
  IconArticle, IconBookOpen, IconExamSheet, IconEye, IconFlashcard, IconFlyer,
  IconGlobe, IconGlobeExam, IconGreenPath, IconKnowledgeGraph, IconMicroLesson,
  IconPopup, IconReference, IconTestBank, IconTrophy, IconWiki,
} from '../adminIcons';

/* گروه‌های لایه‌ها — ترتیب نمایش همین است و با seedِ contentStore هم‌خوان است */
const LAYER_GROUPS = [
  { id: 'learning', label: 'یادگیری و آموزش', icon: IconBookOpen, tone: 'learning' },
  { id: 'assessment', label: 'ارزیابی، آزمون و رقابت', icon: IconExamSheet, tone: 'assessment' },
  { id: 'knowledge', label: 'دانش و محتوا', icon: IconKnowledgeGraph, tone: 'knowledge' },
  { id: 'marketing', label: 'تبلیغات و اطلاع‌رسانی', icon: IconFlyer, tone: 'marketing' },
];

/* کلید آیکون رکورد → کامپوننت آیکون پنل */
const LAYER_ICONS = {
  flashcard: IconFlashcard,
  'book-open': IconBookOpen,
  'micro-lesson': IconMicroLesson,
  'green-path': IconGreenPath,
  reference: IconReference,
  globe: IconGlobe,
  'test-bank': IconTestBank,
  'exam-sheet': IconExamSheet,
  'globe-exam': IconGlobeExam,
  trophy: IconTrophy,
  'knowledge-graph': IconKnowledgeGraph,
  wiki: IconWiki,
  article: IconArticle,
  popup: IconPopup,
  flyer: IconFlyer,
};

function layerIcon(page) {
  return LAYER_ICONS[page.icon] ?? IconFlashcard;
}

/*
 * لایه‌های داخل پنل — نگاشت `slug` رکورد لایه به نمای داخل پنل خودش.
 *
 * فقط کارت‌هایی که اینجا مقصد دارند وارد لایه می‌شوند؛ بقیهٔ کارت‌ها عمداً `null`
 * برمی‌گردانند تا دکمهٔ «ورود به لایه»شان بی‌عمل بماند (درخواست کاربر: «لینک‌دهی
 * نداشته باشند»). یک‌جا نگه داشته شده تا نام نما با روتر (`AdminLayout`:
 * ROUTABLE_VIEWS + SECTION_SUBVIEWS + VIEW_TITLES) از هم دور نیفتد.
 */
const LAYER_VIEWS = {
  flashcards: { view: 'flashcard-library', title: 'مدیریت کتابخانهٔ فلش‌کارت تپش' },
  reference: { view: 'reference-library', title: 'مدیریت مراجع تپش: مرجع‌ها، بخش‌ها و متن هر بخش' },
  'tapesh-articles': { view: 'article-library', title: 'مدیریت مقالات تپش: متن، تصویر و انتشار برای کاربران' },
  'micro-lesson': { view: 'micro-lesson', title: 'مدیریت میکرو درسنامه و انتشارش برای کاربران تپش' },
  'test-bank': { view: 'test-bank-library', title: 'مدیریت سؤالات بانک تست علوم پایه' },
  'comprehensive-lesson': { view: 'comprehensive-library', title: 'مدیریت درسنامه جامع: متن‌ها و تست‌های هر درس، مبحث و واحد' },
};

export function layerEntryTarget(page) {
  return LAYER_VIEWS[page?.slug] ?? null;
}

export default function AdminPages({ navigate }) {
  /* تعداد لایه‌ها ثابت و کم است، پس یک واکشی با perPage بالا کافی است */
  const load = useCallback(() => pagesApi.list({ page: 1, perPage: 100 }), []);
  const { data, loading, error, reload } = useAsync(load, []);

  const items = data?.items ?? [];
  const grouped = LAYER_GROUPS
    .map((group) => ({ ...group, pages: items.filter((page) => page.group === group.id) }))
    .filter((group) => group.pages.length > 0);

  return (
    <div className="ad-stack">
      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingBlock label="در حال خواندن لایه‌ها…" rows={4} /> : null}

      {data && grouped.length === 0 ? (
        <EmptyState
          title="لایه‌ای پیدا نشد"
          description="هیچ لایه‌ای در رکوردهای محتوا ثبت نشده است."
        />
      ) : null}

      {data ? grouped.map((group) => {
        const GroupIcon = group.icon;
        return (
          <section key={group.id} className="ad-layergroup" aria-label={group.label}>
            <header className="ad-layergroup__head">
              <span className={`ad-layergroup__icon ad-layergroup__icon--${group.tone}`} aria-hidden="true">
                <GroupIcon width={18} height={18} />
              </span>
              <h2>{group.label}</h2>
              <Badge tone="neutral">{faNumber(group.pages.length)} لایه</Badge>
            </header>

            <div className="ad-layergrid">
              {group.pages.map((page) => {
                const Icon = layerIcon(page);
                const entryTarget = layerEntryTarget(page);
                return (
                  <article key={page.id} className={`ad-layercard ad-layercard--${page.group}`}>
                    <div className="ad-layercard__top">
                      <span className={`ad-layercard__icon ad-layercard__icon--${page.group}`} aria-hidden="true">
                        <Icon width={20} height={20} />
                      </span>
                      <h3 className="ad-layercard__name">{page.title}</h3>
                    </div>

                    <p className="ad-layercard__desc">{page.description || 'بدون توضیح.'}</p>

                    <div className="ad-layercard__meta">
                      <code className="ad-code" dir="ltr">/{page.slug}</code>
                      {page.route ? (
                        <a
                          className="ad-layercard__route"
                          href={page.route}
                          target="_blank"
                          rel="noreferrer"
                          title="مشاهدهٔ لایه در سایت"
                          aria-label="مشاهدهٔ لایه در سایت"
                        >
                          <IconEye width={16} height={16} />
                        </a>
                      ) : (
                        <span className="ad-layercard__noroute">فقط از طریق پنل</span>
                      )}
                    </div>

                    <footer className="ad-layercard__foot">
                      <span className="ad-sub">آخرین ویرایش {faDateTime(page.updatedAt)}</span>
                      <div className="ad-rowactions">
                        {/*
                         * فقط کارت‌هایی که در LAYER_VIEWS مقصد دارند وارد لایه می‌شوند؛
                         * بقیهٔ دکمه‌ها عمداً بی‌عمل‌اند (درخواست کاربر).
                         */}
                        {entryTarget ? (
                          <Button
                            size="sm"
                            onClick={() => navigate?.(entryTarget.view)}
                            title={entryTarget.title}
                          >
                            ورود به لایه
                          </Button>
                        ) : (
                          <Button size="sm">ورود به لایه</Button>
                        )}
                      </div>
                    </footer>
                  </article>
                );
              })}
            </div>
          </section>
        );
      }) : null}
    </div>
  );
}
