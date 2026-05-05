/* ============================================================
   CONSTANTS
============================================================ */
var STORAGE_KEY        = 'wup_data_v2';
var SOUND_ENABLED      = true;
var MAX_MISSION_LEN    = 50;
var MAX_HISTORY        = 10;
var RING_RADIUS        = 77;
var RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ≈ 483.8

var MSG_SUCCESS = [
  '¡Misión completada! Eres imparable.',
  '¡Excelente! Cada bloque de enfoque cuenta.',
  '¡Un paso más hacia la grandeza!',
  '¡Lo conseguiste! El hábito se construye así.',
  '¡Consistencia es tu superpoder!',
];

var MSG_ABANDON = [
  'Misión abandonada. La constancia marca la diferencia.',
  'No pasa nada, vuelve cuando estés listo.',
];

/* ============================================================
   MEDALS DEFINITION
============================================================ */
var MEDALS = [
  {
    id: 'first_step', name: 'Primer paso',
    desc: 'Completa tu primera misión', icon: 'flag',
    check:    function(s) { return s.missions.length >= 1; },
    progress: function(s) { return { curr: Math.min(s.missions.length, 1), total: 1 }; },
  },
  {
    id: 'daily_3', name: 'Enfoque inicial',
    desc: '3 misiones en un mismo día', icon: 'zap',
    check:    function(s) { return getMaxMissionsInDay(s) >= 3; },
    progress: function(s) { return { curr: Math.min(getMaxMissionsInDay(s), 3), total: 3 }; },
  },
  {
    id: 'active_5', name: 'Cerebro activo',
    desc: '5 días distintos con actividad', icon: 'activity',
    check:    function(s) { return getActiveDays(s) >= 5; },
    progress: function(s) { return { curr: Math.min(getActiveDays(s), 5), total: 5 }; },
  },
  {
    id: 'missions_10', name: 'Disciplina base',
    desc: '10 misiones completadas', icon: 'shield',
    check:    function(s) { return s.missions.length >= 10; },
    progress: function(s) { return { curr: Math.min(s.missions.length, 10), total: 10 }; },
  },
  {
    id: 'hyperfocus', name: 'Hyperfocus',
    desc: 'Completa una misión de 25+ min', icon: 'rocket',
    check:    function(s) { return s.missions.some(function(m) { return m.duration >= 25; }); },
    progress: function(s) {
      var n = s.missions.filter(function(m) { return m.duration >= 25; }).length;
      return { curr: Math.min(n, 1), total: 1 };
    },
  },
  {
    id: 'streak_7', name: 'Constancia',
    desc: '7 días seguidos con actividad', icon: 'calendar',
    check:    function(s) { return calcStreak(s) >= 7; },
    progress: function(s) { return { curr: Math.min(calcStreak(s), 7), total: 7 }; },
  },
  {
    id: 'xp_1000', name: 'Maestro del enfoque',
    desc: 'Acumula 1000 XP', icon: 'star',
    check:    function(s) { return s.xp >= 1000; },
    progress: function(s) { return { curr: Math.min(s.xp, 1000), total: 1000 }; },
  },
];

/* ============================================================
   APPLICATION STATE
============================================================ */
var state = {
  xp:             0,
  missions:       [],
  unlockedMedals: [],
  currentMission: null,
  timerInterval:  null,
  timeLeft:       0,
  selectedDur:    10,
  customDurValue: 30,
};

/* ============================================================
   PERSISTENCE
============================================================ */
function loadData() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    var p = JSON.parse(raw);
    if (typeof p.xp === 'number' && Array.isArray(p.missions)) {
      state.xp = p.xp;
      state.missions = p.missions.filter(function(m) {
        return typeof m.text === 'string' &&
               typeof m.duration === 'number' &&
               typeof m.timestamp === 'number';
      });
    }
    if (Array.isArray(p.unlockedMedals)) {
      state.unlockedMedals = p.unlockedMedals.filter(function(id) {
        return typeof id === 'string';
      });
    }
  } catch (e) { console.warn('WUP: localStorage parse error —', e.message); }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      xp:             state.xp,
      missions:       state.missions,
      unlockedMedals: state.unlockedMedals,
    }));
  } catch (e) { console.warn('WUP: localStorage write error —', e.message); }
}

