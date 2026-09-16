/*
 * بخش‌های «آموزش»، «محصولات» و «محتوا».
 *
 * پرسش مشترک این سه: محتوایی که ساخته‌ایم چقدر دیده و استفاده می‌شود؟
 * فهرست محصولات (تست، ویکی، فلش‌کارت، درسنامه، شبکهٔ دانش) مستقیماً از
 * ماژول‌های واقعی پروژه خوانده می‌شود، نه از یک فهرست دستی.
 */

import { useState } from 'react';

import {
  BarChart, DataTable, Donut, HBarList, KpiCard, LineChart, MiniStat, Notice,
  Panel, SectionHero, StatusPill, formatPercent, formatValue, faNumber, toFa,
} from '../analyticsKit';

const SPARK_FIELDS = {
  tests: 'tests',
  questions: 'tests',
  flashcards: 'flashcards',
  studies: 'sessions',
  activeLearners: 'visitors',
  accuracy: 'tests',
  avgTime: 'avgDurationSeconds',
};

const INVERTED = new Set(['avgTime', 'errorRate']);

/* ─────────────────────────── آموزش ─────────────────────────── */

export function EducationSection({ data }) {
  const series = data.series ?? [];
  const inventory = data.inventory ?? {};
  const testBank = inventory.testBank ?? {};
  const wiki = inventory.wiki ?? {};
  const flashcards = inventory.flashcards ?? {};
  const knowledge = inventory.knowledge ?? {};
  const course = inventory.course ?? {};

  const [questionView, setQuestionView] = useState('hardest');

  const questionSets = {
    hardest: data.questions?.hardest ?? [],
    easiest: data.questions?.easiest ?? [],
    anomalous: data.questions?.anomalous ?? [],
  };

  const questionColumns = [
    { key: 'text', label: 'سؤال', render: (row) => <span className="an-path" title={row.text}>{row.text}</span> },
    { key: 'subject', label: 'درس' },
    { key: 'attempts', label: 'تلاش', align: 'end' },
    { key: 'accuracy', label: 'درصد پاسخ درست', align: 'end', render: (row) => formatPercent(row.accuracy) },
    { key: 'avgSeconds', label: 'میانگین زمان', align: 'end', render: (row) => formatValue(row.avgSeconds, 0) },
  ];

  const inventoryRows = [
    { key: 'tests', label: 'بانک تست', value: `${faNumber(testBank.questions ?? 0)} سؤال` },
    { key: 'wiki', label: 'ویکی', value: `${faNumber(wiki.entities ?? 0)} مدخل` },
    { key: 'flashcards', label: 'فلش‌کارت', value: `${faNumber(flashcards.decks ?? 0)} دسته · ${faNumber(flashcards.cards ?? 0)} کارت` },
    { key: 'knowledge', label: 'شبکهٔ دانش', value: `${faNumber(knowledge.nodes ?? 0)} گره · ${faNumber(knowledge.edges ?? 0)} ارتباط` },
    { key: 'international', label: 'آزمون‌های بین‌الملل', value: `${faNumber(inventory.international?.exams ?? 0)} آزمون · ${faNumber(inventory.international?.questions ?? 0)} سؤال` },
    { key: 'coordinated', label: 'آزمون‌های هماهنگ', value: `${faNumber(inventory.coordinated?.exams ?? 0)} آزمون · ${faNumber(inventory.coordinated?.questions ?? 0)} سؤال` },
    { key: 'course', label: 'درسنامه', value: `${faNumber(course.modules ?? 0)} ماژول · ${faNumber(course.units ?? 0)} واحد` },
  ];

  return (
    <div className="an-section">
      <SectionHero
        eyebrow="آموزش"
        title="یادگیری واقعاً اتفاق می‌افتد؟"
        description="تست، سؤال، فلش‌کارت و درسنامه — همراه با فهرست کامل محصول آموزشی موجود در پروژه."
      />

      <div className="an-kpi-grid">
        {(data.kpis ?? []).map((kpi) => (
          <KpiCard
            key={kpi.key}
            kpi={kpi}
            invert={INVERTED.has(kpi.key)}
            spark={SPARK_FIELDS[kpi.key] ? series.map((point) => point[SPARK_FIELDS[kpi.key]]) : null}
          />
        ))}
      </div>

      <Panel title="روند فعالیت آموزشی" description="تست و فلش‌کارت در روزهای بازه">
        <LineChart
          labels={series.map((point) => point.label)}
          series={[
            { key: 'tests', label: 'تست انجام‌شده', values: series.map((point) => point.tests), color: 'var(--purple-ink)' },
          ]}
          height={240}
        />
      </Panel>

      <Panel title="فهرست محصول آموزشی" description="مستقیماً از ماژول‌های واقعی پروژه شمارش شده است">
        <div className="an-inventory">
          {inventoryRows.map((row) => (
            <div key={row.key} className="an-inventory__item">
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
        {inventory.failed?.length ? (
          <Notice tone="warn">
            برخی فهرست‌ها خوانده نشد: {inventory.failed.map((item) => item.module ?? item).join('، ')}
          </Notice>
        ) : null}
      </Panel>

      <div className="an-split">
        <Panel title="ترکیب بانک تست" description="بر پایهٔ ساختار واقعی سؤالات">
          <Donut
            slices={Object.entries(testBank.byDifficulty ?? {}).map(([key, value]) => ({
              key,
              label: { easy: 'آسان', medium: 'متوسط', hard: 'دشوار', very_hard: 'خیلی دشوار' }[key] ?? key,
              value,
            }))}
            centerLabel="سؤال"
          />
        </Panel>

        <Panel title="درس‌های بانک تست" description="تعداد سؤال هر درس">
          <HBarList
            rows={(testBank.subjects ?? []).map((subject) => ({
              key: subject.id ?? subject.label,
              label: subject.label,
              value: subject.count,
            }))}
            maxRows={12}
          />
        </Panel>
      </div>

      <div className="an-split">
        <Panel title="ویکی — توزیع موضوعی" description={`${faNumber(wiki.entities ?? 0)} مدخل`}>
          <HBarList
            rows={Object.entries(wiki.bySubject ?? {}).map(([key, value]) => ({ key, label: key, value }))}
            maxRows={10}
          />
        </Panel>

        <Panel title="ویکی — نوع مدخل">
          <Donut
            slices={Object.entries(wiki.byType ?? {}).map(([key, value]) => ({ key, label: key, value }))}
            centerLabel="مدخل"
            size={170}
          />
        </Panel>
      </div>

      <div className="an-split">
        <Panel title="فلش‌کارت — دسته‌ها">
          <HBarList
            rows={Object.entries(flashcards.bySubject ?? {}).map(([key, value]) => ({ key, label: key, value }))}
            emptyLabel="دسته‌ای ثبت نشده"
          />
        </Panel>
        <Panel title="شبکهٔ دانش — نوع گره">
          <HBarList
            rows={Object.entries(knowledge.byType ?? {}).map(([key, value]) => ({ key, label: key, value }))}
            maxRows={12}
            emptyLabel="گره‌ای ثبت نشده"
          />
        </Panel>
      </div>

      <Panel
        title="تحلیل سؤالات"
        description={data.questions?.total ? `${faNumber(data.questions.total)} سؤال با پاسخ واقعی کاربران` : 'برای تحلیل سؤال، به پاسخ‌های واقعی نیاز است'}
        actions={(
          <div className="an-chips">
            {[
              { key: 'hardest', label: 'دشوارترین' },
              { key: 'easiest', label: 'آسان‌ترین' },
              { key: 'anomalous', label: 'رفتار غیرعادی' },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                className={`an-chip ${questionView === option.key ? 'is-on' : ''}`}
                onClick={() => setQuestionView(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      >
        <DataTable
          rows={questionSets[questionView]}
          columns={questionColumns}
          sortable={false}
          emptyLabel="برای این دسته داده‌ای نیست — پاسخ‌های واقعی کاربران لازم است"
        />
      </Panel>

      <Panel title="مطالب پرمخاطب آموزشی">
        <DataTable
          rows={data.topArticles ?? []}
          columns={[
            { key: 'title', label: 'عنوان', render: (row) => <span className="an-path" title={row.title}>{row.title}</span> },
            { key: 'category', label: 'دسته' },
            { key: 'views', label: 'بازدید', align: 'end' },
          ]}
          initialSort={{ key: 'views', dir: 'desc' }}
        />
      </Panel>

      {data.knowledge?.connected ? (
        <Panel title="ارتباط محصولات" description="چند محصول از یک مفهوم مشترک استفاده می‌کنند">
          <div className="an-kpi-grid an-kpi-grid--tight">
            <MiniStat label="گرهٔ دانش" value={faNumber(data.knowledge.nodes ?? 0)} />
            <MiniStat label="ارتباط" value={faNumber(data.knowledge.edges ?? 0)} />
            <MiniStat label="درس" value={faNumber((data.knowledge.courses ?? []).length)} />
          </div>
          <div className="an-kpi-grid an-kpi-grid--tight">
            {(data.knowledge.courses ?? []).map((item) => (
              <MiniStat key={item.id} label={item.label} value={faNumber(item.nodes ?? 0)} hint={item.accent} />
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

/* ─────────────────────────── محصولات ─────────────────────────── */

export function ProductsSection({ data }) {
  const features = data.features ?? [];
  const inventory = data.inventory ?? {};

  const usageColumns = [
    {
      key: 'label',
      label: 'محصول',
      render: (row) => (
        <span className="an-feature">
          <StatusPill status={row.status === 'active' ? 'good' : row.status === 'idle' ? 'warn' : 'neutral'} label={row.status === 'active' ? 'فعال' : row.status === 'idle' ? 'کم‌استفاده' : 'بی‌استفاده'} />
          <strong>{row.label}</strong>
        </span>
      ),
    },
    { key: 'inventory', label: 'موجودی' },
    { key: 'uses', label: 'استفاده', align: 'end' },
    { key: 'users', label: 'کاربر', align: 'end' },
    { key: 'returnRate', label: 'نرخ بازگشت', align: 'end', render: (row) => formatPercent(row.returnRate) },
    { key: 'errorRate', label: 'نرخ خطا', align: 'end', render: (row) => formatPercent(row.errorRate) },
  ];

  return (
    <div className="an-section">
      <SectionHero
        eyebrow="محصولات"
        title="کدام محصول استفاده می‌شود، کدام نه"
        description="استفادهٔ هر محصول از رویدادهای واقعی شمرده می‌شود؛ فهرست موجودی از خود پروژه خوانده می‌شود."
      />

      <div className="an-kpi-grid an-kpi-grid--tight">
        <MiniStat label="محصول فعال" value={faNumber(data.used ?? 0)} tone="good" />
        <MiniStat label="محصول بی‌استفاده" value={faNumber(data.unused ?? 0)} tone="warn" />
        <MiniStat label="نرخ پذیرش" value={formatPercent(data.adoption)} tone="neutral" hint="سهم محصولاتی که حداقل یک استفاده داشته‌اند" />
      </div>

      <Panel title="مصرف محصولات" description="بر پایهٔ رویدادهای feature_use، lesson_view، wiki_view و…">
        <DataTable rows={features} columns={usageColumns} initialSort={{ key: 'uses', dir: 'desc' }} />
      </Panel>

      <Panel title="مقایسهٔ استفاده" description="کدام محصول بیشترین تعامل را دارد">
        <BarChart
          data={features.map((feature) => ({
            key: feature.id,
            label: feature.label,
            value: feature.uses,
            extra: `${faNumber(feature.users)} کاربر`,
            extraLabel: 'کاربر',
          }))}
          height={260}
          unit=" بار"
        />
      </Panel>

      <Panel title="محصولات بی‌استفاده" description="ساخته شده‌اند اما کسی سراغشان نمی‌رود">
        {features.filter((feature) => feature.uses === 0).length ? (
          <ul className="an-plain">
            {features.filter((feature) => feature.uses === 0).map((feature) => (
              <li key={feature.id}>
                <strong>{feature.label}</strong>
                <span className="an-muted">{feature.inventory}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="an-muted">همهٔ محصولات حداقل یک بار استفاده شده‌اند.</p>
        )}
      </Panel>

      <Panel title="موجودی فنی محصولات" description="از ماژول‌های واقعی پروژه">
        <div className="an-inventory">
          <div className="an-inventory__item"><span>سؤال بانک تست</span><strong>{faNumber(inventory.testBank?.questions ?? 0)}</strong></div>
          <div className="an-inventory__item"><span>مدخل ویکی</span><strong>{faNumber(inventory.wiki?.entities ?? 0)}</strong></div>
          <div className="an-inventory__item"><span>کارت فلش‌کارت</span><strong>{faNumber(inventory.flashcards?.cards ?? 0)}</strong></div>
          <div className="an-inventory__item"><span>گرهٔ شبکهٔ دانش</span><strong>{faNumber(inventory.knowledge?.nodes ?? 0)}</strong></div>
          <div className="an-inventory__item"><span>آزمون بین‌الملل</span><strong>{faNumber(inventory.international?.exams ?? 0)}</strong></div>
          <div className="an-inventory__item"><span>آزمون هماهنگ</span><strong>{faNumber(inventory.coordinated?.exams ?? 0)}</strong></div>
        </div>
      </Panel>
    </div>
  );
}

/* ─────────────────────────── محتوا ─────────────────────────── */

export function ContentSection({ data }) {
  const totals = data.totals ?? {};
  const freshness = data.freshness ?? [];

  const contentColumns = [
    { key: 'title', label: 'عنوان', render: (row) => <span className="an-path" title={row.title}>{row.title}</span> },
    {
      key: 'kind',
      label: 'نوع',
      render: (row) => ({ article: 'مقاله', page: 'صفحه' }[row.kind] ?? row.kind),
    },
    { key: 'status', label: 'وضعیت', render: (row) => (row.status === 'published' ? 'منتشرشده' : 'پیش‌نویس') },
    { key: 'wordCount', label: 'کلمه', align: 'end' },
    { key: 'views', label: 'بازدید', align: 'end' },
    {
      key: 'updatedAt',
      label: 'آخرین ویرایش',
      render: (row) => toFa(new Date(row.updatedAt).toLocaleDateString('fa-IR')),
    },
  ];

  return (
    <div className="an-section">
      <SectionHero
        eyebrow="محتوا"
        title="چه ساخته‌ایم و چه چیزی دیده نمی‌شود"
        description="شمارش محتوا از فایل‌های واقعی CMS و بازدید از تلمتری مرورگر می‌آید."
      />

      <div className="an-kpi-grid an-kpi-grid--tight">
        <MiniStat label="مقاله" value={faNumber(totals.articles ?? 0)} hint={`${faNumber(totals.publishedArticles ?? 0)} منتشرشده`} />
        <MiniStat label="صفحه" value={faNumber(totals.pages ?? 0)} hint={`${faNumber(totals.publishedPages ?? 0)} منتشرشده`} />
        <MiniStat label="رسانه" value={faNumber(totals.media ?? 0)} />
        <MiniStat label="بنر" value={faNumber(totals.banners ?? 0)} />
        <MiniStat label="تست" value={faNumber(totals.tests ?? 0)} />
        <MiniStat label="فلش‌کارت" value={faNumber(totals.flashcards ?? 0)} />
        <MiniStat label="صفحهٔ ویکی" value={faNumber(totals.wikiPages ?? 0)} />
        <MiniStat label="گرهٔ دانش" value={faNumber(totals.knowledgeNodes ?? 0)} />
      </div>

      <Panel title="تازگی محتوا" description={data.note}>
        <div className="an-kpi-grid an-kpi-grid--tight">
          <MiniStat label="جدید (۳۰ روز)" value={faNumber(freshness.newLast30 ?? 0)} tone="good" />
          <MiniStat label="کهنه (۶ ماه+)" value={faNumber(freshness.staleSixMonths ?? 0)} tone="warn" />
          <MiniStat label="هرگز ویرایش نشده" value={faNumber(freshness.neverUpdated ?? 0)} tone="warn" />
          <MiniStat label="هرگز دیده نشده" value={faNumber(freshness.neverViewed ?? 0)} tone="critical" />
        </div>
      </Panel>

      <Panel title="محتوای پربازدید" description="شامل بازدید زنده از تلمتری">
        <DataTable rows={data.top ?? []} columns={contentColumns} initialSort={{ key: 'views', dir: 'desc' }} />
      </Panel>

      <Panel title="محتوای بدون بازدید" description="منتشر شده اما کسی ندیده — فرصت اصلاح" tone="warn">
        <DataTable rows={data.zeroViews ?? []} columns={contentColumns} sortable={false} emptyLabel="همهٔ محتوای منتشرشده بازدید داشته است" />
      </Panel>

      <div className="an-split">
        <Panel title="محتوای در رشد" description="افزایش بازدید نسبت به بازهٔ قبل">
          <DataTable
            rows={data.growing ?? []}
            columns={contentColumns}
            sortable={false}
            emptyLabel="رشد معناداری ثبت نشده"
          />
        </Panel>
        <Panel title="محتوای در افت" description="کاهش بازدید نسبت به بازهٔ قبل" tone="warn">
          <DataTable
            rows={data.declining ?? []}
            columns={contentColumns}
            sortable={false}
            emptyLabel="افت معناداری ثبت نشده"
          />
        </Panel>
      </div>

      <div className="an-split">
        <Panel title="محتوای کم‌بازدید" description="نیازمند بهبود سئو یا لینک داخلی">
          <DataTable rows={data.low ?? []} columns={contentColumns} initialSort={{ key: 'views', dir: 'asc' }} emptyLabel="محتوای کم‌بازدیدی نیست" />
        </Panel>
        <Panel title="ترکیب محتوا" description="به تفکیک نوع">
          <Donut
            slices={(data.byKind ?? []).map((item) => ({ key: item.key, label: item.label ?? item.key, value: item.count }))}
            centerLabel="مورد"
          />
        </Panel>
      </div>

      {(data.byCategory ?? []).length ? (
        <Panel title="دسته‌بندی‌ها">
          <HBarList rows={data.byCategory.map((item) => ({ key: item.key, label: item.key, value: item.count }))} />
        </Panel>
      ) : null}
    </div>
  );
}
