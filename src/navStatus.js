import { applyConnectionState, getConnectionState, getStoredConnectionState } from './lib/serverClient.js';

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

const init = async () => {
  const pill = ensurePill();
  if (!pill) {
    return;
  }

  applyConnectionState(pill, getStoredConnectionState());

  try {
    const state = await getConnectionState();
    applyConnectionState(pill, state);
  } catch {
    applyConnectionState(pill, {
      code: 'unavailable',
      label: 'Server unavailable'
    });
  }
};

init();
