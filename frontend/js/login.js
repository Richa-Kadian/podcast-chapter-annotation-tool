/* =============================================================
   MOMENTO — Login & Registration Page Logic
   js/login.js
   ============================================================= */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const { $, toast, api, setCurrentUser, legacyScopedKey, USERS_KEY, LIB_KEY, STREAK_KEY } = window.Momento;

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // -------------------------------------------------------------
  // Small shared helpers for inline field validation UI
  // -------------------------------------------------------------
  function showFieldError(field, errEl) {
    if (field) {
      field.classList.add('invalid');
      field.setAttribute('aria-invalid', 'true');
    }
    if (errEl) errEl.classList.add('on');
  }

  function clearFieldError(field, errEl) {
    if (field) {
      field.classList.remove('invalid');
      field.removeAttribute('aria-invalid');
    }
    if (errEl) errEl.classList.remove('on');
  }

  function focusAndScroll(field) {
    if (!field) return;
    field.focus({ preventScroll: true });
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field.classList.add('shake');
    field.addEventListener('animationend', () => field.classList.remove('shake'), { once: true });
  }

  function setBtnLoading(btn, isLoading, loadingText) {
    if (!btn) return;
    if (isLoading) {
      btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
      btn.textContent = loadingText;
      btn.setAttribute('disabled', 'true');
    } else {
      btn.textContent = btn.dataset.originalText || btn.textContent;
      btn.removeAttribute('disabled');
    }
  }

  // -------------------------------------------------------------
  // Form View Toggle (Sign In <-> Create Account)
  // -------------------------------------------------------------
  const loginView = $('#auth-login-view');
  const signupView = $('#auth-signup-view');
  const toggleToSignup = $('#toggleToSignup');
  const toggleToLogin = $('#toggleToLogin');
  const loginForm = $('#loginForm');
  const signupForm = $('#signupForm');

  function resetFormErrors(form) {
    if (!form) return;
    form.querySelectorAll('.field').forEach((f) => {
      f.classList.remove('invalid', 'shake');
      f.removeAttribute('aria-invalid');
    });
    form.querySelectorAll('.err-text').forEach((e) => e.classList.remove('on'));
    form.querySelectorAll('.vc-item').forEach((i) => i.classList.remove('invalid'));
  }

  if (toggleToSignup && toggleToLogin) {
    toggleToSignup.addEventListener('click', () => {
      resetFormErrors(loginForm);
      loginView.style.display = 'none';
      signupView.style.display = 'block';
      const nameField = $('#signupName');
      if (nameField) nameField.focus({ preventScroll: true });
    });
    toggleToLogin.addEventListener('click', () => {
      resetFormErrors(signupForm);
      signupView.style.display = 'none';
      loginView.style.display = 'block';
      const emailField = $('#loginEmail');
      if (emailField) emailField.focus({ preventScroll: true });
    });
  }

  // -------------------------------------------------------------
  // 1. Sign In Form & Validation
  // -------------------------------------------------------------
  const loginEmail = $('#loginEmail');
  const loginPassword = $('#loginPassword');
  const loginEmailErr = $('#loginEmailErr');
  const loginPasswordErr = $('#loginPasswordErr');
  const loginEmailErrMsg = $('#loginEmailErrMsg');
  const loginSubmitBtn = $('#loginSubmitBtn');

  // Clear a field's error the moment the user starts fixing it
  if (loginEmail) {
    loginEmail.addEventListener('input', () => {
      if (loginEmail.value.trim() && EMAIL_RE.test(loginEmail.value.trim())) {
        clearFieldError(loginEmail, loginEmailErr);
      }
    });
  }
  if (loginPassword) {
    loginPassword.addEventListener('input', () => {
      if (loginPassword.value) clearFieldError(loginPassword, loginPasswordErr);
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = loginEmail.value.trim().toLowerCase();
      const password = loginPassword.value;

      clearFieldError(loginEmail, loginEmailErr);
      clearFieldError(loginPassword, loginPasswordErr);

      let firstInvalid = null;

      if (!email) {
        if (loginEmailErrMsg) loginEmailErrMsg.textContent = 'Email address is required.';
        showFieldError(loginEmail, loginEmailErr);
        firstInvalid = firstInvalid || loginEmail;
      } else if (!EMAIL_RE.test(email)) {
        if (loginEmailErrMsg) loginEmailErrMsg.textContent = 'Please enter a valid email address.';
        showFieldError(loginEmail, loginEmailErr);
        firstInvalid = firstInvalid || loginEmail;
      }

      if (!password) {
        showFieldError(loginPassword, loginPasswordErr);
        firstInvalid = firstInvalid || loginPassword;
      }

      if (firstInvalid) {
        focusAndScroll(firstInvalid);
        return;
      }

      setBtnLoading(loginSubmitBtn, true, 'Signing in…');

      try {
        // The server checks the password against the bcrypt hash in MongoDB.
        const { user, token } = await api.post('/auth/login', { email, password });
        setCurrentUser(user, token);
        toast(`Welcome back, ${user.name}!`);
        const imported = await offerLegacyImport(findLegacyUserIds(email));
        setTimeout(() => {
          const redirect = sessionStorage.getItem('momento_auth_redirect') || 'index.html';
          sessionStorage.removeItem('momento_auth_redirect');
          window.location.href = redirect;
        }, imported ? 1800 : 500);
      } catch (err) {
        setBtnLoading(loginSubmitBtn, false);
        if (err.status !== 401) {
          // Server unreachable, too many attempts, etc. — not a wrong password.
          toast(err.message, { err: true });
          return;
        }
        toast('Invalid email or password. Please try again or create an account.', { err: true });
        showFieldError(loginEmail, loginEmailErr);
        showFieldError(loginPassword, loginPasswordErr);
        if (loginEmailErrMsg) loginEmailErrMsg.textContent = 'We couldn\u2019t match this email and password.';
        loginEmailErr.classList.add('on');
        loginPasswordErr.classList.remove('on');
        focusAndScroll(loginEmail);
      }
    });
  }

  // -------------------------------------------------------------
  // 2. Sign Up Form & Live Criteria Validation
  // -------------------------------------------------------------
  const signupName = $('#signupName');
  const signupEmail = $('#signupEmail');
  const signupPassword = $('#signupPassword');
  const signupConfirm = $('#signupConfirmPassword');
  const signupSubmitBtn = $('#signupSubmitBtn');

  const signupNameErr = $('#signupNameErr');
  const signupEmailErr = $('#signupEmailErr');
  const signupPasswordErr = $('#signupPasswordErr');
  const signupConfirmErr = $('#signupConfirmErr');

  const scEmail = $('#scEmail');
  const scPassword = $('#scPassword');
  const scMatch = $('#scMatch');

  // Only start showing red "invalid" states once the user has tried
  // to submit once — avoids nagging red borders on a fresh form.
  let signupAttempted = false;

  function validateLiveSignup() {
    const email = signupEmail ? signupEmail.value.trim() : '';
    const pwd = signupPassword ? signupPassword.value : '';
    const conf = signupConfirm ? signupConfirm.value : '';

    const emailValid = EMAIL_RE.test(email);
    const pwdValid = pwd.length >= 8 && /\d/.test(pwd) && /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    const matchValid = pwd.length > 0 && pwd === conf;

    if (scEmail) {
      scEmail.classList.toggle('valid', emailValid);
      scEmail.classList.toggle('invalid', signupAttempted && !emailValid);
    }
    if (scPassword) {
      scPassword.classList.toggle('valid', pwdValid);
      scPassword.classList.toggle('invalid', signupAttempted && !pwdValid);
    }
    if (scMatch) {
      scMatch.classList.toggle('valid', matchValid);
      scMatch.classList.toggle('invalid', signupAttempted && !matchValid);
    }

    if (signupAttempted) {
      emailValid ? clearFieldError(signupEmail, signupEmailErr) : showFieldError(signupEmail, signupEmailErr);
      pwdValid ? clearFieldError(signupPassword, signupPasswordErr) : showFieldError(signupPassword, signupPasswordErr);
      matchValid ? clearFieldError(signupConfirm, signupConfirmErr) : showFieldError(signupConfirm, signupConfirmErr);
    }

    return emailValid && pwdValid && matchValid;
  }

  if (signupName) {
    signupName.addEventListener('input', () => {
      if (signupName.value.trim().length >= 2) clearFieldError(signupName, signupNameErr);
    });
  }
  if (signupEmail) signupEmail.addEventListener('input', validateLiveSignup);
  if (signupPassword) signupPassword.addEventListener('input', validateLiveSignup);
  if (signupConfirm) signupConfirm.addEventListener('input', validateLiveSignup);

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      signupAttempted = true;

      const name = signupName.value.trim();
      const email = signupEmail.value.trim().toLowerCase();
      const password = signupPassword.value;

      clearFieldError(signupName, signupNameErr);

      let firstInvalid = null;

      if (!name || name.length < 2) {
        showFieldError(signupName, signupNameErr);
        firstInvalid = signupName;
      }

      const criteriaValid = validateLiveSignup();
      if (!criteriaValid) {
        if (!firstInvalid) {
          if (signupEmail.classList.contains('invalid')) firstInvalid = signupEmail;
          else if (signupPassword.classList.contains('invalid')) firstInvalid = signupPassword;
          else if (signupConfirm.classList.contains('invalid')) firstInvalid = signupConfirm;
        }
      }

      if (firstInvalid) {
        focusAndScroll(firstInvalid);
        toast('Please fix the highlighted fields below.', { err: true });
        return;
      }

      setBtnLoading(signupSubmitBtn, true, 'Creating account…');

      try {
        // The server hashes the password; it is never stored in the browser.
        const { user, token } = await api.post('/auth/signup', { name, email, password });
        setCurrentUser(user, token);
        toast(`Account created! Welcome to Momento, ${name}.`);
        const imported = await offerLegacyImport(findLegacyUserIds(email));
        setTimeout(() => { window.location.href = 'index.html'; }, imported ? 1800 : 500);
      } catch (err) {
        setBtnLoading(signupSubmitBtn, false);
        if (err.status === 409) {
          showFieldError(signupEmail, signupEmailErr);
          toast('An account with this email already exists. Please sign in.', { err: true });
          focusAndScroll(signupEmail);
          return;
        }
        toast(err.message, { err: true });
      }
    });
  }

  // -------------------------------------------------------------
  // Demo Login Shortcut
  // -------------------------------------------------------------
  // Signs into the shared demo account on the server. Only works when
  // the backend has DEMO_LOGIN_ENABLED=true.
  const demoLoginBtn = $('#demoLoginBtn');
  if (demoLoginBtn) {
    demoLoginBtn.addEventListener('click', async () => {
      setBtnLoading(demoLoginBtn, true, 'Signing in…');
      try {
        const { user, token } = await api.post('/auth/demo');
        setCurrentUser(user, token);
        toast('Signed in with 1-Click Evaluation Student Demo.');
        const imported = await offerLegacyImport([LEGACY_DEMO_USER_ID]);
        setTimeout(() => { window.location.href = 'index.html'; }, imported ? 1800 : 400);
      } catch (err) {
        setBtnLoading(demoLoginBtn, false);
        toast(err.status === 404 ? 'Demo access is turned off on this server. Please create an account.' : err.message, { err: true });
      }
    });
  }

  // -------------------------------------------------------------
  // 3. One-Time Import of Data Saved Before the Backend Existed
  // -------------------------------------------------------------
  // Older versions kept accounts and libraries only in LocalStorage.
  // After signing in, we look for that data (matched by email) and offer
  // to copy it into the user's MongoDB account. The server assigns the
  // records to the signed-in user and skips anything already imported.
  // The original LocalStorage data is never deleted here.
  const LEGACY_DEMO_USER_ID = 'u_demo_eval'; // id the old demo button used

  function readLocalJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value === null || value === undefined ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function findLegacyUserIds(email) {
    const users = readLocalJson(USERS_KEY, []);
    if (!Array.isArray(users)) return [];
    return users
      .filter((u) => u && typeof u.email === 'string' && u.email.toLowerCase() === email)
      .map((u) => u.id);
  }

  function collectLegacyData(localUserId) {
    const library = readLocalJson(legacyScopedKey(LIB_KEY, localUserId), []);
    const lectures = (Array.isArray(library) ? library : []).map((session) => ({
      ...session,
      legacyId: session.id,
      notes: readLocalJson(`momento_notes_${session.id}`, []),
      flashcards: readLocalJson(`momento_fc_states_${session.id}`, null)
    }));
    return { lectures, streak: readLocalJson(legacyScopedKey(STREAK_KEY, localUserId), null) };
  }

  // Returns true if an import was attempted (so the caller can leave the
  // result toast on screen a little longer before redirecting).
  async function offerLegacyImport(localUserIds) {
    let attempted = false;

    for (const localUserId of localUserIds) {
      const doneKey = `momento_migrated_v1__${localUserId}`;
      if (localStorage.getItem(doneKey)) continue;

      const data = collectLegacyData(localUserId);
      const hasStreak = data.streak && data.streak.best > 0;
      if (!data.lectures.length && !hasStreak) continue;

      const count = data.lectures.length;
      const wantsImport = confirm(
        `We found ${count} study session${count === 1 ? '' : 's'} saved in this browser from before Momento had online accounts.\n\nImport ${count === 1 ? 'it' : 'them'} into your account?`
      );
      if (!wantsImport) continue; // we will ask again next time

      attempted = true;
      try {
        const result = await api.post('/migration/local-storage', data);
        // Only stop offering once everything went in; failures can be retried.
        if (result.failed.length === 0) localStorage.setItem(doneKey, new Date().toISOString());
        const failedText = result.failed.length ? `, ${result.failed.length} could not be imported` : '';
        toast(`Imported ${result.imported} session(s)${result.skipped ? `, ${result.skipped} already imported` : ''}${failedText}.`, { err: result.failed.length > 0, ms: 4000 });
      } catch (err) {
        toast(`Import failed: ${err.message} Your browser data was left untouched.`, { err: true, ms: 4000 });
      }
    }

    return attempted;
  }
});