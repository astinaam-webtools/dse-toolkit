import {
  clearServerUrl,
  getAppSettings,
  getAiSettings,
  getPendingSync,
  getImportDecision,
  setImportDecision,
  setServerUrl,
  updateAiSettings
} from './lib/appSettings.js';
import { ApiError, getServerAiModels, getServerAiSettings, saveServerAiSettings, probeServer } from './lib/serverClient.js';
import {
  getConnectionState,
  flushPendingSync,
  getSession,
  login,
  logout,
  signup
} from './lib/documentGateway.js';
import { applyConnectionState } from './lib/serverClient.js';
import {
  getLocalPortfolioState,
  hasLocalPortfolioState,
  uploadPortfolioStateDocument
} from './lib/portfolioStore.js';
import {
  getLocalFundsData,
  hasLocalFundsState,
  uploadFundsDataDocument
} from './lib/fundsStore.js';
import { createModelPicker } from './lib/modelPicker.js';
import { normalizeOpenRouterModels } from './lib/modelNormalize.js';

const els = {
  serverUrl: document.getElementById('server-url'),
  serverSave: document.getElementById('save-server-url'),
  serverClear: document.getElementById('clear-server-url'),
  serverMessage: document.getElementById('server-message'),
  statusBadge: document.getElementById('connection-status'),
  statusDetail: document.getElementById('connection-detail'),
  authCard: document.getElementById('auth-card'),
  authGuestCard: document.getElementById('auth-guest-card'),
  currentUserCard: document.getElementById('current-user-card'),
  currentUserEmail: document.getElementById('current-user-email'),
  logoutBtn: document.getElementById('logout-btn'),
  openLoginModal: document.getElementById('open-login-modal'),
  openSignupModal: document.getElementById('open-signup-modal'),
  authModal: document.getElementById('auth-modal'),
  closeAuthModal: document.getElementById('close-auth-modal'),
  switchLogin: document.getElementById('switch-login'),
  switchSignup: document.getElementById('switch-signup'),
  authModalTitle: document.getElementById('auth-modal-title'),
  authModalSubtitle: document.getElementById('auth-modal-subtitle'),
  loginForm: document.getElementById('login-form'),
  signupForm: document.getElementById('signup-form'),
  loginMessage: document.getElementById('login-message'),
  signupMessage: document.getElementById('signup-message'),
  importSection: document.getElementById('import-section'),
  importStocksCard: document.getElementById('import-stocks-card'),
  importFundsCard: document.getElementById('import-funds-card'),
  importStocksBtn: document.getElementById('import-stocks-btn'),
  importFundsBtn: document.getElementById('import-funds-btn'),
  dismissStocksBtn: document.getElementById('dismiss-stocks-btn'),
  dismissFundsBtn: document.getElementById('dismiss-funds-btn'),
  aiModeClient: document.getElementById('ai-mode-client'),
  aiModeServer: document.getElementById('ai-mode-server'),
  aiClientSettings: document.getElementById('ai-client-settings'),
  aiServerSettings: document.getElementById('ai-server-settings'),
  aiLocalApiKey: document.getElementById('ai-local-api-key'),
  saveAiLocal: document.getElementById('save-ai-local'),
  saveAiServer: document.getElementById('save-ai-server'),
  aiProviderOpenRouter: document.getElementById('ai-provider-openrouter'),
  aiProviderCursor: document.getElementById('ai-provider-cursor'),
  aiCursorKeyWrap: document.getElementById('ai-cursor-key-wrap'),
  aiServerCursorKey: document.getElementById('ai-server-cursor-key'),
  aiServerStatusInfo: document.getElementById('ai-server-status-info'),
  aiClientPickerMount: document.getElementById('ai-client-model-picker-mount'),
  aiClientDetailMount: document.getElementById('ai-client-model-detail-mount'),
  aiServerPickerMount: document.getElementById('ai-server-model-picker-mount'),
  aiServerDetailMount: document.getElementById('ai-server-model-detail-mount'),
  aiMessage: document.getElementById('ai-message'),
  colorModeStandard: document.getElementById('color-mode-standard'),
  colorModeEastAsian: document.getElementById('color-mode-east-asian'),
  colorModeMessage: document.getElementById('color-mode-message')
};

