/*
 * هستهٔ مشترک گفت‌وگوی هوشمند تپش.
 *
 * استور در سطح ماژول است (نه state کامپوننت) تا:
 *  ۱. مکالمه با جابه‌جایی بین بخش‌های داشبورد از دست نرود؛
 *  ۲. فردا «صفحهٔ کامل AI» بدون کپی یک خط، همین مکالمه را نشان دهد —
 *     AICard و صفحهٔ کامل فقط دو مصرف‌کنندهٔ یک استور هستند (معماری مشترک).
 *
 * چرخهٔ پیام: user → assistant(status: thinking → streaming → done | error)
 */

import { useCallback, useSyncExternalStore } from 'react';
import * as aiService from '../../../services/ai/aiService';
import { getAIContext } from '../../../services/ai/aiContext';

const listeners = new Set();

let state = {
  messages: [], /* [{ id, role, text, status?, attachments?, feedback?, createdAt }] */
  status: 'idle', /* idle | thinking | streaming */
  mode: 'general',
  attachments: [], /* پیوست‌های آمادهٔ پیام بعدی */
  error: null,
};

let controller = null;
let uid = 0;

/* گفت‌وگوی ذخیره‌شدهٔ فعلی — با اولین ذخیره ساخته می‌شود تا ذخیرهٔ دوباره همان گفت‌وگو، رکورد جدید نسازد */
let currentConversationId = null;

const SAVED_CONVERSATIONS_KEY = 'tapesh:ai:conversations:v1';
const MAX_SAVED_CONVERSATIONS = 30;

function readSavedConversations() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_CONVERSATIONS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

function setState(patch) {
  state = { ...state, ...patch };
  emit();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function patchMessage(messageId, patch) {
  setState({
    messages: state.messages.map((message) =>
      message.id === messageId ? { ...message, ...patch } : message
    ),
  });
}

const lastUserMessage = () => [...state.messages].reverse().find((message) => message.role === 'user');

/* درخواست مدل برای آخرین پیام کاربر؛ هم ارسال و هم regenerate از اینجا می‌گذرد */
async function requestAnswer({ userText, attachments, history }) {
  const assistantId = `a${++uid}`;
  setState({
    messages: [
      ...state.messages,
      { id: assistantId, role: 'assistant', text: '', status: 'thinking', createdAt: Date.now() },
    ],
    status: 'thinking',
    error: null,
  });

  controller = new AbortController();

  const updateChunk = (fullText) => {
    patchMessage(assistantId, { text: fullText, status: 'streaming' });
    if (state.status !== 'streaming') setState({ status: 'streaming' });
  };

  try {
    const finalText = await aiService.sendMessage({
      text: userText,
      attachments,
      mode: state.mode,
      context: getAIContext(),
      history,
      signal: controller.signal,
      onChunk: updateChunk,
    });
    patchMessage(assistantId, { text: finalText, status: 'done' });
    setState({ status: 'idle' });
  } catch (error) {
    const partial = state.messages.find((message) => message.id === assistantId)?.text;
    if (error?.name === 'AbortError') {
      /* کاربر تولید را متوقف کرد — همان‌قدر که آمده بود می‌ماند */
      patchMessage(assistantId, {
        text: partial ? `${partial} …` : '',
        status: 'done',
        stopped: !partial,
      });
      setState({ status: 'idle' });
      return;
    }
    patchMessage(assistantId, { status: 'error' });
    setState({ status: 'idle', error: error });
  } finally {
    controller = null;
  }
}

export function sendAIMessage(text) {
  const trimmed = (text ?? '').trim();
  if (!trimmed || state.status !== 'idle') return;

  const attachments = state.attachments;
  setState({
    attachments: [],
    messages: [
      ...state.messages,
      {
        id: `u${++uid}`,
        role: 'user',
        text: trimmed,
        attachments,
        createdAt: Date.now(),
      },
    ],
  });

  const history = state.messages
    .filter((message) => message.status !== 'error')
    .slice(0, -1)
    .map(({ role, text: messageText }) => ({ role, text: messageText }));

  requestAnswer({ userText: trimmed, attachments, history });
}

export function regenerateAIMessage() {
  if (state.status !== 'idle') return;
  const userMessage = lastUserMessage();
  if (!userMessage) return;

  /* پاسخ قبلی حذف می‌شود و همان درخواست دوباره زده می‌شود */
  const messages = [...state.messages];
  const last = messages[messages.length - 1];
  if (last?.role === 'assistant') messages.pop();
  setState({ messages });

  const history = messages
    .filter((message) => message.status !== 'error')
    .slice(0, -1)
    .map(({ role, text }) => ({ role, text }));

  requestAnswer({
    userText: userMessage.text,
    attachments: userMessage.attachments,
    history,
  });
}

export function stopAIStreaming() {
  controller?.abort();
}

export function retryAIMessage() {
  if (state.status !== 'idle') return;
  /* خطا در همان حباب می‌ماند؛ فقط دوباره درخواست می‌زنیم */
  regenerateAIMessage();
}

export function setAIMode(mode) {
  setState({ mode });
}

export async function addAIAttachments(fileList) {
  const files = Array.from(fileList ?? []);
  if (!files.length) return;

  const placeholders = files.map((file) => ({
    id: `pending-${Math.random().toString(36).slice(2)}`,
    name: file.name,
    type: file.type || 'file',
    size: file.size,
    previewUrl: null,
    uploading: true,
  }));
  setState({ attachments: [...state.attachments, ...placeholders] });

  await Promise.all(
    placeholders.map(async (placeholder, index) => {
      try {
        const uploaded = await aiService.uploadAttachment(files[index]);
        setState({
          attachments: state.attachments.map((attachment) =>
            attachment.id === placeholder.id ? { ...uploaded, uploading: false } : attachment
          ),
        });
      } catch {
        removeAIAttachment(placeholder.id);
      }
    })
  );
}

export function removeAIAttachment(attachmentId) {
  setState({ attachments: state.attachments.filter((attachment) => attachment.id !== attachmentId) });
}

/* بازخورد و ذخیرهٔ پیام — فعلاً محلی؛ بعداً به Analytics/Backend وصل می‌شود */
export function setMessageFeedback(messageId, feedback) {
  patchMessage(messageId, {
    feedback: state.messages.find((message) => message.id === messageId)?.feedback === feedback
      ? null
      : feedback,
  });
}

export function toggleSavedMessage(messageId) {
  const message = state.messages.find((item) => item.id === messageId);
  if (!message) return;

  const saved = !message.saved;
  patchMessage(messageId, { saved });

  try {
    const SAVED_KEY = 'tapesh:ai:saved-messages';
    const current = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]');
    const next = saved
      ? [...current, { id: messageId, text: message.text, savedAt: Date.now() }]
      : current.filter((item) => item.id !== messageId);
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  } catch {
    /* حافظه در دسترس نیست؛ UI به حالت خودش ادامه می‌دهد */
  }
}

