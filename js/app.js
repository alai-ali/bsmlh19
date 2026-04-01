// ── СОСТОЯНИЕ ПОЛЬЗОВАТЕЛЯ ──
var U = { name:'', huid:'', phone:'', photo:'', hasChip:false, chipUID:'' };
var curLv = 1;

// ── УТИЛИТЫ ──
function el(id) { return document.getElementById(id); }

function T(msg) {
  var t = el('toast');
  if (!t) return;
  t.innerText = msg;
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 2800);
}

// Заглушки для функций Биржи (чтобы не было ошибок Defined)
if (typeof loadJobs !== 'function') { var loadJobs = function() { console.log('Биржа: загрузка списка...'); }; }
if (typeof loadMyJobs !== 'function') { var loadMyJobs = function() { console.log('Биржа: мои заказы...'); }; }
if (typeof loadPatent !== 'function') { var loadPatent = function() { console.log('Патент: загрузка...'); }; }
if (typeof initJobsDB !== 'function') { var initJobsDB = function() { console.log('Биржа: инициализация БД...'); }; }

function showScr(id) {
  document.querySelectorAll('.scr').forEach(function(s){ s.style.display = 'none'; });
  var s = el(id);
  if (s) s.style.display = 'flex';
}

function openPg(id) {
  var p = el(id);
  if (p) p.style.display = 'flex';
  if (id === 'pg-wal' && typeof loadWalletBalance === 'function') loadWalletBalance();
  if (id === 'pg-stats') loadStats();
}

function closePg(id) {
  var p = el(id);
  if (p) p.style.display = 'none';
}

// ── ЗАПУСК ПРИЛОЖЕНИЯ ──
function toApp() {
  try {
    var saved = localStorage.getItem('bsmlh_huid');
    if (saved) {
      U.huid = saved;
      var savedName = localStorage.getItem('bsmlh_name');
      if (savedName) U.name = savedName;
    } else {
      var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', uid = '';
      for (var i = 0; i < 16; i++) uid += chars[Math.floor(Math.random() * chars.length)];
      U.huid = 'BSMLH-2026-' + uid;
      localStorage.setItem('bsmlh_huid', U.huid);
      localStorage.setItem('bsmlh_name', U.name);
    }

    var key = U.huid.replace(/[^a-zA-Z0-9]/g, '');

    if (window.firebase && firebase.apps && firebase.apps.length) {
      // 1. Инициализация Биржи
      initJobsDB();

      // 2. Soulbound токен
      var ref = firebase.database().ref('tokens/' + key + '/bsmlh');
      ref.once('value', function(snap) {
        if (!snap.val()) { ref.set(1); }
      });

      // 3. Стартовый бонус QRT
      var qrtRef = firebase.database().ref('tokens/' + key + '/qrt');
      qrtRef.once('value', function(qSnap) {
        if (!qSnap.val()) {
          qrtRef.set(50);
          T('🎁 Начислено 50 QRT');
        }
      });

      // 4. Дата регистрации
      var regRef = firebase.database().ref('tokens/' + key + '/regDate');
      regRef.once('value', function(rSnap) {
        if (!rSnap.val()) {
          var now = Date.now();
          regRef.set(now);
          localStorage.setItem('bsmlh_reg_date', now);
        }
      });
    }
  } catch(e) {
    console.error("Ошибка запуска:", e);
  }

  // Обновление UI
  var initl = (U.name || 'U').charAt(0).toUpperCase();
  ['id-name','p-name','set-name'].forEach(function(id){ var e=el(id); if(e) e.innerText=U.name.toUpperCase(); });
  ['id-huid','p-huid','set-huid'].forEach(function(id){ var e=el(id); if(e) e.innerText=U.huid; });
  ['dash-av-ph','p-av-ph','set-av-ph'].forEach(function(id){ var e=el(id); if(e) e.innerText=initl; });

  if (U.photo) {
    ['dash-av','p-av','set-av'].forEach(function(id){ var e=el(id); if(e){ e.src=U.photo; e.style.display='block'; } });
    ['dash-av-ph','p-av-ph','set-av-ph'].forEach(function(id){ var e=el(id); if(e) e.style.display='none'; });
  }

  refreshChipUI();

  document.querySelectorAll('.scr').forEach(function(s){ s.style.display='none'; });
  var app = el('app');
  if (app) app.style.display = 'flex';

  loadFeed();
  loadPatent();
  if (typeof addMsg === 'function') addMsg('bot', '👋 Привет, ' + U.name + '! Я ALAI — ваш ИИ-ассистент.');
}

// ── СТАТИСТИКА ──
function loadStats() {
  if (!U.huid) return;
  var key = U.huid.replace(/[^a-zA-Z0-9]/g, '');

  var reg = localStorage.getItem('bsmlh_reg_date') || Date.now();
  var days = Math.max(1, Math.floor((Date.now() - parseInt(reg)) / 86400000));
  var dEl = el('stat-days'); if (dEl) dEl.innerText = days;

  if (!window.firebase || !firebase.apps || !firebase.apps.length) return;

  // Токены и баланс
  firebase.database().ref('tokens/' + key).once('value', function(snap) {
    var data = snap.val() || {};
    var qrt = data.qrt || 0;
    var qrnc = data.qrnc || 0;
    var earned = Math.floor(qrt * 150);

    if (el('stat-qrt')) el('stat-qrt').innerText = qrt.toFixed(1);
    if (el('stat-qrnc')) el('stat-qrnc').innerText = qrnc.toFixed(2);
    if (el('stat-earned')) el('stat-earned').innerText = earned.toLocaleString('ru-RU') + ' ₸';
  });

  // Заказы и Уровень
  firebase.database().ref('jobs').once('value', function(snap) {
    var done = 0, posted = 0;
    snap.forEach(function(job) {
      var d = job.val();
      if (d.employerHuid === U.huid) posted++;
      if (d.selectedWorker === U.huid && d.status === 'done') done++;
    });

    if (el('stat-done')) el('stat-done').innerText = done;
    if (el('stat-posted')) el('stat-posted').innerText = posted;

    // Расчет уровня
    var level = 'Новичок 🌱', color = '#21A038', bg = '#E8F5E9', progress = 10;
    if (done >= 1) { level = 'Стартер ⚡'; progress = 25; color = '#2563EB'; bg = '#EFF6FF'; }
    if (done >= 5) { level = 'Активный 🔥'; progress = 45; color = '#7C3AED'; bg = '#EDE9FE'; }
    if (done >= 15) { level = 'Профи 🏆'; progress = 70; color = '#D97706'; bg = '#FEF3C7'; }

    var lb = el('stat-level-badge');
    if (lb) { lb.innerText = level; lb.style.background = bg; lb.style.color = color; }
    var pr = el('stat-progress'); if (pr) pr.style.width = progress + '%';
  });
}

// ── РОЛЬ (БИРЖА) ──
function selectRole(role) {
    if (typeof currentRole !== 'undefined') currentRole = role;
    var roleScr = el('jobs-role'); if (roleScr) roleScr.style.display = 'none';
    
    if (role === 'employer') {
        var empScr = el('jobs-employer'); if (empScr) empScr.style.display = 'block';
        if (typeof loadMyJobs === 'function') loadMyJobs();
    } else {
        var wrkScr = el('jobs-worker'); if (wrkScr) wrkScr.style.display = 'block';
        if (typeof loadJobs === 'function') loadJobs();
    }
}
