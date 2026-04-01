// ── БИРЖА ТРУДА (ПОЛНАЯ ВЕРСИЯ) ──
window.jobsDB = null;
window.currentJobId = null;
window.currentRole = null;

// Утилита поиска элемента с защитой
window.el = function(id) { return document.getElementById(id); };

// Инициализация базы
window.initJobsDB = function() {
  if (!window.firebase || !firebase.apps || !firebase.apps.length) {
    setTimeout(window.initJobsDB, 800); return;
  }
  try {
    window.jobsDB = firebase.database().ref('jobs');
    console.log('JobsDB ready');
  } catch(e) {
    setTimeout(window.initJobsDB, 800);
  }
};

// ВЫБОР РОЛИ
window.selectRole = function(role) {
  window.currentRole = role;
  
  // ЗАЩИТА: проверяем наличие элементов перед тем как менять .style
  var rScr = el('jobs-role');
  var eScr = el('jobs-employer');
  var wScr = el('jobs-worker');

  if (rScr) rScr.style.display = 'none';

  if (role === 'employer') {
    if (eScr) eScr.style.display = 'block';
    if (wScr) wScr.style.display = 'none';
    window.loadMyJobs();
  } else {
    if (wScr) wScr.style.display = 'block';
    if (eScr) eScr.style.display = 'none';
    window.loadJobs();
  }
};

// КАТЕГОРИИ
window.jobCategories = [
  { id:'it', icon:'💻', name:'IT и технологии' },
  { id:'build', icon:'🏗️', name:'Строительство' },
  { id:'transport', icon:'🚗', name:'Транспорт и доставка' },
  { id:'clean', icon:'🧹', name:'Уборка и клининг' },
  { id:'cook', icon:'🍳', name:'Кулинария' },
  { id:'teach', icon:'📚', name:'Образование' },
  { id:'med', icon:'🏥', name:'Медицина' },
  { id:'design', icon:'🎨', name:'Дизайн и творчество' },
  { id:'fin', icon:'💰', name:'Финансы и бухгалтерия' },
  { id:'other', icon:'🔧', name:'Другое' },
];

window.renderCategories = function(targetId, onSelectName) {
  var container = el(targetId);
  if (!container) return;
  container.innerHTML = window.jobCategories.map(function(c) {
    return `<div onclick="window.${onSelectName}('${c.id}')" style="display:flex;align-items:center;gap:12px;padding:14px;background:white;border-radius:12px;margin-bottom:8px;cursor:pointer;border:1.5px solid #eee;">`
      + `<span style="font-size:24px;">${c.icon}</span>`
      + `<span style="font-size:15px;font-weight:600;">${c.name}</span>`
      + `</div>`;
  }).join('');
};

// РАБОТОДАТЕЛЬ: ПУБЛИКАЦИЯ
window.selectedCategory = '';

window.showPostJob = function() {
  var catSel = el('jobs-cat-select');
  var empHome = el('jobs-employer-home');
  if (catSel) catSel.style.display = 'block';
  if (empHome) empHome.style.display = 'none';
  window.renderCategories('jobs-cat-list', 'selectJobCategory');
};

window.selectJobCategory = function(catId) {
  window.selectedCategory = catId;
  var cat = window.jobCategories.find(function(c){ return c.id === catId; });
  if (el('jobs-cat-select')) el('jobs-cat-select').style.display = 'none';
  if (el('jobs-post-form')) el('jobs-post-form').style.display = 'block';
  if (el('jobs-post-cat-label')) el('jobs-post-cat-label').innerText = cat ? cat.icon + ' ' + cat.name : catId;
};

window.postNewJob = function() {
  var title = el('jp-title') ? el('jp-title').value.trim() : '';
  var desc = el('jp-desc') ? el('jp-desc').value.trim() : '';
  var price = el('jp-price') ? el('jp-price').value.trim() : '';
  var loc = el('jp-location') ? el('jp-location').value.trim() : 'Удалённо';

  if (!title || !desc || !price) { T('Заполните обязательные поля'); return; }

  var key = U.huid.replace(/[^a-zA-Z0-9]/g, '');
  var FREE_LIMIT = 5;
  var POST_FEE = 5;

  firebase.database().ref('jobs').orderByChild('employerHuid').equalTo(U.huid).once('value', function(snap) {
    var count = snap.numChildren();
    
    var publish = function() {
      var jobId = Date.now().toString(36).toUpperCase();
      var jobData = {
        id: jobId, title: title, desc: desc, price: price, location: loc,
        category: window.selectedCategory, employer: U.name, employerHuid: U.huid,
        status: 'open', createdAt: Date.now(), applicants: {}
      };
      firebase.database().ref('jobs/' + jobId).set(jobData).then(function() {
        T('✅ Заказ опубликован!');
        if (el('jobs-post-form')) el('jobs-post-form').style.display = 'none';
        if (el('jobs-employer-home')) el('jobs-employer-home').style.display = 'block';
        window.loadMyJobs();
      });
    };

    if (count < FREE_LIMIT) {
      publish();
    } else {
      firebase.database().ref('tokens/' + key + '/qrt').once('value', function(q) {
        var bal = q.val() || 0;
        if (bal < POST_FEE) { T('Нужно ' + POST_FEE + ' QRT'); return; }
        firebase.database().ref('tokens/' + key + '/qrt').set(Math.round((bal - POST_FEE)*100)/100);
        publish();
      });
    }
  });
};

// РАБОТНИК: ЗАГРУЗКА И ОТКЛИК
window.loadJobs = function() {
  var list = el('worker-jobs-list');
  if (!list) return;
  firebase.database().ref('jobs').on('value', function(snap) {
    var jobs = snap.val();
    if (!jobs) { list.innerHTML = 'Заказов нет'; return; }
    var myKey = U.huid.replace(/[^a-zA-Z0-9]/g,'');
    
    list.innerHTML = Object.values(jobs).reverse().map(function(j) {
      var iApplied = j.applicants && j.applicants[myKey];
      if (j.status !== 'open' && !iApplied && j.selectedWorker !== U.huid) return '';
      
      var btnHtml = iApplied ? '✅ Откликнулись' : `<button onclick="window.applyToJob('${j.id}', this)">Откликнуться (2 QRT)</button>`;
      return `<div class="job-item" style="border:1px solid #eee; padding:10px; margin-bottom:10px;">
        <b>${j.title}</b> [${j.price}]<br>${j.desc.substring(0,50)}...<br>${btnHtml}
      </div>`;
    }).join('');
  });
};

window.applyToJob = function(jobId, btn) {
  var key = U.huid.replace(/[^a-zA-Z0-9]/g, '');
  var FEE = 2;
  btn.disabled = true;

  firebase.database().ref('tokens/' + key + '/qrt').once('value', function(snap) {
    var bal = snap.val() || 0;
    if (bal < FEE) { T('Недостаточно QRT'); btn.disabled = false; return; }
    
    firebase.database().ref('tokens/' + key + '/qrt').set(Math.round((bal - FEE)*100)/100);
    firebase.database().ref('jobs/' + jobId + '/applicants/' + key).set({
      name: U.name, huid: U.huid, appliedAt: Date.now()
    }).then(function() { T('✅ Отклик отправлен!'); });
  });
};

// Вызов инициализации
window.initJobsDB();
