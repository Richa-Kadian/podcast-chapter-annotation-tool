/* =============================================================
   MOMENTO — Compare Page Logic
   js/compare.js
   ============================================================= */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const { $$, toast } = window.Momento;

  // Comparison row click interactions
  $$('.compare-table tbody tr').forEach((row) => {
    const featName = row.querySelector('.feat')?.textContent;

    // Rows are custom clickable elements, not native buttons/links — make
    // them reachable and operable by keyboard too (Tab to focus, Enter/Space
    // to activate), matching the pointer-click behavior below.
    row.setAttribute('tabindex', '0');
    row.setAttribute('role', 'button');
    if (featName) row.setAttribute('aria-label', `View details about: ${featName}`);

    function announceFeature() {
      if (featName) {
        toast(`Feature: "${featName}" — exclusive closed-loop in Momento.`);
      }
    }

    row.addEventListener('click', announceFeature);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        announceFeature();
      }
    });
  });
});