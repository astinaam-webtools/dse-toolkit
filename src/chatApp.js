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
  snapshotThreadForRequest,
  updateThreadMessage,
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
  newThreadSidebar: document.getElementById('chat-new-thread-sidebar'),
  syncState: document.getElementById('chat-sync-state'),
  threadList: document.getElementById('chat-thread-list'),
  modelSelect: document.getElementById('chat-model-select'),
  clearThread: document.getElementById('chat-clear-thread'),
  deleteThread: document.getElementById('chat-delete-thread'),
  feed: document.getElementById('chat-feed'),
  composer: document.getElementById('chat-composer'),
  includeStockData: document.getElementById('chat-include-stock-data'),
  input: document.getElementById('chat-input'),
  send: document.getElementById('chat-send')
};

const route = new URL(window.location.href);
const qs = route.searchParams;

const state = {
  chat: getLocalChatState(),
  serverModels: [],
  loading: false,
  bootstrap: null,
  lastMeta: null,
  expandedMetaMessageIds: new Set(),
  includeStockData: false
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

const autoResizeComposer = () => {
  const input = els.input;
  if (!input) {
    return;
  }

  input.style.height = 'auto';
  const next = Math.min(Math.max(input.scrollHeight, 42), 180);
  input.style.height = `${next}px`;
};

const canIncludeStockData = (thread = getActiveThread()) => Boolean(thread?.systemPrompt);

const shouldIncludeStockDataForSend = (thread = getActiveThread()) => {
  if (!canIncludeStockData(thread)) {
    return false;
  }

  if (!thread.messages.length) {
    return true;
  }

  return Boolean(state.includeStockData);
};

const syncIncludeStockDataControl = () => {
  if (!els.includeStockData) {
    return;
  }

  const thread = getActiveThread();
  const canInclude = canIncludeStockData(thread);
  const nextChecked = shouldIncludeStockDataForSend(thread);
  state.includeStockData = nextChecked;

  els.includeStockData.disabled = !canInclude;
  els.includeStockData.checked = nextChecked;
  els.includeStockData.title = canInclude
    ? 'Adds the stock analysis context to this request.'
    : 'Stock context is only available in stock analysis threads.';
};

const buildRequestMessages = (thread, includeStockData = true) => {
  const requestMessages = snapshotThreadForRequest(thread);

  if (!includeStockData && requestMessages[0]?.role === 'system' && thread?.systemPrompt) {
    requestMessages.shift();
  }

  return requestMessages;
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
      const isPendingAssistant = message.role === 'assistant' && Boolean(message.meta?.pending);
      const isFailedAssistant = message.role === 'assistant' && Boolean(message.meta?.failed);

      let body;
      if (isPendingAssistant) {
        body = '<span class="thinking-dots"><span></span><span></span><span></span></span>Thinking...';
      } else if (message.role === 'assistant') {
        body = renderMarkdown(message.content);
      } else {
        body = escapeHtml(message.content);
      }

      const detailsVisible = state.expandedMetaMessageIds.has(message.id);
      const detailsToggle =
        message.role === 'assistant' && !isPendingAssistant && !isFailedAssistant && message.meta
          ? `<button class="bubble-meta-toggle" type="button" data-toggle-meta-id="${message.id}">${detailsVisible ? 'Hide details' : 'Show details'}</button>`
          : '';

      const meta =
        message.meta && detailsVisible
          ? `<div class="bubble-meta">${message.meta.model ? `Model: ${escapeHtml(message.meta.model)}` : ''}${message.meta.respondedAt ? `${message.meta.model ? ' · ' : ''}${escapeHtml(formatTime(message.meta.respondedAt))}` : ''}${message.meta.latencyMs != null ? ` · ${Number(message.meta.latencyMs)}ms` : ''}</div>`
          : '';

      const retry =
        isFailedAssistant
          ? `<button class="bubble-retry" type="button" data-retry-message-id="${message.id}">Retry</button>`
          : '';

      return `<div class="bubble ${cls} ${isPendingAssistant ? 'bubble-thinking' : ''}">${body}${detailsToggle}${meta}${retry}</div>`;
    })
    .join('');

  els.feed.innerHTML = html;
  els.feed.scrollTop = els.feed.scrollHeight;
};

