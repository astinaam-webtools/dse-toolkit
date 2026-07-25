// Shared page shell: tabbar (mobile), siderail (desktop), footer, and "More" sheet.
// Injects into placeholder mount points on each page so the shell is one source of truth.

// Apply price color mode from localStorage as early as shell script loads
try {
  const savedColorMode = localStorage.getItem('dse_color_mode');
  if (savedColorMode === 'east-asian') {
    document.documentElement.dataset.colorMode = 'east-asian';
  }
} catch (e) {
  // Ignore storage access errors
}

const PRIMARY_TABS = [
  { id: 'glossary', href: './index.html',    label: 'Glossary', icon: 'book' },
  { id: 'market',   href: './market.html',   label: 'Market',   icon: 'chart' },
  { id: 'stocks',   href: './portfolio.html',label: 'Stocks',   icon: 'briefcase' },
  { id: 'funds',    href: './funds.html',    label: 'Funds',    icon: 'coins' },
  { id: 'ai',       href: './chat.html',     label: 'AI',       icon: 'sparkle' }
];

const MORE_ITEMS = [
  { href: './settings.html',  label: 'Settings' },
  { href: './guides.html',    label: 'Chart Playbook' },
  { href: './analyzer.html',  label: 'Behavior Analyzer' },
  { href: './privacy.html',   label: 'Privacy Policy' },
  { href: 'https://github.com/astinaam-webtools/dse-toolkit', label: 'GitHub', external: true }
];

const LOGO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>';

const FOOTER_LINKS = [
  {
    href: './settings.html',
    label: 'Settings',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>'
  },
  {
    href: './guides.html',
    label: 'Chart Playbook',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>'
  },
  {
    href: './analyzer.html',
    label: 'Behavior Analyzer',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 21l-4.35-4.35"/><circle cx="11" cy="11" r="8"/><path d="M11 8v6M8 11h6"/></svg>'
  }
];

const ICONS = {
  book:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  chart:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-6"/></svg>',
  briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  coins:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h2v4"/><path d="M16.71 13.88l.7.71-2.82 2.82"/></svg>',
  sparkle:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="M5.6 5.6l2.1 2.1"/><path d="M16.3 16.3l2.1 2.1"/><path d="M5.6 18.4l2.1-2.1"/><path d="M16.3 7.7l2.1-2.1"/></svg>',
  more:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>'
};

function activeTabId() {
  const path = (window.location.pathname || '').toLowerCase();
  const file = path.split('/').pop() || 'index.html';
  if (file === 'index.html' || file === '' || file === '/') return 'glossary';
  if (file === 'market.html')    return 'market';
  if (file === 'portfolio.html') return 'stocks';
  if (file === 'funds.html')     return 'funds';
  if (file === 'chat.html')      return 'ai';
  return null;
}

function renderTab(tab, isActive) {
  return `
    <a href="${tab.href}" class="tabbar__tab${isActive ? ' is-active' : ''}" aria-current="${isActive ? 'page' : 'false'}">
      <span class="tabbar__icon">${ICONS[tab.icon]}</span>
      <span class="tabbar__label">${tab.label}</span>
    </a>`;
}

function renderTabbar() {
  const activeId = activeTabId();
  const tabs = PRIMARY_TABS.map(t => renderTab(t, t.id === activeId)).join('');
  const moreActive = activeId === null;
  return `
    <nav class="tabbar" aria-label="Primary">
      ${tabs}
      <button type="button" class="tabbar__tab tabbar__more${moreActive ? ' is-active' : ''}" data-shell-more aria-haspopup="dialog" aria-controls="shell-more-sheet">
        <span class="tabbar__icon">${ICONS.more}</span>
        <span class="tabbar__label">More</span>
      </button>
    </nav>`;
}

