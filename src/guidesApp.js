import { buildGuideAnalysisPrompt, storePrefilledPrompt } from './lib/chatPrompts.js';

const init = () => {
  const cards = document.querySelectorAll('.guide-card');
  if (!cards.length) return;

  cards.forEach((card) => {
    const heading = card.querySelector('h2');
    const tagEl = card.querySelector('.guide-tag');
    if (!heading) return;

    const title = heading.textContent.trim();
    const tag = tagEl ? tagEl.textContent.trim() : '';

    const bodyParts = [];
    card.querySelectorAll('p').forEach((p) => {
      if (p.classList.contains('guide-tag')) return;
      bodyParts.push(p.textContent.trim());
    });
    const bodyText = bodyParts.join('\n');

    const cta = document.createElement('a');
    cta.href = './chat.html';
    cta.className = 'term-ai-cta';
    cta.innerHTML = [
      '<span class="term-ai-cta__icon" aria-hidden="true">✨</span>',
      '<span>Understand Better with AI</span>',
      '<span class="term-ai-cta__arrow" aria-hidden="true">→</span>'
    ].join('');

    cta.addEventListener('click', (e) => {
      e.preventDefault();
      const promptText = buildGuideAnalysisPrompt(title, tag, bodyText);
      if (!promptText) return;
      const pk = storePrefilledPrompt(promptText, title);
      if (pk) {
        window.location.href = `./chat.html?pk=${encodeURIComponent(pk)}`;
      } else {
        window.location.href = `./chat.html?prompt=${encodeURIComponent(promptText)}&term=${encodeURIComponent(title)}`;
      }
    });

    card.appendChild(cta);
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
