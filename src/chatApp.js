import { getAiSettings, getAppSettings, updateAiSettings } from './lib/appSettings.js';
import { flushPendingSync, getConnectionState, getSession } from './lib/documentGateway.js';
import { getServerAiModels, requestServerAiChat, resetCursorSession } from './lib/serverClient.js';
import { createModelPicker } from './lib/modelPicker.js';
import { normalizeOpenRouterModels } from './lib/modelNormalize.js';
import {
  appendThreadMessage,
  clearThreadMessages,
  createThread,
  deleteThread,
  ensureThread,
  getLocalChatState,
  loadChatState,
  saveChatState,
  setActiveThread,
  snapshotThreadForRequest,
  updateThreadMessage,
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
  modelPickerMount: document.getElementById('chat-model-picker-mount'),
  modelDetailMount: document.getElementById('chat-model-detail-mount'),
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
  includeStockData: false,
  picker: null
};

const formatTime = (value) => {
  if (!value) return '';
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
  if (!symbol) return null;

  const dataset = await loadMarketDataset();
  const stock = getStockBySymbol(dataset, symbol);
  if (!stock) return null;

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
  if (!input) return;
  input.style.height = 'auto';
  const next = Math.min(Math.max(input.scrollHeight, 42), 180);
  input.style.height = `${next}px`;
};

const canIncludeStockData = (thread = getActiveThread()) => Boolean(thread?.systemPrompt);

const shouldIncludeStockDataForSend = (thread = getActiveThread()) => {
  if (!canIncludeStockData(thread)) return false;
  if (!thread.messages.length) return true;
  return Boolean(state.includeStockData);
};