let authMode = 'login';
let clientPicker = null;
let serverPicker = null;

const migrateLegacyAiKeys = () => {
  const oldKey = localStorage.getItem('openrouter_key');
  const oldModel = localStorage.getItem('openrouter_model');
  const aiSettings = getAiSettings();

  if (oldKey && !aiSettings.localOpenRouterApiKey) {
    updateAiSettings({
      localOpenRouterApiKey: oldKey,
      localOpenRouterModel: oldModel || aiSettings.localOpenRouterModel || ''
    });
  }

  if (oldKey || oldModel) {
    localStorage.removeItem('openrouter_key');
    localStorage.removeItem('openrouter_model');
  }
};

const setMessage = (element, text, tone = '') => {
  if (!element) return;
  element.textContent = text || '';
  element.dataset.tone = tone;
};

const showImports = (isConnected) => {
  const hasStocksImport = hasLocalPortfolioState() && !getImportDecision('stocks');
  const hasFundsImport = hasLocalFundsState() && !getImportDecision('funds');

  els.importSection.hidden = !isConnected || (!hasStocksImport && !hasFundsImport);
  els.importStocksCard.hidden = !hasStocksImport;
  els.importFundsCard.hidden = !hasFundsImport;
};

const getConnectionDetailText = (state, settings, session) => {
  const serverUrl = settings.serverUrl;
  if (!serverUrl || state.code === 'client-only') {
    return 'No server URL configured. Portfolio data stays in this browser.';
  }
  if (state.code === 'checking') {
    return `Checking ${serverUrl}...`;
  }
  if (state.code === 'connected') {
    const email = session.user?.email || state.user?.email;
    return email ? `Connected to ${serverUrl} as ${email}.` : `Connected to ${serverUrl}.`;
  }
  if (state.code === 'login-required') {
    return `Server reachable at ${serverUrl}. Log in to use synced portfolios.`;
  }
  if (state.code === 'pending-sync') {
    return `Connected to ${serverUrl}. Local changes are waiting to sync.`;
  }
  if (state.code === 'unavailable') {
    const reason = state.detail || 'Unable to reach the configured server.';
    return `${reason} (${serverUrl})`;
  }
  return state.detail || state.title || '';
};

const renderConnectionState = async () => {
  let settings = getAppSettings();
  els.serverUrl.value = settings.serverUrl;

  applyConnectionState(els.statusBadge, { code: 'checking' });
  els.statusDetail.textContent = getConnectionDetailText({ code: 'checking' }, settings, getSession());

  let state;
  try {
    state = await getConnectionState();
  } catch (error) {
    state = {
      code: 'unavailable',
      label: 'Server unavailable',
      title: 'The configured server could not be reached or returned an error.',
      detail: error?.message || 'Unable to reach the configured server.'
    };
  }

  settings = getAppSettings();
  els.serverUrl.value = settings.serverUrl;
  const session = getSession();

  applyConnectionState(els.statusBadge, state);
  els.statusDetail.textContent = getConnectionDetailText(state, settings, session);

  const serverConfigured = Boolean(settings.serverUrl);
  els.authCard.hidden = !serverConfigured;
  els.serverClear.disabled = !serverConfigured;

  const isConnected = state.code === 'connected' || state.code === 'pending-sync';
  els.authGuestCard.hidden = !serverConfigured || isConnected;
  els.currentUserCard.hidden = !isConnected;
  els.currentUserEmail.textContent = session.user?.email || state.user?.email || '';

  if (isConnected) {
    closeAuthModal();
  }

  showImports(isConnected);
  await renderAiSettings();
};

const renderAuthModal = () => {
  const isLogin = authMode === 'login';
  els.loginForm.hidden = !isLogin;
  els.signupForm.hidden = isLogin;
  els.switchLogin.classList.toggle('active', isLogin);
  els.switchSignup.classList.toggle('active', !isLogin);
  els.authModalTitle.textContent = isLogin ? 'Log In' : 'Register';
  els.authModalSubtitle.textContent = isLogin
    ? 'Connect to your portfolio server account.'
    : 'Create an account for your portfolio server.';
};