/* ============================================================
   PURE LOGIC
============================================================ */
function missionThreshold(level) {
  if (level <= 1) return 1;
  return 1 + Math.floor((level - 1) * level / 2);
}

function calculateLevelProgress(missionCount) {
  var mc    = Math.max(missionCount, 0);
  var level = 1;
  while (mc >= missionThreshold(level + 1)) { level++; }
  var currThreshold = missionThreshold(level);
  var nextThreshold = missionThreshold(level + 1);
  var inLevel       = mc - currThreshold;
  var needed        = nextThreshold - currThreshold;
  return {
    level:           level,
    progressPct:     needed > 0 ? Math.min((inLevel / needed) * 100, 100) : 100,
    missionsInLevel: Math.max(inLevel, 0),
    missionsNeeded:  needed,
    missionsToNext:  Math.max(needed - inLevel, 0),
  };
}

function detectLevelUp(prevCount, newCount) {
  if (newCount <= prevCount) return 0;
  var prevLevel = 1;
  while (prevCount >= missionThreshold(prevLevel + 1)) { prevLevel++; }
  var newLevel = prevLevel;
  while (newCount >= missionThreshold(newLevel + 1)) { newLevel++; }
  return newLevel > prevLevel ? newLevel : 0;
}

function calcStreak(s) {
  s = s || state;
  if (s.missions.length === 0) return 0;
  var dateSet = new Set(s.missions.map(function(m) {
    var d = new Date(m.timestamp);
    return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  }));
  var today    = new Date();
  var todayKey = today.getFullYear() + '-' + today.getMonth() + '-' + today.getDate();
  var check    = new Date(today);
  if (!dateSet.has(todayKey)) check.setDate(check.getDate() - 1);
  var streak = 0;
  while (streak <= 3650) {
    var key = check.getFullYear() + '-' + check.getMonth() + '-' + check.getDate();
    if (!dateSet.has(key)) break;
    streak++;
    check.setDate(check.getDate() - 1);
  }
  return streak;
}

function getActiveDays(s) {
  s = s || state;
  return new Set(s.missions.map(function(m) {
    var d = new Date(m.timestamp);
    return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  })).size;
}

function getMaxMissionsInDay(s) {
  s = s || state;
  var counts = {};
  s.missions.forEach(function(m) {
    var d = new Date(m.timestamp);
    var k = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
    counts[k] = (counts[k] || 0) + 1;
  });
  var vals = Object.keys(counts).map(function(k) { return counts[k]; });
  return vals.length > 0 ? Math.max.apply(null, vals) : 0;
}

function checkMedals() {
  var newlyUnlocked = [];
  MEDALS.forEach(function(m) {
    if (state.unlockedMedals.indexOf(m.id) === -1 && m.check(state)) {
      state.unlockedMedals.push(m.id);
      newlyUnlocked.push(m.id);
    }
  });
  return newlyUnlocked;
}

function getEffectiveDuration() {
  return state.selectedDur === 'custom' ? state.customDurValue : state.selectedDur;
}

