import { getAiSettings, getAppSettings, updateAiSettings } from './lib/appSettings.js';
import { flushPendingSync, getConnectionState, getSession } from './lib/documentGateway.js';
import { getServerAiModels, requestServerAiChat } from './lib/serverClient.js';
import {
  appendThreadMessage,
  clearThreadMessages,
  createThread,
  deleteThread,
  ensureThread,
  getLocalChatState,
  getSelectedServerModel,
  loadChatState,
  saveChatState,
  setActiveThread,
  setThreadLockedAutoModel,
  snapshotThreadForRequest,
  updateSelectedServerModel,
  uploadChatState
} from './lib/chatStore.js';
import {
  buildStockAnalysisPrompt,
  getStockBySymbol,
  loadMarketDataset
} from './lib/chatPrompts.js';

const els = {
  back: document.getElementById('chat-back'),
  newThread: document.getElementById('chat-new-thread'),
  syncState: document.getElementById('chat-sync-state'),
  threadList: document.getElementById('chat-thread-list'),
  modelSelect: document.getElementById('chat-model-select'),
  clearThread: document.getElementById('chat-clear-thread'),
  deleteThread: document.getElementById('chat-delete-thread'),
  feed: document.getElementById('chat-feed'),
  composer: document.getElementById('chat-composer'),
  input: document.getElementById('chat-input'),
  send: document.getElementById('chat-send')
};

const route = new URL(window.location.href);
const qs = route.searchParams;

const state = {
  chat: getLocalChatState(),
  serverModels: [],
  loading: false,
  pendingAssistantThreadId: null,
  bootstrap: null,
  lastMeta: null
};

