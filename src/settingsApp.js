import {
  clearServerUrl,
  getAppSettings,
  getImportDecision,
  setImportDecision,
  setServerUrl
} from './lib/appSettings.js';
import { ApiError, probeServer } from './lib/serverClient.js';
import {
  applyConnectionState,
  getConnectionState,
  getSession,
  login,
  logout,
  signup
} from './lib/documentGateway.js';
import { flushPendingSync } from './lib/documentGateway.js';
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
  dismissFundsBtn: document.getElementById('dismiss-funds-btn')
};

let authMode = 'login';

const setMessage = (element, text, tone = '') => {
  if (!element) {
    return;
  }

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

const renderConnectionState = async () => {
  const settings = getAppSettings();
  els.serverUrl.value = settings.serverUrl;

  const state = await getConnectionState();
  applyConnectionState(els.statusBadge, state);
  els.statusDetail.textContent = state.detail || state.title || '';

  const serverConfigured = Boolean(settings.serverUrl);
  els.authCard.hidden = !serverConfigured;
  els.serverClear.disabled = !serverConfigured;

  const isConnected = state.code === 'connected';
  els.authGuestCard.hidden = !serverConfigured || isConnected;
  els.currentUserCard.hidden = !isConnected;
  const session = getSession();
  els.currentUserEmail.textContent = session.user?.email || state.user?.email || '';

  if (isConnected) {
    closeAuthModal();
  }

  showImports(isConnected);
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
  els.authModal.classList.add('open');
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
  setMessage(els.serverMessage, 'Checking server...', '');

  try {
    await probeServer(rawServerUrl);
    const settings = setServerUrl(rawServerUrl);
    els.serverUrl.value = settings.serverUrl;
    setMessage(els.serverMessage, 'Server URL saved. Log in to load server-backed portfolios.', 'success');
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

    // Auto-upload any locally-queued changes after reconnecting
    flushPendingSync().catch((err) => console.warn('[offline-first] Post-login flush error:', err));
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Unable to complete the request.';
    setMessage(messageEl, message, 'error');
  } finally {
    await renderConnectionState();
  }
};

const handleImport = async (type) => {
  const button = type === 'stocks' ? els.importStocksBtn : els.importFundsBtn;
  button.disabled = true;

  try {
    if (type === 'stocks') {
      await uploadPortfolioStateDocument(getLocalPortfolioState());
    } else {
      await uploadFundsDataDocument(getLocalFundsData());
    }

    setImportDecision(type, 'imported');
  } catch (error) {
    alert(error.message || 'Import failed.');
  } finally {
    button.disabled = false;
    showImports(true);
  }
};

const dismissImport = (type) => {
  setImportDecision(type, 'skipped');
  showImports(true);
};

const init = async () => {
  els.serverSave.addEventListener('click', handleSaveServerUrl);
  els.serverClear.addEventListener('click', handleClearServerUrl);
  els.openLoginModal.addEventListener('click', () => openAuthModal('login'));
  els.openSignupModal.addEventListener('click', () => openAuthModal('signup'));
  els.closeAuthModal.addEventListener('click', closeAuthModal);
  els.switchLogin.addEventListener('click', () => {
    authMode = 'login';
    renderAuthModal();
  });
  els.switchSignup.addEventListener('click', () => {
    authMode = 'signup';
    renderAuthModal();
  });
  els.loginForm.addEventListener('submit', (event) => handleAuthSubmit(event, 'login'));
  els.signupForm.addEventListener('submit', (event) => handleAuthSubmit(event, 'signup'));
  els.logoutBtn.addEventListener('click', async () => {
    logout();
    await renderConnectionState();
  });
  els.importStocksBtn.addEventListener('click', () => handleImport('stocks'));
  els.importFundsBtn.addEventListener('click', () => handleImport('funds'));
  els.dismissStocksBtn.addEventListener('click', () => dismissImport('stocks'));
  els.dismissFundsBtn.addEventListener('click', () => dismissImport('funds'));

  els.authModal.addEventListener('click', (event) => {
    if (event.target === els.authModal) {
      closeAuthModal();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAuthModal();
    }
  });

  renderAuthModal();
  await renderConnectionState();
};

init();
