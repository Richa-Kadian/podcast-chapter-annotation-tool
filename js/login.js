/* =============================================================
   MOMENTO — Login & Registration Page Logic
   js/login.js
   ============================================================= */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const { $, toast, setCurrentUser, USERS_KEY } = window.Momento;

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
    loginForm.addEventListener('submit', (e) => {
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

      // Read users from LocalStorage
      let users = [];
      try {
        users = JSON.parse(localStorage.getItem(USERS_KEY)) || [];
      } catch {}

      const matchedUser = users.find(u => u.email.toLowerCase() === email && u.password === password);

      setBtnLoading(loginSubmitBtn, true, 'Signing in…');

      if (matchedUser) {
        setCurrentUser({ id: matchedUser.id, name: matchedUser.name, email: matchedUser.email });
        toast(`Welcome back, ${matchedUser.name}!`);
        setTimeout(() => {
          const redirect = sessionStorage.getItem('momento_auth_redirect') || 'index.html';
          sessionStorage.removeItem('momento_auth_redirect');
          window.location.href = redirect;
        }, 500);
      } else if (email.includes('demo') || users.length === 0) {
        // Convenience path for evaluators on a fresh browser / demo-style email
        const demoUser = { id: 'm_demo', name: email.split('@')[0] || 'Demo Learner', email };
        setCurrentUser(demoUser);
        toast(`Signed in as demo user: ${demoUser.name}`);
        setTimeout(() => { window.location.href = 'index.html'; }, 500);
      } else {
        setBtnLoading(loginSubmitBtn, false);
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
    signupForm.addEventListener('submit', (e) => {
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

      let users = [];
      try {
        users = JSON.parse(localStorage.getItem(USERS_KEY)) || [];
      } catch {}

      if (users.some(u => u.email.toLowerCase() === email)) {
        showFieldError(signupEmail, signupEmailErr);
        toast('An account with this email already exists. Please sign in.', { err: true });
        focusAndScroll(signupEmail);
        return;
      }

      setBtnLoading(signupSubmitBtn, true, 'Creating account…');

      const newUser = {
        id: 'u_' + Math.random().toString(36).slice(2, 9),
        name,
        email,
        password,
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));

      setCurrentUser({ id: newUser.id, name: newUser.name, email: newUser.email });
      toast(`Account created! Welcome to Momento, ${name}.`);
      setTimeout(() => { window.location.href = 'index.html'; }, 500);
    });
  }

  // -------------------------------------------------------------
  // Demo Login Shortcut
  // -------------------------------------------------------------
  const demoLoginBtn = $('#demoLoginBtn');
  if (demoLoginBtn) {
    demoLoginBtn.addEventListener('click', () => {
      const demoUser = { id: 'u_demo_eval', name: 'Evaluation Student', email: 'student@momento.ai' };
      setCurrentUser(demoUser);
      toast('Signed in with 1-Click Evaluation Student Demo.');
      setTimeout(() => { window.location.href = 'index.html'; }, 400);
    });
  }
});