const formatTime = (value) => {
  if (!value) {
    return '';
  }

  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const escapeHtml = (value) =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const renderMarkdown = (text) => {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/^### (.*$)/gim, '<h4>$1</h4>')
    .replace(/^## (.*$)/gim, '<h3>$1</h3>')
    .replace(/^# (.*$)/gim, '<h2>$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
};

const getActiveThread = () =>
  state.chat.threads.find((thread) => thread.id === state.chat.activeThreadId) || null;

const parseBootstrapContext = async () => {
  const symbol = (qs.get('symbol') || '').trim().toUpperCase();
  if (!symbol) {
    return null;
  }

  const dataset = await loadMarketDataset();
  const stock = getStockBySymbol(dataset, symbol);
  if (!stock) {
    return null;
  }

  const source = qs.get('source') || 'market';
  const title = `${stock.symbol} Analysis`;
  const systemPrompt = buildStockAnalysisPrompt(stock);

  return {
    title,
    context: {
      symbol: stock.symbol,
      source,
      stockName: stock.name
    },
    systemPrompt,
    seedMessage: `Start a fresh analysis for ${stock.symbol} (${stock.name}).`
  };
};

const renderSyncState = async () => {
  const appSettings = getAppSettings();
  if (!appSettings.serverUrl) {
    els.syncState.textContent = 'Client-only mode: chat saved locally.';
    return;
  }

  try {
    const conn = await getConnectionState();
    if (conn.code === 'connected' || conn.code === 'pending-sync') {
      els.syncState.textContent = 'Server connected: chat sync enabled.';
    } else if (conn.code === 'login-required') {
      els.syncState.textContent = 'Server set: login required for chat sync.';
    } else {
      els.syncState.textContent = 'Server unavailable: changes queued locally.';
    }
  } catch {
    els.syncState.textContent = 'Server unavailable: changes queued locally.';
  }
};

const persist = async () => {
  state.chat = await saveChatState(state.chat);
  await renderSyncState();
};

const renderMeta = () => {};

const renderThreadList = () => {
  const activeId = state.chat.activeThreadId;
  const html = state.chat.threads
    .map((thread) => {
      const activeClass = thread.id === activeId ? 'active' : '';
      return `
        <button class="thread-item ${activeClass}" data-thread-id="${thread.id}" type="button">
          <span class="thread-item__title">${escapeHtml(thread.title || 'New Chat')}</span>
          <span class="thread-item__meta">${escapeHtml(formatTime(thread.updatedAt))}</span>
        </button>
      `;
    })
    .join('');

  els.threadList.innerHTML = html || '<div class="status-note">No chat thread yet.</div>';
};

const renderFeed = () => {
  const thread = getActiveThread();
  if (!thread) {
    els.feed.innerHTML = '<div class="bubble bubble-system">Start a thread to begin AI chat.</div>';
    return;
  }

  if (!thread.messages.length) {
    els.feed.innerHTML = '<div class="bubble bubble-system">No messages yet. Ask your first question.</div>';
    return;
  }

  const html = thread.messages
    .map((message) => {
      const cls = message.role === 'assistant' ? 'bubble-assistant' : 'bubble-user';
      const body = message.role === 'assistant' ? renderMarkdown(message.content) : escapeHtml(message.content);
      const meta = message.meta
        ? `<div class="bubble-meta">${message.meta.model ? `Model: ${escapeHtml(message.meta.model)}` : ''}${message.meta.latencyMs != null ? ` · ${Number(message.meta.latencyMs)}ms` : ''}${message.meta.respondedAt ? ` · ${escapeHtml(formatTime(message.meta.respondedAt))}` : ''}</div>`
        : '';
      return `<div class="bubble ${cls}">${body}${meta}</div>`;
    })
    .join('');

  const thinkingBubble =
    state.loading && state.pendingAssistantThreadId === thread.id
      ? '<div class="bubble bubble-assistant bubble-thinking"><span class="thinking-dots"><span></span><span></span><span></span></span>Thinking...</div>'
      : '';

  els.feed.innerHTML = html + thinkingBubble;
  els.feed.scrollTop = els.feed.scrollHeight;
};

const getRandomModel = () => {
  if (!state.serverModels.length) {
    return '';
  }
  const index = Math.floor(Math.random() * state.serverModels.length);
  return state.serverModels[index]?.model_id || '';
};

const resolveServerModelForThread = (thread) => {
  const selected = getSelectedServerModel();
  if (selected !== 'auto') {
    return {
      selectedModel: selected,
      lockedModel: ''
    };
  }

  const alreadyLocked = String(thread.lockedAutoModel || '').trim();
  if (alreadyLocked) {
    return {
      selectedModel: alreadyLocked,
      lockedModel: alreadyLocked
    };
  }

  const picked = getRandomModel();
  return {
    selectedModel: picked,
    lockedModel: picked
  };
};

const setLoading = (value) => {
  state.loading = Boolean(value);
  els.send.disabled = state.loading;
  els.input.disabled = state.loading;
};

const requestCompletion = async (messages, thread) => {
  const aiSettings = getAiSettings();

  if (aiSettings.mode === 'server') {
    const resolved = resolveServerModelForThread(thread);
    if (resolved.lockedModel) {
      state.chat = setThreadLockedAutoModel(state.chat, thread.id, resolved.lockedModel);
      await persist();
    }

    const reply = await requestServerAiChat({
      messages,
      model: resolved.selectedModel,
      mode: getSelectedServerModel() === 'auto' ? 'auto' : 'manual'
    });

    return {
      text: reply?.message || '',
      meta: {
        model: reply?.model || resolved.selectedModel,
        latencyMs: reply?.meta?.latencyMs,
        respondedAt: reply?.meta?.respondedAt || new Date().toISOString()
      }
    };
  }

  const apiKey = aiSettings.localOpenRouterApiKey;
  const model = String(aiSettings.localOpenRouterModel || '').trim();
  if (!apiKey || !model) {
    throw new Error('Client-only AI requires both API key and model in Settings.');
  }

  const started = Date.now();
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages
    })
  });

  if (!response.ok) {
    throw new Error('OpenRouter request failed for client-only mode.');
  }

  const data = await response.json();
  return {
    text: data?.choices?.[0]?.message?.content || '',
    meta: {
      model,
      latencyMs: Date.now() - started,
      respondedAt: new Date().toISOString()
    }
  };
};

const sendMessage = async (rawText) => {
  const text = String(rawText || '').trim();
  if (!text || state.loading) {
    return;
  }

  const thread = getActiveThread();
  if (!thread) {
    return;
  }

  setLoading(true);

  try {
    state.chat = appendThreadMessage(state.chat, thread.id, {
      role: 'user',
      content: text
    });
    await persist();
    renderThreadList();
    renderFeed();

    const nextThread = getActiveThread();
    state.pendingAssistantThreadId = nextThread?.id || thread.id;
    renderFeed();
    const requestMessages = snapshotThreadForRequest(nextThread);
    const response = await requestCompletion(requestMessages, nextThread);

    state.chat = appendThreadMessage(state.chat, thread.id, {
      role: 'assistant',
      content: response.text,
      meta: response.meta
    });
    await persist();

    state.lastMeta = response.meta;
    state.pendingAssistantThreadId = null;
    renderThreadList();
    renderFeed();
    renderMeta(response.meta);
  } catch (error) {
    state.pendingAssistantThreadId = null;
    state.chat = appendThreadMessage(state.chat, thread.id, {
      role: 'assistant',
      content: `Request failed: ${error.message}`,
      meta: null
    });
    await persist();
    renderFeed();
  } finally {
    setLoading(false);
  }
};

