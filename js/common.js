/* =============================================================
   MOMENTO — Shared JavaScript Utilities & Global Navigation
   js/common.js — Loaded across all pages
   ============================================================= */

(() => {
  'use strict';

  // DOM Query Helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Time & String formatting
  const fmtTime = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const uid = () => 'm_' + Math.random().toString(36).slice(2, 10);

  const escapeHtml = (s) => {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  };

  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  function fetchWithTimeout(url, ms = 5000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
  }

  // Storage Keys
  const LIB_KEY = 'momento_library_v1';
  const STREAK_KEY = 'momento_streak_v1';
  const USERS_KEY = 'momento_users_v1';
  const CURRENT_USER_KEY = 'momento_current_user';

  // -------------------------------------------------------------
  // Toast System
  // -------------------------------------------------------------
  const toastEl = $('#toast') || (() => {
    const t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
    return t;
  })();

  let toastTimer = null;
  function toast(msg, opts = {}) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.toggle('err', !!opts.err);
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), opts.ms || 3200);
  }

  // -------------------------------------------------------------
  // Mobile Nav & Header Active State
  // -------------------------------------------------------------
  const hamburger = $('#hamburger');
  const navLinks = $('#navLinks');

  function openMobileMenu() {
    if (!navLinks || !hamburger) return;
    navLinks.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
  }

  function closeMobileMenu() {
    if (!navLinks || !hamburger) return;
    navLinks.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  }

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      hamburger.getAttribute('aria-expanded') === 'true' ? closeMobileMenu() : openMobileMenu();
    });
  }

  // Active Link Highlighting based on pathname
  function highlightActiveNav() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    $$('.navlink').forEach((link) => {
      const href = link.getAttribute('href');
      if (href === currentPath || (currentPath === 'index.html' && (href === '/' || href === 'index.html'))) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // -------------------------------------------------------------
  // Ripple & Scroll Reveal Effects
  // -------------------------------------------------------------
  function attachRipple(el) {
    el.addEventListener('pointerdown', (e) => {
      const rect = el.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.8;
      const span = document.createElement('span');
      span.className = 'ripple';
      span.style.width = span.style.height = size + 'px';
      span.style.left = (e.clientX - rect.left - size / 2) + 'px';
      span.style.top = (e.clientY - rect.top - size / 2) + 'px';
      el.appendChild(span);
      span.addEventListener('animationend', () => span.remove());
    });
  }
  $$('.btn, .play-btn, .quiz-opt, .chap-pill, .test-cta').forEach(attachRipple);

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  function initReveal(root = document) {
    $$('.reveal', root).forEach((el) => revealObserver.observe(el));
  }

  // -------------------------------------------------------------
  // User Authentication & Session Manager
  // -------------------------------------------------------------
  function getCurrentUser() {
    try {
      return JSON.parse(sessionStorage.getItem(CURRENT_USER_KEY));
    } catch {
      return null;
    }
  }

  function setCurrentUser(user) {
    sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    updateNavAuth();
  }

  function clearCurrentUser() {
    sessionStorage.removeItem(CURRENT_USER_KEY);
    updateNavAuth();
  }

  function updateNavAuth() {
    const navAuthArea = $('#navAuthArea');
    if (!navAuthArea) return;

    const user = getCurrentUser();
    if (user) {
      navAuthArea.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="width:30px; height:30px; border-radius:50%; background:var(--amber); color:#211703; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold; font-family:var(--ff-mono);">
            ${escapeHtml((user.name || 'U').charAt(0).toUpperCase())}
          </div>
          <span style="font-size:13.5px; font-weight:600; color:var(--cloud);">${escapeHtml(user.name || 'Learner')}</span>
          <button type="button" class="btn btn-ghost btn-sm" id="signOutBtn" style="padding:4px 10px; font-size:11.5px; margin-left:4px;">Sign Out</button>
        </div>
      `;
      const signOutBtn = $('#signOutBtn');
      if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
          clearCurrentUser();
          toast('Signed out successfully.');
          setTimeout(() => { window.location.href = 'login.html'; }, 400);
        });
      }
    } else {
      navAuthArea.innerHTML = `
        <a href="login.html" class="btn btn-ghost btn-sm nav-cta" style="border-radius:20px; font-weight:600;">Sign In</a>
        <a href="app.html" class="btn btn-amber nav-cta">Try it now</a>
      `;
    }
  }

  function requireAuth(redirectUrl = 'login.html') {
    if (!getCurrentUser()) {
      sessionStorage.setItem('momento_auth_redirect', window.location.pathname);
      window.location.href = redirectUrl;
      return false;
    }
    return true;
  }

  // -------------------------------------------------------------
  // Global Reset Button (Footer)
  // -------------------------------------------------------------
  const resetAllBtn = $('#resetAllBtn');
  if (resetAllBtn) {
    resetAllBtn.addEventListener('click', () => {
      if (confirm('Clear and reset demo library recordings in this browser?')) {
        localStorage.removeItem(LIB_KEY);
        localStorage.removeItem(STREAK_KEY);
        toast('Demo library reset. Reloading…');
        setTimeout(() => { window.location.reload(); }, 600);
      }
    });
  }

  // Init on page load
  document.addEventListener('DOMContentLoaded', () => {
    highlightActiveNav();
    updateNavAuth();
    initReveal();
  });

  // Expose to window.Momento
  window.Momento = {
    $,
    $$,
    fmtTime,
    uid,
    escapeHtml,
    wait,
    fetchWithTimeout,
    toast,
    attachRipple,
    initReveal,
    getCurrentUser,
    setCurrentUser,
    clearCurrentUser,
    updateNavAuth,
    requireAuth,
    LIB_KEY,
    STREAK_KEY,
    USERS_KEY,
    CURRENT_USER_KEY
  };
})();