const openAuthModal = (mode) => {
  authMode = mode;
  renderAuthModal();
  els.authModal.setAttribute('open', '');
  els.authModal.setAttribute('aria-hidden', 'false');
};

const closeAuthModal = () => {
  els.authModal.classList.remove('open');
  els.authModal.setAttribute('aria-hidden', 'true');
};

const handleSaveServerUrl = async (event) => {
  event.preventDefault();
  const rawServerUrl = els.serverUrl.value.trim();
  if (!rawServerUrl) {
    setMessage(els.serverMessage, 'Enter a server URL or clear the configuration.', 'warning');
    return;
  }

  els.serverSave.disabled = true;
  setMessage(els.serverMessage, 'Saving server URL...', '');

  try {
    const settings = setServerUrl(rawServerUrl);
    els.serverUrl.value = settings.serverUrl;

    try {
      await probeServer(settings.serverUrl);
      setMessage(els.serverMessage, 'Server URL saved and reachable. Log in to use server-backed portfolios.', 'success');
    } catch (error) {
      setMessage(
        els.serverMessage,
        `Server URL saved, but server is currently unreachable (${error.message}). Data will stay local/offline-first until it reconnects.`,
        'warning'
      );
    }
  } catch (error) {
    setMessage(els.serverMessage, error.message, 'error');
  } finally {
    els.serverSave.disabled = false;
    await renderConnectionState();
  }
};

const handleClearServerUrl = async () => {
  clearServerUrl();
  setMessage(els.serverMessage, 'Server mode disabled. The app is back in client-only mode.', 'success');
  await renderConnectionState();
};

const setupClientPicker = async () => {
  const aiSettings = getAiSettings();
  if (!clientPicker && els.aiClientPickerMount) {
    clientPicker = createModelPicker({
      mount: els.aiClientPickerMount,
      detailMount: els.aiClientDetailMount,
      provider: 'openrouter',
      mode: 'manual',
      onChange: (sel) => {
        updateAiSettings({ localOpenRouterModel: sel.modelId });
      }
    });
  }

  const apiKey = aiSettings.localOpenRouterApiKey;
  if (!apiKey) {
    clientPicker?.setError('Client AI mode requires an OpenRouter API key.');
    return;
  }

  clientPicker?.setLoading(true);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const data = await res.json();
    const normalized = normalizeOpenRouterModels(data?.data || []);
    clientPicker?.hydrate(normalized, {
      selectedId: aiSettings.localOpenRouterModel || 'openrouter/free',
      mode: 'manual',
      provider: 'openrouter'
    });
  } catch (err) {
    clientPicker?.setError(`Failed to fetch OpenRouter models: ${err.message}`);
  } finally {
    clientPicker?.setLoading(false);
  }
};

const setupServerPicker = async (provider) => {
  const aiSettings = getAiSettings();
  if (!serverPicker && els.aiServerPickerMount) {
    serverPicker = createModelPicker({
      mount: els.aiServerPickerMount,
      detailMount: els.aiServerDetailMount,
      provider,
      mode: aiSettings.serverModelMode,
      onChange: (sel) => {
        updateAiSettings({
          serverPreferredModel: sel.modelId,
          serverModelParams: sel.modelParams,
          serverModelMode: sel.mode
        });
      }
    });
  }

  serverPicker?.setLoading(true);
  try {
    const response = await getServerAiModels(provider);
    const models = response?.models || [];
    serverPicker?.hydrate(models, {
      selectedId: aiSettings.serverPreferredModel,
      selectedParams: aiSettings.serverModelParams,
      mode: aiSettings.serverModelMode,
      provider
    });
  } catch (err) {
    serverPicker?.setError(`Failed to load server models for ${provider}: ${err.message}`);
  } finally {
    serverPicker?.setLoading(false);
  }
};

