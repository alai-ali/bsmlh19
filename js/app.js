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

function showScr(id) {
  document.querySelectorAll('.scr').forEach(function(s){ s.style.display = 'none'; });
  var s = el(id);
  if (s) s.style.display = 'flex';
}

function openPg(id) {
  var p = el(id);
  if (p) p.style.display = 'flex';
  if (id === 'pg-wal' && typeof loadWalletBalance === 'function') loadWalletBalance();
}
function closePg(id) {
  var p = el(id);
  if (p) p.style.display = 'none';
}

// ── ОНБОРДИНГ ──
function step1Next() {
  var n = el('inp-name');
  if (!n || !n.value.trim()) { T('Введите ваше имя'); return; }
  U.name = n.value.trim();
  showScr('s2');
}

function loadPhoto(inp) {
  if (!inp.files || !inp.files[0]) return;
  var r = new FileReader();
  r.onload = function(e) {
    U.photo = e.target.result;
    var prev = el('photo-prev');
    if (prev) prev.innerHTML = '<img src="' + e.target.result + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
  };
  r.readAsDataURL(inp.files[0]);
}

function showSMS() { showScr('s4'); }

// ── ЗАПУСК ПРИЛОЖЕНИЯ ──
function toApp() {
  try {
    var saved = localStorage.getItem('bsmlh_huid');
    if (saved) {
      U.huid = saved;
    } else {
      var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', uid = '';
      for (var i = 0; i < 16; i++) uid += chars[Math.floor(Math.random() * chars.length)];
      U.huid = 'BSMLH-2026-' + uid;
      localStorage.setItem('bsmlh_huid', U.huid);
      localStorage.setItem('bsmlh_name', U.name);

      // Новый пользователь — начислить 1 BSMLH Soulbound
      setTimeout(function() {
        if (window.firebase && firebase.apps && firebase.apps.length) {
          var key = U.huid.replace(/[^a-zA-Z0-9]/g, '');
          var ref = firebase.database().ref('tokens/' + key + '/bsmlh');
          ref.once('value', function(snap) {
            if (!snap.val()) {
              ref.set(1);
            }
          });
        }
      }, 3000);
    }
  } catch(e) {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', uid = '';
    for (var i = 0; i < 16; i++) uid += chars[Math.floor(Math.random() * chars.length)];
    U.huid = 'BSMLH-2026-' + uid;
  }

  // Имя
  ['id-name','p-name','set-name'].forEach(function(id){ var e=el(id); if(e) e.innerText=U.name.toUpperCase(); });
  ['id-huid','p-huid','set-huid'].forEach(function(id){ var e=el(id); if(e) e.innerText=U.huid; });

  // Инициал аватара
  var initl = U.name.charAt(0).toUpperCase();
  ['dash-av-ph','p-av-ph','set-av-ph'].forEach(function(id){ var e=el(id); if(e) e.innerText=initl; });

  // Фото
  if (U.photo) {
    ['dash-av','p-av','set-av'].forEach(function(id){ var e=el(id); if(e){ e.src=U.photo; e.style.display='block'; } });
    ['dash-av-ph','p-av-ph','set-av-ph'].forEach(function(id){ var e=el(id); if(e) e.style.display='none'; });
  }

  // Телефон
  if (U.phone) { var sp=el('set-phone'); if(sp) sp.innerText=U.phone; }

  refreshChipUI();

  // Показать app
  document.querySelectorAll('.scr').forEach(function(s){ s.style.display='none'; });
  var app = el('app');
  if (app) app.style.display = 'flex';

  loadFeed();
  loadPatent();
  addMsg('bot', '👋 Привет, ' + U.name + '! Я ALAI — ваш ИИ-ассистент BSMLH. Чем могу помочь?');
}

// ── ЧИП UI ──
function refreshChipUI() {
  var s = U.hasChip ? '✅ Чип активирован' : 'Без чипа';
  var st = el('id-chip-status'); if (st) st.innerText = s;
  var sl = el('chip-status-label'); if (sl) sl.innerText = U.hasChip ? 'ЧИП АКТИВИРОВАН' : 'ЧИП НЕ АКТИВИРОВАН';
  var sc = el('set-chip-txt'); if (sc) sc.innerText = U.hasChip ? 'Чип: ' + U.chipUID : 'Чип не активирован';
  if (U.hasChip && U.chipUID) {
    var ub = el('chip-uid-block'); if (ub) ub.style.display = 'block';
    var uv = el('chip-uid-val'); if (uv) uv.innerText = U.chipUID;
  }
}

