/**
 * Personal Productivity Dashboard — script.js
 * Features: Greeting/Clock · Profile Modal · Dark/Light Mode ·
 *           Custom Name · Focus Timer · To-Do List (with duplicate guard) ·
 *           Quick Links  — all persisted via localStorage.
 */

'use strict';

/* ============================================================
   UTILS
   ============================================================ */
const $ = (sel) => document.querySelector(sel);
const pad = (n) => String(n).padStart(2, '0');

function saveLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** Return up to 2 capital initials from a name string, or '?' */
function initials(name) {
  if (!name || !name.trim()) return '?';
  return name.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

/* ============================================================
   1. PROFILE MODAL — open / close
   ============================================================ */
(function initProfileModal() {
  const profileBtn   = $('#profile-btn');
  const overlay      = $('#profile-overlay');
  const closeBtn     = $('#profile-close');

  function open() {
    overlay.removeAttribute('hidden');
    // Trap focus: put focus inside the modal
    setTimeout(() => $('#name-input').focus(), 50);
  }

  function close() {
    overlay.setAttribute('hidden', '');
    profileBtn.focus();
  }

  profileBtn.addEventListener('click', () => {
    if (overlay.hasAttribute('hidden')) open(); else close();
  });

  closeBtn.addEventListener('click', close);

  // Click on the dark overlay backdrop (not the modal box itself) closes it
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Escape key closes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hasAttribute('hidden')) close();
  });
})();


/* ============================================================
   2. THEME — Light / Dark mode (toggle inside Profile modal)
   ============================================================ */
(function initTheme() {
  const root      = document.documentElement;
  const toggle    = $('#theme-toggle');

  let current = loadLS('theme', 'light');

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    const isDark = theme === 'dark';
    toggle.setAttribute('aria-checked', String(isDark));
    saveLS('theme', theme);
    current = theme;
  }

  toggle.addEventListener('click', () => {
    apply(current === 'dark' ? 'light' : 'dark');
  });

  apply(current);
})();


/* ============================================================
   3. GREETING — Clock, Date, Custom Name + Profile avatars
   ============================================================ */
