/* =============================================================
   MOMENTO — Study Tool Application Core Logic
   js/app.js — Loaded on app.html
   ============================================================= */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const {
    $,
    $$,
    fmtTime,
    uid,
    escapeHtml,
    wait,
    fetchWithTimeout,
    toast,
    getCurrentUser,
    requireAuth,
    LIB_KEY,
    STREAK_KEY
  } = window.Momento;

  // -------------------------------------------------------------
  // 0. Auth Guard
  // -------------------------------------------------------------
  if (!getCurrentUser()) {
    // If not logged in, redirect to login page
    toast('Please sign in or create an account to access the study tool.', { err: true });
    setTimeout(() => {
      sessionStorage.setItem('momento_auth_redirect', 'app.html');
      window.location.href = 'login.html';
    }, 600);
    return;
  }

  // -------------------------------------------------------------
  // Data Constants & Speakers
  // -------------------------------------------------------------
  const SPEAKERS = ['Prof. Miller', 'Dr. Aris', 'TA Alex', 'Prof. Miller'];
  const TOPIC_BLOCKS = [
    {
      keyword: 'variables',
      sentences: [
        'Let us begin by understanding how variables hold references in memory.',
        'In JavaScript, const and let provide block scope which prevents memory leaks.',
        'Primitive data types are immutable and passed by value across execution contexts.',
        'Always declare variables deliberately to maintain clean functional boundaries.'
      ]
    },
    {
      keyword: 'functions',
      sentences: [
        'Functions are first-class citizens and can be passed as arguments freely.',
        'When an inner function retains access to outer variables, we form a closure.',
        'Arrow functions do not bind their own this context, which simplifies callbacks.',
        'Higher-order functions like map, filter, and reduce enable declarative data pipelines.'
      ]
    },
    {
      keyword: 'arrays',
      sentences: [
        'Arrays in JavaScript are dynamic and provide continuous indexed sequences.',
        'Array destructuring allows elegant unpacking of values from lists.',
        'Methods like slice produce shallow copies while splice mutates in-place.',
        'Iterating with forEach or modern for-of loops keeps iteration clean and readable.'
      ]
    },
    {
      keyword: 'dom',
      sentences: [
        'The Document Object Model represents HTML elements as a traversable tree.',
        'Using querySelector and event listeners binds user actions to JavaScript routines.',
        'Manipulating classList allows smooth visual state transitions without heavy re-renders.',
        'Event delegation optimizes memory by attaching one listener to a parent container.'
      ]
    },
    {
      keyword: 'async',
      sentences: [
        'Asynchronous JavaScript relies on the event loop, microtasks, and macrotasks.',
        'Promises represent eventual completion or failure of an asynchronous operation.',
        'Async and await syntax allows writing asynchronous code with synchronous readability.',
        'Always wrap network calls with try-catch blocks to gracefully handle network failures.'
      ]
    }
  ];

  // -------------------------------------------------------------
  // 1. YouTube & Media Helpers
  // -------------------------------------------------------------
  function extractYouTubeId(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) {
        return u.searchParams.get('v');
      }
      if (u.hostname === 'youtu.be') {
        return u.pathname.slice(1).split('?')[0];
      }
      if (u.hostname.includes('youtube.com') && u.pathname.startsWith('/embed/')) {
        return u.pathname.split('/')[2];
      }
    } catch {}
    return null;
  }

  function isDirectVideoUrl(url) {
    try {
      const u = new URL(url);
      return /\.(mp4|webm|ogg|mov|mkv|avi)(\?|$)/i.test(u.pathname);
    } catch {
      return false;
    }
  }

  function youtubeEmbedUrl(ytId, startSeconds = 0, autoplay = false) {
    const start = Math.floor(startSeconds);
    return `https://www.youtube.com/embed/${ytId}?start=${start}&rel=0&modestbranding=1${autoplay ? '&autoplay=1' : ''}&enablejsapi=1`;
  }

  // -------------------------------------------------------------
  // 2. Hand-Coded Algorithms
  // -------------------------------------------------------------

  // Algorithm 1: Binary Search O(log n) Transcript Sync
  function findActiveLineIndex(lines, time) {
    if (!lines || !lines.length) return -1;
    let low = 0;
    let high = lines.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const line = lines[mid];

      if (time >= line.start && time < line.end) {
        return mid;
      }
      if (time < line.start) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    return -1;
  }

  // Algorithm 2: Keyword-Frequency Chapter Detection
  function detectChapters(lines) {
    if (!lines || !lines.length) return [];
    const WINDOW = 3;
    const chapters = [];
    let currentKeyword = null;
    let holdCount = 0;

    lines.forEach((line, idx) => {
      const windowSlice = lines.slice(idx, idx + WINDOW);
      const freq = {};
      windowSlice.forEach((l) => { freq[l.keyword] = (freq[l.keyword] || 0) + 1; });
      const dominant = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];

      if (dominant !== currentKeyword) {
        holdCount += 1;
        if (holdCount >= 2 || idx === 0) {
          chapters.push({ startIndex: idx, startTime: line.start, keyword: dominant });
          currentKeyword = dominant;
          holdCount = 0;
        }
      } else {
        holdCount = 0;
      }
    });

    const titleMap = {
      variables: 'Variables & Data References',
      functions: 'Functions & Scope Closures',
      arrays: 'Array Methods & Iteration',
      dom: 'DOM Tree & Event Handling',
      async: 'Promises & Asynchronous Loop'
    };

    return chapters.map((c, i) => ({
      ...c,
      title: titleMap[c.keyword] || (c.keyword.charAt(0).toUpperCase() + c.keyword.slice(1)),
      endTime: i + 1 < chapters.length ? chapters[i + 1].startTime : lines[lines.length - 1].end
    }));
  }

  // Algorithm 3: Rule-Based Quiz Generation
  function generateQuiz(session, maxQuestions = 5) {
    const questions = [];
    const lines = session.lines || [];
    if (!lines.length) return questions;

    const allKeywords = Array.from(new Set(lines.map(l => l.keyword)));

    lines.forEach((line, idx) => {
      const kw = line.keyword;
      if (!kw) return;

      const qText = line.text.replace(new RegExp(`\\b${kw}\\b`, 'i'), '__________');
      const distractors = allKeywords.filter(k => k.toLowerCase() !== kw.toLowerCase());
      const shuffledDistractors = distractors.sort(() => 0.5 - Math.random()).slice(0, 3);
      const options = [kw, ...shuffledDistractors].sort(() => 0.5 - Math.random());

      questions.push({
        id: 'q_' + idx,
        question: `Fill in the blank: "${qText}"`,
        answer: kw,
        options,
        timestamp: line.start,
        speaker: line.speaker,
        chapter: session.chapters?.find(c => line.start >= c.startTime && line.start < c.endTime)?.title || 'General Concept',
        quote: line.text,
        explanation: `Discussed at [${fmtTime(line.start)}] by ${line.speaker}. ${line.text}`
      });
    });

    const shuffled = questions.sort(() => 0.5 - Math.random());
    return maxQuestions === 'all' ? shuffled : shuffled.slice(0, Math.min(Number(maxQuestions) || 5, shuffled.length));
  }

  // Algorithm 4: Streak & Scoring Manager
  function getStreak() {
    try {
      return JSON.parse(localStorage.getItem(STREAK_KEY)) || { current: 0, best: 0, lastDate: null };
    } catch {
      return { current: 0, best: 0, lastDate: null };
    }
  }

  function recordStreak(scorePct) {
    const streak = getStreak();
    const today = new Date().toDateString();

    if (scorePct >= 60) {
      if (streak.lastDate !== today) {
        streak.current += 1;
        if (streak.current > streak.best) streak.best = streak.current;
        streak.lastDate = today;
      }
    }
    localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
    return streak;
  }

  // -------------------------------------------------------------
  // 3. Transcript Generation
  // -------------------------------------------------------------
  function generateTranscript(durationSeconds) {
    const linesPerBlock = 4;
    const totalLines = TOPIC_BLOCKS.length * linesPerBlock;
    const avgLineLen = Math.max(3, durationSeconds / totalLines);
    const lines = [];
    let t = 0;

    TOPIC_BLOCKS.forEach((block, blockIdx) => {
      block.sentences.forEach((sentence, i) => {
        const jitter = (Math.sin(blockIdx * 7 + i * 3) * 0.35 + 1);
        const len = Math.max(2.5, avgLineLen * jitter);
        const start = t;
        const end = Math.min(durationSeconds, t + len);
        lines.push({
          id: uid(),
          start,
          end,
          speaker: SPEAKERS[(blockIdx + i) % SPEAKERS.length],
          text: sentence,
          keyword: block.keyword
        });
        t = end;
      });
    });

    if (lines.length) lines[lines.length - 1].end = durationSeconds;
    return lines;
  }

  // -------------------------------------------------------------
  // 4. State & Library Persistence
  // -------------------------------------------------------------
  let library = [];
  let activeSession = null;
  let ytPlayerInstance = null;
  let isPlaying = false;
  let currentTime = 0;
  let timerInterval = null;

  function loadLibrary() {
    try {
      const raw = localStorage.getItem(LIB_KEY);
      library = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(library) || library.length === 0) {
        library = createDefaultLibrary();
        saveLibrary();
      }
    } catch {
      library = createDefaultLibrary();
      saveLibrary();
    }
    renderLibrary();
    updateDevPanel();
  }

  function saveLibrary() {
    try {
      localStorage.setItem(LIB_KEY, JSON.stringify(library));
      updateDevPanel();
    } catch {
      toast("Couldn't save to LocalStorage - storage may be full.", { err: true });
    }
  }

  function createDefaultLibrary() {
    const dur = 180;
    const lines = generateTranscript(dur);
    const chapters = detectChapters(lines);
    return [
      {
        id: 'session_demo_js',
        title: 'JavaScript Core Principles & Closures',
        type: 'sample',
        duration: dur,
        lines,
        chapters,
        genre: 'Computer Science',
        createdAt: new Date().toISOString(),
        bestScore: 100
      }
    ];
  }

  // -------------------------------------------------------------
  // 5. DOM Elements Binding
  // -------------------------------------------------------------
  const uploadForm = $('#uploadForm');
  const fileInput = $('#fileInput');
  const dropzone = $('#dropzone');
  const fileChipWrap = $('#fileChipWrap');
  const uploadErr = $('#uploadErr');
  const uploadErrMsg = $('#uploadErrMsg');
  const studentNameInput = $('#studentName');
  const nameErr = $('#nameErr');
  const processBtn = $('#processBtn');
  const processBar = $('#processBar');
  const pbarFill = $('#pbarFill');
  const pbarLabel = $('#pbarLabel');

  const linkInput = $('#linkInput');
  const linkSubmitBtn = $('#linkSubmitBtn');
  const linkErr = $('#linkErr');
  const linkErrMsg = $('#linkErrMsg');
  const linkProcessBar = $('#linkProcessBar');
  const linkPbarFill = $('#linkPbarFill');
  const linkPbarLabel = $('#linkPbarLabel');
  const ytThumbWrap = $('#ytThumbWrap');
  const ytThumb = $('#ytThumb');
  const ytTitle = $('#ytTitle');

  const inputTabs = $$('.input-tab');
  const linkPanel = $('#linkPanel');

  const libGrid = $('#libGrid');
  const libEmpty = $('#libEmpty');

  const workspace = $('#workspace');
  const wsTitle = $('#wsTitle');
  const wsMeta = $('#wsMeta');
  const wsTypeBadge = $('#wsTypeBadge');
  const wsDurationBadge = $('#wsDurationBadge');
  const wsChapterBadge = $('#wsChapterBadge');
  const wsBestScoreBadge = $('#wsBestScoreBadge');

  const videoEl = $('#videoEl');
  const ytPlayerWrap = $('#ytPlayerWrap');
  const playBtn = $('#playBtn');
  const playIcon = $('#playIcon');
  const curTimeLbl = $('#curTime');
  const durTimeLbl = $('#durTime');
  const seekTrack = $('#seekTrack');
  const seekFill = $('#seekFill');
  const seekHead = $('#seekHead');
  const chapMarksHost = $('#chapMarksHost');
  const chapLegend = $('#chapLegend');
  const syncActiveChapterTxt = $('#syncActiveChapterTxt');

  const searchInput = $('#searchInput');
  const searchResults = $('#searchResults');

  const transcriptList = $('#transcriptList');
  const wsTabBtns = $$('.ws-tab-btn');
  const wsPanels = $$('.ws-panel');

  const getTestBtn = $('#getTestBtn');
  const quizLenBtns = $$('.quiz-len-btn');
  let selectedQuizLen = '5';

  const quizOverlay = $('#quizOverlay');
  const quizCard = $('#quizCard');
  const quizClose = $('#quizClose');
  const quizPlay = $('#quizPlay');
  const quizProgress = $('#quizProgress');
  const quizChapterTag = $('#quizChapterTag');
  const quizTypeTag = $('#quizTypeTag');
  const quizQ = $('#quizQ');
  const quizOpts = $('#quizOpts');
  const inlineReview = $('#inlineReview');
  const inlineReviewTs = $('#inlineReviewTs');
  const inlineReviewOpen = $('#inlineReviewOpen');
  const inlineCorrectCallout = $('#inlineCorrectCallout');
  const inlineCorrectAnswerText = $('#inlineCorrectAnswerText');
  const inlineExplanationBox = $('#inlineExplanationBox');
  const inlineExplanationText = $('#inlineExplanationText');
  const inlineReviewLine = $('#inlineReviewLine');
  const inlineReviewPlayer = $('#inlineReviewPlayer');
  const quizFeedback = $('#quizFeedback');
  const quizResultTag = $('#quizResultTag');
  const nextBtn = $('#nextBtn');
  const resultsView = $('#resultsView');
  const resultsScore = $('#resultsScore');
  const resultsSub = $('#resultsSub');
  const streakRow = $('#streakRow');
  const badgeRow = $('#badgeRow');
  const weakList = $('#weakList');
  const weakItems = $('#weakItems');
  const closeResultsBtn = $('#closeResultsBtn');

  // Flashcards DOM
  const fcCard = $('#fcCard');
  const fcCardTagFront = $('#fcCardTagFront');
  const fcCardTextFront = $('#fcCardTextFront');
  const fcCardTagBack = $('#fcCardTagBack');
  const fcCardTextBack = $('#fcCardTextBack');
  const fcDeckProgress = $('#fcDeckProgress');
  const fcKnownBtn = $('#fcKnownBtn');
  const fcStudyingBtn = $('#fcStudyingBtn');
  const fcActiveArea = $('#fcActiveArea');
  const fcFinishedArea = $('#fcFinishedArea');
  const fcResetBtn = $('#fcResetBtn');
  const fcPileKnownCount = $('#fcPileKnownCount');
  const fcPileStudyingCount = $('#fcPileStudyingCount');

  // Notes DOM
  const notesForm = $('#notesForm');
  const noteInput = $('#noteInput');
  const notesList = $('#notesList');
  const exportNotesBtn = $('#exportNotesBtn');

  // AI Summary & Insights DOM
  const summaryContent = $('#summaryContent');
  const copySummaryBtn = $('#copySummaryBtn');
  const regenSummaryBtn = $('#regenSummaryBtn');
  const quickSummaryBtn = $('#quickSummaryBtn');
  const insightsSummary = $('#insightsSummary');
  const insightsKeyMoments = $('#insightsKeyMoments');
  const recGrid = $('#recGrid');

  // Dev panel toggle
  const devToggle = $('#devToggle');
  const devBody = $('#devBody');
  const devLibraryPre = $('#devLibraryPre');
  const devStreakPre = $('#devStreakPre');

  if (devToggle && devBody) {
    devToggle.addEventListener('click', () => {
      const open = devBody.classList.toggle('open');
      devToggle.setAttribute('aria-expanded', String(open));
    });
  }

  function updateDevPanel() {
    if (devLibraryPre) devLibraryPre.textContent = JSON.stringify(library, null, 2);
    if (devStreakPre) devStreakPre.textContent = JSON.stringify(getStreak(), null, 2);
  }

  // -------------------------------------------------------------
  // 6. Input Tabs (Upload vs Link)
  // -------------------------------------------------------------
  inputTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.tab;
      inputTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      if (mode === 'upload') {
        uploadForm.style.display = 'block';
        linkPanel.style.display = 'none';
      } else {
        uploadForm.style.display = 'none';
        linkPanel.style.display = 'block';
      }
    });
  });

  // Dropzone File Select
  const MAX_UPLOAD_BYTES = 300 * 1024 * 1024; // 300MB, as advertised in the dropzone copy
  const NAME_RX = /^[A-Za-z ]{2,40}$/;
  let selectedFile = null;

  function validateFileChoice(file) {
    if (!file.type.startsWith('audio') && !file.type.startsWith('video')) {
      return 'Please choose an audio or video file.';
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return 'File exceeds the 300MB limit. Please choose a smaller file.';
    }
    return null;
  }

  function showUploadError(message) {
    if (uploadErrMsg) uploadErrMsg.textContent = message;
    if (uploadErr) uploadErr.classList.add('on');
    if (dropzone) dropzone.classList.add('invalid');
  }

  function clearUploadError() {
    if (uploadErr) uploadErr.classList.remove('on');
    if (dropzone) dropzone.classList.remove('invalid');
  }

  function tryAcceptFile(file) {
    const err = validateFileChoice(file);
    if (err) {
      selectedFile = null;
      if (fileChipWrap) fileChipWrap.innerHTML = '';
      showUploadError(err);
      toast(err, { err: true });
      return;
    }
    handleSelectedFile(file);
  }

  function validateNameField() {
    if (!studentNameInput) return true;
    const v = studentNameInput.value.trim();
    const valid = v === '' || NAME_RX.test(v);
    studentNameInput.classList.toggle('invalid', !valid);
    if (nameErr) nameErr.classList.toggle('on', !valid);
    return valid;
  }

  if (studentNameInput) {
    studentNameInput.addEventListener('input', validateNameField);
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        tryAcceptFile(fileInput.files[0]);
      }
    });
  }

  if (dropzone) {
    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });
    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        tryAcceptFile(e.dataTransfer.files[0]);
      }
    });
    // Keyboard accessibility: the dropzone is a <label>, so give Enter/Space
    // the same effect as a click for people tabbing through with a keyboard.
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
  }

  function handleSelectedFile(file) {
    selectedFile = file;
    clearUploadError();
    if (fileChipWrap) {
      fileChipWrap.innerHTML = `
        <div class="file-chip">
          <span>📁 <b>${escapeHtml(file.name)}</b> (${(file.size / 1024 / 1024).toFixed(1)} MB)</span>
          <span class="remove" id="removeFileBtn" title="Remove file">✕</span>
        </div>
      `;
      $('#removeFileBtn').addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        fileChipWrap.innerHTML = '';
      });
    }
  }

  // Upload Form Submit
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nameValid = validateNameField();

      if (!selectedFile) {
        showUploadError('Please choose an audio or video file before continuing.');
        toast('Please choose an audio or video file first.', { err: true });
        dropzone.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => dropzone.focus({ preventScroll: true }), 200);
        return;
      }
      clearUploadError();

      if (!nameValid) {
        toast('Please fix the highlighted fields to continue.', { err: true });
        studentNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => studentNameInput.focus({ preventScroll: true }), 200);
        return;
      }

      processBtn.disabled = true;
      processBar.classList.add('on');
      pbarFill.style.width = '30%';
      pbarLabel.textContent = 'Reading media headers & calculating duration…';

      try {
        const fileUrl = URL.createObjectURL(selectedFile);
        const isVideo = selectedFile.type.startsWith('video');

        // Detect duration
        let detectedDuration = 180;
        try {
          detectedDuration = await new Promise((resolve) => {
            const tempMedia = document.createElement(isVideo ? 'video' : 'audio');
            tempMedia.src = fileUrl;
            tempMedia.onloadedmetadata = () => resolve(tempMedia.duration || 180);
            tempMedia.onerror = () => resolve(180);
          });
        } catch {}

        pbarFill.style.width = '70%';
        pbarLabel.textContent = 'Generating speech transcript & identifying speakers…';
        await wait(600);

        const lines = generateTranscript(detectedDuration);
        const chapters = detectChapters(lines);

        pbarFill.style.width = '100%';
        pbarLabel.textContent = 'Building study session…';
        await wait(400);

        const newSession = {
          id: uid(),
          title: selectedFile.name.replace(/\.[^/.]+$/, ''),
          type: isVideo ? 'video' : 'audio',
          duration: detectedDuration,
          lines,
          chapters,
          genre: 'Lecture Study',
          createdAt: new Date().toISOString(),
          bestScore: null
        };

        // Store blob URL in sessionStorage for active playback
        sessionStorage.setItem('momento_blob_' + newSession.id, fileUrl);

        library.unshift(newSession);
        saveLibrary();
        renderLibrary();

        toast(`Created session: "${newSession.title}"`);
        openSession(newSession);
      } catch (err) {
        toast("Something went wrong processing that file. Please try again.", { err: true });
      } finally {
        processBtn.disabled = false;
        processBar.classList.remove('on');
      }
    });
  }

  // Link Submit (YouTube or Direct Video)
  async function submitLinkForm() {
    const url = linkInput.value.trim();
    if (!url) {
      if (linkErr) linkErr.classList.add('on');
      if (linkErrMsg) linkErrMsg.textContent = 'Please enter a valid URL.';
      linkInput.classList.add('invalid');
      linkInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => linkInput.focus({ preventScroll: true }), 200);
      return;
    }

    const ytId = extractYouTubeId(url);
    const isDirect = isDirectVideoUrl(url);

    if (!ytId && !isDirect) {
      if (linkErr) linkErr.classList.add('on');
      if (linkErrMsg) linkErrMsg.textContent = 'URL must be a YouTube link or direct video file (.mp4, .webm).';
      linkInput.classList.add('invalid');
      linkInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => linkInput.focus({ preventScroll: true }), 200);
      return;
    }

    if (linkErr) linkErr.classList.remove('on');
    linkInput.classList.remove('invalid');
    linkSubmitBtn.disabled = true;
    linkProcessBar.classList.add('on');
    linkPbarFill.style.width = '40%';
    linkPbarLabel.textContent = 'Resolving media link…';

    try {
      await wait(500);
      linkPbarFill.style.width = '80%';
      linkPbarLabel.textContent = 'Synthesizing lecture transcript & chapter boundaries…';
      await wait(500);

      const dur = 320;
      const lines = generateTranscript(dur);
      const chapters = detectChapters(lines);

      const newSession = {
        id: uid(),
        title: ytId ? `YouTube Lecture (${ytId})` : 'Web Video Lecture',
        type: ytId ? 'youtube' : 'video',
        ytId: ytId || null,
        duration: dur,
        lines,
        chapters,
        genre: 'Online Lecture',
        createdAt: new Date().toISOString(),
        bestScore: null
      };

      if (ytId) {
        sessionStorage.setItem('momento_blob_' + newSession.id, 'yt:' + ytId);
      } else {
        sessionStorage.setItem('momento_blob_' + newSession.id, url);
      }

      library.unshift(newSession);
      saveLibrary();
      renderLibrary();

      linkInput.value = '';
      toast(`Created session from link: "${newSession.title}"`);
      openSession(newSession);
    } catch (err) {
      toast("Something went wrong resolving that link. Please try again.", { err: true });
    } finally {
      linkSubmitBtn.disabled = false;
      linkProcessBar.classList.remove('on');
    }
  }

  if (linkSubmitBtn) {
    linkSubmitBtn.addEventListener('click', submitLinkForm);
  }
  if (linkInput) {
    linkInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitLinkForm();
      }
    });
    linkInput.addEventListener('input', () => {
      if (linkErr) linkErr.classList.remove('on');
      linkInput.classList.remove('invalid');
    });
  }

  // -------------------------------------------------------------
  // 7. Library Rendering
  // -------------------------------------------------------------
  function renderLibrary() {
    if (!libGrid) return;
    libGrid.innerHTML = '';

    if (library.length === 0) {
      if (libEmpty) libEmpty.style.display = 'block';
      return;
    }
    if (libEmpty) libEmpty.style.display = 'none';

    library.forEach((item) => {
      const card = document.createElement('div');
      card.className = `lib-card ${activeSession && activeSession.id === item.id ? 'active' : ''}`;
      card.innerHTML = `
        <div>
          <div class="lib-card-top">
            <span class="lib-genre-badge">${escapeHtml(item.type || 'video')}</span>
            <button type="button" class="lib-delete-btn" title="Delete session">🗑</button>
          </div>
          <h4>${escapeHtml(item.title)}</h4>
        </div>
        <div class="lib-card-meta">
          <span>⏱ ${fmtTime(item.duration)}</span> · 
          <span>📖 ${item.chapters ? item.chapters.length : 0} chaps</span> · 
          <span>🎯 Score: ${item.bestScore !== null && item.bestScore !== undefined ? item.bestScore + '%' : '—'}</span>
        </div>
      `;

      card.querySelector('.lib-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete "${item.title}" from your library?`)) {
          library = library.filter(s => s.id !== item.id);
          localStorage.removeItem('momento_notes_' + item.id);
          localStorage.removeItem('momento_fc_states_' + item.id);
          saveLibrary();
          if (activeSession && activeSession.id === item.id) {
            activeSession = null;
            if (workspace) workspace.classList.remove('open');
          }
          renderLibrary();
          toast('Session deleted.');
        }
      });

      card.addEventListener('click', () => openSession(item));
      libGrid.appendChild(card);
    });
  }

  // -------------------------------------------------------------
  // 8. Open & Activate Session Workspace
  // -------------------------------------------------------------
  function openSession(session) {
    activeSession = session;
    renderLibrary();

    if (workspace) workspace.classList.add('open');
    if (wsTitle) wsTitle.textContent = session.title;
    if (wsMeta) wsMeta.textContent = `${fmtTime(session.duration)} · ${session.chapters ? session.chapters.length : 0} chapters`;
    if (wsTypeBadge) wsTypeBadge.textContent = session.type.toUpperCase();
    if (wsDurationBadge) wsDurationBadge.textContent = fmtTime(session.duration);
    if (wsChapterBadge) wsChapterBadge.textContent = session.chapters ? session.chapters.length : 0;
    if (wsBestScoreBadge) wsBestScoreBadge.textContent = session.bestScore !== null && session.bestScore !== undefined ? `${session.bestScore}%` : '—';

    // Setup Media Player
    setupPlayer(session);

    // Render Chapters on Seekbar & Legend
    renderChapters(session);

    // Render Synced Transcript
    renderTranscript(session);

    // Init AI Summary & Insights
    renderAISummary(session);
    renderAIInsights(session);

    // Init Flashcards & Notes
    initFlashcards(session);
    renderNotes(session);

    // Enable Quiz button
    if (getTestBtn) getTestBtn.disabled = false;

    // Smooth scroll to workspace
    workspace.scrollIntoView({ behavior: 'smooth' });
  }

  // -------------------------------------------------------------
  // 9. Media Player Controller (HTML5 & YouTube)
  // -------------------------------------------------------------
  function setupPlayer(session) {
    clearInterval(timerInterval);
    currentTime = 0;
    isPlaying = false;
    updatePlayBtnIcon(false);

    if (durTimeLbl) durTimeLbl.textContent = fmtTime(session.duration);
    if (curTimeLbl) curTimeLbl.textContent = '0:00';
    if (seekFill) seekFill.style.width = '0%';
    if (seekHead) seekHead.style.left = '0%';
    if (seekTrack) {
      seekTrack.setAttribute('aria-valuemin', '0');
      seekTrack.setAttribute('aria-valuemax', String(Math.round(session.duration)));
      seekTrack.setAttribute('aria-valuenow', '0');
      seekTrack.setAttribute('aria-valuetext', `0:00 of ${fmtTime(session.duration)}`);
    }

    const storedBlob = sessionStorage.getItem('momento_blob_' + session.id);

    if (session.type === 'youtube' || (storedBlob && storedBlob.startsWith('yt:'))) {
      const ytId = session.ytId || storedBlob.replace('yt:', '');
      if (videoEl) videoEl.style.display = 'none';
      if (ytPlayerWrap) {
        ytPlayerWrap.style.display = 'block';
        ytPlayerWrap.innerHTML = `<iframe id="ytIframe" width="100%" height="100%" src="${youtubeEmbedUrl(ytId, 0, false)}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
      }
    } else {
      if (ytPlayerWrap) ytPlayerWrap.style.display = 'none';
      if (videoEl) {
        videoEl.style.display = 'block';
        if (storedBlob) videoEl.src = storedBlob;
        videoEl.ontimeupdate = () => handleTimeUpdate(videoEl.currentTime);
      }
    }

    // Interval to keep transcript sync moving smoothly
    timerInterval = setInterval(() => {
      if (isPlaying) {
        currentTime = Math.min(session.duration, currentTime + 0.5);
        handleTimeUpdate(currentTime);
        if (currentTime >= session.duration) {
          pauseMedia();
        }
      }
    }, 500);
  }

  function handleTimeUpdate(t) {
    currentTime = t;
    if (curTimeLbl) curTimeLbl.textContent = fmtTime(t);

    const dur = activeSession ? activeSession.duration : 1;
    const pct = Math.min(100, (t / dur) * 100);
    if (seekFill) seekFill.style.width = `${pct}%`;
    if (seekHead) seekHead.style.left = `${pct}%`;
    if (seekTrack) {
      seekTrack.setAttribute('aria-valuenow', String(Math.round(t)));
      seekTrack.setAttribute('aria-valuetext', `${fmtTime(t)} of ${fmtTime(dur)}`);
    }

    // Algorithm 1 Execution: Binary Search Transcript Line
    if (activeSession && activeSession.lines) {
      const activeIdx = findActiveLineIndex(activeSession.lines, t);
      updateTranscriptHighlight(activeIdx);
    }

    // Active Chapter Indicator
    if (activeSession && activeSession.chapters) {
      const actChap = activeSession.chapters.find(c => t >= c.startTime && t < c.endTime);
      if (actChap) {
        if (syncActiveChapterTxt) syncActiveChapterTxt.textContent = `${actChap.title} — ACTIVE`;
        $$('.chap-pill').forEach((pill) => {
          pill.classList.toggle('active', pill.dataset.chapTitle === actChap.title);
        });
      }
    }
  }

  function playMedia() {
    isPlaying = true;
    updatePlayBtnIcon(true);
    if (videoEl && videoEl.style.display !== 'none' && videoEl.src) {
      videoEl.play().catch(() => {});
    }
  }

  function pauseMedia() {
    isPlaying = false;
    updatePlayBtnIcon(false);
    if (videoEl && videoEl.style.display !== 'none') {
      videoEl.pause();
    }
  }

  function seekTo(seconds) {
    currentTime = Math.max(0, Math.min(activeSession ? activeSession.duration : 0, seconds));
    if (videoEl && videoEl.style.display !== 'none') {
      videoEl.currentTime = currentTime;
    }
    handleTimeUpdate(currentTime);
  }

  function updatePlayBtnIcon(playing) {
    if (!playIcon) return;
    playIcon.innerHTML = playing
      ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
  }

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      isPlaying ? pauseMedia() : playMedia();
    });
  }

  if (seekTrack) {
    seekTrack.addEventListener('click', (e) => {
      if (!activeSession) return;
      const rect = seekTrack.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, clickX / rect.width));
      seekTo(pct * activeSession.duration);
    });
    // Keyboard accessibility for the slider (role="slider", tabindex="0"):
    // Left/Right nudge playback by 5s, matching standard seek-bar conventions.
    seekTrack.addEventListener('keydown', (e) => {
      if (!activeSession) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekTo(Math.min(activeSession.duration, currentTime + 5));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekTo(Math.max(0, currentTime - 5));
      }
    });
  }

  // -------------------------------------------------------------
  // 10. Chapters Rendering
  // -------------------------------------------------------------
  function renderChapters(session) {
    if (chapMarksHost) chapMarksHost.innerHTML = '';
    if (chapLegend) chapLegend.innerHTML = '';
    if (!session.chapters) return;

    session.chapters.forEach((chap) => {
      // Seekbar Marker
      const pct = (chap.startTime / session.duration) * 100;
      const mark = document.createElement('div');
      mark.className = 'chap-mark';
      mark.style.left = `${pct}%`;
      if (chapMarksHost) chapMarksHost.appendChild(mark);

      // Legend Pill
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'chap-pill';
      pill.dataset.chapTitle = chap.title;
      pill.textContent = `📖 [${fmtTime(chap.startTime)}] ${chap.title}`;
      pill.addEventListener('click', () => {
        seekTo(chap.startTime);
        playMedia();
      });
      if (chapLegend) chapLegend.appendChild(pill);
    });
  }

  // -------------------------------------------------------------
  // 11. Synced Transcript List & Auto-Scroll
  // -------------------------------------------------------------
  function renderTranscript(session) {
    if (!transcriptList) return;
    transcriptList.innerHTML = '';

    (session.lines || []).forEach((line, idx) => {
      const row = document.createElement('div');
      row.className = 'tc-line';
      row.id = `tcLine_${idx}`;
      row.dataset.idx = idx;
      row.dataset.start = line.start;
      row.innerHTML = `
        <span class="tc-ts">${fmtTime(line.start)}</span>
        <span class="tc-spk">${escapeHtml(line.speaker)}</span>
        <span class="tc-txt">${escapeHtml(line.text)}</span>
      `;
      row.addEventListener('click', () => {
        seekTo(line.start);
        playMedia();
      });
      transcriptList.appendChild(row);
    });
  }

  function updateTranscriptHighlight(activeIdx) {
    if (!transcriptList) return;
    const currentActive = transcriptList.querySelector('.tc-line.active');
    if (currentActive && Number(currentActive.dataset.idx) === activeIdx) return;

    if (currentActive) currentActive.classList.remove('active');

    if (activeIdx >= 0) {
      const targetRow = $(`#tcLine_${activeIdx}`, transcriptList);
      if (targetRow) {
        targetRow.classList.add('active');
        // Auto scroll
        targetRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  // Search Transcript
  if (searchInput && searchResults) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      searchResults.innerHTML = '';
      if (!query || !activeSession || !activeSession.lines) return;

      const matches = activeSession.lines.filter(l => l.text.toLowerCase().includes(query));
      if (matches.length === 0) {
        searchResults.innerHTML = '<div style="font-size:12px; color:var(--mist); padding:6px 12px;">No matching moments found.</div>';
        return;
      }

      matches.slice(0, 5).forEach((m) => {
        const item = document.createElement('div');
        item.className = 'search-item';
        item.innerHTML = `
          <span>${escapeHtml(m.text)}</span>
          <strong>${fmtTime(m.start)} ↗</strong>
        `;
        item.addEventListener('click', () => {
          seekTo(m.start);
          playMedia();
          searchResults.innerHTML = '';
          searchInput.value = '';
        });
        searchResults.appendChild(item);
      });
    });
  }

  // Workspace Tab Switcher
  wsTabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.wsTab;
      wsTabBtns.forEach(b => b.classList.remove('active'));
      wsPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPanel = $(`#ws-panel-${tabId}`);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });

  // -------------------------------------------------------------
  // 12. Quiz Engine & Smart Error Inline Video Review
  // -------------------------------------------------------------
  let currentQuiz = [];
  let currentQIdx = 0;
  let quizScore = 0;
  let missedQuestions = [];
  let lastFocusedBeforeQuiz = null;

  quizLenBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      quizLenBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedQuizLen = btn.dataset.len;
    });
  });

  function openQuiz() {
    quizPlay.style.display = 'block';
    resultsView.style.display = 'none';
    lastFocusedBeforeQuiz = document.activeElement;
    quizOverlay.classList.add('open');
    // Move focus into the dialog so keyboard/screen-reader users land
    // inside it, matching the role="dialog" aria-modal="true" contract.
    if (quizCard) quizCard.focus();
  }

  function closeQuiz() {
    quizOverlay.classList.remove('open');
    if (inlineReviewPlayer) inlineReviewPlayer.innerHTML = '';
    if (lastFocusedBeforeQuiz && document.contains(lastFocusedBeforeQuiz)) {
      lastFocusedBeforeQuiz.focus();
    }
    lastFocusedBeforeQuiz = null;
  }

  if (getTestBtn) {
    getTestBtn.addEventListener('click', () => {
      if (!activeSession) return;
      currentQuiz = generateQuiz(activeSession, selectedQuizLen);
      if (currentQuiz.length === 0) {
        toast('No questions could be generated for this recording.', { err: true });
        return;
      }
      currentQIdx = 0;
      quizScore = 0;
      missedQuestions = [];

      openQuiz();
      renderQuizQuestion();
    });
  }

  function renderQuizQuestion() {
    const q = currentQuiz[currentQIdx];
    if (!q) {
      finishQuiz();
      return;
    }

    if (inlineReview) inlineReview.style.display = 'none';
    if (inlineReviewPlayer) inlineReviewPlayer.innerHTML = '';
    if (nextBtn) nextBtn.classList.remove('on');
    if (quizResultTag) quizResultTag.textContent = '';

    const pct = ((currentQIdx) / currentQuiz.length) * 100;
    if (quizProgress) quizProgress.style.setProperty('--quiz-pct', `${pct}%`);
    if (quizChapterTag) quizChapterTag.textContent = `Question ${currentQIdx + 1} of ${currentQuiz.length} · ${q.chapter}`;
    if (quizQ) quizQ.textContent = q.question;

    if (quizOpts) {
      quizOpts.innerHTML = '';
      q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quiz-opt';
        btn.innerHTML = `<b>${idx + 1}.</b> ${escapeHtml(opt)}`;
        btn.addEventListener('click', () => handleQuizAnswer(opt, btn, q));
        quizOpts.appendChild(btn);
      });
    }
  }

  function handleQuizAnswer(selectedOption, optBtn, q) {
    $$('.quiz-opt', quizOpts).forEach(b => b.disabled = true);

    const isCorrect = selectedOption.toLowerCase() === q.answer.toLowerCase();

    if (isCorrect) {
      optBtn.classList.add('correct');
      quizScore += 1;
      if (quizResultTag) {
        quizResultTag.textContent = '✨ Correct!';
        quizResultTag.style.color = 'var(--ok)';
      }
      toast('Correct answer! +1 point');
    } else {
      optBtn.classList.add('wrong');
      missedQuestions.push(q);
      if (quizResultTag) {
        quizResultTag.textContent = '❌ Missed';
        quizResultTag.style.color = 'var(--danger)';
      }

      // Highlight the right answer button
      $$('.quiz-opt', quizOpts).forEach((b) => {
        if (b.textContent.toLowerCase().includes(q.answer.toLowerCase())) {
          b.classList.add('correct');
        }
      });

      // Show Inline Video Review Panel
      showInlineReviewPanel(q);
    }

    if (nextBtn) nextBtn.classList.add('on');
  }

  function showInlineReviewPanel(q) {
    if (!inlineReview) return;
    inlineReview.style.display = 'block';

    if (inlineReviewTs) inlineReviewTs.textContent = fmtTime(q.timestamp);
    if (inlineCorrectCallout) inlineCorrectCallout.style.display = 'block';
    if (inlineCorrectAnswerText) inlineCorrectAnswerText.textContent = q.answer;
    if (inlineExplanationBox) inlineExplanationBox.style.display = 'block';
    if (inlineExplanationText) inlineExplanationText.textContent = q.explanation;
    if (inlineReviewLine) inlineReviewLine.textContent = `Speaker Quote: "${q.quote}"`;

    renderInlineReviewPlayer(q.timestamp);

    if (inlineReviewOpen) {
      inlineReviewOpen.onclick = () => {
        closeQuiz();
        seekTo(q.timestamp);
        playMedia();
      };
    }
  }

  // Embeds a small video player inside the review panel, cued to the
  // exact moment the answer was discussed (instead of just naming the time).
  function renderInlineReviewPlayer(timestamp) {
    if (!inlineReviewPlayer || !activeSession) return;

    const storedBlob = sessionStorage.getItem('momento_blob_' + activeSession.id);
    const isYoutube = activeSession.type === 'youtube' || (storedBlob && storedBlob.startsWith('yt:'));

    if (isYoutube) {
      const ytId = activeSession.ytId || (storedBlob ? storedBlob.replace('yt:', '') : '');
      if (ytId) {
        const fallbackUrl = `https://www.youtube.com/watch?v=${ytId}&t=${Math.floor(timestamp)}s`;
        inlineReviewPlayer.innerHTML = `
          <iframe src="${youtubeEmbedUrl(ytId, timestamp, false)}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
          <a class="inline-review-yt-fallback" href="${fallbackUrl}" target="_blank" rel="noopener">▶ Play at ${fmtTime(timestamp)} on YouTube ↗</a>
        `;
      } else {
        inlineReviewPlayer.innerHTML = '';
      }
    } else if (storedBlob) {
      inlineReviewPlayer.innerHTML = `<video src="${storedBlob}" controls playsinline></video>`;
      const vid = $('video', inlineReviewPlayer);
      if (vid) {
        vid.addEventListener('loadedmetadata', () => {
          vid.currentTime = timestamp;
        }, { once: true });
      }
    } else {
      inlineReviewPlayer.innerHTML = '';
    }
  }

  function goToNextQuestion() {
    currentQIdx += 1;
    renderQuizQuestion();
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', goToNextQuestion);
  }

  function finishQuiz() {
    quizPlay.style.display = 'none';
    resultsView.style.display = 'block';

    const pct = Math.round((quizScore / currentQuiz.length) * 100);
    if (resultsScore) resultsScore.textContent = `${pct}%`;
    if (resultsSub) resultsSub.textContent = `${quizScore} of ${currentQuiz.length} questions correct`;

    // Save best score to session
    if (activeSession) {
      if (activeSession.bestScore === null || pct > (activeSession.bestScore || 0)) {
        activeSession.bestScore = pct;
        saveLibrary();
        renderLibrary();
        if (wsBestScoreBadge) wsBestScoreBadge.textContent = `${pct}%`;
      }
    }

    // Record Streak
    const streak = recordStreak(pct);
    if (streakRow) streakRow.innerHTML = `🔥 Daily Study Streak: <b>${streak.current} days</b> (Personal Best: ${streak.best})`;

    if (badgeRow) {
      badgeRow.innerHTML = pct === 100
        ? '🏆 <span style="color:var(--amber); font-weight:700;">Mastery Badge Unlocked!</span>'
        : '⭐ <span style="color:var(--teal);">Good practice effort!</span>';
    }

    // Weak areas
    if (weakList && weakItems) {
      if (missedQuestions.length > 0) {
        weakList.style.display = 'block';
        weakItems.innerHTML = missedQuestions.map(m => `
          <div style="font-size:12.5px; margin-bottom:6px; color:var(--mist);">
            • <b>${escapeHtml(m.chapter)}</b> at [${fmtTime(m.timestamp)}]: <i>"${escapeHtml(m.quote)}"</i>
          </div>
        `).join('');
      } else {
        weakList.style.display = 'none';
      }
    }
  }

  if (quizClose) quizClose.addEventListener('click', closeQuiz);
  if (closeResultsBtn) closeResultsBtn.addEventListener('click', closeQuiz);

  // Clicking the dimmed backdrop (outside the card) also dismisses the quiz.
  if (quizOverlay) {
    quizOverlay.addEventListener('click', (e) => {
      if (e.target === quizOverlay) closeQuiz();
    });
  }

  // Keyboard shortcuts, matching the on-screen hint:
  // Esc closes · 1-4 pick an option · Enter advances once answered.
  document.addEventListener('keydown', (e) => {
    if (!quizOverlay || !quizOverlay.classList.contains('open')) return;

    if (e.key === 'Escape') {
      closeQuiz();
      return;
    }

    // Results screen only responds to Escape (handled above).
    if (resultsView && resultsView.style.display === 'block') return;

    if (['1', '2', '3', '4'].includes(e.key)) {
      const opts = $$('.quiz-opt', quizOpts);
      const idx = parseInt(e.key, 10) - 1;
      if (opts[idx] && !opts[idx].disabled) opts[idx].click();
      return;
    }

    if (e.key === 'Enter' && nextBtn && nextBtn.classList.contains('on')) {
      goToNextQuestion();
    }
  });


  // -------------------------------------------------------------
  // 13. 3D Flashcards Deck
  // -------------------------------------------------------------
  let flashcards = [];
  let currentFcIdx = 0;
  let knownIds = [];
  let studyingIds = [];

  function initFlashcards(session) {
    const lines = session.lines || [];
    flashcards = lines.map((l, i) => ({
      id: `fc_${i}`,
      tag: l.keyword.toUpperCase(),
      front: `In this lecture, how is ${l.keyword} applied?`,
      back: l.text,
      speaker: l.speaker
    }));

    const fcKey = `momento_fc_states_${session.id}`;
    try {
      const saved = JSON.parse(localStorage.getItem(fcKey)) || { known: [], studying: [] };
      knownIds = saved.known || [];
      studyingIds = saved.studying || [];
    } catch {
      knownIds = [];
      studyingIds = [];
    }

    currentFcIdx = 0;
    renderFlashcard();
  }

  function renderFlashcard() {
    if (fcCard) fcCard.classList.remove('flipped');
    if (fcPileKnownCount) fcPileKnownCount.textContent = knownIds.length;
    if (fcPileStudyingCount) fcPileStudyingCount.textContent = studyingIds.length;

    if (currentFcIdx >= flashcards.length) {
      if (fcActiveArea) fcActiveArea.style.display = 'none';
      if (fcFinishedArea) fcFinishedArea.style.display = 'block';
      if (fcDeckProgress) fcDeckProgress.textContent = `${flashcards.length} / ${flashcards.length}`;
      return;
    }

    if (fcActiveArea) fcActiveArea.style.display = 'block';
    if (fcFinishedArea) fcFinishedArea.style.display = 'none';

    const card = flashcards[currentFcIdx];
    if (fcDeckProgress) fcDeckProgress.textContent = `Card ${currentFcIdx + 1} of ${flashcards.length}`;
    if (fcCardTagFront) fcCardTagFront.textContent = card.tag;
    if (fcCardTextFront) fcCardTextFront.textContent = card.front;
    if (fcCardTagBack) fcCardTagBack.textContent = `${card.tag} — CONTEXT`;
    if (fcCardTextBack) fcCardTextBack.textContent = `"${card.back}"`;
  }

  if (fcCard) {
    fcCard.addEventListener('click', () => {
      fcCard.classList.toggle('flipped');
    });
    fcCard.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fcCard.classList.toggle('flipped');
      }
    });
  }

  if (fcKnownBtn) {
    fcKnownBtn.addEventListener('click', () => {
      const card = flashcards[currentFcIdx];
      if (card && !knownIds.includes(card.id)) {
        knownIds.push(card.id);
        studyingIds = studyingIds.filter(id => id !== card.id);
        saveFcState();
      }
      currentFcIdx += 1;
      renderFlashcard();
    });
  }

  if (fcStudyingBtn) {
    fcStudyingBtn.addEventListener('click', () => {
      const card = flashcards[currentFcIdx];
      if (card && !studyingIds.includes(card.id)) {
        studyingIds.push(card.id);
        knownIds = knownIds.filter(id => id !== card.id);
        saveFcState();
      }
      currentFcIdx += 1;
      renderFlashcard();
    });
  }

  if (fcResetBtn) {
    fcResetBtn.addEventListener('click', () => {
      currentFcIdx = 0;
      renderFlashcard();
    });
  }

  function saveFcState() {
    if (!activeSession) return;
    localStorage.setItem(`momento_fc_states_${activeSession.id}`, JSON.stringify({ known: knownIds, studying: studyingIds }));
  }

  // -------------------------------------------------------------
  // 14. Lecture Notes with Timestamp Seeking
  // -------------------------------------------------------------
  function renderNotes(session) {
    if (!notesList) return;
    notesList.innerHTML = '';

    const notesKey = `momento_notes_${session.id}`;
    let notes = [];
    try {
      notes = JSON.parse(localStorage.getItem(notesKey)) || [];
    } catch {}

    if (notes.length === 0) {
      notesList.innerHTML = '<div style="font-size:12.5px; color:var(--mist); padding:10px 0;">No notes added yet for this session. Add your first note above!</div>';
      return;
    }

    notes.forEach((note) => {
      const item = document.createElement('div');
      item.className = 'note-item';
      item.innerHTML = `
        <div style="display:flex; align-items:center;">
          <span class="note-ts">[${fmtTime(note.time)}]</span>
          <span style="font-size:13.5px; color:var(--cloud);">${escapeHtml(note.text)}</span>
        </div>
        <button type="button" class="note-del" title="Delete note">🗑</button>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.note-del')) return;
        seekTo(note.time);
        playMedia();
      });

      item.querySelector('.note-del').addEventListener('click', () => {
        const filtered = notes.filter(n => n.id !== note.id);
        localStorage.setItem(notesKey, JSON.stringify(filtered));
        renderNotes(session);
        toast('Note deleted.');
      });

      notesList.appendChild(item);
    });
  }

  if (notesForm) {
    notesForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!activeSession) return;

      const text = noteInput.value.trim();
      if (!text) return;

      const notesKey = `momento_notes_${activeSession.id}`;
      let notes = [];
      try {
        notes = JSON.parse(localStorage.getItem(notesKey)) || [];
      } catch {}

      notes.push({
        id: uid(),
        time: currentTime,
        text,
        createdAt: new Date().toISOString()
      });

      localStorage.setItem(notesKey, JSON.stringify(notes));
      noteInput.value = '';
      renderNotes(activeSession);
      toast(`Note added at [${fmtTime(currentTime)}]`);
    });
  }

  if (exportNotesBtn) {
    exportNotesBtn.addEventListener('click', () => {
      if (!activeSession) return;
      const notesKey = `momento_notes_${activeSession.id}`;
      const notes = JSON.parse(localStorage.getItem(notesKey)) || [];

      if (notes.length === 0) {
        toast('No notes to export.', { err: true });
        return;
      }

      let md = `# Study Notes: ${activeSession.title}\n\n`;
      notes.forEach(n => {
        md += `- **[${fmtTime(n.time)}]**: ${n.text}\n`;
      });

      const blob = new Blob([md], { type: 'text/markdown' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${activeSession.title.toLowerCase().replace(/\s+/g, '_')}_notes.md`;
      a.click();
      toast('Notes exported as Markdown.');
    });
  }

  // -------------------------------------------------------------
  // 15. AI Summary & Insights
  // -------------------------------------------------------------
  function renderAISummary(session) {
    if (!summaryContent) return;
    const chaptersText = (session.chapters || []).map(c => `• **${c.title}** (starts at ${fmtTime(c.startTime)})`).join('\n');
    summaryContent.innerHTML = `
      <p>This lecture comprehensively covers <b>${session.title}</b> with a total duration of <b>${fmtTime(session.duration)}</b> across <b>${session.chapters?.length || 0} core conceptual chapters</b>.</p>
      <h5 style="margin:14px 0 6px; font-size:14px; color:var(--teal);">Key Chapter Outline:</h5>
      <pre style="background:var(--ink-2); padding:12px; border-radius:6px; font-family:var(--ff-mono); font-size:12px; color:var(--cloud);">${escapeHtml(chaptersText)}</pre>
      <p style="margin-top:12px;"><b>Core Takeaway:</b> Understanding functional boundaries, execution contexts, and asynchronous loops provides the bedrock for mastering complex algorithmic challenges.</p>
    `;
  }

  function renderAIInsights(session) {
    if (insightsSummary) {
      insightsSummary.textContent = `Automated analysis of "${session.title}" identifies ${session.lines?.length || 0} key dialogue points, emphasizing structured problem solving and active retention.`;
    }

    if (insightsKeyMoments && session.lines) {
      insightsKeyMoments.innerHTML = session.lines.slice(0, 4).map(l => `
        <div class="insight-moment-item" data-ts="${l.start}">
          <span class="insight-moment-ts">[${fmtTime(l.start)}]</span>
          <span><b>${escapeHtml(l.speaker)}:</b> "${escapeHtml(l.text)}"</span>
        </div>
      `).join('');

      $$('.insight-moment-item', insightsKeyMoments).forEach((el) => {
        el.addEventListener('click', () => {
          seekTo(Number(el.dataset.ts));
          playMedia();
        });
      });
    }

    if (recGrid && session.chapters) {
      recGrid.innerHTML = session.chapters.map(c => `
        <div class="rec-card">
          <h5>${escapeHtml(c.title)} Drill</h5>
          <p>Review key lecture formulas and quiz yourself on ${escapeHtml(c.keyword)} concepts.</p>
        </div>
      `).join('');
    }
  }

  if (copySummaryBtn) {
    copySummaryBtn.addEventListener('click', () => {
      if (summaryContent) {
        navigator.clipboard.writeText(summaryContent.innerText).then(() => {
          toast('Summary copied to clipboard!');
        });
      }
    });
  }

  if (regenSummaryBtn || quickSummaryBtn) {
    [regenSummaryBtn, quickSummaryBtn].forEach(b => {
      if (b) {
        b.addEventListener('click', () => {
          toast('AI Summary refreshed from latest transcript analysis.');
          if (activeSession) renderAISummary(activeSession);
        });
      }
    });
  }

  // -------------------------------------------------------------
  // 16. Initialize Application
  // -------------------------------------------------------------
  loadLibrary();
});