// ── ТАБЫ ──
function switchTab(name) {
  ['home','map','chat','prof'].forEach(function(t) {
    var tc = el('tab-' + t);
    if (tc) { tc.classList.toggle('on', t === name); }
    var nb = el('nav-' + t);
    if (nb) nb.classList.toggle('on', t === name);
  });
}

// ── ФИД ──
function loadFeed() {
  var items = [
    { tag:'НОВОСТЬ', title:'BSMLH запускает NFC-идентификацию в Казахстане', time:'2 ч назад' },
    { tag:'ОБНОВЛЕНИЕ', title:'Новая функция: биржа труда теперь доступна', time:'5 ч назад' },
    { tag:'ТЕХНОЛОГИИ', title:'NTAG213: как работает NFC-чип BSMLH', time:'1 день назад' },
    { tag:'ИНВЕСТИЦИИ', title:'BST Token — скоро на биржах', time:'2 дня назад' },
  ];
  var f = el('feed-home');
  if (!f) return;
  f.innerHTML = items.map(function(i) {
    return '<div class="feed-item"><div class="feed-tag">' + i.tag + '</div><div class="feed-title">' + i.title + '</div><div class="feed-meta">' + i.time + '</div></div>';
  }).join('');
}

// ── ALAI ЧАТ ──
function addMsg(type, text) {
  var msgs = el('chat-msgs');
  if (!msgs) return;
  var d = document.createElement('div');
  d.className = 'msg ' + type;
  d.innerText = text;
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
}

function sendChat() {
  var inp = el('chat-inp');
  if (!inp || !inp.value.trim()) return;
  var q = inp.value.trim();
  inp.value = '';
  addMsg('user', q);
  setTimeout(function() {
    addMsg('bot', 'Обрабатываю: "' + q + '". Полноценный ИИ-ответ скоро будет доступен.');
  }, 600);
}

// ── БИРЖА ТРУДА ──
function showJobTab(tab) {
  var v = el('job-vacancies'), p = el('job-post');
  if (tab === 'vacancies') { if(v) v.style.display='block'; if(p) p.style.display='none'; }
  else { if(v) v.style.display='none'; if(p) p.style.display='block'; }
}

function applyJob(btn, title) {
  if (btn) { btn.innerText = '✅ Отклик отправлен'; btn.disabled = true; btn.style.background = '#6B7280'; }
  T('Отклик на "' + title + '" отправлен!');
}

function postJob() {
  var t = el('job-post-title');
  if (!t || !t.value.trim()) { T('Введите название вакансии'); return; }
  T('✅ Вакансия опубликована!');
  ['job-post-title','job-post-company','job-post-salary','job-post-desc'].forEach(function(id){ var e=el(id); if(e) e.value=''; });
  showJobTab('vacancies');
}

// ── КОШЕЛЁК ──
function loadWalletBalance() {
  if (!U.huid) return;

  var addrEl = el('wal-addr');
  if (addrEl) addrEl.innerText = U.huid;

  if (!window.firebase || !firebase.apps || !firebase.apps.length) {
    setTimeout(loadWalletBalance, 1000);
    return;
  }

  var key = U.huid.replace(/[^a-zA-Z0-9]/g, '');

  firebase.database().ref('tokens/' + key).on('value', function(snap) {
    var data = snap.val() || {};

    var qrt  = data.qrt  || 0;
    var qrnc = data.qrnc || 0;

    document.querySelectorAll('#wal-qrt').forEach(function(e) {
      e.innerText = qrt.toFixed(3);
    });
    document.querySelectorAll('#wal-qrnc').forEach(function(e) {
      e.innerText = qrnc.toFixed(3);
    });

    // BSMLH Soulbound
    var bsmlhEl = el('wal-bsmlh');
    if (!data.bsmlh) {
      firebase.database().ref('tokens/' + key + '/bsmlh').set(1);
      if (bsmlhEl) bsmlhEl.innerText = '1';
    } else {
      if (bsmlhEl) bsmlhEl.innerText = data.bsmlh;
    }
  });
}

function copyAddr() {
  var a = el('wal-addr');
  if (a && navigator.clipboard) navigator.clipboard.writeText(a.innerText).then(function(){ T('Адрес скопирован'); });
  else T('Адрес скопирован');
}

// ── НАСТРОЙКИ ──
function toggleLang() { T('Смена языка — скоро'); }
