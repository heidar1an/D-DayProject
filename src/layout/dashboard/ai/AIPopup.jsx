import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AIComposer from './AIComposer';
import AIConversation from './AIConversation';
import { useAIConversation, getSavedConversations } from './aiStore';
import { SparkIcon, BookmarkIcon, ListIcon, CloseIcon, toFaDigits } from './aiShared';

const faDate = (timestamp) =>
  new Date(timestamp).toLocaleDateString('fa-IR', { month: 'long', day: 'numeric' });

/* پنل فهرست گفت‌وگوهای ذخیره‌شده — بازیابی و حذف */
function SavedConversationsPanel({ onLoad, onDelete, onClose }) {
  const [conversations, setConversations] = useState(() => getSavedConversations());

  const remove = (id) => {
    onDelete(id);
    setConversations(getSavedConversations());
  };

  return (
    <div className="ai-popup__saved">
      <div className="ai-popup__saved-head">
        <h3>گفت‌وگوهای ذخیره‌شده</h3>
        <button type="button" className="ai-icon-btn" onClick={onClose} aria-label="بستن فهرست">
          <CloseIcon width={14} height={14} />
        </button>
      </div>

      {conversations.length === 0 ? (
        <p className="ai-popup__saved-empty">هنوز گفت‌وگویی ذخیره نکرده‌ای.</p>
      ) : (
        <ul className="ai-popup__saved-list">
          {conversations.map((conversation) => (
            <li key={conversation.id} className="ai-saved-item">
              <button type="button" className="ai-saved-item__main" onClick={() => onLoad(conversation.id)}>
                <span className="ai-saved-item__title">{conversation.title}</span>
                <span className="ai-saved-item__meta">
                  {toFaDigits(conversation.messages?.length ?? 0)} پیام · {faDate(conversation.savedAt)}
                </span>
              </button>
              <button
                type="button"
                className="ai-icon-btn"
                onClick={() => remove(conversation.id)}
                aria-label={`حذف گفت‌وگوی ${conversation.title}`}
              >
                <CloseIcon width={14} height={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/*
 * پاپ‌آپ گفت‌وگو با تپش هوشمند — وقتی کاربر می‌خواهد بنویسد، به‌جای باز شدن داخل کارت،
 * یک پنل شناور روی همان صفحه باز می‌شود (بدون جابه‌جایی به صفحهٔ دیگر).
 * فوکوس ابتدا به Composer می‌رود، Esc/کلیک بیرون می‌بندد و فوکوس به کارت برمی‌گردد.
 */
export default function AIPopup({ draft, onDraftChange, onClose }) {
  const ai = useAIConversation();
  const dialogRef = useRef(null);
  const textareaRef = useRef(null);
  const [savedPanelOpen, setSavedPanelOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedTimer = useRef(null);

  const hasMessages = ai.messages.length > 0;

  /* فوکوس اولیه روی Composer + قفل اسکرول پس‌زمینه */
  useEffect(() => {
    textareaRef.current?.querySelector('textarea')?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      clearTimeout(savedTimer.current);
    };
  }, []);

  const close = () => {
    setSavedPanelOpen(false);
    onClose();
  };

  /* Esc می‌بندد (اگر پاپ‌اور ابزار/حالت باز نباشد)؛ Tab داخل دیالوگ می‌چرخد */
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      if (dialogRef.current?.querySelector('.ai-popover')) return; /* اول پاپ‌اور بسته می‌شود */
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === 'Tab') {
      const focusables = dialogRef.current?.querySelectorAll(
        'button, textarea, [href], input, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  const handleSend = () => {
    ai.send(draft);
    onDraftChange('');
  };

  const handleSave = () => {
    if (!hasMessages) return;
    if (ai.saveConversation()) {
      setSavedFlash(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSavedFlash(false), 1800);
    }
  };

  const handleLoadConversation = (conversationId) => {
    ai.loadConversation(conversationId);
    setSavedPanelOpen(false);
  };

  const handleFollowUp = (prompt) => {
    ai.send(prompt);
  };

  return createPortal(
    <div
      className="ai-popup-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="ai-popup"
        role="dialog"
        aria-modal="true"
        aria-label="گفت‌وگو با تپش هوشمند"
        ref={dialogRef}
        onKeyDown={handleKeyDown}
      >
        <header className="ai-popup__head">
          <span className="ai-card__badge" aria-hidden="true">
            <SparkIcon width={16} height={16} />
          </span>
          <h2 className="ai-popup__title">تپش هوشمند</h2>

          <div className="ai-popup__actions">
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
            <button
              type="button"
              className="ai-card__ghost-btn"
              onClick={() => setSavedPanelOpen((open) => !open)}
              aria-expanded={savedPanelOpen}
            >
              <ListIcon width={13} height={13} />
              ذخیره‌شده‌ها
            </button>
            {hasMessages ? (
              <button
                type="button"
                className="ai-card__ghost-btn"
                onClick={() => {
                  ai.reset();
                  onDraftChange('');
                }}
              >
                گفت‌وگوی جدید
              </button>
            ) : null}
            <button type="button" className="ai-icon-btn" onClick={close} aria-label="بستن گفت‌وگو">
              <CloseIcon width={16} height={16} />
            </button>
          </div>
        </header>

        {savedPanelOpen ? (
          <SavedConversationsPanel
            onLoad={handleLoadConversation}
            onDelete={ai.deleteConversation}
            onClose={() => setSavedPanelOpen(false)}
          />
        ) : null}

        {hasMessages ? (
          <AIConversation
            messages={ai.messages}
            onRegenerate={ai.regenerate}
            onFeedback={ai.setMessageAction}
            onToggleSaved={ai.toggleSaved}
            onFollowUp={handleFollowUp}
          />
        ) : (
          <div className="ai-popup__welcome">
            <p className="ai-popup__welcome-title">چه چیزی می‌خواهی یاد بگیری؟</p>
            <p className="ai-popup__welcome-sub">
              سؤال بپرس، مفهوم بگیر، تست و فلش‌کارت بساز — همه‌چیز همین‌جا.
            </p>
          </div>
        )}

        <div className="ai-popup__composer" ref={textareaRef}>
          <AIComposer
            draft={draft}
            onDraftChange={onDraftChange}
            expanded
            mode={ai.mode}
            status={ai.status}
            attachments={ai.attachments}
            placeholder={
              { general: 'هر چیزی می‌خواهی بپرس...', study: 'برای مطالعه چه کمکی بخواهی؟', medical: 'چه مفهوم پزشکی‌ای را توضیح بدهم؟', quiz: 'سؤال یا مبحث تست را بنویس...' }[ai.mode] ??
              'هر چیزی می‌خواهی بپرس...'
            }
            onSend={handleSend}
            onStop={ai.stop}
            onSetMode={ai.setMode}
            onAddAttachments={ai.addAttachments}
            onRemoveAttachment={ai.removeAttachment}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
