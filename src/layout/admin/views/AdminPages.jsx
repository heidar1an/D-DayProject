/*
 * بخش «صفحات» پنل — رجیستری لایه‌های تپش.
 *
 * این بخش فهرست صفحات عمومی نیست؛ مجموعهٔ ثابتِ لایه‌های واقعی محصول است
 * (فلش کارت، بانک تست، مسیر سبز و…) که هر لایه یک رکورد محتوا دارد: متن معرفی
 * + سئو + وضعیت انتشار. رکوردها از seed می‌آیند و فرادادهٔ گروه/آیکون/مسیرشان
 * فقط همین‌جا نمایش داده می‌شود؛ محتوای هر لایه با همان ویرایشگر صفحات ادیت می‌شود.
 *
 * چیدمان: نوار آمار + نوار فیلتر (جست‌وجو، وضعیت، گروه) + کارت‌های گروه‌بندی‌شده.
 * چون تعداد لایه‌ها ثابت و محدود است، واکشی با perPage بالا انجام می‌شود و
 * صفحه‌بندی جدولی جای خودش را به گروه‌بندی کارتی داده است.
 */

import { useCallback, useMemo, useState } from 'react';

import { pages as pagesApi } from '../../../services/admin/adminService';
import {
  Badge, Button, EmptyState, ErrorState, IconButton, LoadingBlock, SearchInput,
  Select, StatusBadge, faDateTime, faNumber, useAsync, useToast,
} from '../adminShared';
import {
  IconArticle, IconBookOpen, IconExamSheet, IconEdit, IconEye, IconFlashcard, IconFlyer,
  IconGlobe, IconGlobeExam, IconGreenPath, IconKnowledgeGraph, IconMicroLesson,
  IconPopup, IconReference, IconRefresh, IconTestBank, IconTrophy, IconWiki,
} from '../adminIcons';

const STATUS_OPTIONS = [
  { value: 'all', label: 'همهٔ وضعیت‌ها' },
  { value: 'published', label: 'منتشرشده' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'archived', label: 'بایگانی' },
];

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