const renderAiSettings = async () => {
  const aiSettings = getAiSettings();
  const isServer = aiSettings.mode === 'server';

  els.aiModeClient.checked = !isServer;
  els.aiModeServer.checked = isServer;
  els.aiClientSettings.hidden = isServer;
  els.aiServerSettings.hidden = !isServer;
  els.aiLocalApiKey.value = aiSettings.localOpenRouterApiKey || '';

  if (!isServer) {
    await setupClientPicker();
    return;
  }

  // Server AI Mode setup
  const provider = aiSettings.serverAiProvider || 'openrouter';
  if (provider === 'cursor-sdk') {
    els.aiProviderCursor.checked = true;
    els.aiCursorKeyWrap.hidden = false;
  } else {
    els.aiProviderOpenRouter.checked = true;
    els.aiCursorKeyWrap.hidden = true;
  }

  const appSettings = getAppSettings();
  const hasServerConn = Boolean(appSettings.serverUrl && appSettings.authToken);

  if (!hasServerConn) {
    els.aiServerStatusInfo.textContent = 'Connect and log in to a server to configure server AI settings.';
    return;
  }

  try {
    const data = await getServerAiSettings();
    const isConfigured = data?.configured;

    if (provider === 'cursor-sdk') {
      if (data.sandboxReady === false) {
        els.aiServerStatusInfo.textContent = `Cursor SDK Disabled: ${data.cursorDisabledReason || 'Sandbox unavailable'}`;
        els.aiServerStatusInfo.style.color = 'var(--down)';
      } else {
        els.aiServerStatusInfo.textContent = isConfigured
          ? `Cursor SDK Agent Ready (Sandboxed). Preferred model: ${data.model || 'composer-2.5'}`
          : 'Cursor SDK Key required (or backend env CURSOR_API_KEY).';
        els.aiServerStatusInfo.style.color = 'var(--text-muted)';
      }
    } else {
      els.aiServerStatusInfo.textContent = isConfigured
        ? `OpenRouter Server AI Ready. Preferred model: ${data.model || 'openrouter/free'}`
        : 'OpenRouter API Key required.';
      els.aiServerStatusInfo.style.color = 'var(--text-muted)';
    }

    await setupServerPicker(provider);
  } catch (err) {
    els.aiServerStatusInfo.textContent = `Could not load server AI settings: ${err.message}`;
  }
};

const handleAiModeChange = async () => {
  const mode = els.aiModeServer.checked ? 'server' : 'client';
  updateAiSettings({ mode });
  setMessage(els.aiMessage, `AI mode set to ${mode === 'server' ? 'Server AI' : 'Client-only AI'}.`, 'success');
  await renderAiSettings();
};

const handleSaveAiLocal = () => {
  const apiKey = els.aiLocalApiKey.value.trim();
  const selection = clientPicker ? clientPicker.getSelection() : { modelId: '' };

  if (!apiKey || !selection.modelId) {
    setMessage(els.aiMessage, 'Client-only AI requires both OpenRouter API key and model selection.', 'warning');
    return;
  }

  updateAiSettings({
    localOpenRouterApiKey: apiKey,
    localOpenRouterModel: selection.modelId
  });
  setMessage(els.aiMessage, 'Client AI settings saved.', 'success');
  setupClientPicker();
};

const handleSaveAiServer = async () => {
  const provider = els.aiProviderCursor.checked ? 'cursor-sdk' : 'openrouter';
  const apiKey = provider === 'cursor-sdk' ? els.aiServerCursorKey.value.trim() : '';
  const selection = serverPicker ? serverPicker.getSelection() : { modelId: 'auto', modelParams: [], mode: 'auto' };

  try {
    const updated = await saveServerAiSettings({
      provider,
      apiKey,
      model: selection.modelId,
      modelParams: selection.modelParams
    });

    updateAiSettings({
      serverAiProvider: provider,
      serverPreferredModel: selection.modelId,
      serverModelParams: selection.modelParams,
      serverModelMode: selection.mode
    });

    setMessage(els.aiMessage, `Server AI settings saved for provider '${provider}'.`, 'success');
    await renderAiSettings();
  } catch (err) {
    setMessage(els.aiMessage, err.message, 'error');
  }
};

