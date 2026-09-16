import { useState } from 'react';

import { coverageOf, getCapabilityRows, toFa } from '../../services/pricing/pricingService';
import { CheckIcon, MinusIcon, PartialIcon } from './pricingShared';

/*
 * ماتریس مقایسهٔ قابلیت‌ها.
 *
 * دو ترکیب‌بندی جدا برای دو بستر — نه یک جدول که فقط زیر هم می‌شکند:
 *   دسکتاپ: جدول واقعی و تحریریه‌ای. جدول `<table>` بومی است تا صفحه‌خوان
 *           رابطهٔ «قابلیت × پلن» را بفهمد؛ ظاهر با CSS تحریریه می‌شود.
 *   موبایل: حالت «تک‌کارتی متمرکز» با تب‌های واقعی (tablist/tabpanel) — کاربر
 *           یک پلن را می‌بیند و همان فهرست را ورق می‌زند.
 * دادهٔ هر دو یکی است؛ فقط ترکیب‌بندی عوض می‌شود.
 *
 * هاور روی سرستون یک پلن، همان ستون را در کل جدول روشن می‌کند؛ state آن
 * محلی است چون هیچ بخش دیگری به آن نیاز ندارد.
 */

function CoverageMark({ coverage }) {
  if (coverage.id === 'full') return <CheckIcon />;
  if (coverage.id === 'partial') return <PartialIcon />;
  return <MinusIcon />;
}

export default function FeatureMatrix({ plans, selectedPlanId, onSelectPlan }) {
  const rows = getCapabilityRows();
  const [hoveredPlanId, setHoveredPlanId] = useState(null);

  const columnClass = (planId) =>
    [planId === selectedPlanId ? 'is-active' : '', planId === hoveredPlanId ? 'is-hovered' : '']
      .filter(Boolean)
      .join(' ');

  return (
    <div className="pr-matrix">
      {/* ── دسکتاپ ── */}
      <div className="pr-matrix__desktop">
        <table className="pr-matrix__table">
          <caption className="sr-only">مقایسهٔ قابلیت‌های اشتراک‌های تپش</caption>
          <thead>
            <tr>
              <th scope="col" className="pr-matrix__corner">
                قابلیت
              </th>
              {plans.map((plan) => {
                const isActive = plan.id === selectedPlanId;

                return (
                  <th
                    scope="col"
                    className={`pr-matrix__plan ${columnClass(plan.id)}`}
                    key={plan.id}
                    onPointerEnter={() => setHoveredPlanId(plan.id)}
                    onPointerLeave={() => setHoveredPlanId(null)}
                  >
                    <button
                      className="pr-matrix__plan-button"
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => onSelectPlan(plan.id)}
                    >
                      <span className="pr-matrix__plan-name">{plan.name}</span>
                      <span className="pr-matrix__plan-tagline">{plan.tagline}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="pr-matrix__row" key={row.id}>
                <th scope="row" className="pr-matrix__capability">
                  <span className="pr-matrix__capability-label">{row.label}</span>
                  <span className="pr-matrix__capability-hint">{row.hint}</span>
                </th>
                {plans.map((plan) => {
                  const coverage = coverageOf(row, plan.id);

                  return (
                    <td
                      className={`pr-matrix__cell is-${coverage.id} ${columnClass(plan.id)}`}
                      key={`${row.id}-${plan.id}`}
                    >
                      <span className="pr-matrix__mark" aria-hidden="true">
                        <CoverageMark coverage={coverage} />
                      </span>
                      <span className="pr-matrix__coverage">{coverage.label}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── موبایل: تک‌کارتی متمرکز با تب ── */}
      <div className="pr-matrix__mobile">
        <div className="pr-matrix__tabs" role="tablist" aria-label="انتخاب پلن برای مقایسه">
          {plans.map((plan) => {
            const isActive = plan.id === selectedPlanId;

            return (
              <button
                className={`pr-matrix__tab ${isActive ? 'is-active' : ''}`}
                type="button"
                role="tab"
                id={`pr-matrix-tab-${plan.id}`}
                aria-selected={isActive}
                aria-controls={`pr-matrix-panel-${plan.id}`}
                tabIndex={isActive ? 0 : -1}
                key={plan.id}
                onClick={() => onSelectPlan(plan.id)}
              >
                {plan.name}
              </button>
            );
          })}
        </div>

        {plans.map((plan) => {
          const isActive = plan.id === selectedPlanId;
          const fullCount = rows.filter((row) => coverageOf(row, plan.id).id === 'full').length;

          return (
            <div
              className="pr-matrix__panel"
              role="tabpanel"
              id={`pr-matrix-panel-${plan.id}`}
              aria-labelledby={`pr-matrix-tab-${plan.id}`}
              hidden={!isActive}
              key={plan.id}
            >
              <p className="pr-matrix__panel-summary">
                {toFa(fullCount)} قابلیت از {toFa(rows.length)} قابلیت، کامل در اشتراک {plan.name}
              </p>
              <ul className="pr-matrix__list">
                {rows.map((row) => {
                  const coverage = coverageOf(row, plan.id);

                  return (
                    <li className={`pr-matrix__item is-${coverage.id}`} key={row.id}>
                      <span className="pr-matrix__item-text">
                        <strong>{row.label}</strong>
                        <small>{row.hint}</small>
                      </span>
                      <span className="pr-matrix__item-mark">
                        <span aria-hidden="true">
                          <CoverageMark coverage={coverage} />
                        </span>
                        {coverage.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