/* ============================================================
   TIMER LOGIC
============================================================ */
function startMission() {
  var inputEl = document.getElementById('mission-input');
  var text    = inputEl.value.trim();

  if (text.length === 0) {
    showInlineMsg('Escribe en qué te vas a enfocar antes de empezar.');
    inputEl.focus();
    return;
  }
  if (text.length > MAX_MISSION_LEN) {
    showInlineMsg('La misión no puede superar los ' + MAX_MISSION_LEN + ' caracteres.');
    return;
  }
  if (state.selectedDur === 'custom') {
    var cVal = parseInt(document.getElementById('custom-input').value, 10);
    if (isNaN(cVal) || cVal < 1 || cVal > 180) {
      showInlineMsg('Introduce un número entre 1 y 180 minutos.');
      document.getElementById('custom-input').focus();
      return;
    }
    state.customDurValue = cVal;
  }

  var dur          = getEffectiveDuration();
  var totalSeconds = dur * 60;

  state.currentMission = { text: text, duration: dur, totalSeconds: totalSeconds };
  state.timeLeft       = totalSeconds;
  state.timerInterval  = setInterval(tickTimer, 1000);

  hideInlineMsg();
  renderUI();
}

function tickTimer() {
  state.timeLeft--;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    renderUI();
    return;
  }
  renderTimerOnly();
}

function abandonMission() {
  if (!confirm('¿Seguro que quieres abandonar esta misión?\nPerderás el progreso del temporizador.')) return;
  clearInterval(state.timerInterval);
  state.timerInterval  = null;
  state.currentMission = null;
  state.timeLeft       = 0;
  showToast(MSG_ABANDON[Math.floor(Math.random() * MSG_ABANDON.length)], 'warning');
  renderUI();
}

function completeMission() {
  if (!state.currentMission) return;
  var text     = state.currentMission.text;
  var duration = state.currentMission.duration;

  var prevMissionCount = state.missions.length;
  var prevProg         = calculateLevelProgress(prevMissionCount);

  state.missions.unshift({ text: text, duration: duration, timestamp: Date.now() });
  state.xp += duration;
  state.currentMission = null;
  state.timeLeft       = 0;

  var newMissionCount = state.missions.length;
  var levelUp         = detectLevelUp(prevMissionCount, newMissionCount);
  var newMedals       = checkMedals();
  saveData();

  showToast(MSG_SUCCESS[Math.floor(Math.random() * MSG_SUCCESS.length)], 'success');
  showToast('+' + duration + ' XP ganados', 'xp');

  var inputEl = document.getElementById('mission-input');
  inputEl.value = '';
  updateCharCount('');

  renderUI();

  if (levelUp) {
    requestAnimationFrame(function() {
      var fill = document.getElementById('progress-fill');
      if (fill) {
        fill.style.transition = 'none';
        fill.style.width = prevProg.progressPct + '%';
      }
      setTimeout(function() {
        playLevelUpAnimation(levelUp);
        playLevelUpSound();
      }, 80);
    });
  }

  if (newMedals.length > 0) {
    setTimeout(function() {
      newMedals.forEach(function(id) {
        var el = document.querySelector('[data-medal="' + id + '"]');
        if (el) {
          el.classList.add('just-unlocked');
          setTimeout(function() { el.classList.remove('just-unlocked'); }, 650);
        }
      });
      var def = MEDALS.filter(function(m) { return m.id === newMedals[0]; })[0];
      if (def) showToast('\u00a1Logro desbloqueado: ' + def.name + '!', 'success');
    }, 350);
  }
}

/* ============================================================
   RENDER FUNCTIONS
============================================================ */
function renderUI() {
  var prog   = calculateLevelProgress(state.missions.length);
  var streak = calcStreak();
  var active  = state.currentMission !== null;
  var running = active && state.timeLeft > 0;
  var done    = active && state.timeLeft <= 0;

  setTextBumped('stat-level',  prog.level);
  setTextBumped('stat-xp',     state.xp);
  setTextBumped('stat-streak', streak);
  renderXPBar(prog);

  var disabled = active;
  document.getElementById('mission-input').disabled = disabled;
  document.getElementById('start-btn').disabled     = disabled;
  document.getElementById('custom-input').disabled  = disabled;
  document.querySelectorAll('.dur-btn').forEach(function(b) { b.disabled = disabled; });

  var timerPanel = document.getElementById('timer-panel');
  if (running) {
    timerPanel.hidden = false;
    document.getElementById('timer-mission-name').textContent =
      '\u201C' + state.currentMission.text + '\u201D';
    renderTimerOnly();
  } else {
    timerPanel.hidden = true;
    timerPanel.classList.remove('mid', 'low');
  }

  document.getElementById('completion-panel').hidden = !done;

  renderHistory();
  renderMedals();

  initIcons();
}