(function initGreeting() {
  // Greeting card
  const greetingText = $('#greeting-text');
  const greetingName = $('#greeting-name');
  const clockTime    = $('#clock-time');
  const clockAmpm    = $('#clock-ampm');
  const dateEl       = $('#date-display');

  // Profile modal elements
  const nameInput      = $('#name-input');
  const nameSave       = $('#name-save');
  const nameFeedback   = $('#name-feedback');
  const profileAvatar  = $('#profile-avatar');   // small circle in topbar
  const avatarLarge    = $('#avatar-large');     // big circle inside modal
  const previewName    = $('#profile-preview-name');
  const profileBtnLabel = $('.profile-btn-label');

  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  function getGreetingPhrase(hour) {
    if (hour < 12) return '🌅 Good morning,';
    if (hour < 17) return '☀️ Good afternoon,';
    if (hour < 21) return '🌆 Good evening,';
    return '🌙 Good night,';
  }

  /* Update every element that shows the user's name / initials */
  function applyName(name) {
    const displayName = name || 'Friend';
    const ini = initials(name);

    greetingName.textContent    = displayName;
    previewName.textContent     = displayName;
    profileAvatar.textContent   = ini;
    avatarLarge.textContent     = ini;
  }

  /* Live clock + greeting phrase */
  function tick() {
    const now  = new Date();
    const h    = now.getHours();
    const h12  = h % 12 || 12;
    const ampm = h >= 12 ? 'PM' : 'AM';

    clockTime.textContent    = `${pad(h12)}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    clockAmpm.textContent    = ampm;
    greetingText.textContent = getGreetingPhrase(h);
    dateEl.textContent       = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  }

  /* Show a timed success message in the modal */
  function showFeedback(msg) {
    nameFeedback.textContent = msg;
    clearTimeout(showFeedback._t);
    showFeedback._t = setTimeout(() => { nameFeedback.textContent = ''; }, 2500);
  }

  /* Save button handler */
  nameSave.addEventListener('click', () => {
    const val = nameInput.value.trim();
    if (!val) {
      nameFeedback.style.color = 'var(--danger)';
      nameFeedback.textContent = 'Please enter a name.';
      clearTimeout(nameSave._t);
      nameSave._t = setTimeout(() => {
        nameFeedback.textContent = '';
        nameFeedback.style.color = '';
      }, 2500);
      return;
    }
    saveLS('userName', val);
    applyName(val);
    nameFeedback.style.color = 'var(--success)';
    showFeedback('✅ Name saved!');
  });

  /* Enter key inside input triggers save */
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') nameSave.click();
  });

  /* Keep the live preview up to date as the user types */
  nameInput.addEventListener('input', () => {
    const live = nameInput.value.trim();
    previewName.textContent   = live || 'Friend';
    avatarLarge.textContent   = initials(live);
  });

  /* Bootstrap — load saved name */
  const saved = loadLS('userName', '');
  nameInput.value = saved;
  applyName(saved);

  tick();
  setInterval(tick, 1000);
})();


/* ============================================================
   4. FOCUS TIMER — Pomodoro-style
   ============================================================ */
(function initTimer() {
  const display    = $('#timer-display');
  const labelEl    = $('#timer-label');
  const startBtn   = $('#timer-start');
  const stopBtn    = $('#timer-stop');
  const resetBtn   = $('#timer-reset');
  const presetBtns = document.querySelectorAll('.preset-btn');

  let totalSeconds  = 25 * 60;
  let remaining     = totalSeconds;
  let intervalId    = null;
  let isRunning     = false;
  let activeMinutes = 25;

  function fmt(secs) {
    return `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`;
  }

  function updateDisplay() {
    display.textContent = fmt(remaining);
    display.classList.remove('running', 'overtime');
    if (isRunning && remaining > 0) display.classList.add('running');
    if (remaining === 0)             display.classList.add('overtime');
  }

  function start() {
    if (isRunning || remaining === 0) return;
    isRunning = true;
    labelEl.textContent = 'Focus! 🔥';
    intervalId = setInterval(() => {
      remaining--;
      updateDisplay();
      if (remaining === 0) {
        clearInterval(intervalId);
        isRunning = false;
        labelEl.textContent = "Time's up! 🎉";
        if (Notification.permission === 'granted') {
          new Notification('Pomodoro done!', { body: 'Take a 5-minute break.' });
        }
      }
    }, 1000);
    updateDisplay();
  }

  function stop() {
    if (!isRunning) return;
    clearInterval(intervalId);
    isRunning = false;
    labelEl.textContent = 'Paused ⏸';
    updateDisplay();
  }

  function reset() {
    clearInterval(intervalId);
    isRunning = false;
    remaining = totalSeconds;
    labelEl.textContent = 'Ready';
    updateDisplay();
  }

  function setPreset(minutes) {
    clearInterval(intervalId);
    isRunning     = false;
    activeMinutes = minutes;
    totalSeconds  = minutes * 60;
    remaining     = totalSeconds;
    labelEl.textContent = 'Ready';
    updateDisplay();
    presetBtns.forEach((b) =>
      b.classList.toggle('active-preset', Number(b.dataset.minutes) === minutes)
    );
  }

  startBtn.addEventListener('click', start);
  stopBtn.addEventListener('click',  stop);
  resetBtn.addEventListener('click', reset);
  presetBtns.forEach((b) =>
    b.addEventListener('click', () => setPreset(Number(b.dataset.minutes)))
  );

  startBtn.addEventListener('click', () => {
    if (Notification.permission === 'default') Notification.requestPermission();
  }, { once: true });

  // Mark default preset active
  presetBtns.forEach((b) => {
    if (Number(b.dataset.minutes) === activeMinutes) b.classList.add('active-preset');
  });

  updateDisplay();
})();


/* ============================================================
   5. TO-DO LIST — Add / Edit / Complete / Delete + Duplicates + Sort
   ============================================================ */
(function initTodo() {
  const input      = $('#todo-input');
  const addBtn     = $('#todo-add');
  const listEl     = $('#todo-list');
  const errorEl    = $('#todo-error');
  const emptyEl    = $('#todo-empty');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const sortSelect = $('#todo-sort');

  let tasks  = loadLS('tasks', []);
  let filter = 'all';
  let sortBy = loadLS('taskSort', 'newest');

  // Sync dropdown to persisted sort preference
  sortSelect.value = sortBy;

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  function save() { saveLS('tasks', tasks); }

  function showError(msg) {
    errorEl.textContent = msg;
    clearTimeout(showError._t);
    showError._t = setTimeout(() => { errorEl.textContent = ''; }, 3000);
  }

  function isDuplicate(text, excludeId) {
    return tasks.some(
      (t) => t.id !== excludeId &&
             t.text.trim().toLowerCase() === text.trim().toLowerCase()
    );
  }

  function render() {
    // 1. Filter — work on a shallow copy so the master array is never mutated
    let visible = tasks.filter((t) =>
      filter === 'active'    ? !t.completed :
      filter === 'completed' ?  t.completed : true
    );

    // 2. Sort the copy (never touches `tasks`)
    visible = visible.slice().sort((a, b) => {
      if (sortBy === 'oldest') {
        return (a.createdAt || 0) - (b.createdAt || 0);
      }
      if (sortBy === 'status') {
        // incomplete (0) before complete (1)
        return Number(a.completed) - Number(b.completed);
      }
      // default: newest first
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    listEl.innerHTML = '';
    emptyEl.style.display = visible.length === 0 ? 'block' : 'none';

    visible.forEach((task) => {
      const li = document.createElement('li');
      li.className = `todo-item${task.completed ? ' completed' : ''}`;
      li.dataset.id = task.id;

      // Checkbox
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'todo-checkbox';
      cb.checked = task.completed;
      cb.setAttribute('aria-label', 'Mark complete');
      cb.addEventListener('change', () => toggleTask(task.id));

      // Text
      const span = document.createElement('span');
      span.className   = 'todo-text';
      span.textContent = task.text;

      // Actions
      const actions = document.createElement('div');
      actions.className = 'todo-actions';

      const editBtn = document.createElement('button');
      editBtn.className   = 'btn-edit';
      editBtn.textContent = '✏️';
      editBtn.setAttribute('aria-label', 'Edit');
      editBtn.addEventListener('click', () => startEdit(li, task));

      const delBtn = document.createElement('button');
      delBtn.className   = 'btn btn-danger';
      delBtn.textContent = '🗑';
      delBtn.setAttribute('aria-label', 'Delete');
      delBtn.addEventListener('click', () => deleteTask(task.id));

      actions.append(editBtn, delBtn);
      li.append(cb, span, actions);
      listEl.appendChild(li);
    });
  }

  function startEdit(li, task) {
    if (li.dataset.editing) return;
    li.dataset.editing = '1';

    const span    = li.querySelector('.todo-text');
    const actions = li.querySelector('.todo-actions');

    const editInput = document.createElement('input');
    editInput.type      = 'text';
    editInput.className = 'todo-edit-input';
    editInput.value     = task.text;
    editInput.maxLength = 120;

    const saveBtn   = document.createElement('button');
    saveBtn.className   = 'btn btn-primary';
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = 'padding:.3rem .7rem;font-size:.8rem';

    const cancelBtn = document.createElement('button');
    cancelBtn.className   = 'btn btn-ghost';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:.3rem .7rem;font-size:.8rem';

    function commitEdit() {
      const newText = editInput.value.trim();
      if (!newText) return;
      if (isDuplicate(newText, task.id)) {
        showError('⚠️ A task with that name already exists.');
        return;
      }
      task.text = newText;
      save();
      render();
    }

    saveBtn.addEventListener('click', commitEdit);
    cancelBtn.addEventListener('click', render);
    editInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  commitEdit();
      if (e.key === 'Escape') render();
    });

    span.replaceWith(editInput);
    actions.innerHTML = '';
    actions.append(saveBtn, cancelBtn);
    editInput.focus();
    editInput.select();
  }

  function addTask(text) {
    const trimmed = text.trim();
    if (!trimmed)              { showError('⚠️ Please enter a task.'); return false; }
    if (isDuplicate(trimmed))  { showError('⚠️ This task already exists.'); return false; }
    tasks.unshift({ id: uid(), text: trimmed, completed: false, createdAt: Date.now() });
    save();
    render();
    return true;
  }

  function toggleTask(id) {
    const t = tasks.find((t) => t.id === id);
    if (t) { t.completed = !t.completed; save(); render(); }
  }

  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    save();
    render();
  }

  addBtn.addEventListener('click', () => {
    if (addTask(input.value)) input.value = '';
    input.focus();
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') addBtn.click(); });

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      filter = btn.dataset.filter;
      render();
    });
  });

  sortSelect.addEventListener('change', () => {
    sortBy = sortSelect.value;
    saveLS('taskSort', sortBy);
    render();
  });

  render();
})();


/* ============================================================
   6. QUICK LINKS — Add / Delete, open in new tab
   ============================================================ */
(function initLinks() {
  const nameInput = $('#link-name-input');
  const urlInput  = $('#link-url-input');
  const addBtn    = $('#link-add');
  const listEl    = $('#links-list');

  let links = loadLS('quickLinks', []);

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  function save() { saveLS('quickLinks', links); }

  function faviconSrc(url) {
    try { return `https://www.google.com/s2/favicons?domain=${new URL(url).origin}&sz=32`; }
    catch { return ''; }
  }

  function normalizeUrl(raw) {
    const t = raw.trim();
    if (!t) return '';
    return /^https?:\/\//i.test(t) ? t : 'https://' + t;
  }

  function render() {
    listEl.innerHTML = '';
    if (links.length === 0) {
      const empty = document.createElement('li');
      empty.className   = 'empty-msg';
      empty.textContent = 'No links yet — add one above!';
      listEl.appendChild(empty);
      return;
    }
    links.forEach((link) => {
      const li = document.createElement('li');
      li.className = 'link-item';

      const favicon = document.createElement('img');
      favicon.className = 'link-favicon';
      favicon.src       = faviconSrc(link.url);
      favicon.alt       = '';
      favicon.onerror   = () => { favicon.style.display = 'none'; };

      const anchor = document.createElement('a');
      anchor.className   = 'link-name';
      anchor.href        = link.url;
      anchor.target      = '_blank';
      anchor.rel         = 'noopener noreferrer';
      anchor.textContent = link.name;
      anchor.title       = link.url;

      const delBtn = document.createElement('button');
      delBtn.className   = 'btn btn-danger';
      delBtn.textContent = '🗑';
      delBtn.setAttribute('aria-label', `Remove ${link.name}`);
      delBtn.addEventListener('click', () => {
        links = links.filter((l) => l.id !== link.id);
        save();
        render();
      });

      li.append(favicon, anchor, delBtn);
      listEl.appendChild(li);
    });
  }

  addBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const url  = normalizeUrl(urlInput.value);
    if (!name) { nameInput.focus(); return; }
    if (!url)  { urlInput.focus();  return; }
    try { new URL(url); } catch {
      urlInput.style.borderColor = 'var(--danger)';
      setTimeout(() => { urlInput.style.borderColor = ''; }, 2000);
      return;
    }
    links.push({ id: uid(), name, url });
    save();
    render();
    nameInput.value = '';
    urlInput.value  = '';
    nameInput.focus();
  });

  urlInput.addEventListener('keydown',  (e) => { if (e.key === 'Enter') addBtn.click(); });
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') urlInput.focus(); });

  render();
})();