export default function AdminPages({ navigate, admin }) {
  const notify = useToast();
  const [filters, setFilters] = useState({ search: '', status: 'all', group: 'all' });
  const [pendingStatusId, setPendingStatusId] = useState(null);

  const can = (permission) => admin.permissions?.includes(permission);
  const load = useCallback(
    () => pagesApi.list({ search: filters.search, status: filters.status, page: 1, perPage: 100 }),
    [filters.search, filters.status],
  );
  const { data, loading, error, reload } = useAsync(load, [filters.search, filters.status]);

  /* فیلتر گروه سمت کلاینت است — سرور فقط جست‌وجو و وضعیت را می‌فهمد */
  const items = useMemo(
    () => (data?.items ?? []).filter((page) => filters.group === 'all' || page.group === filters.group),
    [data, filters.group],
  );

  const grouped = useMemo(() => (
    LAYER_GROUPS
      .map((group) => ({ ...group, pages: items.filter((page) => page.group === group.id) }))
      .filter((group) => group.pages.length > 0)
  ), [items]);

  const stats = useMemo(() => {
    const all = data?.items ?? [];
    return {
      total: data?.total ?? all.length,
      published: all.filter((page) => page.status === 'published').length,
      drafts: all.filter((page) => page.status === 'draft').length,
      groups: LAYER_GROUPS.length,
    };
  }, [data]);

  const patch = (changes) => setFilters((current) => ({ ...current, ...changes }));

  /*
   * تغییر سریع وضعیت از روی کارت — کل رکورد برمی‌گردد تا فرادادهٔ لایه
   * (گروه، آیکون، مسیر) در همان پاسخ سرور حفظ شود.
   */
  const toggleStatus = async (page) => {
    const nextStatus = page.status === 'published' ? 'draft' : 'published';
    setPendingStatusId(page.id);
    try {
      await pagesApi.update(page.id, { ...page, status: nextStatus });
      notify(nextStatus === 'published' ? `«${page.title}» منتشر شد` : `انتشار «${page.title}» لغو شد`);
      reload();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setPendingStatusId(null);
    }
  };

  const resetFilters = () => setFilters({ search: '', status: 'all', group: 'all' });

  return (
    <div className="ad-stack">
      <div className="ad-statgrid">
        <div className="ad-stat ad-stat--purple">
          <span className="ad-stat__icon"><IconFlashcard width={20} height={20} /></span>
          <span>
            <span className="ad-stat__value">{faNumber(stats.total)}</span>
            <span className="ad-stat__label">لایهٔ تعریف‌شده</span>
          </span>
        </div>
        <div className="ad-stat ad-stat--green">
          <span className="ad-stat__icon"><IconEye width={20} height={20} /></span>
          <span>
            <span className="ad-stat__value">{faNumber(stats.published)}</span>
            <span className="ad-stat__label">منتشرشده</span>
          </span>
        </div>
        <div className="ad-stat ad-stat--gold">
          <span className="ad-stat__icon"><IconEdit width={20} height={20} /></span>
          <span>
            <span className="ad-stat__value">{faNumber(stats.drafts)}</span>
            <span className="ad-stat__label">پیش‌نویس</span>
          </span>
        </div>
        <div className="ad-stat ad-stat--blue">
          <span className="ad-stat__icon"><IconKnowledgeGraph width={20} height={20} /></span>
          <span>
            <span className="ad-stat__value">{faNumber(stats.groups)}</span>
            <span className="ad-stat__label">گروه لایه</span>
          </span>
        </div>
      </div>

      <div className="ad-toolbar">
        <SearchInput value={filters.search} onChange={(search) => patch({ search })} placeholder="جست‌وجوی عنوان یا نشانی لایه…" />
        <Select options={STATUS_OPTIONS} value={filters.status} onChange={(event) => patch({ status: event.target.value })} aria-label="وضعیت" />

        <div className="ad-chiprow" role="group" aria-label="گروه لایه‌ها">
          <button
            type="button"
            className={`ad-chip ${filters.group === 'all' ? 'is-active' : ''}`}
            onClick={() => patch({ group: 'all' })}
          >
            همه
          </button>
          {LAYER_GROUPS.map((group) => (
            <button
              type="button"
              key={group.id}
              className={`ad-chip ${filters.group === group.id ? 'is-active' : ''}`}
              onClick={() => patch({ group: group.id })}
            >
              {group.label}
            </button>
          ))}
        </div>

        <div className="ad-toolbar__end">
          <Button variant="ghost" size="sm" onClick={reload}><IconRefresh width={15} height={15} />تازه‌سازی</Button>
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingBlock label="در حال خواندن لایه‌ها…" rows={4} /> : null}

      {data && grouped.length === 0 ? (
        <EmptyState
          title="لایه‌ای پیدا نشد"
          description="با فیلترهای فعلی هیچ لایه‌ای مطابقت ندارد."
          action={<Button size="sm" variant="ghost" onClick={resetFilters}>پاک کردن فیلترها</Button>}
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
                return (
                  <article key={page.id} className="ad-layercard">
                    <div className="ad-layercard__top">
                      <span className={`ad-layercard__icon ad-layercard__icon--${page.group}`} aria-hidden="true">
                        <Icon width={20} height={20} />
                      </span>
                      <div className="ad-layercard__title">
                        <button type="button" className="ad-linkcell" onClick={() => navigate('page-editor', { id: page.id })}>
                          {page.title}
                        </button>
                        <StatusBadge status={page.status} />
                      </div>
                    </div>

                    <p className="ad-layercard__desc">{page.description || 'بدون توضیح.'}</p>

                    <div className="ad-layercard__meta">
                      <code className="ad-code" dir="ltr">/{page.slug}</code>
                      {page.route ? (
                        <a className="ad-layercard__route" href={page.route} target="_blank" rel="noreferrer" title="مشاهدهٔ لایه در سایت">
                          <IconEye width={14} height={14} />
                          مشاهده در سایت
                        </a>
                      ) : (
                        <span className="ad-layercard__noroute">فقط از طریق پنل</span>
                      )}
                    </div>

                    <footer className="ad-layercard__foot">
                      <span className="ad-sub">آخرین ویرایش {faDateTime(page.updatedAt)}</span>
                      <div className="ad-rowactions">
                        <IconButton label="ویرایش محتوا" onClick={() => navigate('page-editor', { id: page.id })}>
                          <IconEdit width={16} height={16} />
                        </IconButton>
                        {can('pages.update') ? (
                          <Button
                            variant={page.status === 'published' ? 'ghost' : 'primary'}
                            size="sm"
                            loading={pendingStatusId === page.id}
                            onClick={() => toggleStatus(page)}
                          >
                            {page.status === 'published' ? 'لغو انتشار' : 'انتشار'}
                          </Button>
                        ) : null}
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
