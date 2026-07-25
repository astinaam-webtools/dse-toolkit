/**
 * Searchable Model Picker + Detail Panel Component.
 * Supports combobox accessibility, keyboard navigation, live filtering, and parameter variant tuning.
 */

let instanceCounter = 0;

function formatContextLength(ctx) {
  if (typeof ctx !== 'number' || ctx <= 0) return '—';
  if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(1)}M`;
  if (ctx >= 1_000) return `${Math.round(ctx / 1_000)}K`;
  return `${ctx}`;
}

export function createModelPicker({
  mount,
  detailMount = null,
  provider = 'openrouter',
  mode = 'manual',
  onChange = null
} = {}) {
  if (!mount) {
    throw new Error('mount container element is required for createModelPicker');
  }

  instanceCounter++;
  const pickerId = `picker-${instanceCounter}`;
  const listId = `picker-list-${pickerId}`;

  let models = [];
  let currentProvider = provider;
  let currentMode = mode;
  let selectedModelId = currentMode === 'auto' ? '__auto__' : '';
  let selectedParams = [];
  let filterQuery = '';
  let focusedIndex = -1;
  let isOpen = false;
  let isDisabled = false;

  // Render DOM structure into mount
  mount.innerHTML = `
    <div class="model-picker" id="${pickerId}">
      <div class="model-picker__input-wrap">
        <input
          type="text"
          class="model-picker__input"
          role="combobox"
          aria-expanded="false"
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls="${listId}"
          placeholder="Search models..."
        />
        <span class="model-picker__toggle-icon">▼</span>
      </div>
      <ul
        class="model-picker__list"
        id="${listId}"
        role="listbox"
        tabindex="-1"
      ></ul>
    </div>
  `;

  const pickerEl = mount.querySelector(`#${pickerId}`);
  const inputEl = mount.querySelector('.model-picker__input');
  const listEl = mount.querySelector('.model-picker__list');

  function getAutoOption() {
    return {
      model_id: '__auto__',
      model_name: currentProvider === 'cursor-sdk' ? 'Auto (default / first available)' : 'Auto (random per message)',
      description: currentProvider === 'cursor-sdk' ? 'Uses composer-2.5 or first live model.' : 'Picks a random free model per request.',
      context_length: null,
      pricing: null,
      capabilities: { reasoning: false, tools: true, modalities: ['text'] },
      parameters: [],
      variants: []
    };
  }

  function getFilteredModels() {
    const autoOpt = getAutoOption();
    const query = filterQuery.trim().toLowerCase();

    const filtered = models.filter((m) => {
      if (!query) return true;
      const nameMatch = String(m.model_name || '').toLowerCase().includes(query);
      const idMatch = String(m.model_id || '').toLowerCase().includes(query);
      const descMatch = String(m.description || '').toLowerCase().includes(query);
      return nameMatch || idMatch || descMatch;
    });

    return [autoOpt, ...filtered];
  }

  function getSelectedModelObj() {
    if (selectedModelId === '__auto__') return getAutoOption();
    return models.find((m) => m.model_id === selectedModelId) || null;
  }

  function updateInputDisplay() {
    const obj = getSelectedModelObj();
    if (obj) {
      inputEl.value = obj.model_name || obj.model_id;
    } else if (selectedModelId) {
      inputEl.value = selectedModelId;
    } else {
      inputEl.value = '';
    }
  }

  function renderList() {
    const listItems = getFilteredModels();
    const visibleItems = listItems.slice(0, 50);
    const isTruncated = listItems.length > 50;

    if (visibleItems.length === 0) {
      listEl.innerHTML = `<li class="model-picker__truncated-hint">No matching models found</li>`;
      return;
    }

    let html = '';
    visibleItems.forEach((m, idx) => {
      const isSelected = m.model_id === selectedModelId;
      const isFocused = idx === focusedIndex;
      const optionId = `picker-opt-${pickerId}-${idx}`;

      const ctxBadge = m.context_length ? `${formatContextLength(m.context_length)} ctx` : '';
      const pricingDisplay = m.pricing?.display || (currentProvider === 'cursor-sdk' ? 'Cursor' : '—');
      const reasoningBadge = m.capabilities?.reasoning ? `<span class="model-picker__badge model-picker__badge--reasoning">Reasoning</span>` : '';
      const presetsBadge = m.variants?.length > 0 ? `<span class="model-picker__badge">Presets</span>` : '';

      html += `
        <li
          id="${optionId}"
          class="model-picker__option ${isSelected ? 'is-selected' : ''} ${isFocused ? 'is-focused' : ''}"
          role="option"
          aria-selected="${isSelected}"
          data-id="${m.model_id}"
          data-index="${idx}"
        >
          <div class="model-picker__option-top">
            <span class="model-picker__name">${escapeHtml(m.model_name)}</span>
            <div class="model-picker__badges">
              ${reasoningBadge}
              ${ctxBadge ? `<span class="model-picker__badge">${ctxBadge}</span>` : ''}
              <span class="model-picker__badge model-picker__badge--pricing">${escapeHtml(pricingDisplay)}</span>
              ${presetsBadge}
            </div>
          </div>
          ${m.description ? `<div class="model-picker__desc-short">${escapeHtml(m.description)}</div>` : ''}
        </li>
      `;
    });

    if (isTruncated) {
      html += `<li class="model-picker__truncated-hint">Type to narrow... (${listItems.length - 50} more)</li>`;
    }

    listEl.innerHTML = html;

    // Attach click listeners to options
    listEl.querySelectorAll('.model-picker__option').forEach((optEl) => {
      optEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = optEl.getAttribute('data-id');
        selectModel(id);
        closeList();
      });
    });
  }

  function renderDetail() {
    if (!detailMount) return;

    const selectedObj = getSelectedModelObj();
    if (!selectedObj || selectedModelId === '__auto__') {
      detailMount.innerHTML = `
        <div class="model-detail">
          <div class="model-detail__title">Auto Model Selection</div>
          <div class="model-detail__desc">${escapeHtml(getAutoOption().description)}</div>
        </div>
      `;
      return;
    }

    const ctxDisplay = formatContextLength(selectedObj.context_length);
    const pricingDisplay = selectedObj.pricing?.display || (currentProvider === 'cursor-sdk' ? 'Billed on Cursor plan' : '—');
    const hasVariants = Array.isArray(selectedObj.variants) && selectedObj.variants.length > 0;
    const hasParams = Array.isArray(selectedObj.parameters) && selectedObj.parameters.length > 0;

    let variantsHtml = '';
    if (hasVariants) {
      variantsHtml = `
        <div class="model-detail__section-label">Presets / Variants</div>
        <div class="model-detail__variants">
          ${selectedObj.variants.map((v, idx) => {
            const isDefault = Boolean(v.isDefault);
            return `
              <button
                type="button"
                class="model-detail__variant-chip"
                data-variant-idx="${idx}"
              >
                ${escapeHtml(v.name || v.id)} ${isDefault ? '(default)' : ''}
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    let paramsHtml = '';
    if (hasParams) {
      paramsHtml = `
        <div class="model-detail__section-label">Parameters</div>
        <div class="model-detail__params">
          ${selectedObj.parameters.map((p) => {
            const currentParamVal = selectedParams.find((sp) => sp.id === p.id)?.value ?? (p.default || '');
            let controlHtml = '';

            if (p.type === 'boolean' || typeof p.default === 'boolean') {
              const isChecked = String(currentParamVal) === 'true';
              controlHtml = `<input type="checkbox" data-param-id="${p.id}" ${isChecked ? 'checked' : ''} />`;
            } else if (Array.isArray(p.options) && p.options.length > 0) {
              controlHtml = `
                <select data-param-id="${p.id}">
                  ${p.options.map((opt) => {
                    const optVal = typeof opt === 'object' ? opt.value : opt;
                    const optLabel = typeof opt === 'object' ? opt.label : opt;
                    return `<option value="${escapeHtml(optVal)}" ${String(optVal) === String(currentParamVal) ? 'selected' : ''}>${escapeHtml(optLabel)}</option>`;
                  }).join('')}
                </select>
              `;
            } else {
              controlHtml = `<input type="text" data-param-id="${p.id}" value="${escapeHtml(currentParamVal)}" />`;
            }

            return `
              <div class="model-detail__param-row">
                <span class="model-detail__param-label">${escapeHtml(p.name || p.id)}</span>
                <div class="model-detail__param-control">${controlHtml}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    detailMount.innerHTML = `
      <div class="model-detail">
        <div class="model-detail__title">${escapeHtml(selectedObj.model_name)}</div>
        <div class="model-detail__id">${escapeHtml(selectedObj.model_id)}</div>
        ${selectedObj.description ? `<div class="model-detail__desc">${escapeHtml(selectedObj.description)}</div>` : ''}

        <div class="model-detail__stats">
          <div class="model-detail__stat-item">
            <span class="model-detail__stat-label">Context</span>
            <span class="model-detail__stat-val">${escapeHtml(ctxDisplay)}</span>
          </div>
          <div class="model-detail__stat-item">
            <span class="model-detail__stat-label">Pricing</span>
            <span class="model-detail__stat-val">${escapeHtml(pricingDisplay)}</span>
          </div>
          <div class="model-detail__stat-item">
            <span class="model-detail__stat-label">Reasoning</span>
            <span class="model-detail__stat-val">${selectedObj.capabilities?.reasoning ? 'Yes' : 'No'}</span>
          </div>
        </div>

        ${variantsHtml}
        ${paramsHtml}
      </div>
    `;

    // Attach variant click handlers
    if (hasVariants) {
      detailMount.querySelectorAll('.model-detail__variant-chip').forEach((chipEl) => {
        chipEl.addEventListener('click', () => {
          const idx = parseInt(chipEl.getAttribute('data-variant-idx'), 10);
          const variant = selectedObj.variants[idx];
          if (variant && Array.isArray(variant.parameters)) {
            selectedParams = [...variant.parameters];
            renderDetail();
            notifyChange();
          }
        });
      });
    }

    // Attach parameter inputs event handlers
    if (hasParams) {
      detailMount.querySelectorAll('.model-detail__params input, .model-detail__params select').forEach((ctrlEl) => {
        const handler = () => {
          const paramId = ctrlEl.getAttribute('data-param-id');
          let val = ctrlEl.value;
          if (ctrlEl.type === 'checkbox') {
            val = ctrlEl.checked ? 'true' : 'false';
          }
          const existingIdx = selectedParams.findIndex((sp) => sp.id === paramId);
          if (existingIdx >= 0) {
            selectedParams[existingIdx] = { id: paramId, value: val };
          } else {
            selectedParams.push({ id: paramId, value: val });
          }
          notifyChange();
        };
        ctrlEl.addEventListener('change', handler);
      });
    }
  }

  function openList() {
    if (isDisabled || isOpen) return;
    isOpen = true;
    pickerEl.setAttribute('aria-expanded', 'true');
    inputEl.setAttribute('aria-expanded', 'true');
    renderList();
  }

  function closeList() {
    if (!isOpen) return;
    isOpen = false;
    pickerEl.setAttribute('aria-expanded', 'false');
    inputEl.setAttribute('aria-expanded', 'false');
    focusedIndex = -1;
    filterQuery = '';
    updateInputDisplay();
  }

  function selectModel(id) {
    selectedModelId = id;
    currentMode = id === '__auto__' ? 'auto' : 'manual';
    selectedParams = [];

    // Apply default variant params if available
    const obj = getSelectedModelObj();
    if (obj?.variants && obj.variants.length > 0) {
      const defVar = obj.variants.find((v) => v.isDefault) || obj.variants[0];
      if (defVar?.parameters) {
        selectedParams = [...defVar.parameters];
      }
    }

    updateInputDisplay();
    renderDetail();
    notifyChange();
  }

  function notifyChange() {
    if (typeof onChange === 'function') {
      onChange({
        modelId: selectedModelId === '__auto__' ? '' : selectedModelId,
        modelParams: selectedParams,
        mode: currentMode
      });
    }
  }

  // Keyboard navigation on input
  inputEl.addEventListener('focus', () => {
    openList();
  });

  inputEl.addEventListener('input', () => {
    filterQuery = inputEl.value;
    focusedIndex = 0;
    if (!isOpen) openList();
    renderList();
  });

  inputEl.addEventListener('keydown', (e) => {
    const items = getFilteredModels().slice(0, 50);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        openList();
      } else {
        focusedIndex = Math.min(focusedIndex + 1, items.length - 1);
        renderList();
        scrollToFocusedOption();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) {
        focusedIndex = Math.max(focusedIndex - 1, 0);
        renderList();
        scrollToFocusedOption();
      }
    } else if (e.key === 'Enter') {
      if (isOpen && items.length > 0 && focusedIndex >= 0 && focusedIndex < items.length) {
        e.preventDefault();
        selectModel(items[focusedIndex].model_id);
        closeList();
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        closeList();
      }
    } else if (e.key === 'Home') {
      if (isOpen) {
        e.preventDefault();
        focusedIndex = 0;
        renderList();
      }
    } else if (e.key === 'End') {
      if (isOpen) {
        e.preventDefault();
        focusedIndex = items.length - 1;
        renderList();
      }
    }
  });

  function scrollToFocusedOption() {
    const focusedEl = listEl.querySelector(`.model-picker__option.is-focused`);
    if (focusedEl) {
      focusedEl.scrollIntoView({ block: 'nearest' });
      inputEl.setAttribute('aria-activedescendant', focusedEl.id);
    }
  }

  // Close list on outside click
  document.addEventListener('click', (e) => {
    if (!mount.contains(e.target)) {
      closeList();
    }
  });

  return {
    hydrate(modelsList, { selectedId = '', selectedParams: initParams = [], mode: initMode = 'manual', provider: newProvider = null } = {}) {
      models = Array.isArray(modelsList) ? modelsList : [];
      if (newProvider) currentProvider = newProvider;
      currentMode = initMode;

      if (currentMode === 'auto') {
        selectedModelId = '__auto__';
      } else {
        selectedModelId = selectedId || (models[0]?.model_id || '');
      }

      selectedParams = Array.isArray(initParams) ? [...initParams] : [];
      updateInputDisplay();
      renderDetail();
    },

    getSelection() {
      return {
        modelId: selectedModelId === '__auto__' ? '' : selectedModelId,
        modelParams: selectedParams,
        mode: currentMode
      };
    },

    setDisabled(disabled) {
      isDisabled = Boolean(disabled);
      inputEl.disabled = isDisabled;
      if (isDisabled) closeList();
    },

    setError(msg) {
      if (detailMount) {
        detailMount.innerHTML = `<div class="model-detail" style="border-color: var(--down); color: var(--down);">${escapeHtml(msg)}</div>`;
      }
    },

    setLoading(loading) {
      if (loading) {
        inputEl.placeholder = 'Loading models...';
      } else {
        inputEl.placeholder = 'Search models...';
      }
    }
  };
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
