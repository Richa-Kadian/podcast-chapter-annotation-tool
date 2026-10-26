/* =============================================================
   MOMENTO — Frontend Configuration
   js/config.js — Loaded first on every page
   -------------------------------------------------------------
   The ONLY place the backend address is written down.
   After deploying the backend, paste its URL into PRODUCTION_API_URL.
   ============================================================= */

(() => {
  'use strict';

  const LOCAL_API_URL = 'http://localhost:5050/api';
  const PRODUCTION_API_URL = 'https://momento-api.onrender.com/api';

  // Opening the site from localhost / 127.0.0.1 (VS Code Live Server,
  // `npx serve`, ...) talks to the backend running on this machine;
  // anywhere else uses the deployed backend.
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    || window.location.protocol === 'file:';

  window.MOMENTO_CONFIG = {
    API_BASE_URL: isLocal ? LOCAL_API_URL : PRODUCTION_API_URL
  };
})();
