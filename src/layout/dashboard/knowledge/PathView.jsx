/* ── Path View — دو مسیر در یک نما ──
   ۱) «مسیر مفهومی»: کوتاه‌ترین مسیر بین دو مفهوم دلخواه (BFS روی گراف واقعی)
   ۲) «مسیر مطالعه»: توالی پیش‌نیازهای یک مفهوم هدف
   هر گام با برچسب علمی رابطه و قابلیت پرش به موضوع. */

import { useMemo, useState } from 'react';
import {
  findConceptPath,
  getLearningPath,
  courseAccent,
  nodeStatus,
  statusLabel,
} from '../../../services/knowledge/knowledgeService';
import { relationLabel, SHOWCASE_CHAIN } from '../../../services/knowledge/graphData';
import { NodeGlyph, TypeBadge, KnButton, EmptyState, faCount } from './knowledgeShared';
import { SwapIcon, EnterIcon } from './knowledgeIcons';
import { NodePicker } from './KnowledgeSearchBar';

const DEFAULT_FROM = SHOWCASE_CHAIN[0];
const DEFAULT_TO = SHOWCASE_CHAIN[SHOWCASE_CHAIN.length - 1];

export default function PathView({ onOpenNode, onEnterTopic, progressMap }) {
  const [fromId, setFromId] = useState(DEFAULT_FROM);
  const [toId, setToId] = useState(DEFAULT_TO);
  const [tab, setTab] = useState('concept'); /* concept | study */

  const steps = useMemo(() => (fromId && toId ? findConceptPath(fromId, toId) : []), [fromId, toId]);
  const studyPath = useMemo(() => (toId ? getLearningPath(toId) : null), [toId]);

  return (
    <div className="kn-paths">
      <div className="kn-paths__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'concept'}
          className={`kn-paths__tab ${tab === 'concept' ? 'is-active' : ''}`}
          onClick={() => setTab('concept')}
        >
          مسیر مفهومی
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'study'}
          className={`kn-paths__tab ${tab === 'study' ? 'is-active' : ''}`}
          onClick={() => setTab('study')}
        >
          مسیر مطالعه
        </button>
      </div>

      {tab === 'concept' ? (
        <section className="kn-paths__panel" aria-label="مسیر مفهومی بین دو مفهوم">
          <div className="kn-paths__pickers">
            <NodePicker label="از مفهوم" value={fromId} onChange={setFromId} />
            <button
              type="button"
              className="kn-paths__swap"
              aria-label="جابه‌جایی مبدأ و مقصد"
              onClick={() => {
                setFromId(toId);
                setToId(fromId);
              }}
            >
              <SwapIcon />
            </button>
            <NodePicker label="تا مفهوم" value={toId} onChange={setToId} />
          </div>

          {steps.length === 0 ? (
            <EmptyState
              title="مسیری بین این دو مفهوم پیدا نشد"
              description="در شبکهٔ فعلی این دو مفهوم به هم وصل نیستند؛ یک سر مسیر را عوض کنید."
            />
          ) : (
            <ol className="kn-path">
              {steps.map((step, index) => {
                const next = steps[index + 1];
                return (
                  <li key={`${step.node.id}-${index}`}>
                    <PathStep node={step.node} progressMap={progressMap} onOpenNode={onOpenNode} onEnterTopic={onEnterTopic} />
                    {next ? (
                      <div className="kn-path__link" aria-label={relationLabel(next.edge.type)}>
                        <span>{next.direction === 'out' ? relationLabel(next.edge.type) : relationLabel(next.edge.type)}</span>
                        <i aria-hidden="true">↓</i>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
          <p className="kn-paths__note">
            مسیر روی گراف واقعی مفاهیم پیدا می‌شود؛ با گسترش شبکه، مسیرهای کوتاه‌تر و معنادارتر خواهند شد.
          </p>
        </section>
      ) : (
        <section className="kn-paths__panel" aria-label="مسیر مطالعه یک مفهوم">
          <div className="kn-paths__pickers">
            <NodePicker label="می‌خواهم این را بفهمم:" value={toId} onChange={setToId} />
          </div>

          {studyPath && studyPath.steps.length > 1 ? (
            <ol className="kn-lpath kn-lpath--wide">
              {studyPath.steps.map((step) => (
                <li key={step.node.id} className={step.isTarget ? 'is-target' : ''}>
                  <button type="button" onClick={() => onOpenNode?.(step.node.id)}>
                    <span className="kn-lpath__num">{faCount(step.order)}</span>
                    <span className="kn-lpath__title">
                      <strong>{step.node.title}</strong>
                      {step.feedsInto.length > 0 ? (
                        <small>پایهٔ فهم: {step.feedsInto.map((feed) => feed.title).join('، ')}</small>
                      ) : (
                        <small>{statusLabel(nodeStatus(progressMap, step.node.id))}</small>
                      )}
                    </span>
                    <span className="kn-lpath__type">
                      <TypeBadge type={step.node.type} />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="این مفهوم پیش‌نیاز خاصی ندارد" description="می‌توانید مستقیم سراغ مطالعهٔ آن بروید." />
          )}
          <p className="kn-paths__note">
            ترتیب مطالعه از وابستگی واقعی مفاهیم ساخته می‌شود، نه فهرست فصل‌های کتاب.
          </p>
        </section>
      )}
    </div>
  );
}

function PathStep({ node, progressMap, onOpenNode, onEnterTopic }) {
  const accent = courseAccent(node.courses?.[0]);
  return (
    <div className="kn-path__step" style={{ '--accent': accent }}>
      <span className="kn-path__glyph" style={{ '--accent': accent }}>
        <NodeGlyph type={node.type} size={17} />
      </span>
      <div className="kn-path__text">
        <strong>{node.title}</strong>
        <small dir="ltr">{node.englishTitle}</small>
      </div>
      <div className="kn-path__actions">
        <KnButton icon={<EnterIcon />} onClick={() => onEnterTopic?.(node.id)}>
          موضوع
        </KnButton>
      </div>
    </div>
  );
}