const syncIncludeStockDataControl = () => {
  if (!els.includeStockData) return;
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
    els.feed.innerHTML = `
      <div class="chat-welcome">
        <div class="chat-welcome__icon">✨</div>
        <h3>DSE AI Analyst</h3>
        <p>Ask anything about Dhaka Stock Exchange stocks, financial ratios, or market trends.</p>
        <div class="quick-prompts">
          <button class="quick-prompt-btn" type="button" data-prompt="What are the key financial ratios to evaluate a DSE value stock?">
            <span>📈 Key ratios for DSE value stocks</span>
            <span>→</span>
          </button>
          <button class="quick-prompt-btn" type="button" data-prompt="How do I read P/E ratio and EPS for DSE stocks?">
            <span>📊 How to read P/E and EPS</span>
            <span>→</span>
          </button>
          <button class="quick-prompt-btn" type="button" data-prompt="Which DSE sectors are considered defensive during market volatility?">
            <span>🛡️ Defensive sectors on DSE</span>
            <span>→</span>
          </button>
        </div>
      </div>
    `;
    return;
  }

  const html = thread.messages
    .map((message) => {
      const cls = message.role === 'assistant' ? 'bubble-assistant' : 'bubble-user';
      const isPendingAssistant = message.role === 'assistant' && Boolean(message.meta?.pending);
      const isFailedAssistant = message.role === 'assistant' && Boolean(message.meta?.failed);

      let body;
      if (isPendingAssistant) {
        body = `<span class="thinking-dots"><span></span><span></span><span></span></span>${message.content ? renderMarkdown(message.content) : 'Thinking...'}`;
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

const setupModelPicker = async () => {
  const aiSettings = getAiSettings();

  state.picker = createModelPicker({
    mount: els.modelPickerMount,
    detailMount: els.modelDetailMount,
    provider: aiSettings.mode === 'server' ? (aiSettings.serverAiProvider || 'openrouter') : 'openrouter',
    mode: aiSettings.mode === 'server' ? aiSettings.serverModelMode : 'manual',
    onChange: (selection) => {
      if (aiSettings.mode === 'server') {
        updateAiSettings({
          serverPreferredModel: selection.modelId,
          serverModelParams: selection.modelParams,
          serverModelMode: selection.mode
        });
      } else {
        updateAiSettings({
          localOpenRouterModel: selection.modelId
        });
      }
    }
  });

  if (aiSettings.mode === 'server') {
    state.picker.setLoading(true);
    try {
      const provider = aiSettings.serverAiProvider || 'openrouter';
      const response = await getServerAiModels(provider);
      state.serverModels = response?.models || [];
      state.picker.hydrate(state.serverModels, {
        selectedId: aiSettings.serverPreferredModel,
        selectedParams: aiSettings.serverModelParams,
        mode: aiSettings.serverModelMode,
        provider
      });
    } catch (err) {
      state.picker.setError(`Failed to load server models: ${err.message}`);
    } finally {
      state.picker.setLoading(false);
    }
  } else {
    // Client-only mode OpenRouter live fetch
    const apiKey = aiSettings.localOpenRouterApiKey;
    if (!apiKey) {
      state.picker.setError('Client-only mode requires an OpenRouter API key in Settings.');
      return;
    }

    state.picker.setLoading(true);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      const data = await res.json();
      const normalized = normalizeOpenRouterModels(data?.data || []);
      state.serverModels = normalized;
      state.picker.hydrate(normalized, {
        selectedId: aiSettings.localOpenRouterModel || 'openrouter/free',
        mode: 'manual',
        provider: 'openrouter'
      });
    } catch (err) {
      state.picker.setError(`Failed to load client models: ${err.message}`);
    } finally {
      state.picker.setLoading(false);
    }
  }
};

const setLoading = (value) => {
  state.loading = Boolean(value);
  els.send.disabled = state.loading;
  els.input.disabled = state.loading;
  if (els.includeStockData) {
    els.includeStockData.disabled = state.loading || !canIncludeStockData();
  }
  if (state.picker) {
    state.picker.setDisabled(state.loading);
  }
};

const requestCompletion = async (messages, thread, pendingMsgId) => {
  const aiSettings = getAiSettings();
  const selection = state.picker ? state.picker.getSelection() : { modelId: '', modelParams: [], mode: 'manual' };

  if (aiSettings.mode === 'server') {
    const provider = aiSettings.serverAiProvider || 'openrouter';
    const reply = await requestServerAiChat({
      provider,
      messages,
      model: selection.modelId,
      modelParams: selection.modelParams,
      mode: selection.mode,
      cursor: provider === 'cursor-sdk' ? { sessionId: thread.id } : null,
      stream: true,
      onDelta: (chunkText) => {
        // Live streaming update to pending assistant bubble
        const activeThread = getActiveThread();
        if (activeThread && pendingMsgId) {
          const msg = activeThread.messages.find((m) => m.id === pendingMsgId);
          if (msg) {
            msg.content = (msg.content || '') + chunkText;
            renderFeed();
          }
        }
      }
    });

    return {
      text: reply?.message || '',
      meta: {
        model: reply?.model || selection.modelId,
        modelParams: reply?.modelParams || selection.modelParams,
        latencyMs: reply?.meta?.latencyMs,
        respondedAt: reply?.meta?.respondedAt || new Date().toISOString()
      }
    };
  }

  // Client-only mode path
  const apiKey = aiSettings.localOpenRouterApiKey;
  const model = selection.modelId || String(aiSettings.localOpenRouterModel || '').trim();
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
    body: JSON.stringify({ model, messages })
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
  if (!text || state.loading) return;

  const thread = getActiveThread();
  if (!thread) return;

  const includeStockContext = shouldIncludeStockDataForSend(thread);
  appendThreadMessage(thread, { role: 'user', content: text });

  const pendingMsgId = `pending-${Date.now()}`;
  appendThreadMessage(thread, {
    id: pendingMsgId,
    role: 'assistant',
    content: '',
    meta: { pending: true }
  });

  renderFeed();
  renderThreadList();
  await persist();

  els.input.value = '';
  autoResizeComposer();
  setLoading(true);

  try {
    const requestMessages = buildRequestMessages(thread, includeStockContext);
    const completion = await requestCompletion(requestMessages, thread, pendingMsgId);

    updateThreadMessage(thread, pendingMsgId, {
      content: completion.text,
      meta: {
        pending: false,
        failed: false,
        ...completion.meta
      }
    });

    state.lastMeta = completion.meta;
    state.expandedMetaMessageIds.add(pendingMsgId);
  } catch (error) {
    updateThreadMessage(thread, pendingMsgId, {
      content: `Failed to generate AI response: ${error.message}`,
      meta: {
        pending: false,
        failed: true,
        error: error.message
      }
    });
  } finally {
    setLoading(false);
    syncIncludeStockDataControl();
    renderFeed();
    renderThreadList();
    await persist();
  }
};

const init = async () => {
  state.chat = await loadChatState();
  state.bootstrap = await parseBootstrapContext();

  if (state.bootstrap) {
    const thread = createThread({
      title: state.bootstrap.title,
      context: state.bootstrap.context,
      systemPrompt: state.bootstrap.systemPrompt
    });
    state.chat.threads.unshift(thread);
    setActiveThread(state.chat, thread.id);
  } else {
    ensureThread(state.chat);
  }

  await setupModelPicker();
  syncIncludeStockDataControl();
  renderThreadList();
  renderFeed();
  await renderSyncState();

  if (state.bootstrap?.seedMessage) {
    await sendMessage(state.bootstrap.seedMessage);
  }
};

// Event Listeners
els.back?.addEventListener('click', () => {
  window.location.href = './index.html';
});

const createNewThread = async () => {
  const thread = createThread({ title: 'New Chat' });
  state.chat.threads.unshift(thread);
  setActiveThread(state.chat, thread.id);
  syncIncludeStockDataControl();
  renderThreadList();
  renderFeed();
  await persist();
};

els.newThread?.addEventListener('click', createNewThread);
els.newThreadSidebar?.addEventListener('click', createNewThread);

els.clearThread?.addEventListener('click', async () => {
  const thread = getActiveThread();
  if (!thread) return;
  const aiSettings = getAiSettings();
  if (aiSettings.mode === 'server' && aiSettings.serverAiProvider === 'cursor-sdk') {
    resetCursorSession(thread.id);
  }
  clearThreadMessages(thread);
  syncIncludeStockDataControl();
  renderFeed();
  renderThreadList();
  await persist();
});

els.deleteThread?.addEventListener('click', async () => {
  const thread = getActiveThread();
  if (!thread) return;
  const aiSettings = getAiSettings();
  if (aiSettings.mode === 'server' && aiSettings.serverAiProvider === 'cursor-sdk') {
    resetCursorSession(thread.id);
  }
  deleteThread(state.chat, thread.id);
  ensureThread(state.chat);
  syncIncludeStockDataControl();
  renderThreadList();
  renderFeed();
  await persist();
});

els.threadList?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-thread-id]');
  if (!btn) return;
  const threadId = btn.getAttribute('data-thread-id');
  setActiveThread(state.chat, threadId);
  syncIncludeStockDataControl();
  renderThreadList();
  renderFeed();
});

