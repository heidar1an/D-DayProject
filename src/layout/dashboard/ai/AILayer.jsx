import { useEffect, useMemo, useRef, useState } from 'react';
import AIComposer from './AIComposer';
import AIConversation from './AIConversation';
import { useAIConversation, getSavedConversations } from './aiStore';
import { LAYER_IDS, useLayerRoute } from '../dashboardRoute';
import { SparkIcon, BookmarkIcon, PlusIcon, CloseIcon, SendIcon, toFaDigits } from './aiShared';
import './ai.css';

const faDate = (timestamp) =>
  new Date(timestamp).toLocaleDateString('fa-IR', { month: 'long', day: 'numeric' });

/* گفت‌وگوی فعال روی مسیر داشبورد می‌نشیند تا رفرش همان گفت‌وگو را برگرداند */
const AI_LAYER_VIEW = { conversationId: null };

/*
 * لایهٔ «تپش هوشمند» — چیدمان سه‌بخشی:
 *   ستون راست  → فهرست گفت‌وگوهای انجام‌شده (بازیابی/حذف)
 *   ستون اصلی  → متن گفت‌وگو
 *   پایینِ وسط → کادر نوشتن پیام
 */
export default function AILayer({ onBack }) {
  const ai = useAIConversation();
  const [view, , patchView] = useLayerRoute(LAYER_IDS.ai, AI_LAYER_VIEW);
  const activeConversationId = view.conversationId;
  const [draft, setDraft] = useState('');
  const [conversations, setConversations] = useState(() => getSavedConversations());
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedTimer = useRef(null);
  const composerRef = useRef(null);

  const hasMessages = ai.messages.length > 0;

  const refreshConversations = () => setConversations(getSavedConversations());

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    return () => {
      clearTimeout(savedTimer.current);
    };
  }, []);

  /* رفرش روی گفت‌وگوی ذخیره‌شده: گفت‌وگو از حافظهٔ محلی بازخوانی می‌شود */
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (!view.conversationId || ai.messages.length > 0) return;
    if (!ai.loadConversation(view.conversationId)) patchView({ conversationId: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    composerRef.current?.querySelector('textarea')?.focus();
  }, []);

  const handleSend = () => {
    ai.send(draft);
    setDraft('');
  };

  const handleSave = () => {
    if (!hasMessages) return;
    const savedId = ai.saveConversation();
    if (savedId) {
      patchView({ conversationId: savedId });
      refreshConversations();
      setSavedFlash(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSavedFlash(false), 1800);
    }
  };

  const handleNewConversation = () => {
    ai.reset();
    setDraft('');
    patchView({ conversationId: null });
    setIsHistoryOpen(false);
    composerRef.current?.querySelector('textarea')?.focus();
  };

  const handleOpenConversation = (conversationId) => {
    if (ai.loadConversation(conversationId)) {
      patchView({ conversationId });
      setDraft('');
      setIsHistoryOpen(false);
      composerRef.current?.querySelector('textarea')?.focus();
    }
  };

  const handleDeleteConversation = (conversationId) => {
    ai.deleteConversation(conversationId);
    if (conversationId === activeConversationId) patchView({ conversationId: null });
    refreshConversations();
  };

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  const historyList = (
    <ul className="ai-layer__history-list">
      {conversations.length === 0 ? (
        <li className="ai-layer__history-empty">
          هنوز گفت‌وگویی ذخیره نکرده‌ای. بعد از هر گفت‌وگو دکمهٔ «ذخیرهٔ گفت‌وگو» را بزن تا همین‌جا بماند.
        </li>
      ) : (
        conversations.map((conversation) => (
          <li
            key={conversation.id}
            className={`ai-layer__history-item ${conversation.id === activeConversationId ? 'is-active' : ''}`}
          >
            <button
              type="button"
              className="ai-layer__history-open"
              onClick={() => handleOpenConversation(conversation.id)}
              aria-current={conversation.id === activeConversationId ? 'true' : undefined}
            >
              <span className="ai-layer__history-title">{conversation.title}</span>
              <span className="ai-layer__history-meta">
                {toFaDigits(conversation.messages?.length ?? 0)} پیام · {faDate(conversation.savedAt)}
              </span>
            </button>
            <button
              type="button"
              className="ai-layer__history-delete"
              onClick={() => handleDeleteConversation(conversation.id)}
              aria-label={`حذف گفت‌وگوی ${conversation.title}`}
            >
              <CloseIcon width={13} height={13} />
            </button>
          </li>
        ))
      )}
    </ul>
  );

  return (
    <section dir="rtl" className="ai-layer" aria-label="تپش هوشمند">
      <header className="ai-layer__topbar">
        <div className="ai-layer__identity">
          <span className="ai-card__badge" aria-hidden="true">
            <SparkIcon width={18} height={18} />
          </span>
          <div>
            <h1>تپش هوشمند</h1>
            <p>
              {activeConversation
                ? `در حال مشاهدهٔ «${activeConversation.title}»`
                : 'همراه مطالعه‌ات برای فهم بهتر، مرور سریع و سؤال‌های پزشکی'}
            </p>
          </div>
        </div>

        <div className="ai-layer__top-actions">
          <button
            type="button"
            className="ai-card__ghost-btn ai-layer__history-toggle"
            onClick={() => setIsHistoryOpen((open) => !open)}
            aria-expanded={isHistoryOpen}
          >
            گفت‌وگوهای انجام‌شده
            {conversations.length ? ` (${toFaDigits(conversations.length)})` : ''}
          </button>

          {hasMessages ? (
            <button
              type="button"
              className={`ai-card__ghost-btn ${savedFlash ? 'ai-card__ghost-btn--flash' : ''}`}
              onClick={handleSave}
            >
              <BookmarkIcon width={13} height={13} filled={savedFlash} />
              {savedFlash ? 'ذخیره شد' : 'ذخیرهٔ گفت‌وگو'}
            </button>
          ) : null}

          {hasMessages ? (
            <button type="button" className="ai-card__ghost-btn" onClick={handleNewConversation}>
              گفت‌وگوی جدید
            </button>
          ) : null}

          <button type="button" className="ai-layer__back" onClick={onBack}>
            بازگشت به سایر بخش‌ها <SendIcon width={15} height={15} />
          </button>
        </div>
      </header>

      <div className="ai-layer__workspace">
        {/* ستون سمت راست — گفت‌وگوهای انجام‌شده */}
        <aside className={`ai-layer__history ${isHistoryOpen ? 'is-open' : ''}`} aria-label="گفت‌وگوهای انجام‌شده">
          <div className="ai-layer__history-head">
            <div>
              <h2>گفت‌وگوهای انجام‌شده</h2>
              <span>
                {conversations.length ? `${toFaDigits(conversations.length)} گفت‌وگوی ذخیره‌شده` : 'خالی'}
              </span>
            </div>
            <button
              type="button"
              className="ai-layer__history-new"
              onClick={handleNewConversation}
              aria-label="گفت‌وگوی جدید"
            >
              <PlusIcon width={13} height={13} />
              جدید
            </button>
          </div>
          {historyList}
        </aside>

        {/* ستون اصلی — متن گفت‌وگو + کادر نوشتن در پایینِ وسط */}
        <div className="ai-layer__conversation-panel">
          {hasMessages ? (
            <AIConversation
              messages={ai.messages}
              onRegenerate={ai.regenerate}
              onFeedback={ai.setMessageAction}
              onToggleSaved={ai.toggleSaved}
              onFollowUp={ai.send}
            />
          ) : (
            <div className="ai-layer__welcome">
              <span className="ai-layer__welcome-symbol" aria-hidden="true">
                <SparkIcon width={29} height={29} />
              </span>
              <h2>چه چیزی می‌خواهی یاد بگیری؟</h2>
              <p>سؤال بپرس، مفهوم بگیر، تست و فلش‌کارت بساز — همه‌چیز همین‌جا.</p>
              <div className="ai-layer__quick-actions">
                {['این مبحث را ساده توضیح بده', 'از این درس برایم تست بساز', 'یک برنامه مطالعه پیشنهاد بده'].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="ai-chip"
                    onClick={() => {
                      setDraft(prompt);
                      composerRef.current?.querySelector('textarea')?.focus();
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="ai-layer__composer" ref={composerRef}>
            <AIComposer
              draft={draft}
              onDraftChange={setDraft}
              expanded
              mode={ai.mode}
              status={ai.status}
              attachments={ai.attachments}
              placeholder={
                {
                  general: 'هر چیزی می‌خواهی بپرس...',
                  study: 'برای مطالعه چه کمکی بخواهی؟',
                  medical: 'چه مفهوم پزشکی‌ای را توضیح بدهم؟',
                  quiz: 'سؤال یا مبحث تست را بنویس...',
                }[ai.mode] ?? 'هر چیزی می‌خواهی بپرس...'
              }
              onSend={handleSend}
              onStop={ai.stop}
              onSetMode={ai.setMode}
              onAddAttachments={ai.addAttachments}
              onRemoveAttachment={ai.removeAttachment}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
