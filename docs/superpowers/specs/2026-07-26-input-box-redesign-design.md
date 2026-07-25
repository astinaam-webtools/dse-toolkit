# Unified Input Box Redesign Spec

> Date: 2026-07-26
> Scope: Global form controls (`input`, `select`, `textarea`), `.field`, `.input-group`, password visibility toggles, and per-page HTML form cleanup across `settings.html`, `analyzer.html`, `funds.html`, `portfolio.html`, `chat.html`, and `market.html`.

---

## 1. Goal & Objectives

Overhaul the input box system across the DSE Toolkit application to replace disjointed, unstyled, or per-page input boxes with a cohesive, mobile-first design system.

### Objectives
1. **Global Base Coverage**: Automatically style all `<input>`, `<select>`, and `<textarea>` elements site-wide via `styles.css` so unclassed form inputs (such as the OpenRouter API Key in `settings.html`) inherit dark/light mode surface styling seamlessly.
2. **Design Token Consistency**: Use existing OKLCH tokens (`--surface-sunk`, `--surface`, `--surface-2`, `--border-strong`, `--accent`, `--accent-soft`, `--text`, `--text-muted`, `--r-sm`, `--dur-2`).
3. **Enhanced Component Primitives**: Provide robust `.field`, `.input-group`, `.input-group__icon`, and `.input-group__action` utilities for leading icons and trailing action controls (e.g. eye toggle for password/API key fields).
4. **Touch & Accessibility**: Enforce ≥44px touch target height, 16px base font size to avoid mobile browser automatic zoom, visible `:focus-visible` rings with `--accent-soft`, and clear `aria-invalid` error states.

---

## 2. Design System Architecture (`styles.css`)

### 2.1 Base Element Styles
Base styles apply to native `<input>` (text, password, number, email, url, search, date), `<select>`, and `<textarea>` elements as well as `.input`:

```css
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
```

### 2.2 Layout Primitives (`.field` and `.input-group`)

- **`.field`**: Stacked label + input layout container with 8px gap.
- **`.input-group`**: Relative wrapper positioning leading SVG icons (`.input-group__icon`) or trailing interactive buttons (`.input-group__action`).

```css
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

---

## 3. Interactive Features & Password Toggle

For API Key fields (like `#ai-local-api-key`) and sensitive inputs, a global listener in `src/shell.js` handles `[data-toggle-password]` attributes:

```js
document.addEventListener('click', (e) => {
  const toggleBtn = e.target.closest('[data-toggle-password]');
  if (!toggleBtn) return;
  const targetId = toggleBtn.getAttribute('data-toggle-password');
  const inputEl = document.getElementById(targetId);
  if (!inputEl) return;

  const isPassword = inputEl.type === 'password';
  inputEl.type = isPassword ? 'text' : 'password';
  toggleBtn.setAttribute('aria-label', isPassword ? 'Hide API key' : 'Show API key');
  
  // Toggle Eye / Eye-Off SVG icon
  toggleBtn.innerHTML = isPassword
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
});
```

---

## 4. Affected Pages & HTML Refactoring

1. **`settings.html`**: Update `#ai-local-api-key` to use `.input` inside `.input-group` with password toggle button. Clean up all `.settings-form` input markup.
2. **`analyzer.html`**: Verify all 10 financial ratio `<input>` fields use `.field` wrapper and standard `.input` class.
3. **`funds.html`**: Clean up inline `<style>` input rules (`.nav-input-group`) and replace with standard `.input` and `.field`.
4. **`portfolio.html`**: Refactor modal stock editor fields (`#pf-symbol`, `#pf-qty`, `#pf-cost`) to standard `.field` layout.
5. **`chat.html`**: Ensure `.chat-input` textarea consumes tokenized focus/border colors seamlessly.
6. **`market.html`**: Align search & screener inputs with standard `.input` class.

---

## 5. Verification & Testing

- Run `npm test` to ensure zero regressions in automated tests.
- Verify light mode and dark mode color contrast (AA compliance).
- Verify touch targets (≥44px) on mobile viewports (360px width).
