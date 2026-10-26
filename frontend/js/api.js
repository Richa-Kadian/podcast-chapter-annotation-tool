/* =============================================================
   MOMENTO — Backend API Client
   js/api.js — Loaded after config.js, before common.js
   -------------------------------------------------------------
   Every request to the Express backend goes through request():
   it adds the JSON headers and the login token, applies a timeout,
   and turns error responses into a readable ApiError.
   ============================================================= */

(() => {
  'use strict';

  const BASE_URL = window.MOMENTO_CONFIG.API_BASE_URL;
  // The login token lives in sessionStorage, like the signed-in user
  // always has: closing the tab signs you out.
  const TOKEN_KEY = 'momento_auth_token';
  // Generous on purpose: a free-tier host (e.g. Render) puts the API to
  // sleep when idle, and the first request after that can take ~30-50 s.
  const DEFAULT_TIMEOUT_MS = 45000;

  class ApiError extends Error {
    constructor(message, status, errors) {
      super(message);
      this.status = status; // 0 means the server could not be reached at all
      this.errors = errors || null;
    }
  }

  const getToken = () => sessionStorage.getItem(TOKEN_KEY);
  const setToken = (token) => sessionStorage.setItem(TOKEN_KEY, token);
  const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

  // A token the server no longer accepts (expired, or signed out elsewhere):
  // forget the session and send the user to the login page.
  function handleExpiredSession() {
    clearToken();
    sessionStorage.removeItem('momento_current_user');
    if (!/login\.html$/.test(window.location.pathname)) {
      sessionStorage.setItem('momento_auth_redirect', window.location.pathname);
      window.location.href = 'login.html';
    }
  }

  async function request(path, { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(BASE_URL + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
    } catch (err) {
      const message = err.name === 'AbortError'
        ? 'The Momento server took too long to respond. Please try again.'
        : 'Could not reach the Momento server. Check your connection and try again.';
      throw new ApiError(message, 0);
    } finally {
      clearTimeout(timer);
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch {}

    if (!response.ok) {
      if (response.status === 401 && token) handleExpiredSession();
      const message = (payload && payload.message) || `Request failed (${response.status})`;
      throw new ApiError(message, response.status, payload && payload.errors);
    }

    return payload ? payload.data : null;
  }

  window.MomentoApi = {
    BASE_URL,
    ApiError,
    getToken,
    setToken,
    clearToken,
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body: body || {} }),
    put: (path, body) => request(path, { method: 'PUT', body }),
    del: (path) => request(path, { method: 'DELETE' })
  };
})();