function renderTimerOnly() {
  if (!state.currentMission) return;
  var timeEl = document.getElementById('timer-digits');
  var ringEl = document.getElementById('ring-progress');
  var panel  = document.getElementById('timer-panel');

  timeEl.textContent = formatTime(state.timeLeft);

  var pct    = state.timeLeft / state.currentMission.totalSeconds;
  var offset = RING_CIRCUMFERENCE * (1 - pct);
  ringEl.style.strokeDasharray  = RING_CIRCUMFERENCE;
  ringEl.style.strokeDashoffset = offset;

  ringEl.classList.toggle('low', pct < 0.15);
  ringEl.classList.toggle('mid', pct >= 0.15 && pct < 0.35);
  panel.classList.toggle('low', pct < 0.15);
  panel.classList.toggle('mid', pct >= 0.15 && pct < 0.35);
}

function renderXPBar(prog) {
  var fill  = document.getElementById('progress-fill');
  var label = document.getElementById('xp-bar-value');
  if (!fill || !label) return;
  fill.style.width = prog.progressPct + '%';
  label.textContent =
    prog.missionsInLevel + ' / ' + prog.missionsNeeded +
    ' misiones · Nv.' + (prog.level + 1);
}

function animateXPChange(fill, fromPct, toPct) {
  var startTime = null;
  var duration  = 550;
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
  function step(ts) {
    if (!startTime) startTime = ts;
    var t = Math.min((ts - startTime) / duration, 1);
    fill.style.width = (fromPct + (toPct - fromPct) * easeInOut(t)) + '%';
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function playLevelUpAnimation(level) {
  var levelEl = document.getElementById('stat-level');
  if (levelEl) {
    levelEl.classList.remove('level-up-pulse');
    void levelEl.offsetWidth;
    levelEl.classList.add('level-up-pulse');
    setTimeout(function() { levelEl.classList.remove('level-up-pulse'); }, 950);
  }

  var fill = document.getElementById('progress-fill');
  if (fill) {
    var fromPct = parseFloat(fill.style.width) || 0;
    fill.style.transition = '';
    animateXPChange(fill, fromPct, 100);
    setTimeout(function() {
      fill.style.transition = 'none';
      fill.style.width = '0%';
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          fill.style.transition = '';
          var newProg = calculateLevelProgress(state.missions.length);
          animateXPChange(fill, 0, newProg.progressPct);
          var label = document.getElementById('xp-bar-value');
          if (label) {
            label.textContent =
              newProg.missionsInLevel + ' / ' + newProg.missionsNeeded +
              ' misiones · Nv.' + (newProg.level + 1);
          }
        });
      });
    }, 620);
  }

  var banner = document.getElementById('levelup-banner');
  if (banner) {
    var numEl = document.getElementById('levelup-banner-number');
    if (numEl) numEl.textContent = String(level);
    banner.classList.add('show');
    setTimeout(function() { banner.classList.remove('show'); }, 2400);
  }

  showToast('\u00a1Nivel ' + level + ' alcanzado!', 'xp');
}

function playLevelUpSound() {
  if (!SOUND_ENABLED) return;
  try {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    var ctx   = new AudioCtx();
    var notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach(function(freq, i) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      var t = ctx.currentTime + i * 0.13;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.46);
      osc.start(t);
      osc.stop(t + 0.5);
    });
    setTimeout(function() { try { ctx.close(); } catch (e) {} }, 2500);
  } catch (e) {}
}