els.feed?.addEventListener('click', async (e) => {
  const toggleBtn = e.target.closest('[data-toggle-meta-id]');
  if (toggleBtn) {
    const id = toggleBtn.getAttribute('data-toggle-meta-id');
    if (state.expandedMetaMessageIds.has(id)) {
      state.expandedMetaMessageIds.delete(id);
    } else {
      state.expandedMetaMessageIds.add(id);
    }
    renderFeed();
    return;
  const promptBtn = e.target.closest('.quick-prompt-btn');
  if (promptBtn && els.input) {
    const promptText = promptBtn.getAttribute('data-prompt');
    if (promptText) {
      els.input.value = promptText;
      autoResizeComposer();
      els.input.focus();
    }
    return;
  }

  const retryBtn = e.target.closest('[data-retry-message-id]');
  if (retryBtn) {
    const thread = getActiveThread();
    if (!thread || state.loading) return;

    const userMsgs = thread.messages.filter((m) => m.role === 'user');
    const lastUser = userMsgs[userMsgs.length - 1];
    if (!lastUser) return;

    thread.messages = thread.messages.filter((m) => !m.meta?.failed);
    const pendingMsgId = `pending-${Date.now()}`;
    appendThreadMessage(thread, {
      id: pendingMsgId,
      role: 'assistant',
      content: '',
      meta: { pending: true }
    });

    renderFeed();
    setLoading(true);

    try {
      const requestMessages = buildRequestMessages(thread, shouldIncludeStockDataForSend(thread));
      const completion = await requestCompletion(requestMessages, thread, pendingMsgId);

      updateThreadMessage(thread, pendingMsgId, {
        content: completion.text,
        meta: {
          pending: false,
          failed: false,
          ...completion.meta
        }
      });
      state.expandedMetaMessageIds.add(pendingMsgId);
    } catch (err) {
      updateThreadMessage(thread, pendingMsgId, {
        content: `Failed to generate AI response: ${err.message}`,
        meta: { pending: false, failed: true, error: err.message }
      });
    } finally {
      setLoading(false);
      renderFeed();
      renderThreadList();
      await persist();
    }
  }
});

els.composer?.addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessage(els.input.value);
});

els.input?.addEventListener('input', autoResizeComposer);
els.input?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(els.input.value);
  }
});

els.includeStockData?.addEventListener('change', () => {
  state.includeStockData = Boolean(els.includeStockData.checked);
});

init();
