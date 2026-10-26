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

  // Legacy storage keys (pre-backend data, read only by the importer)
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
  // The backend decides who is signed in (via the token kept by
  // js/api.js). The user object in sessionStorage is only a cached
  // copy, so the header can show the name without waiting for a request.
  const api = window.MomentoApi;

  function getCurrentUser() {
    if (!api.getToken()) return null;
    try {
      return JSON.parse(sessionStorage.getItem(CURRENT_USER_KEY));
    } catch {
      return null;
    }
  }

  function setCurrentUser(user, token) {
    if (token) api.setToken(token);
    sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    updateNavAuth();
  }

  function clearCurrentUser() {
    api.clearToken();
    sessionStorage.removeItem(CURRENT_USER_KEY);
    updateNavAuth();
  }

  async function signOut() {
    try {
      await api.post('/auth/logout'); // invalidates the token on the server
    } catch {}
    clearCurrentUser();
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
        signOutBtn.addEventListener('click', async () => {
          signOutBtn.disabled = true;
          await signOut();
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
  // Legacy LocalStorage Keys
  // -------------------------------------------------------------
  // Before the backend existed, each browser-only account saved its
  // library and streak under "<baseKey>__<localUserId>". Those keys
  // are now only read once, by the import in login.js, and are never
  // written again — MongoDB is the source of truth.
  function legacyScopedKey(baseKey, localUserId) {
    return `${baseKey}__${localUserId}`;
  }

  // -------------------------------------------------------------
  // Global Reset Button (Footer)
  // -------------------------------------------------------------
  // The library and streak now live in MongoDB, so resetting deletes
  // the signed-in user's lectures, notes, quiz attempts and progress.
  const resetAllBtn = $('#resetAllBtn');
  if (resetAllBtn) {
    resetAllBtn.addEventListener('click', async () => {
      if (!getCurrentUser()) {
        toast('Sign in first — your saved library is stored with your account.', { err: true });
        return;
      }
      if (!confirm('Delete all saved lectures, notes and study progress from your account?')) return;
      try {
        await api.del('/lectures');
        await api.del('/progress');
        toast('Your library has been reset. Reloading…');
        setTimeout(() => { window.location.reload(); }, 600);
      } catch (err) {
        toast(err.message, { err: true });
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
    api,
    getCurrentUser,
    setCurrentUser,
    clearCurrentUser,
    signOut,
    updateNavAuth,
    requireAuth,
    legacyScopedKey,
    LIB_KEY,
    STREAK_KEY,
    USERS_KEY,
    CURRENT_USER_KEY
  };
})();