function renderSiderail() {
  const activeId = activeTabId();
  const tabs = PRIMARY_TABS.map(t => renderTab(t, t.id === activeId)).join('');

  const footerLinks = FOOTER_LINKS.map(item => `
    <a href="${item.href}" class="siderail__footer-link">
      <span class="siderail__footer-icon">${item.icon}</span>
      ${item.label}
    </a>`).join('');

  return `
    <nav class="siderail" aria-label="Primary">
      <div class="siderail__brand">
        <div class="siderail__logo" aria-hidden="true">${LOGO_SVG}</div>
        <div class="siderail__wordmark">
          <span class="siderail__name">DSE Toolkit</span>
          <span class="siderail__tagline">DSE Investor Tools</span>
        </div>
      </div>
      <p class="siderail__section-label" aria-hidden="true">Navigate</p>
      <div class="siderail__nav" role="list">
        ${tabs}
      </div>
      <div class="siderail__footer">
        <p class="siderail__section-label siderail__section-label--footer" aria-hidden="true">More</p>
        ${footerLinks}
      </div>
    </nav>`;
}

function renderMoreSheet() {
  const items = MORE_ITEMS.map(item => {
    const attrs = item.external ? ' target="_blank" rel="noopener"' : '';
    return `<li><a href="${item.href}"${attrs}>${item.label}</a></li>`;
  }).join('');
  return `
    <div class="sheet-overlay" id="shell-more-sheet" data-shell-sheet>
      <div class="sheet sheet--more" role="dialog" aria-modal="true" aria-label="More pages">
        <div class="sheet__handle" aria-hidden="true"></div>
        <h2 class="sheet__title">More</h2>
        <ul class="sheet__list">${items}</ul>
        <button type="button" class="sheet__close" data-shell-close>Close</button>
      </div>
    </div>`;
}

function renderFooter() {
  return `
    <footer class="site-footer">
      <div class="site-footer__inner">
        <p>Made with <span class="footer__heart">&#x2764;&#xFE0F;</span> in Bangladesh</p>
        <p class="site-footer__sep" aria-hidden="true">•</p>
        <p>Data is educational only — always do your own research</p>
        <p class="site-footer__sep" aria-hidden="true">•</p>
        <p>© 2025 DSE Toolkit</p>
      </div>
    </footer>`;
}

function closeSheet(sheet) {
  if (!sheet) return;
  sheet.hidden = true;
  sheet.removeAttribute('open');
  document.body.classList.remove('sheet-open');
}

function openSheet(sheet) {
  if (!sheet) return;
  sheet.hidden = false;
  sheet.setAttribute('open', '');
  document.body.classList.add('sheet-open');
}

function wireMoreSheet(root) {
  const sheet = root.querySelector('[data-shell-sheet]');
  const opener = root.querySelector('[data-shell-more]');
  if (!sheet || !opener) return;

  opener.addEventListener('click', () => openSheet(sheet));
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet || e.target.matches('[data-shell-close]')) {
      closeSheet(sheet);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (!sheet.hidden || sheet.hasAttribute('open'))) closeSheet(sheet);
  });
}

export function initShell() {
  const tabbarMount = document.getElementById('tabbar-mount');
  if (tabbarMount) {
    tabbarMount.innerHTML = renderTabbar();
  }

  const siderailMount = document.getElementById('siderail-mount');
  if (siderailMount) {
    siderailMount.innerHTML = renderSiderail();
  }

  const moreMount = document.getElementById('more-mount');
  if (moreMount) {
    moreMount.innerHTML = renderMoreSheet();
    wireMoreSheet(moreMount);
  }

  const footerMount = document.getElementById('footer-mount');
  if (footerMount) {
    footerMount.innerHTML = renderFooter();
  }

  // Reserved space to avoid layout shift while the tabbar injects.
  if (tabbarMount && !document.querySelector('.tabbar-spacer')) {
    const spacer = document.createElement('div');
    spacer.className = 'tabbar-spacer';
    spacer.setAttribute('aria-hidden', 'true');
    tabbarMount.parentNode?.insertBefore(spacer, tabbarMount.nextSibling);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initShell, { once: true });
} else {
  initShell();
}