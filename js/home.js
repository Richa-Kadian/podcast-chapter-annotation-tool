/* =============================================================
   MOMENTO — Home / Landing Page Logic
   js/home.js
   ============================================================= */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const { $, $$, toast, LIB_KEY } = window.Momento;

  // -------------------------------------------------------------
  // 1. Hero Live Sync Simulation
  //    Runs on requestAnimationFrame instead of a fixed 100ms
  //    setInterval so it's smooth, doesn't drift over time, and
  //    pauses automatically when the tab isn't visible.
  //
  //    DEMO_LOOP_SECONDS (42) is kept as-is on purpose — it's the
  //    simulated lecture length shown in the 00:00 / 00:42 labels.
  //    DEMO_PLAYBACK_SPEED controls how fast real time maps to
  //    that simulated time. At 1x a full loop took a literal 42
  //    real seconds, which read as sluggish; at 4x it completes
  //    in ~10.5s, which feels alive without changing any content.
  // -------------------------------------------------------------
  const demoLine = $('#demoLine');
  const demoFill = $('#demoFill');
  const demoCursor = $('#demoCursor');

  const DEMO_SENTENCES = [
    { text: 'A closure gives you access to an outer function’s scope from an inner function.', start: 0, end: 7 },
    { text: 'In JavaScript, closures are created every single time a function is created.', start: 7, end: 15 },
    { text: 'To use a closure, define a function inside another function and expose it.', start: 15, end: 24 },
    { text: 'The inner function will have access to the variables in the outer function scope.', start: 24, end: 34 },
    { text: 'This is the fundamental mechanism behind data encapsulation in JavaScript.', start: 34, end: 42 }
  ];

  const DEMO_LOOP_SECONDS = 42;
  const DEMO_PLAYBACK_SPEED = 4;

  let demoStartedAt = null;
  let demoPausedSimTime = 0;
  let demoRafId = null;
  let demoLastSentenceText = '';

  function renderDemoFrame(simTime) {
    const pct = (simTime / DEMO_LOOP_SECONDS) * 100;
    if (demoFill) demoFill.style.width = pct + '%';
    if (demoCursor) demoCursor.style.left = pct + '%';

    const activeSentence = DEMO_SENTENCES.find(s => simTime >= s.start && simTime < s.end) || DEMO_SENTENCES[0];
    if (demoLine && demoLastSentenceText !== activeSentence.text) {
      demoLastSentenceText = activeSentence.text;
      demoLine.innerHTML = activeSentence.text.replace(
        /(closure|scope|function|variables|encapsulation)/gi,
        '<span class="hl">$1</span>'
      );
    }
  }

  function tickDemo(now) {
    if (demoStartedAt === null) demoStartedAt = now;
    const elapsedReal = (now - demoStartedAt) / 1000;
    const simTime = (demoPausedSimTime + elapsedReal * DEMO_PLAYBACK_SPEED) % DEMO_LOOP_SECONDS;
    renderDemoFrame(simTime);
    demoRafId = requestAnimationFrame(tickDemo);
  }

  function startDemo() {
    demoStartedAt = null;
    demoRafId = requestAnimationFrame(tickDemo);
  }

  function stopDemoAndRememberPosition() {
    if (demoRafId) cancelAnimationFrame(demoRafId);
    demoRafId = null;
    if (demoStartedAt !== null) {
      const elapsedReal = (performance.now() - demoStartedAt) / 1000;
      demoPausedSimTime = (demoPausedSimTime + elapsedReal * DEMO_PLAYBACK_SPEED) % DEMO_LOOP_SECONDS;
    }
  }

  if (demoLine || demoFill || demoCursor) {
    startDemo();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopDemoAndRememberPosition();
      } else {
        startDemo();
      }
    });
  }

  // -------------------------------------------------------------
  // 2. Library Count Indicator
  // -------------------------------------------------------------
  const libNote = $('#lib-count-note');
  if (libNote) {
    try {
      const raw = localStorage.getItem(LIB_KEY);
      const items = raw ? JSON.parse(raw) : [];
      if (items.length > 0) {
        libNote.innerHTML = `📚 <b>${items.length}</b> study session${items.length === 1 ? '' : 's'} saved in your browser. <a href="app.html" style="color:var(--amber); text-decoration:underline; font-weight:600;">Open your library →</a>`;
      }
    } catch {}
  }

  // -------------------------------------------------------------
  // 3. Use Cases Tab Switcher
  // -------------------------------------------------------------
  const ucTabs = $$('.uc-tab');
  const ucContents = $$('.uc-content');

  ucTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      ucTabs.forEach(t => t.classList.remove('active'));
      ucContents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetContent = $(`#uc-${target}`);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // -------------------------------------------------------------
  // 4. Interactive Podcast Feature Hub & Telemetry
  // -------------------------------------------------------------
  const hubCoreBtn = $('#hubCoreBtn');
  const hubVisualizer = $('#hubVisualizer');
  let hubActive = false;

  if (hubCoreBtn) {
    hubCoreBtn.addEventListener('click', () => {
      hubActive = !hubActive;
      hubCoreBtn.setAttribute('aria-expanded', String(hubActive));
      if (hubVisualizer) {
        hubVisualizer.style.display = hubActive ? 'flex' : 'none';
      }
      toast(hubActive ? '🎙️ AI Podcast Deck Synced!' : 'AI Podcast Deck Paused.');
    });
  }

  // Interactive HUD Telemetry
  // Note: these are role="button" divs (not native <button>), so
  // clicking already worked but Enter/Space did nothing for
  // keyboard users despite tabindex="0" implying they should.
  $$('.hud-stat.interactive').forEach((stat) => {
    stat.addEventListener('click', () => {
      const type = stat.dataset.hud;
      if (type === 'gain') {
        const bar = $('#hudGainBar');
        const current = parseInt(bar.style.width, 10) || 75;
        const next = current >= 100 ? 50 : current + 25;
        bar.style.width = next + '%';
        toast(`Audio Gain: ${next}%`);
      } else if (type === 'speed') {
        const val = $('#hudSpeedVal');
        const speeds = ['1.0x', '1.25x', '1.5x', '2.0x'];
        const next = speeds[(speeds.indexOf(val.textContent) + 1) % speeds.length];
        val.textContent = next;
        toast(`Playback Speed: ${next}`);
      } else if (type === 'stereo') {
        const val = $('#hudStereoVal');
        val.textContent = val.textContent === 'L-R' ? 'SPATIAL 3D' : 'L-R';
        toast(`Audio Channel: ${val.textContent}`);
      } else if (type === 'latency') {
        const val = $('#hudLatencyVal');
        val.textContent = `${Math.floor(Math.random() * 8 + 8)} ms`;
        toast(`Network Latency: ${val.textContent}`);
      } else if (type === 'deck-state') {
        const val = $('#hudStateBadge');
        val.textContent = val.textContent === 'READY' ? 'SYNCED' : 'READY';
        toast(`Deck State: ${val.textContent}`);
      }
    });

    stat.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        stat.click();
      }
    });
  });

  // -------------------------------------------------------------
  // Feature Node Previews (Modal)
  // -------------------------------------------------------------
  const hubModal = $('#hubModal');
  const hubModalCard = $('#hubModalCard');
  const hubModalTitle = $('#hubModalTitle');
  const hubModalDesc = $('#hubModalDesc');
  const hubModalBody = $('#hubModalBody');
  const hubModalClose = $('#hubModalClose');
  const hubModalDismiss = $('#hubModalDismiss');
  const hubModalStudioBtn = $('#hubModalStudioBtn');

  const FEATURE_INFO = {
    transcript: {
      title: 'Synced Transcript Engine',
      desc: 'Real-time text tracking mapped directly to audio and video timestamps.',
      body: 'Utilizes a hand-coded Binary Search algorithm ($O(\\log n)$) to highlight active transcript sentences in < 2ms, with instantaneous jump-to-time capabilities.'
    },
    video: {
      title: 'Smart Error Video Review',
      desc: 'Never get stuck on a missed question.',
      body: 'Whenever a user selects an incorrect quiz answer, Momento automatically embeds a mini review player seeking directly to the exact second that explains the answer.'
    },
    quiz: {
      title: 'Active Recall Quiz Generator',
      desc: 'Dynamic questions generated directly from lecture transcript sentences.',
      body: 'Extracts core sentences across detected chapters, blanks target keywords, and generates intelligent distractors using other lecture topics.'
    },
    flashcards: {
      title: '3D Interactive Flashcards',
      desc: 'Rapid term drills with 3D card flips.',
      body: 'Automatically categorizes concepts and provides spaced-repetition tracking ("Known" vs "To Review") saved to browser LocalStorage.'
    },
    notes: {
      title: 'Timestamp-Linked Smart Notes',
      desc: 'Write notes with live audio timecodes.',
      body: 'Every note captures your current playback timestamp. Clicking a note in your study list seeks the player right back to that lecture moment.'
    },
    chapters: {
      title: 'Auto Chapter Detection',
      desc: 'Sliding-window keyword frequency analysis.',
      body: 'Detects natural topic transitions across the lecture and sets visual chapter pills on the playback track.'
    }
  };

  let lastFocusedTrigger = null;

  function openHubModal(triggerEl, info) {
    if (!hubModal) return;
    lastFocusedTrigger = triggerEl || document.activeElement;

    if (hubModalTitle) hubModalTitle.textContent = info.title;
    if (hubModalDesc) hubModalDesc.textContent = info.desc;
    if (hubModalBody) hubModalBody.textContent = info.body;

    hubModal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog for keyboard/screen-reader users
    requestAnimationFrame(() => {
      if (hubModalCard) hubModalCard.focus({ preventScroll: true });
    });
  }

  function closeHubModal() {
    if (!hubModal || !hubModal.classList.contains('open')) return;
    hubModal.classList.remove('open');
    document.body.style.overflow = '';
    if (lastFocusedTrigger && typeof lastFocusedTrigger.focus === 'function') {
      lastFocusedTrigger.focus({ preventScroll: true });
    }
    lastFocusedTrigger = null;
  }

  $$('.hub-node').forEach((node) => {
    node.addEventListener('click', () => {
      const feat = node.dataset.feature;
      const info = FEATURE_INFO[feat];
      if (!info) return;
      openHubModal(node, info);
    });
  });

  if (hubModalClose) hubModalClose.addEventListener('click', closeHubModal);
  if (hubModalDismiss) hubModalDismiss.addEventListener('click', closeHubModal);
  if (hubModalStudioBtn) {
    hubModalStudioBtn.addEventListener('click', () => {
      window.location.href = 'app.html';
    });
  }

  // Close on backdrop click (clicking the dark overlay itself, not its contents)
  if (hubModal) {
    hubModal.addEventListener('click', (e) => {
      if (e.target === hubModal) closeHubModal();
    });
  }

  // Close on Escape, whenever the modal is open
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && hubModal && hubModal.classList.contains('open')) {
      closeHubModal();
    }
  });
});