function renderHistory() {
  var list   = document.getElementById('history-list');
  var recent = state.missions.slice(0, MAX_HISTORY);

  while (list.firstChild) list.removeChild(list.firstChild);

  if (recent.length === 0) {
    var empty       = document.createElement('li');
    empty.className = 'empty-history';
    empty.textContent = 'Aún no has completado ninguna misión. ¡Empieza ahora!';
    list.appendChild(empty);
    return;
  }

  recent.forEach(function(mission) {
    var li       = document.createElement('li');
    li.className = 'history-item';

    var dot     = document.createElement('div');
    dot.className = 'history-dot';
    var dotIcon = document.createElement('i');
    dotIcon.setAttribute('data-lucide', 'check');
    dotIcon.setAttribute('style', 'width:13px;height:13px;');
    dot.appendChild(dotIcon);

    var info       = document.createElement('div');
    info.className = 'history-info';

    var textEl       = document.createElement('div');
    textEl.className = 'history-text';
    textEl.textContent = mission.text;

    var meta       = document.createElement('div');
    meta.className = 'history-meta';
    meta.textContent = mission.duration + ' min · ' + formatDate(mission.timestamp);

    info.appendChild(textEl);
    info.appendChild(meta);

    var xpBadge       = document.createElement('div');
    xpBadge.className = 'history-xp';
    xpBadge.textContent = '+' + mission.duration + ' XP';

    li.appendChild(dot);
    li.appendChild(info);
    li.appendChild(xpBadge);
    list.appendChild(li);
  });
}

function renderMedals() {
  var grid  = document.getElementById('medals-grid');
  var count = state.unlockedMedals.length;
  document.getElementById('medals-badge').textContent = count + ' / ' + MEDALS.length;

  while (grid.firstChild) grid.removeChild(grid.firstChild);

  MEDALS.forEach(function(medal) {
    var unlocked = state.unlockedMedals.indexOf(medal.id) !== -1;
    var prog     = medal.progress(state);

    var item       = document.createElement('div');
    item.className = 'medal-item ' + (unlocked ? 'unlocked' : 'locked');
    item.setAttribute('data-medal', medal.id);

    var iconWrap       = document.createElement('div');
    iconWrap.className = 'medal-icon';

    var iconEl = document.createElement('i');
    iconEl.setAttribute('data-lucide', medal.icon);
    iconEl.setAttribute('style', 'width:19px;height:19px;');
    iconWrap.appendChild(iconEl);

    var nameEl       = document.createElement('div');
    nameEl.className = 'medal-name';
    nameEl.textContent = medal.name;

    item.appendChild(iconWrap);
    item.appendChild(nameEl);
    item.appendChild(buildMedalTip(medal, unlocked, prog));
    grid.appendChild(item);
  });
}

function buildMedalTip(medal, unlocked, prog) {
  var tip       = document.createElement('div');
  tip.className = 'medal-tip';
  tip.setAttribute('role', 'tooltip');

  var nameEl       = document.createElement('div');
  nameEl.className = 'tip-name';
  nameEl.textContent = medal.name;

  var descEl       = document.createElement('div');
  descEl.className = 'tip-desc';
  descEl.textContent = medal.desc;

  var track       = document.createElement('div');
  track.className = 'tip-progress-track';

  var fill       = document.createElement('div');
  fill.className = 'tip-progress-fill';
  fill.style.width = (prog.total > 0 ? Math.min((prog.curr / prog.total) * 100, 100) : 0) + '%';
  track.appendChild(fill);

  var progressText       = document.createElement('div');
  progressText.className = 'tip-progress-text';
  progressText.textContent = unlocked ? '\u2713 Desbloqueado' : prog.curr + ' / ' + prog.total;

  tip.appendChild(nameEl);
  tip.appendChild(descEl);
  tip.appendChild(track);
  tip.appendChild(progressText);
  return tip;
}