const handleBootstrapAutostart = async () => {
  if (!qs.get('autostart')) {
    return;
  }

  const thread = getActiveThread();
  if (!thread || thread.messages.length > 0) {
    return;
  }

  const seed = state.bootstrap?.seedMessage;
  if (seed) {
    await sendMessage(seed);
  }
};

const renderModelPicker = () => {
  const aiSettings = getAiSettings();

  if (aiSettings.mode !== 'server') {
    const modelLabel = aiSettings.localOpenRouterModel || 'Model not set in Settings';
    els.modelSelect.innerHTML = `<option value="${escapeHtml(modelLabel)}">${escapeHtml(modelLabel)}</option>`;
    els.modelSelect.disabled = true;
    renderMeta({ model: modelLabel });
    return;
  }

  const selected = getSelectedServerModel();
  const options = [
    '<option value="auto">Auto (random on new chat)</option>',
    ...state.serverModels.map((item) => `<option value="${escapeHtml(item.model_id)}">${escapeHtml(item.model_name)}</option>`)
  ];

  els.modelSelect.innerHTML = options.join('');
  els.modelSelect.value = selected;
  if (els.modelSelect.value !== selected) {
    els.modelSelect.value = 'auto';
  }
  els.modelSelect.disabled = false;
};

const hydrateServerModels = async () => {
  const aiSettings = getAiSettings();
  if (aiSettings.mode !== 'server') {
    state.serverModels = [];
    return;
  }

  try {
    const data = await getServerAiModels();
    state.serverModels = Array.isArray(data?.models) ? data.models : [];
  } catch {
    state.serverModels = [];
  }
};

const initChatState = async () => {
  state.chat = await loadChatState();
  state.bootstrap = await parseBootstrapContext();

  if (!state.chat.threads.length) {
    const bootstrap = state.bootstrap
      ? {
          title: state.bootstrap.title,
          context: state.bootstrap.context,
          systemPrompt: state.bootstrap.systemPrompt
        }
      : {};

    const created = createThread(state.chat, bootstrap);
    state.chat = created.state;
    await persist();
  }

  if (!state.chat.activeThreadId) {
    const ensured = ensureThread(state.chat, state.bootstrap || {});
    state.chat = ensured.state;
    await persist();
  }
};

const bindEvents = () => {
  els.back.addEventListener('click', () => {
    const returnTo = qs.get('returnTo');
    if (returnTo) {
      window.location.href = returnTo;
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = './market.html';
  });

  els.newThread.addEventListener('click', async () => {
    const bootstrap = state.bootstrap
      ? {
          title: state.bootstrap.title,
          context: state.bootstrap.context,
          systemPrompt: state.bootstrap.systemPrompt
        }
      : {};

    const created = createThread(state.chat, bootstrap);
    state.chat = created.state;
    await persist();
    renderThreadList();
    renderFeed();
  });

  els.threadList.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-thread-id]');
    if (!button) {
      return;
    }

    state.chat = setActiveThread(state.chat, button.dataset.threadId);
    await persist();
    renderThreadList();
    renderFeed();
  });

  els.modelSelect.addEventListener('change', async () => {
    const value = els.modelSelect.value || 'auto';
    updateSelectedServerModel(value);

    if (value === 'auto') {
      const thread = getActiveThread();
      if (thread) {
        state.chat = setThreadLockedAutoModel(state.chat, thread.id, '');
        await persist();
      }
    }

    renderMeta({ model: value === 'auto' ? 'Auto' : value });
  });

  els.clearThread.addEventListener('click', async () => {
    const thread = getActiveThread();
    if (!thread) {
      return;
    }

    state.chat = clearThreadMessages(state.chat, thread.id);
    await persist();
    renderThreadList();
    renderFeed();
  });

  els.deleteThread.addEventListener('click', async () => {
    const thread = getActiveThread();
    if (!thread) {
      return;
    }

    state.chat = deleteThread(state.chat, thread.id);

    if (!state.chat.threads.length) {
      const created = createThread(state.chat, state.bootstrap || {});
      state.chat = created.state;
    }

    await persist();
    renderThreadList();
    renderFeed();
  });

  els.composer.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = els.input.value;
    els.input.value = '';
    await sendMessage(text);
  });
};

const init = async () => {
  await initChatState();
  await hydrateServerModels();

  renderThreadList();
  renderFeed();
  renderModelPicker();
  renderMeta(state.lastMeta || {});
  await renderSyncState();
  bindEvents();

  flushPendingSync().catch(() => {});
  uploadChatState(state.chat).catch(() => {});

  await handleBootstrapAutostart();
};

init().catch((error) => {
  els.feed.innerHTML = `<div class="bubble bubble-system">Chat failed to initialize: ${escapeHtml(error.message)}</div>`;
});