const getRandomModel = () => {
  if (!state.serverModels.length) {
    return '';
  }
  const index = Math.floor(Math.random() * state.serverModels.length);
  return state.serverModels[index]?.model_id || '';
};

const resolveServerModelForThread = () => {
  const selected = getSelectedServerModel();
  if (selected !== 'auto') {
    return selected;
  }

  const picked = getRandomModel();
  return picked;
};

const setLoading = (value) => {
  state.loading = Boolean(value);
  els.send.disabled = state.loading;
  els.input.disabled = state.loading;
  if (els.includeStockData) {
    els.includeStockData.disabled = state.loading || !canIncludeStockData();
  }
};

const requestCompletion = async (messages, thread) => {
  const aiSettings = getAiSettings();

  if (aiSettings.mode === 'server') {
    const selectedModel = resolveServerModelForThread();

    const reply = await requestServerAiChat({
      messages,
      model: selectedModel,
      mode: getSelectedServerModel() === 'auto' ? 'auto' : 'manual'
    });

    return {
      text: reply?.message || '',
      meta: {
        model: reply?.model || selectedModel,
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
    const includeStockData = shouldIncludeStockDataForSend(thread);

    const userMessage = {
      role: 'user',
      content: text
    };
    state.chat = appendThreadMessage(state.chat, thread.id, userMessage);
    const threadAfterUser = getActiveThread();
    const insertedUser = threadAfterUser?.messages[threadAfterUser.messages.length - 1];

    state.chat = appendThreadMessage(state.chat, thread.id, {
      role: 'assistant',
      content: '',
      meta: {
        pending: true,
        requestForMessageId: insertedUser?.id || null,
        requestForContent: text,
        includeStockData,
        model: getSelectedServerModel() === 'auto' ? 'Auto' : getSelectedServerModel()
      }
    });

    await persist();
    renderThreadList();
    renderFeed();

    const nextThread = getActiveThread();
    const pendingMessage = nextThread?.messages[nextThread.messages.length - 1];
    renderFeed();
    const requestMessages = buildRequestMessages(nextThread, includeStockData);
    const response = await requestCompletion(requestMessages, nextThread);

    if (pendingMessage?.id) {
      state.chat = updateThreadMessage(state.chat, thread.id, pendingMessage.id, {
        content: response.text,
        meta: {
          ...response.meta,
          failed: false,
          pending: false,
          requestForMessageId: insertedUser?.id || null,
          requestForContent: text
        }
      });
    }
    await persist();

    state.lastMeta = response.meta;
    if (!nextThread?.messages?.length && canIncludeStockData(nextThread)) {
      state.includeStockData = false;
    }
    if (canIncludeStockData(nextThread) && includeStockData) {
      state.includeStockData = false;
    }
    renderThreadList();
    renderFeed();
    syncIncludeStockDataControl();
    renderMeta(response.meta);
  } catch (error) {
    const nextThread = getActiveThread();
    const pendingMessage = nextThread?.messages[nextThread.messages.length - 1];
    if (pendingMessage?.id && pendingMessage.meta?.pending) {
      state.chat = updateThreadMessage(state.chat, thread.id, pendingMessage.id, {
        content: `Request failed: ${error.message}`,
        meta: {
          ...(pendingMessage.meta || {}),
          pending: false,
          failed: true,
          failedAt: new Date().toISOString(),
          error: error.message
        }
      });
    }
    await persist();
    renderFeed();
    syncIncludeStockDataControl();
  } finally {
    setLoading(false);
    autoResizeComposer();
    syncIncludeStockDataControl();
  }
};

const shouldOpenFreshAnalysisThread = () => {
  const fromAnalysisEntry = qs.get('newThread') === '1' || qs.get('autostart') === '1';
  return Boolean(state.bootstrap && fromAnalysisEntry);
};

const prefillSeedPromptInComposer = () => {
  const thread = getActiveThread();
  if (!thread || thread.messages.length > 0) {
    return;
  }

  const seed = state.bootstrap?.seedMessage;
  if (!seed) {
    return;
  }

  if (!String(els.input.value || '').trim()) {
    els.input.value = seed;
    autoResizeComposer();
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
    '<option value="auto">Auto (random per message)</option>',
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

  if (shouldOpenFreshAnalysisThread()) {
    const created = createThread(state.chat, {
      title: state.bootstrap.title,
      context: state.bootstrap.context,
      systemPrompt: state.bootstrap.systemPrompt
    });
    state.chat = created.state;
    await persist();
    return;
  }

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

  const createNewThread = async () => {
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
    syncIncludeStockDataControl();
  };

  els.newThread.addEventListener('click', createNewThread);
  els.newThreadSidebar?.addEventListener('click', createNewThread);

  els.threadList.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-thread-id]');
    if (!button) {
      return;
    }

    state.chat = setActiveThread(state.chat, button.dataset.threadId);
    await persist();
    renderThreadList();
    renderFeed();
    syncIncludeStockDataControl();
  });

  els.feed.addEventListener('click', async (event) => {
    const retryBtn = event.target.closest('[data-retry-message-id]');
    if (retryBtn) {
      const thread = getActiveThread();
      if (!thread || state.loading) {
        return;
      }

      const failedMessage = thread.messages.find((m) => m.id === retryBtn.dataset.retryMessageId);
      const promptText = failedMessage?.meta?.requestForContent || '';
      if (!promptText) {
        return;
      }

      setLoading(true);
      try {
        state.chat = updateThreadMessage(state.chat, thread.id, failedMessage.id, {
          content: '',
          meta: {
            ...(failedMessage.meta || {}),
            pending: true,
            failed: false,
            retriedAt: new Date().toISOString(),
            model: getSelectedServerModel() === 'auto' ? 'Auto' : getSelectedServerModel()
          }
        });
        await persist();
        renderFeed();

        const refreshedThread = getActiveThread();
        const requestMessages = buildRequestMessages(
          refreshedThread,
          failedMessage?.meta?.includeStockData !== false
        );
        const response = await requestCompletion(requestMessages, refreshedThread);

        state.chat = updateThreadMessage(state.chat, thread.id, failedMessage.id, {
          content: response.text,
          meta: {
            ...response.meta,
            failed: false,
            pending: false,
            requestForMessageId: failedMessage.meta?.requestForMessageId || null,
            requestForContent: promptText
          }
        });
        await persist();
        renderFeed();
        syncIncludeStockDataControl();
      } catch (error) {
        state.chat = updateThreadMessage(state.chat, thread.id, failedMessage.id, {
          content: `Request failed: ${error.message}`,
          meta: {
            ...(failedMessage.meta || {}),
            pending: false,
            failed: true,
            error: error.message,
            failedAt: new Date().toISOString(),
            requestForContent: promptText
          }
        });
        await persist();
        renderFeed();
        syncIncludeStockDataControl();
      } finally {
        setLoading(false);
        syncIncludeStockDataControl();
      }
      return;
    }

    const toggleBtn = event.target.closest('[data-toggle-meta-id]');
    if (toggleBtn) {
      const messageId = toggleBtn.dataset.toggleMetaId;
      if (state.expandedMetaMessageIds.has(messageId)) {
        state.expandedMetaMessageIds.delete(messageId);
      } else {
        state.expandedMetaMessageIds.add(messageId);
      }
      renderFeed();
    }
  });

  els.modelSelect.addEventListener('change', async () => {
    const value = els.modelSelect.value || 'auto';
    updateSelectedServerModel(value);
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
    syncIncludeStockDataControl();
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
    syncIncludeStockDataControl();
  });

  els.includeStockData?.addEventListener('change', () => {
    state.includeStockData = Boolean(els.includeStockData.checked);
    syncIncludeStockDataControl();
  });

  els.composer.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = els.input.value;
    els.input.value = '';
    autoResizeComposer();
    await sendMessage(text);
  });

  els.input.addEventListener('input', () => {
    autoResizeComposer();
  });

  els.input.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    const text = els.input.value;
    els.input.value = '';
    autoResizeComposer();
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
  prefillSeedPromptInComposer();
  autoResizeComposer();
  syncIncludeStockDataControl();

  flushPendingSync().catch(() => {});
  uploadChatState(state.chat).catch(() => {});
};

init().catch((error) => {
  els.feed.innerHTML = `<div class="bubble bubble-system">Chat failed to initialize: ${escapeHtml(error.message)}</div>`;
});
