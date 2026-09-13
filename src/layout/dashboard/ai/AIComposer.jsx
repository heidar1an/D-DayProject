import { useEffect, useRef, useState } from 'react';
import {
  AI_MODES,
  AI_TOOLS,
  PRIMARY_TOOL_COUNT,
  MAX_INPUT_LENGTH,
  SendIcon,
  StopIcon,
  AttachIcon,
  ChevronDownIcon,
  PlusIcon,
  CloseIcon,
  FileIcon,
  toFaDigits,
} from './aiShared';

/* پاپ‌اور مشترک ابزارها/حالت‌ها — با کلیک بیرون یا Esc بسته می‌شود */
function usePopover() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return { open, setOpen, rootRef };
}

function AttachmentPreview({ attachments, onRemove }) {
  if (!attachments.length) return null;
  return (
    <div className="ai-composer__attachments">
      {attachments.map((attachment) => (
        <span key={attachment.id} className={`ai-attachment ${attachment.uploading ? 'ai-attachment--uploading' : ''}`}>
          {attachment.previewUrl ? (
            <img src={attachment.previewUrl} alt="" className="ai-attachment__thumb" />
          ) : (
            <FileIcon width={14} height={14} />
          )}
          <span className="ai-attachment__name">{attachment.name}</span>
          <button
            type="button"
            className="ai-attachment__remove"
            onClick={() => onRemove(attachment.id)}
            aria-label={`حذف پیوست ${attachment.name}`}
          >
            <CloseIcon width={12} height={12} />
          </button>
        </span>
      ))}
    </div>
  );
}

/*
 * Composer حرفه‌ای تپش: multi-line با auto-grow، Enter ارسال، Shift+Enter خط جدید،
 * Toolbar ابزارها (۳ تا + «ابزارها»)، انتخابگر حالت، پیوست و توقف استریم.
 */
export default function AIComposer({
  draft,
  onDraftChange,
  expanded,
  mode,
  status,
  attachments,
  placeholder,
  onSend,
  onStop,
  onSetMode,
  onAddAttachments,
  onRemoveAttachment,
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const toolsPopover = usePopover();
  const modePopover = usePopover();

  const isBusy = status === 'thinking' || status === 'streaming';
  const showCounter = draft.length > MAX_INPUT_LENGTH * 0.9;

  /* auto-grow — ارتفاع تا سقف مشخص رشد می‌کند و بعدش اسکرول داخلی می‌شود */
  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, expanded ? 180 : 120)}px`;
  };

  useEffect(resize, [draft, expanded]);

  const submit = () => {
    if (!draft.trim() || isBusy) return;
    onSend();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const applyTool = (tool) => {
    toolsPopover.setOpen(false);
    onDraftChange((current) => (current.trim() ? current : tool.template));
    textareaRef.current?.focus();
  };

  return (
    <div className={`ai-composer ${expanded ? 'ai-composer--expanded' : ''}`}>
      <AttachmentPreview attachments={attachments} onRemove={onRemoveAttachment} />

      <div className="ai-composer__box">
        <textarea
          ref={textareaRef}
          className="ai-composer__input"
          rows={1}
          value={draft}
          placeholder={placeholder}
          aria-label="پیام به تپش هوشمند"
          maxLength={MAX_INPUT_LENGTH}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />

        <div className="ai-composer__toolbar">
          <div className="ai-composer__tools" role="toolbar" aria-label="ابزارهای هوش مصنوعی">
            {AI_TOOLS.slice(0, PRIMARY_TOOL_COUNT).map((tool) => (
              <button
                key={tool.id}
                type="button"
                className="ai-tool-btn"
                onClick={() => applyTool(tool)}
              >
                {tool.label}
              </button>
            ))}

            <div className="ai-popover-anchor" ref={toolsPopover.rootRef}>
              <button
                type="button"
                className={`ai-tool-btn ${toolsPopover.open ? 'ai-tool-btn--active' : ''}`}
                onClick={() => toolsPopover.setOpen((v) => !v)}
                aria-expanded={toolsPopover.open}
                aria-haspopup="menu"
              >
                <PlusIcon width={14} height={14} />
                ابزارها
              </button>
              {toolsPopover.open ? (
                <div className="ai-popover" role="menu" aria-label="همهٔ ابزارها">
                  {AI_TOOLS.slice(PRIMARY_TOOL_COUNT).map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      role="menuitem"
                      className="ai-popover__item"
                      onClick={() => applyTool(tool)}
                    >
                      {tool.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="ai-composer__side">
            {showCounter ? (
              <span className="ai-composer__counter" aria-live="off">
                {toFaDigits(draft.length)} / {toFaDigits(MAX_INPUT_LENGTH)}
              </span>
            ) : null}

            <div className="ai-popover-anchor" ref={modePopover.rootRef}>
              <button
                type="button"
                className="ai-mode-btn"
                onClick={() => modePopover.setOpen((v) => !v)}
                aria-expanded={modePopover.open}
                aria-haspopup="menu"
                aria-label={`حالت فعلی: ${AI_MODES.find((m) => m.id === mode)?.label}`}
              >
                {AI_MODES.find((m) => m.id === mode)?.label}
                <ChevronDownIcon width={13} height={13} />
              </button>
              {modePopover.open ? (
                <div className="ai-popover ai-popover--start" role="menu" aria-label="انتخاب حالت">
                  {AI_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={m.id === mode}
                      className={`ai-popover__item ${m.id === mode ? 'ai-popover__item--selected' : ''}`}
                      onClick={() => {
                        onSetMode(m.id);
                        modePopover.setOpen(false);
                        textareaRef.current?.focus();
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="ai-icon-btn"
              onClick={() => fileInputRef.current?.click()}
              aria-label="افزودن پیوست"
            >
              <AttachIcon width={16} height={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              multiple
              accept="image/*,.pdf,.txt"
              onChange={(event) => {
                onAddAttachments(event.target.files);
                event.target.value = '';
              }}
            />

            {isBusy ? (
              <button
                type="button"
                className="ai-send-btn ai-send-btn--stop"
                onClick={onStop}
                aria-label="توقف تولید پاسخ"
              >
                <StopIcon width={15} height={15} />
              </button>
            ) : (
              <button
                type="button"
                className="ai-send-btn"
                onClick={submit}
                disabled={!draft.trim()}
                aria-label="ارسال پیام"
              >
                <SendIcon width={16} height={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
