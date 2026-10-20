/* =============================================================
   MOMENTO — How It Works Page Logic
   js/how.js
   ============================================================= */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const { $$, toast } = window.Momento;

  // -------------------------------------------------------------
  // FAQ Accordion
  //
  // Previously relied on a hardcoded `max-height: 200px` in CSS
  // for the open state. Longer answers (or the same answer
  // wrapping to more lines on a narrower screen) would silently
  // get clipped by `overflow: hidden` with no visible sign
  // anything was cut off. This now measures each answer's real
  // height and sets it inline, so nothing is ever clipped
  // regardless of content length or viewport width.
  // -------------------------------------------------------------
  const faqItems = $$('.faq-item');

  function closeFaqItem(item) {
    const btn = item.querySelector('.faq-q');
    const answer = item.querySelector('.faq-a');
    item.classList.remove('open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (answer) {
      answer.style.maxHeight = '0px';
      answer.setAttribute('aria-hidden', 'true');
    }
  }

  function openFaqItem(item) {
    const btn = item.querySelector('.faq-q');
    const answer = item.querySelector('.faq-a');
    item.classList.add('open');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    if (answer) {
      answer.setAttribute('aria-hidden', 'false');
      answer.style.maxHeight = answer.scrollHeight + 'px';
    }
  }

  faqItems.forEach((item) => {
    const btn = item.querySelector('.faq-q');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      faqItems.forEach(closeFaqItem);
      if (!isOpen) openFaqItem(item);
    });
  });

  // If the viewport is resized (e.g. phone rotation) while an
  // answer is open, its wrapped line count can change — recalculate
  // so it doesn't end up clipped or leave leftover empty space.
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const openItem = faqItems.find(i => i.classList.contains('open'));
      if (openItem) {
        const answer = openItem.querySelector('.faq-a');
        if (answer) answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    }, 150);
  });

  // -------------------------------------------------------------
  // Algorithm card acknowledgment
  //
  // These cards previously had a click listener but no visual
  // affordance (no cursor:pointer, no hover state) and no keyboard
  // access at all — so the interaction was effectively invisible
  // and unreachable without a mouse. Fixed to match the same
  // decorative-card pattern already used on the Home page (visual
  // affordance + keyboard support). The toast copy was also
  // rewritten since "Viewing specification for..." implied a
  // detail view that never actually opened.
  // -------------------------------------------------------------
  $$('.algo-card').forEach((card) => {
    const activate = () => {
      const tag = card.querySelector('.tag');
      const title = card.querySelector('h4');
      if (tag && title) {
        toast(`${tag.textContent}: ${title.textContent}`);
      }
    };

    card.addEventListener('click', activate);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        activate();
      }
    });
  });
});