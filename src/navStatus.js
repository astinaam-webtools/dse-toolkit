import { applyConnectionState } from './lib/serverClient.js';
import { getConnectionState, getStoredConnectionState, flushPendingSync, hasPendingSync } from './lib/documentGateway.js';

const CONNECTION_STATE_EVENT = 'dse:connection-state-changed';

let isRefreshing = false;
let refreshQueued = false;

const ensurePill = () => {
  const navContainer = document.querySelector('.nav-container');
  if (!navContainer) {
    return null;
  }

  navContainer.classList.add('has-server-pill');

  let pill = navContainer.querySelector('[data-server-status-pill]');
  if (!pill) {
    pill = document.createElement('a');
    pill.href = './settings.html';
    pill.className = 'nav-server-pill';
    pill.dataset.serverStatusPill = 'true';
    pill.innerHTML = `
      <span class="nav-server-pill__body">
        <span class="nav-server-pill__eyebrow">Storage</span>
        <span class="nav-server-pill__label" data-server-status-label>Checking server...</span>
      </span>
    `;
    navContainer.appendChild(pill);
  }

  return pill;
};

const refreshPill = async () => {
  const pill = ensurePill();
  if (!pill) {
    return;
  }

  if (isRefreshing) {
    refreshQueued = true;
    return;
  }

  isRefreshing = true;

  applyConnectionState(pill, getStoredConnectionState());

  try {
    const state = await getConnectionState();
    applyConnectionState(pill, state);

    if (state.code === 'connected' && hasPendingSync()) {
      applyConnectionState(pill, { code: 'pending-sync', label: 'Syncing...', title: 'Uploading queued changes to server...' });
      const { flushed, errors } = await flushPendingSync();
      if (flushed.length > 0) {
        console.info('[offline-first] Flushed pending sync:', flushed);
      }
      if (errors.length > 0) {
        console.warn('[offline-first] Sync errors:', errors);
      }
      // Refresh pill: either back to connected or still pending if errors remain
      applyConnectionState(pill, hasPendingSync() ? { code: 'pending-sync', label: 'Sync pending', title: 'Some changes could not be uploaded. Will retry.' } : state);
    }
  } catch {
    applyConnectionState(pill, {
      code: 'unavailable',
      label: 'Server unavailable'
    });
  } finally {
    isRefreshing = false;

    if (refreshQueued) {
      refreshQueued = false;
      refreshPill().catch(() => {});
    }
  }
};

const init = () => {
  refreshPill().catch(() => {});

  window.addEventListener(CONNECTION_STATE_EVENT, () => {
    refreshPill().catch(() => {});
  });
};

init();