/* ============================================================
   UTILITIES
============================================================ */
function formatTime(seconds) {
  var m = Math.floor(seconds / 60);
  var s = seconds % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function formatDate(ts) {
  var d         = new Date(ts);
  var today     = new Date();
  var yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  var time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString())     return 'Hoy ' + time;
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer ' + time;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

function setTextBumped(id, value) {
  var el = document.getElementById(id);
  if (!el) return;
  if (el.textContent !== String(value)) {
    el.textContent = String(value);
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
    setTimeout(function() { el.classList.remove('bump'); }, 350);
  }
}

function updateCharCount(val) {
  var el  = document.getElementById('char-count');
  var len = val.length;
  el.textContent = len + ' / ' + MAX_MISSION_LEN;
  el.className   = len >= MAX_MISSION_LEN - 10 ? 'char-counter warn' : 'char-counter';
}

function showInlineMsg(text) {
  var span = document.getElementById('inline-msg-text');
  span.textContent = text;
  document.getElementById('inline-msg').className = 'inline-msg warning show';
  clearTimeout(showInlineMsg._t);
  showInlineMsg._t = setTimeout(hideInlineMsg, 5000);
}

function hideInlineMsg() {
  document.getElementById('inline-msg').className = 'inline-msg';
}

function showToast(text, type) {
  var container = document.getElementById('toast-wrap');

  var toast       = document.createElement('div');
  toast.className = 'toast ' + type;

  var iconWrap       = document.createElement('span');
  iconWrap.className = 't-icon';

  var iconEl = document.createElement('i');
  iconEl.setAttribute('data-lucide',
    type === 'success' ? 'check-circle' : type === 'warning' ? 'alert-triangle' : 'zap');
  iconEl.setAttribute('style', 'width:15px;height:15px;');
  iconWrap.appendChild(iconEl);

  var textEl       = document.createElement('span');
  textEl.textContent = text;

  toast.appendChild(iconWrap);
  toast.appendChild(textEl);
  container.appendChild(toast);

  initIcons();

  requestAnimationFrame(function() {
    requestAnimationFrame(function() { toast.classList.add('show'); });
  });

  setTimeout(function() {
    toast.classList.remove('show');
    setTimeout(function() {
      if (toast.parentNode === container) container.removeChild(toast);
    }, 300);
  }, 3500);
}

function initIcons() {
  try {
    if (window.lucide) {
      lucide.createIcons({ attrs: { 'stroke-width': '1.75', 'aria-hidden': 'true' } });
    }
  } catch (e) {}
}

/* ============================================================
   EVENT LISTENERS
============================================================ */
function initEvents() {
  document.getElementById('start-btn').addEventListener('click', startMission);

  document.getElementById('mission-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') startMission();
  });

  document.getElementById('mission-input').addEventListener('input', function() {
    updateCharCount(this.value);
    hideInlineMsg();
  });

  document.querySelectorAll('.dur-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (this.disabled) return;
      document.querySelectorAll('.dur-btn').forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');

      var dur = this.dataset.duration;
      state.selectedDur = (dur === 'custom') ? 'custom' : parseInt(dur, 10);

      var row = document.getElementById('custom-row');
      if (dur === 'custom') {
        row.classList.add('visible');
        document.getElementById('custom-input').focus();
      } else {
        row.classList.remove('visible');
      }
    });
  });

  document.getElementById('custom-input').addEventListener('input', function() {
    var val = parseInt(this.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 180) {
      state.customDurValue = val;
      hideInlineMsg();
    }
  });

  document.getElementById('abandon-btn').addEventListener('click', abandonMission);
  document.getElementById('complete-btn').addEventListener('click', completeMission);

  window.addEventListener('beforeunload', function(e) {
    if (state.currentMission && state.timeLeft > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

/* ============================================================
   INITIALIZATION
============================================================ */
function init() {
  loadData();
  initEvents();
  renderUI();
  var ring = document.getElementById('ring-progress');
  if (ring) {
    ring.style.strokeDasharray  = RING_CIRCUMFERENCE;
    ring.style.strokeDashoffset = RING_CIRCUMFERENCE;
  }
}

document.addEventListener('DOMContentLoaded', init);