export function resetAIConversation() {
  controller?.abort();
  currentConversationId = null;
  setState({ messages: [], status: 'idle', attachments: [], error: null });
}

/* ── ذخیره و بازیابی گفت‌وگوها (localStorage) ─────────────────────────────── */

export function saveAIConversation() {
  const messages = state.messages.filter((message) => message.status !== 'error');
  if (!messages.length) return null;

  if (!currentConversationId) currentConversationId = `conv-${Date.now()}`;
  const title = (messages.find((message) => message.role === 'user')?.text ?? 'گفت‌وگوی بی‌عنوان').slice(0, 60);

  const entry = {
    id: currentConversationId,
    title,
    mode: state.mode,
    messages,
    savedAt: Date.now(),
  };

  const rest = readSavedConversations().filter((conversation) => conversation.id !== entry.id);
  try {
    localStorage.setItem(SAVED_CONVERSATIONS_KEY, JSON.stringify([entry, ...rest].slice(0, MAX_SAVED_CONVERSATIONS)));
  } catch {
    return null; /* حافظه پر یا در دسترس نیست */
  }
  return entry.id;
}

export function getSavedConversations() {
  return readSavedConversations();
}

export function loadSavedConversation(conversationId) {
  const conversation = readSavedConversations().find((item) => item.id === conversationId);
  if (!conversation) return false;

  controller?.abort();
  currentConversationId = conversation.id;
  setState({
    messages: conversation.messages ?? [],
    status: 'idle',
    mode: conversation.mode ?? 'general',
    attachments: [],
    error: null,
  });
  return true;
}

export function deleteSavedConversation(conversationId) {
  try {
    const rest = readSavedConversations().filter((conversation) => conversation.id !== conversationId);
    localStorage.setItem(SAVED_CONVERSATIONS_KEY, JSON.stringify(rest));
  } catch {
    /* بی‌صدا رد می‌شویم */
  }
}

/* ── هوک مصرف‌کننده ───────────────────────────────────────────────────────── */

export function useAIConversation() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state);

  const send = useCallback(sendAIMessage, []);
  const stop = useCallback(stopAIStreaming, []);
  const regenerate = useCallback(regenerateAIMessage, []);
  const retry = useCallback(retryAIMessage, []);
  const reset = useCallback(resetAIConversation, []);
  const setMode = useCallback(setAIMode, []);
  const addAttachments = useCallback(addAIAttachments, []);
  const removeAttachment = useCallback(removeAIAttachment, []);
  const setMessageAction = useCallback(setMessageFeedback, []);
  const toggleSaved = useCallback(toggleSavedMessage, []);
  const saveConversation = useCallback(saveAIConversation, []);
  const loadConversation = useCallback(loadSavedConversation, []);
  const deleteConversation = useCallback(deleteSavedConversation, []);

  return {
    ...snapshot,
    send,
    stop,
    regenerate,
    retry,
    reset,
    setMode,
    addAttachments,
    removeAttachment,
    setMessageAction,
    toggleSaved,
    saveConversation,
    loadConversation,
    deleteConversation,
  };
}
