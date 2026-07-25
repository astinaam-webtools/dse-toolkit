# Input Box Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the input box system across the DSE Toolkit application to replace disjointed, unstyled inputs with a unified, tokenized, mobile-first design system.

**Architecture:** Update `styles.css` with global base element styles for all `<input>`, `<select>`, and `<textarea>` controls, add layout primitives (`.field`, `.input-group`), implement a global password/API-key visibility toggle in `src/shell.js`, and refactor form markup across `settings.html`, `analyzer.html`, `funds.html`, `portfolio.html`, `chat.html`, and `market.html`.

**Tech Stack:** Vanilla CSS (OKLCH design tokens), ES modules / DOM APIs.

## Global Constraints
- Single stylesheet: `styles.css` for core component styles. No per-page forks of `.field` or `.input`.
- Design tokens: `--surface-sunk`, `--surface`, `--surface-2`, `--border-strong`, `--accent`, `--accent-soft`, `--down`, `--down-soft`, `--text`, `--text-muted`, `--text-faint`, `--r-sm`, `--dur-2`.
- Mobile-first: touch targets ≥44px, base font-size 16px (`--fs-base`).
- Reduced motion: respect `prefers-reduced-motion`.

---

### Task 1: Add Global Input Styles and Input Group Primitives in `styles.css`

**Files:**
- Modify: `styles.css:628-670`

**Interfaces:**
- Consumes: OKLCH design system tokens in `styles.css`.
- Produces: Global element styles (`input`, `select`, `textarea`), `.field`, `.input-group`, `.input-group__icon`, `.input-group__action`, `.input--error`.

- [ ] **Step 1: Update `styles.css` with unified input styles and `.input-group` classes**

```css
/* Base element styling for all form controls */
input[type='text'],
input[type='password'],
input[type='number'],
input[type='email'],
input[type='url'],
input[type='search'],
input[type='date'],
select,
textarea,
.input {
  width: 100%;
  min-height: 44px;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--r-sm);
  background: var(--surface-sunk);
  color: var(--text);
  font-family: var(--font-body);
  font-size: var(--fs-base);
  line-height: var(--lh-snug);
  appearance: none;
  transition: border-color var(--dur-2) var(--ease-out),
              box-shadow var(--dur-2) var(--ease-out),
              background-color var(--dur-2) var(--ease-out);
}

input::placeholder,
textarea::placeholder,
.input::placeholder {
  color: var(--text-faint);
  opacity: 1;
}

input:hover:not(:disabled),
select:hover:not(:disabled),
textarea:hover:not(:disabled),
.input:hover:not(:disabled) {
  border-color: var(--accent);
}

input:focus-visible,
select:focus-visible,
textarea:focus-visible,
.input:focus-visible {
  outline: none;
  border-color: var(--accent);
  background: var(--surface);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

input[aria-invalid='true'],
.input--error {
  border-color: var(--down) !important;
}

input[aria-invalid='true']:focus-visible,
.input--error:focus-visible {
  box-shadow: 0 0 0 3px var(--down-soft) !important;
}

input:disabled,
select:disabled,
textarea:disabled,
.input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--bg);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  margin-bottom: var(--s-3);
}

.field label,
.field__label {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: var(--fs-sm);
  color: var(--text-muted);
  letter-spacing: 0.01em;
}

.input-group {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.input-group .input,
.input-group input {
  padding-right: 2.75rem;
}

.input-group--has-leading .input,
.input-group--has-leading input {
  padding-left: 2.5rem;
}

.input-group__icon {
  position: absolute;
  left: 0.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  color: var(--text-muted);
  pointer-events: none;
}

.input-group__action {
  position: absolute;
  right: 0.35rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: color var(--dur-1) var(--ease-out), background-color var(--dur-1) var(--ease-out);
}

.input-group__action:hover {
  color: var(--text);
  background: var(--surface-2);
}

.input-group__action:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
```

- [ ] **Step 2: Run `npm test` to verify no CSS parsing issues**
- [ ] **Step 3: Commit CSS changes**

---

### Task 2: Implement Global Password Toggle Helper in `src/shell.js`

**Files:**
- Modify: `src/shell.js`

**Interfaces:**
- Consumes: DOM `click` events for elements matching `[data-toggle-password]`.
- Produces: Dynamic `type="password"` / `type="text"` toggle on targeted input element and updates SVG icon/`aria-label`.

- [ ] **Step 1: Add click event delegation for `data-toggle-password` in `src/shell.js`**

```javascript
document.addEventListener('click', (e) => {
  const toggleBtn = e.target.closest('[data-toggle-password]');
  if (!toggleBtn) return;
  const targetId = toggleBtn.getAttribute('data-toggle-password');
  const inputEl = document.getElementById(targetId);
  if (!inputEl) return;

  const isPassword = inputEl.type === 'password';
  inputEl.type = isPassword ? 'text' : 'password';
  toggleBtn.setAttribute('aria-label', isPassword ? 'Hide value' : 'Show value');
  toggleBtn.innerHTML = isPassword
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
});
```

- [ ] **Step 2: Commit shell helper**

---

### Task 3: Refactor Settings Page Form Inputs (`settings.html`)

**Files:**
- Modify: `settings.html`

**Interfaces:**
- Consumes: `.field`, `.input-group`, `.input-group__action`, `data-toggle-password`.
- Produces: Accessible OpenRouter API Key input with visibility toggle button, unified field structures in settings modals.

- [ ] **Step 1: Refactor OpenRouter API key field and settings form elements in `settings.html`**

Replace:
```html
<div>
  <label for="ai-local-api-key">OpenRouter API Key</label>
  <input id="ai-local-api-key" type="password" placeholder="sk-or-..." autocomplete="off" />
</div>
```

With:
```html
<div class="field">
  <label for="ai-local-api-key">OpenRouter API Key</label>
  <div class="input-group">
    <input id="ai-local-api-key" type="password" placeholder="sk-or-..." autocomplete="off" class="input" />
    <button type="button" class="input-group__action" aria-label="Show OpenRouter API Key" data-toggle-password="ai-local-api-key">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    </button>
  </div>
</div>
```

- [ ] **Step 2: Clean up per-page CSS in `settings.html` that overrides form input padding/borders**
- [ ] **Step 3: Commit changes to `settings.html`**

---

### Task 4: Clean up and Standardize Form Inputs Across Remaining Pages

**Files:**
- Modify: `funds.html`, `analyzer.html`, `portfolio.html`, `chat.html`, `market.html`

- [ ] **Step 1: Clean up `funds.html` per-page `.nav-input-group` overrides**
- [ ] **Step 2: Ensure `analyzer.html` fields use `.field` and `.input` classes**
- [ ] **Step 3: Ensure `portfolio.html` modal inputs use `.field` and `.input` classes**
- [ ] **Step 4: Ensure `chat.html` `.chat-input` textarea inherits unified focus rings**
- [ ] **Step 5: Ensure `market.html` search filter input uses `.input`**
- [ ] **Step 6: Commit remaining HTML refactoring**

---

### Task 5: Verification & Test Suite Execution

- [ ] **Step 1: Run full automated test suite (`npm test`)**
- [ ] **Step 2: Verify test pass output**