const handleAuthSubmit = async (event, mode) => {
  event.preventDefault();
  const form = event.currentTarget;
  const messageEl = mode === 'login' ? els.loginMessage : els.signupMessage;
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;

  setMessage(messageEl, mode === 'login' ? 'Logging in...' : 'Creating account...');

  try {
    if (mode === 'login') {
      await login({ email, password });
      setMessage(messageEl, 'Logged in. Server-backed portfolio mode is ready.', 'success');
    } else {
      await signup({ email, password });
      setMessage(messageEl, 'Account created. Server-backed portfolio mode is ready.', 'success');
    }

    form.reset();
    closeAuthModal();
    flushPendingSync().catch((err) => console.warn('[offline-first] Post-login flush error:', err));
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Unable to complete the request.';
    setMessage(messageEl, message, 'error');
  } finally {
    await renderConnectionState();
  }
};

const handleImportClick = async (type) => {
  const btn = type === 'stocks' ? els.importStocksBtn : els.importFundsBtn;
  btn.disabled = true;
  btn.textContent = 'Uploading...';

  try {
    if (type === 'stocks') {
      const doc = getLocalPortfolioState();
      await uploadPortfolioStateDocument(doc);
    } else {
      const doc = getLocalFundsData();
      await uploadFundsDataDocument(doc);
    }

    setImportDecision(type, 'imported');
    showImports(true);
    await renderConnectionState();
  } catch (error) {
    console.error(`Import failed for ${type}`, error);
    btn.disabled = false;
    btn.textContent = 'Retry Upload';
  }
};

const handleDismissImport = (type) => {
  setImportDecision(type, 'skipped');
  showImports(true);
};

const applyColorMode = (mode) => {
  document.documentElement.dataset.colorMode = mode;
  localStorage.setItem('dse_color_mode', mode);
  if (els.colorModeMessage) {
    setMessage(els.colorModeMessage, `Color convention set to ${mode === 'east-asian' ? 'East Asian (Red Up / Green Down)' : 'Standard (Green Up / Red Down)'}.`, 'success');
  }
};

const initColorMode = () => {
  const saved = localStorage.getItem('dse_color_mode') || 'standard';
  if (saved === 'east-asian') {
    if (els.colorModeEastAsian) els.colorModeEastAsian.checked = true;
    document.documentElement.dataset.colorMode = 'east-asian';
  } else {
    if (els.colorModeStandard) els.colorModeStandard.checked = true;
    document.documentElement.dataset.colorMode = 'standard';
  }
};

// Listeners
els.serverSave?.addEventListener('click', handleSaveServerUrl);
els.serverClear?.addEventListener('click', handleClearServerUrl);
els.openLoginModal?.addEventListener('click', () => openAuthModal('login'));
els.openSignupModal?.addEventListener('click', () => openAuthModal('signup'));
els.closeAuthModal?.addEventListener('click', closeAuthModal);
els.switchLogin?.addEventListener('click', () => renderAuthModal(authMode = 'login'));
els.switchSignup?.addEventListener('click', () => renderAuthModal(authMode = 'signup'));

els.loginForm?.addEventListener('submit', (e) => handleAuthSubmit(e, 'login'));
els.signupForm?.addEventListener('submit', (e) => handleAuthSubmit(e, 'signup'));

els.logoutBtn?.addEventListener('click', async () => {
  logout();
  await renderConnectionState();
});

els.importStocksBtn?.addEventListener('click', () => handleImportClick('stocks'));
els.importFundsBtn?.addEventListener('click', () => handleImportClick('funds'));
els.dismissStocksBtn?.addEventListener('click', () => handleDismissImport('stocks'));
els.dismissFundsBtn?.addEventListener('click', () => handleDismissImport('funds'));

els.aiModeClient?.addEventListener('change', handleAiModeChange);
els.aiModeServer?.addEventListener('change', handleAiModeChange);
els.saveAiLocal?.addEventListener('click', handleSaveAiLocal);
els.saveAiServer?.addEventListener('click', handleSaveAiServer);

els.aiProviderOpenRouter?.addEventListener('change', () => {
  els.aiCursorKeyWrap.hidden = true;
  setupServerPicker('openrouter');
});

els.aiProviderCursor?.addEventListener('change', () => {
  els.aiCursorKeyWrap.hidden = false;
  setupServerPicker('cursor-sdk');
});

els.colorModeStandard?.addEventListener('change', () => applyColorMode('standard'));
els.colorModeEastAsian?.addEventListener('change', () => applyColorMode('east-asian'));

migrateLegacyAiKeys();
initColorMode();
renderConnectionState();
