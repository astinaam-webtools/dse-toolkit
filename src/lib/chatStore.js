import { loadDocument, registerLocalReader, saveDocument, uploadDocument } from './documentGateway.js';
import { getAiSettings, updateAiSettings } from './appSettings.js';

const CHAT_STORAGE_KEY = 'dse_toolkit_chat_threads_v1';

const nowIso = () => new Date().toISOString();

const createThreadId = () => `chat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const createEmptyState = () => ({
  version: 1,
  activeThreadId: null,
  selectedModel: 'auto',
  threads: []
});

const clone = (value) => JSON.parse(JSON.stringify(value));

const normalizeMessage = (message) => ({
  id: String(message?.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
  role: message?.role === 'assistant' ? 'assistant' : 'user',
  content: String(message?.content || ''),
  createdAt: String(message?.createdAt || nowIso()),
  meta: message?.meta && typeof message.meta === 'object' ? { ...message.meta } : null
});

const normalizeThread = (thread) => ({
  id: String(thread?.id || createThreadId()),
  title: String(thread?.title || 'New Chat'),
  context: thread?.context && typeof thread.context === 'object' ? { ...thread.context } : null,
  systemPrompt: String(thread?.systemPrompt || ''),
  createdAt: String(thread?.createdAt || nowIso()),
  updatedAt: String(thread?.updatedAt || nowIso()),
  lockedAutoModel: thread?.lockedAutoModel ? String(thread.lockedAutoModel) : '',
  messages: Array.isArray(thread?.messages) ? thread.messages.map(normalizeMessage) : []
});

const normalizeState = (state) => {
  const raw = state && typeof state === 'object' ? state : createEmptyState();
  const threads = Array.isArray(raw.threads) ? raw.threads.map(normalizeThread) : [];
  const fallbackId = threads[0]?.id || null;

  return {
    version: typeof raw.version === 'number' ? raw.version : 1,
    activeThreadId: raw.activeThreadId && threads.some((item) => item.id === raw.activeThreadId)
      ? raw.activeThreadId
      : fallbackId,
    selectedModel: String(raw.selectedModel || 'auto'),
    threads
  };
};

const readLocal = () => {
  const raw = localStorage.getItem(CHAT_STORAGE_KEY);
  if (!raw) {
    return createEmptyState();
  }

  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return createEmptyState();
  }
};

const writeLocal = (state) => {
  const normalized = normalizeState(state);
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
};

registerLocalReader('chat_threads', readLocal);

export const loadChatState = async () => {
  return loadDocument('chat_threads', {
    readLocal,
    createDefault: createEmptyState
  });
};

export const saveChatState = async (state) => saveDocument('chat_threads', state, { writeLocal });

export const uploadChatState = async (state) => uploadDocument('chat_threads', state);

export const getLocalChatState = () => readLocal();

export const ensureThread = (state, bootstrap = {}) => {
  const normalized = normalizeState(state);
  if (normalized.activeThreadId) {
    const existing = normalized.threads.find((item) => item.id === normalized.activeThreadId);
    if (existing) {
      return {
        state: normalized,
        thread: existing
      };
    }
  }

  const thread = normalizeThread({
    id: createThreadId(),
    title: bootstrap.title || 'New Chat',
    context: bootstrap.context || null,
    systemPrompt: bootstrap.systemPrompt || '',
    messages: bootstrap.messages || []
  });

  normalized.threads.unshift(thread);
  normalized.activeThreadId = thread.id;

  return {
    state: normalized,
    thread
  };
};

export const setActiveThread = (state, threadId) => {
  const next = normalizeState(state);
  if (next.threads.some((item) => item.id === threadId)) {
    next.activeThreadId = threadId;
  }
  return next;
};

export const updateSelectedServerModel = (selectedModel) => {
  const value = String(selectedModel || 'auto');
  updateAiSettings({
    serverPreferredModel: value,
    serverModelMode: value === 'auto' ? 'auto' : 'manual'
  });
};

export const getSelectedServerModel = () => {
  const ai = getAiSettings();
  return ai.serverPreferredModel || 'auto';
};

export const appendThreadMessage = (state, threadId, message) => {
  const next = normalizeState(state);
  next.threads = next.threads.map((thread) => {
    if (thread.id !== threadId) {
      return thread;
    }

    const messages = [...thread.messages, normalizeMessage(message)];
    const firstUser = messages.find((item) => item.role === 'user');

    return {
      ...thread,
      title: thread.title === 'New Chat' && firstUser?.content
        ? firstUser.content.slice(0, 42)
        : thread.title,
      updatedAt: nowIso(),
      messages
    };
  });

  return next;
};

export const setThreadLockedAutoModel = (state, threadId, modelId) => {
  const next = normalizeState(state);
  next.threads = next.threads.map((thread) =>
    thread.id === threadId
      ? {
          ...thread,
          lockedAutoModel: String(modelId || ''),
          updatedAt: nowIso()
        }
      : thread
  );

  return next;
};

export const clearThreadMessages = (state, threadId) => {
  const next = normalizeState(state);
  next.threads = next.threads.map((thread) =>
    thread.id === threadId
      ? {
          ...thread,
          messages: [],
          title: 'New Chat',
          lockedAutoModel: '',
          updatedAt: nowIso()
        }
      : thread
  );
  return next;
};

export const deleteThread = (state, threadId) => {
  const next = normalizeState(state);
  const remaining = next.threads.filter((thread) => thread.id !== threadId);

  next.threads = remaining;
  next.activeThreadId = remaining[0]?.id || null;

  return next;
};

export const createThread = (state, bootstrap = {}) => {
  const next = normalizeState(state);
  const thread = normalizeThread({
    id: createThreadId(),
    title: bootstrap.title || 'New Chat',
    context: bootstrap.context || null,
    systemPrompt: bootstrap.systemPrompt || '',
    messages: bootstrap.messages || []
  });

  next.threads.unshift(thread);
  next.activeThreadId = thread.id;

  return {
    state: next,
    thread
  };
};

export const snapshotThreadForRequest = (thread) => {
  const current = normalizeThread(thread);
  const messages = [];

  if (current.systemPrompt) {
    messages.push({ role: 'system', content: current.systemPrompt });
  }

  current.messages.forEach((item) => {
    if (!item.content) {
      return;
    }
    messages.push({ role: item.role, content: item.content });
  });

  return clone(messages);
};
