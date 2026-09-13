/*
 * BehaviorViews — نمای‌های تحلیل رفتاری:
 *   ErrorView        (Wrong ≠ Wrong — توزیع نوع خطا با صداقت داده)
 *   TimeView         (تحلیل زمان پاسخ‌گویی + تندی/کندی نامعمول)
 *   ConfidenceView   (ماتریس اطمینان×دقت — چهار خانه)
 *   UnansweredView   (تحلیل بی‌پاسخ‌ها: Skipped در برابر Not Attempted)
 *   DifficultyView   (Accuracy by Difficulty + Insight داده‌محور)
 */
import {
  Card,
  EmptyState,
  Icon,
  BarRow,
  ColumnChart,
  formatPercent,
  formatSeconds,
  formatFullDate,
  faNum,
  toFa,
  errorTypeLabel,
} from './analyticsShared';
import { ERROR_TYPES } from '../../../services/analytics/analyticsEngine';

/* ─────────────── تحلیل نوع خطا ─────────────── */

const FAST_WRONG_LIMIT = 10; // ثانیه — آستانهٔ «پاسخ تند»

export function ErrorView({ errors, patterns, onOpenQuestion }) {
  const unmarked = errors.distribution.find((entry) => entry.type === 'UNMARKED');
  const marked = errors.distribution.filter((entry) => entry.type !== 'UNMARKED');

  return (
    <div className="space-y-5">
      <Card
        title="هر غلط، یک دلیل ندارد"
        icon="alert"
        hint="نوع خطاها از ثبت خودت می‌آید؛ جایی که داده ثبت نشده، سیستم حدس نمی‌زند."
        className="dashboard-layer-reveal"
      >
        {errors.totalWrong === 0 ? (
          <EmptyState icon="check" title="در این بازه غلطی ثبت نشده" />
        ) : (
          <div className="space-y-3.5">
            {marked.map((entry) => (
              <BarRow
                key={entry.type}
                label={`${ERROR_TYPES[entry.type]?.label ?? entry.type}`}
                value={entry.share}
                max={100}
                accent={entry.type === 'KNOWLEDGE_GAP' ? '#e26d6d' : entry.type === 'CARELESS_MISTAKE' || entry.type === 'MISREADING' ? '#e0b45c' : '#937fcd'}
                right={`${faNum(entry.count)} مورد · ${formatPercent(entry.share)}`}
                subLabel={ERROR_TYPES[entry.type]?.hint}
              />
            ))}
            {unmarked && unmarked.count > 0 && (
              <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] p-3.5">
                <p className="text-[12.5px] text-[#c9c9c9]">
                  <strong className="text-[#999]">{faNum(unmarked.count)} غلط ثبت‌نشده</strong> — دلیلش مشخص نشده؛ «احتمالاً نیازمند بررسی».
                  هنگام مرور کارنامه‌ها می‌توانی نوع خطا را برایشان ثبت کنی تا این تحلیل دقیق‌تر شود.
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* الگوی استنباطی جانبی — صریحاً «احتمالی» */}
      {errors.inferred.fastWrong > 0 && (
        <Card title="میل به پاسخ تند" icon="bolt" className="dashboard-layer-reveal">
          <p className="text-[12.5px] leading-6 text-[#c9c9c9]">
            {faNum(errors.inferred.fastWrong)} غلط از {faNum(errors.totalWrong)} غلط تو در کمتر از {toFa(FAST_WRONG_LIMIT)} ثانیه داده شده
            ({formatPercent(errors.inferred.fastWrongShare)}). این فقط یک الگوی آماری است؛ بخشی از آن‌ها احتمالاً بی‌دقتی است، اما با مرور خودت قابل تأیید است.
          </p>
          {errors.inferred.slowWrong > 0 && (
            <p className="mt-2 text-[12px] text-[#8a8a8a]">در مقابل، {faNum(errors.inferred.slowWrong)} غلط هم بیش از دو برابر زمان متعارف وقت گرفته — نشانهٔ سؤال‌هایی که مسیر حل‌شان مشخص نبود.</p>
          )}
        </Card>
      )}

      {patterns.length > 0 && (
        <Card title="الگوهای رفتاری شناسایی‌شده" icon="spark" hint="هر الگو با حداقل نمونهٔ لازم و شواهدش" className="dashboard-layer-reveal">
          <div className="space-y-3">
            {patterns.map((pattern) => (
              <div key={pattern.id} className="rounded-2xl border border-white/8 bg-[#2a2a2d] p-4">
                <h3 className="text-[13px] font-bold text-[#e0b45c]">{pattern.title}</h3>
                <p className="mt-1 text-[12px] leading-6 text-[#c9c9c9]">{pattern.description}</p>
                <p className="an-evidence mt-2 text-[11px] text-[#8a8a8a]"><span className="an-evidence__tag">شواهد</span>{pattern.evidence}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ─────────────── تحلیل زمان ─────────────── */

export function TimeView({ time, questionPool }) {
  if (!time || time.average === null) {
    return <EmptyState icon="clock" title="دادهٔ زمانی برای تحلیل نیست" note="با حل تست، زمان هر پاسخ ثبت می‌شود و این تحلیل ساخته می‌شود." />;
  }

  return (
    <div className="space-y-5">
      <Card title="سنجه‌های زمان پاسخ‌گویی" icon="clock" className="dashboard-layer-reveal">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'میانگین', value: formatSeconds(time.average) },
            { label: 'میانه', value: formatSeconds(time.medianTime) },
            { label: 'سریع‌ترین', value: formatSeconds(time.fastest) },
            { label: 'کندترین', value: formatSeconds(time.slowest) },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/8 bg-[#2a2a2d] px-4 py-3.5 text-center">
              <span className="block text-[11px] text-[#8a8a8a]">{stat.label}</span>
              <strong className="mt-0.5 block text-lg font-extrabold [font-family:'Doran',Tahoma,sans-serif]">{stat.value}</strong>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="دقت تو در هر بازهٔ زمانی"
        icon="chart"
        hint="سرعت بالا نباید دقت را قربانی کند؛ و زمان زیاد لزوماً به پاسخ درست نمی‌رسد"
        className="dashboard-layer-reveal"
      >
        <div className="space-y-3.5">
          {time.byBucket.map((bucket) => (
            <BarRow
              key={bucket.key}
              label={bucket.label}
              value={bucket.accuracy}
              accent={bucket.accent}
              right={formatPercent(bucket.accuracy)}
              subLabel={`${faNum(bucket.count)} تست در این بازه`}
            />
          ))}
        </div>
        {(() => {
          const fast = time.byBucket.find((bucket) => bucket.key === 'fast');
          const normal = time.byBucket.find((bucket) => bucket.key === 'normal');
          if (fast && normal && fast.accuracy !== null && normal.accuracy !== null && normal.accuracy - fast.accuracy >= 10) {
            return (
              <p className="mt-4 border-t border-white/6 pt-3 text-[12.5px] leading-6 text-[#c9c9c9]">
                دقت تست‌های تند تو ({formatPercent(fast.accuracy)}) از تست‌های نرمال ({formatPercent(normal.accuracy)}) پایین‌تر است؛
                احتمالاً سرعت بالا بخشی از غلط‌هایت را می‌سازد — ریتم پاسخ را کمی آرام‌تر کن.
              </p>
            );
          }
          if (fast && normal && fast.accuracy !== null && fast.accuracy >= normal.accuracy - 3) {
            return <p className="mt-4 border-t border-white/6 pt-3 text-[12.5px] leading-6 text-[#c9c9c9]">در تست‌های سریع هم دقتت حفظ می‌شود؛ نشانهٔ تسلط واقعی روی این سؤال‌ها.</p>;
          }
          return null;
        })()}
      </Card>

      <Card title="زمان تو نسبت به زمان متعارف سؤال‌ها" icon="timer" hint="مقایسه با میانگین زمان جامعه روی هر سطح سختی" className="dashboard-layer-reveal">
        {time.byDifficulty.length > 0 ? (
          <ColumnChart
            columns={time.byDifficulty.map((row) => ({
              key: row.difficulty,
              label: { easy: 'آسان', medium: 'متوسط', hard: 'سخت', very_hard: 'بسیار سخت' }[row.difficulty],
              value: row.averageTime,
              display: formatSeconds(row.averageTime),
              accent: { easy: '#77b787', medium: '#e0b45c', hard: '#ef9196', very_hard: '#e26d6d' }[row.difficulty],
            }))}
            ariaLabel="نمودار میانگین زمان بر اساس سختی"
          />
        ) : (
          <EmptyState icon="clock" title="دادهٔ کافی نیست" />
        )}
      </Card>

      {/* دو دستهٔ قابل بررسی */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="تست‌هایی که بیش از حد سریع پاسخ دادی" icon="bolt" className="dashboard-layer-reveal">
          {time.rushed.length === 0 ? (
            <p className="text-[12px] text-[#8a8a8a]">موردی نیست؛ یا خیلی تند جواب نمی‌دهی یا غلط‌هایت تند نیستند. 👌</p>
          ) : (
            <>
              <p className="mb-3 text-[12.5px] leading-6 text-[#c9c9c9]">
                <strong className="text-[#e0b45c]">{faNum(time.rushed.length)} تست</strong> زیر ۱۰ ثانیه پاسخ داده‌ای که غلط از آب درآمده‌اند؛
                الگوی کلاسیک بی‌دقتی — ارزش دوباره خواندن دارند.
              </p>
              <QuestionChips items={time.rushed} onOpen={undefined} accent="#e0b45c" />
            </>
          )}
        </Card>

        <Card title="تست‌هایی که بیش از حد زمان بردند" icon="alert" className="dashboard-layer-reveal">
          {time.overtime.length === 0 ? (
            <p className="text-[12px] text-[#8a8a8a]">همهٔ پاسخ‌هایت در بازهٔ متعارف زمانی‌اند.</p>
          ) : (
            <>
              <p className="mb-3 text-[12.5px] leading-6 text-[#c9c9c9]">
                <strong className="text-[#e26d6d]">{faNum(time.overtime.length)} تست</strong> بیش از دو برابر زمان متعارف وقت برده‌اند؛
                در آزمون، این سؤال‌ها باید شناسایی و رد شوند تا زمان بقیه حفظ شود.
              </p>
              <QuestionChips items={time.overtime} accent="#e26d6d" />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function QuestionChips({ items, accent }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.slice(0, 18).map((attempt) => (
        <span
          key={attempt.id}
          className="rounded-lg px-2 py-1 text-[10.5px]"
          style={{ background: `${accent}12`, color: accent }}
          title={attempt.stem ?? ''}
        >
          {attempt.topicPath?.[0] ?? 'سؤال'} · {faNum(attempt.timeSpent)}ث
        </span>
      ))}
      {items.length > 18 && <span className="self-center text-[11px] text-[#777]">و {faNum(items.length - 18)} مورد دیگر…</span>}
    </div>
  );
}

/* ─────────────── تحلیل اطمینان ─────────────── */

const QUADRANTS = [
  {
    key: 'confidentCorrect',
    title: 'مطمئن بودی · درست بود',
    accent: '#61D192',
    icon: 'check',
    note: 'دانش محکم — همین سؤال‌ها سرمایهٔ آزمون تو هستند.',
  },
  {
    key: 'confidentWrong',
    title: 'مطمئن بودی · غلط بود',
    accent: '#e26d6d',
    icon: 'alert',
    note: 'خطرناک‌ترین خانه: مفهومی که اشتباه تثبیت شده. اولویت اول مرور.',
  },
  {
    key: 'uncertainCorrect',
    title: 'نامطمئن بودی · درست بود',
    accent: '#e0b45c',
    icon: 'spark',
    note: 'دانش شکننده — بلدی ولی نیم‌بند؛ با تمرین کوتاه محکم می‌شود.',
  },
  {
    key: 'uncertainWrong',
    title: 'نامطمئن بودی · غلط بود',
    accent: '#937fcd',
    icon: 'book',
    note: 'خلأ دانشی شناخته‌شده — از این‌جا شروع به مطالعه کن؛ نه خطا بود، نه بی‌دقتی.',
  },
];

export function ConfidenceView({ confidence }) {
  if (!confidence.sufficient) {
    return (
      <EmptyState
        icon="spark"
        title="دادهٔ اطمینان هنوز کافی نیست"
        note={`پوشش دادهٔ اطمینان فعلی: ${formatPercent(confidence.coverage)}. وقتی در سشن‌های تمرینی سطح اطمینان بیشتری ثبت شود (حداقل ${toFa(40)}٪ پاسخ‌ها)، ماتریس «دانستن در برابر فکر کردن به دانستن» ساخته می‌شود.`}
      />
    );
  }
  const { quadrants } = confidence;
  const total = quadrants.confidentCorrect + quadrants.confidentWrong + quadrants.uncertainCorrect + quadrants.uncertainWrong + quadrants.mediumCorrect + quadrants.mediumWrong;

  return (
    <div className="space-y-5">
      <Card
        title="ماتریس اطمینان × دقت"
        icon="target"
        hint={`تحلیل روی ${faNum(total)} پاسخِ دارای ثبت اطمینان (${formatPercent(confidence.coverage)} از کل)`}
        className="dashboard-layer-reveal"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {QUADRANTS.map((quadrant) => (
            <div key={quadrant.key} className="an-quadrant" style={{ borderColor: `${quadrant.accent}35`, background: `${quadrant.accent}08` }}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-[12.5px] font-bold" style={{ color: quadrant.accent }}>
                  <Icon name={quadrant.icon} className="h-4 w-4" />
                  {quadrant.title}
                </h3>
                <strong className="text-xl font-extrabold [font-family:'Doran',Tahoma,sans-serif]" style={{ color: quadrant.accent }}>
                  {faNum(quadrants[quadrant.key])}
                </strong>
              </div>
              <p className="text-[11.5px] leading-5 text-[#9a9a9a]">{quadrant.note}</p>
            </div>
          ))}
        </div>
        {confidence.calibration !== null && (
          <p className="mt-4 border-t border-white/6 pt-3 text-[12.5px] leading-6 text-[#c9c9c9]">
            کالیبراسیون اطمینان تو: از پاسخ‌هایی که «مطمئن» ثبت کردی، <strong style={{ color: confidence.calibration >= 80 ? '#61D192' : confidence.calibration >= 65 ? '#e0b45c' : '#e26d6d' }}>{formatPercent(confidence.calibration)}</strong> درست بوده‌اند.
            {confidence.calibration >= 80
              ? ' اطمینانت به دانشت نزدیک است — این یعنی خودشناسی آزمونی خوب.'
              : confidence.calibration >= 65
                ? ' بخشی از اطمینانت بیشتر از دانش واقعیت است؛ جای چند مفهوم باید دوباره ساخته شود.'
                : ' اطمینانت جلوتر از دانشت حرکت می‌کند؛ در مرورها، اول سراغ سؤال‌های «مطمئن اما غلط» برو.'}
          </p>
        )}
      </Card>

      {(confidence.dangerousByTopic || confidence.fragileByTopic) && (
        <Card title="تمرکز این الگوها کجاست؟" icon="puzzle" className="dashboard-layer-reveal">
          <div className="space-y-2.5">
            {confidence.dangerousByTopic && (
              <p className="text-[12.5px] leading-6 text-[#c9c9c9]">
                پاسخ‌های «مطمئن اما غلط» تو بیشتر در مبحث <strong className="text-[#e26d6d]">{confidence.dangerousByTopic.topic}</strong> متمرکزند ({faNum(confidence.dangerousByTopic.count)} مورد).
              </p>
            )}
            {confidence.fragileByTopic && (
              <p className="text-[12.5px] leading-6 text-[#c9c9c9]">
                دانش شکنندهٔ تو (نامطمئن اما درست) بیشتر در مبحث <strong className="text-[#e0b45c]">{confidence.fragileByTopic.topic}</strong> است ({faNum(confidence.fragileByTopic.count)} مورد) — با یک تمرین کوتاه محکم می‌شود.
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ─────────────── تحلیل بی‌پاسخ ─────────────── */

export function UnansweredView({ unanswered, kpis }) {
  if (!unanswered || unanswered.total === 0) {
    return <EmptyState icon="check" title="بی‌پاسخی ثبت نشده" note="در این بازه همهٔ سؤال‌ها را پاسخ داده‌ای — همین مدیریت زمان خوب است." />;
  }

  return (
    <div className="space-y-5">
      <Card title="تحلیل سؤال‌های بی‌پاسخ" icon="info" className="dashboard-layer-reveal">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: 'کل بی‌پاسخ', value: faNum(unanswered.total), sub: `${formatPercent(unanswered.share)} از همهٔ سؤال‌ها` },
            { label: 'دیده‌شده و ردشده', value: faNum(unanswered.skipped), sub: 'Skipped' },
            { label: 'اصلاً باز نشده', value: faNum(unanswered.notAttempted), sub: 'Not Attempted' },
            { label: 'در آزمون‌ها', value: faNum(unanswered.inExams), sub: 'نشانهٔ فشار زمان' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/8 bg-[#2a2a2d] px-4 py-3.5 text-center">
              <span className="block text-[11px] text-[#8a8a8a]">{stat.label}</span>
              <strong className="mt-0.5 block text-xl font-extrabold [font-family:'Doran',Tahoma,sans-serif]">{stat.value}</strong>
              <span className="block text-[10.5px] text-[#777]">{stat.sub}</span>
            </div>
          ))}
        </div>
        {unanswered.inExams > 0 && (
          <p className="mt-4 border-t border-white/6 pt-3 text-[12.5px] leading-6 text-[#c9c9c9]">
            بی‌پاسخ‌های آزمونی معمولاً مسئلهٔ «ندانستن» نیستند، مسئلهٔ مدیریت زمان‌اند. راه‌حل: در آزمون اول پاسخ‌های مطمئن را بزن، بعد برگرد.
          </p>
        )}
      </Card>

      {unanswered.topTopics.length > 0 && (
        <Card title="بی‌پاسخ‌ها کجا متمرکزند؟" icon="grid" className="dashboard-layer-reveal">
          <div className="space-y-3">
            {unanswered.topTopics.map((entry) => (
              <div key={entry.topic} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-[#2a2a2d] px-4 py-3">
                <span className="text-[12.5px]">{entry.topic}</span>
                <strong className="text-[13px] text-[#e0b45c]">{faNum(entry.count)} سؤال</strong>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ─────────────── تحلیل دشواری ─────────────── */

export function DifficultyView({ difficulty }) {
  if (!difficulty || difficulty.rows.length === 0) {
    return <EmptyState icon="target" title="داده‌ای برای تحلیل دشواری نیست" />;
  }
  const rowAccent = { easy: '#77b787', medium: '#e0b45c', hard: '#ef9196', very_hard: '#e26d6d' };

  return (
    <div className="space-y-5">
      <Card
        title="دقت تو بر اساس سطح سختی سؤال"
        icon="target"
        hint="این نمودار می‌گوید سطح سختی تا کجا با دقت بالا همراهت است"
        className="dashboard-layer-reveal"
      >
        <ColumnChart
          columns={difficulty.rows.map((row) => ({
            key: row.difficulty,
            label: { easy: 'آسان', medium: 'متوسط', hard: 'سخت', very_hard: 'بسیار سخت' }[row.difficulty],
            value: row.accuracy,
            display: formatPercent(row.accuracy),
            accent: rowAccent[row.difficulty],
          }))}
          ariaLabel="نمودار دقت بر اساس سختی"
        />
        <div className="mt-4 space-y-2.5">
          {difficulty.rows.map((row) => (
            <BarRow
              key={row.difficulty}
              label={{ easy: 'آسان', medium: 'متوسط', hard: 'سخت', very_hard: 'بسیار سخت' }[row.difficulty]}
              value={row.accuracy}
              accent={rowAccent[row.difficulty]}
              right={formatPercent(row.accuracy)}
              subLabel={`${faNum(row.count)} تست · ${faNum(row.correctCount)} درست · ${faNum(row.wrongCount)} غلط${row.unansweredCount ? ` · ${faNum(row.unansweredCount)} نزده` : ''} · میانگین زمان ${formatSeconds(row.averageTime)}`}
            />
          ))}
        </div>
        {difficulty.gap !== null && Math.abs(difficulty.gap) >= 15 && (
          <p className="mt-4 border-t border-white/6 pt-3 text-[12.5px] leading-6 text-[#c9c9c9]">
            {difficulty.gap > 0
              ? `عملکردت در تست‌های ساده‌تر ${toFa(Math.abs(Math.round(difficulty.gap)))} واحد بهتر از سخت‌هاست — طبیعی است، اما با تمرین پله‌ای سطح سخت این فاصله بسته می‌شود.`
              : `جالب است: دقت تو در سؤال‌های سخت‌تر حتی از ساده‌ها بالاتر است؛ نشانهٔ مفهومی بودن سبک مطالعه‌ات.`}
          </p>
        )}
      </Card>
    </div>
  );
}
