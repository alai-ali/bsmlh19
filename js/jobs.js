// ==========================================
// 1. СИСТЕМНЫЕ НАСТРОЙКИ И ИНИЦИАЛИЗАЦИЯ
// ==========================================
window.jobsDB = null;
window.currentJobId = null;
window.currentRole = null;

// Защищенный поиск элементов
window.el = function(id) { 
    const element = document.getElementById(id);
    if (!element) console.warn("Missing HTML element: " + id);
    return element; 
};

// Функция инициализации базы
window.initJobsDB = function() {
  if (!window.firebase || !firebase.apps || !firebase.apps.length) {
    setTimeout(window.initJobsDB, 500); return;
  }
  try {
    window.jobsDB = firebase.database().ref('jobs');
    console.log('✅ Jobs Database Ready');
  } catch(e) {
    console.error("Firebase Init Error:", e);
  }
};
window.initJobsDB();

// ==========================================
// 2. КОНФИГУРАЦИЯ И РОЛИ
// ==========================================
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

window.selectRole = function(role) {
  window.currentRole = role;
  if (el('jobs-role')) el('jobs-role').style.display = 'none';
  
  if (role === 'employer') {
    if (el('jobs-employer')) el('jobs-employer').style.display = 'block';
    window.loadMyJobs();
  } else {
    if (el('jobs-worker')) el('jobs-worker').style.display = 'block';
    window.loadJobs();
  }
};

window.renderCategories = function(targetId, onSelectName) {
  var container = el(targetId);
  if (!container) return;
  container.innerHTML = window.jobCategories.map(function(c) {
    return `<div class="cat-item" onclick="window.${onSelectName}('${c.id}')" style="display:flex;align-items:center;gap:12px;padding:14px;background:white;border-radius:12px;margin-bottom:8px;cursor:pointer;border:1.5px solid var(--border);">`
      + `<span style="font-size:24px;">${c.icon}</span>`
      + `<span style="font-size:15px;font-weight:600;color:var(--text);">${c.name}</span>`
      + `</div>`;
  }).join('');
};

// ==========================================
// 3. ФУНКЦИИ РАБОТОДАТЕЛЯ (ПОСТИНГ И ЛИМИТЫ)
// ==========================================
window.selectedCategory = '';

window.showPostJob = function() {
  if (el('jobs-cat-select')) el('jobs-cat-select').style.display = 'block';
  if (el('jobs-employer-home')) el('jobs-employer-home').style.display = 'none';
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
  var title    = el('jp-title').value.trim();
  var desc     = el('jp-desc').value.trim();
  var price    = el('jp-price').value.trim();
  var location = el('jp-location').value.trim();
 
  if (!title || !desc || !price) { T('Заполните все поля!'); return; }
 
  var key = U.huid.replace(/[^a-zA-Z0-9]/g, '');
  var FREE_LIMIT = 5;
  var POST_FEE   = 5; 
 
  firebase.database().ref('jobs').orderByChild('employerHuid').equalTo(U.huid).once('value', function(snap) {
      var count = snap.numChildren();

      var publishAction = function() {
        var jobId = Date.now().toString(36).toUpperCase();
        var jobData = {
          id: jobId, title: title, desc: desc, price: price,
          location: location || 'Удалённо', category: window.selectedCategory,
          employer: U.name, employerHuid: U.huid, status: 'open',
          createdAt: Date.now(), applicants: {}
        };
 
        firebase.database().ref('jobs/' + jobId).set(jobData).then(function() {
          T('✅ Заказ опубликован!');
          if (el('jobs-post-form')) el('jobs-post-form').style.display = 'none';
          if (el('jobs-employer-home')) el('jobs-employer-home').style.display = 'block';
          window.loadMyJobs();
          ['jp-title','jp-desc','jp-price','jp-location'].forEach(id => { if(el(id)) el(id).value = ''; });
        });
      };

      if (count < FREE_LIMIT) {
        publishAction();
      } else {
        firebase.database().ref('tokens/' + key + '/qrt').once('value', function(qSnap) {
          var balance = qSnap.val() || 0;
          if (balance < POST_FEE) { T('Баланс: ' + balance.toFixed(1) + '. Нужно 5 QRT'); return; }
          firebase.database().ref('tokens/' + key + '/qrt').set(Math.round((balance - POST_FEE) * 100) / 100);
          publishAction();
        });
      }
  });
};

window.loadMyJobs = function() {
  var list = el('my-jobs-list');
  if (!list) return;
  firebase.database().ref('jobs').orderByChild('employerHuid').equalTo(U.huid).on('value', function(snap) {
    var jobs = snap.val();
    if (!jobs) { list.innerHTML = '<div class="empty-msg">Нет активных заказов</div>'; return; }
    list.innerHTML = Object.values(jobs).reverse().map(function(j) {
      var appCount = j.applicants ? Object.keys(j.applicants).length : 0;
      var statusText = j.status==='open' ? 'Открыт' : (j.status==='done' ? 'Завершён' : 'В работе');
      return `<div class="job-item" onclick="window.openJobDetail('${j.id}')">
                <div class="job-company">${(window.jobCategories.find(c=>c.id===j.category)||{icon:'🔧'}).icon} ${j.location}</div>
                <div class="job-title">${j.title}</div>
                <div class="job-tags"><span class="job-tag">${j.price} QRT</span><span class="job-tag">${statusText}</span></div>
                <div class="job-apps">👥 Откликов: ${appCount}</div>
              </div>`;
    }).join('');
  });
};

// ==========================================
// 4. ФУНКЦИИ РАБОТНИКА (ЗАГРУЗКА И ФИЛЬТРЫ)
// ==========================================
window.loadJobs = function() {
  var list = el('worker-jobs-list');
  if (!list) return;
  firebase.database().ref('jobs').on('value', function(snap) {
    var jobs = snap.val();
    if (!jobs) { list.innerHTML = '<div class="empty-msg">Нет доступных заказов</div>'; return; }
    var myKey = U.huid.replace(/[^a-zA-Z0-9]/g,'');
    
    var filtered = Object.values(jobs).filter(j => {
      var iApplied = j.applicants && j.applicants[myKey];
      return j.status === 'open' || iApplied || j.selectedWorker === U.huid;
    });

    list.innerHTML = filtered.reverse().map(function(j) {
      var iApplied = j.applicants && j.applicants[myKey];
      var isSelected = j.selectedWorker === U.huid;
      var cat = window.jobCategories.find(c=>c.id===j.category)||{icon:'🔧'};
      var btn = '';

      if (j.status === 'done') btn = '<div class="badge-done">✅ Завершён</div>';
      else if (isSelected) btn = `<button class="btn-chat" onclick="event.stopPropagation();window.openJobChat('${j.id}','${U.huid}','${j.employer}')">💬 Чат/Управление</button>`;
      else if (iApplied) btn = `<button class="btn-chat" onclick="event.stopPropagation();window.openJobChat('${j.id}','${U.huid}','${j.employer}')">💬 Вы откликнулись</button>`;
      else btn = `<button class="btn-apply" onclick="event.stopPropagation();window.applyToJob('${j.id}',this)">Откликнуться (2 QRT)</button>`;

      return `<div class="job-item">
                <div class="job-company">${cat.icon} ${j.employer}</div>
                <div class="job-title" onclick="window.openJobDetail('${j.id}')">${j.title}</div>
                <div class="job-desc">${j.desc.substring(0,80)}...</div>
                <div class="job-tags"><span class="job-tag">${j.price}</span><span class="job-tag">${j.location}</span></div>
                ${btn}
              </div>`;
    }).join('');
  });
};

window.applyToJob = function(jobId, btn) {
  var key = U.huid.replace(/[^a-zA-Z0-9]/g, '');
  var FEE = 2;
  if (btn) btn.disabled = true;

  firebase.database().ref('tokens/' + key + '/qrt').once('value', function(snap) {
    var balance = snap.val() || 0;
    if (balance < FEE) { T('Нужно 2 QRT для отклика'); btn.disabled = false; return; }
    
    firebase.database().ref('tokens/' + key + '/qrt').set(Math.round((balance - FEE) * 100) / 100);
    firebase.database().ref('jobs/' + jobId + '/applicants/' + key).set({
      name: U.name, huid: U.huid, appliedAt: Date.now()
    }).then(() => T('✅ Отклик отправлен!'));
  });
};

// ==========================================
// 5. ПОДТВЕРЖДЕНИЕ И НАЧИСЛЕНИЕ (CASHBACK)
// ==========================================
window.addToken = function(userHuid, type, amount) {
  var key = userHuid.replace(/[^a-zA-Z0-9]/g,'');
  var ref = firebase.database().ref('tokens/' + key + '/' + type);
  ref.once('value', snap => {
    var cur = snap.val() || 0;
    ref.set(Math.round((cur + amount) * 1000) / 1000);
  });
};

window.completeJobEmployer = function(jobId, workerHuid) {
  firebase.database().ref('jobs/' + jobId + '/confirmedEmployer').set(true).then(() => {
    T('✅ Вы подтвердили выполнение');
    window.processFinalization(jobId, workerHuid);
  });
};

window.completeJobWorker = function(jobId, employerHuid) {
  firebase.database().ref('jobs/' + jobId + '/confirmedWorker').set(true).then(() => {
    T('✅ Вы подтвердили завершение');
    window.processFinalization(jobId, null, employerHuid);
  });
};

window.processFinalization = function(jobId, wHuid, eHuid) {
  firebase.database().ref('jobs/' + jobId).once('value', snap => {
    var j = snap.val();
    if (j.confirmedEmployer && j.confirmedWorker) {
      firebase.database().ref('jobs/' + jobId + '/status').set('done');
      var finalWorker = wHuid || j.selectedWorker;
      var finalEmployer = eHuid || j.employerHuid;
      
      // Начисления: +1 QRT бонус + 0.4 QRT кешбэк
      window.addToken(finalWorker, 'qrt', 1.4);
      window.addToken(finalEmployer, 'qrt', 0.1);
      
      T('🎉 Заказ успешно завершён!');
      setTimeout(() => window.openRating(jobId, finalWorker, j.selectedWorkerName || 'Работник', 'worker'), 1000);
    }
  });
};

// ==========================================
// 6. ЧАТЫ, ДЕТАЛИ И РЕЙТИНГИ
// ==========================================
window.openJobDetail = function(jobId) {
  window.currentJobId = jobId;
  firebase.database().ref('jobs/' + jobId).once('value', snap => {
    var j = snap.val(); if (!j) return;
    var isEmployer = j.employerHuid === U.huid;
    var detail = el('job-detail');
    if (!detail) return;
    
    detail.innerHTML = `
      <div class="pg-head">
        <button onclick="window.closeJobDetail()" class="btn-back">←</button>
        <span>Детали заказа</span>
      </div>
      <div class="detail-content" style="padding:20px;">
        <h2>${j.title}</h2>
        <div class="price-big">${j.price} QRT</div>
        <p>${j.desc}</p>
        <hr>
        ${isEmployer ? window.renderApplicants(j) : `<button class="btn-main" onclick="window.applyToJob('${j.id}',this)">Откликнуться</button>`}
      </div>`;
    detail.style.display = 'flex';
  });
};

window.renderApplicants = function(j) {
  if (!j.applicants) return '<div>Откликов пока нет</div>';
  var apps = Object.values(j.applicants);
  return `<h3>Отклики (${apps.length})</h3>` + apps.map(a => `
    <div class="app-item" style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee;">
      <div><b>${a.name}</b><br><small>${a.huid}</small></div>
      <div style="display:flex; gap:5px;">
        <button onclick="window.selectApplicant('${j.id}','${a.huid}','${a.name}')">Выбрать</button>
        <button onclick="window.openJobChat('${j.id}','${a.huid}','${a.name}')">Чат</button>
      </div>
    </div>`).join('');
};

window.selectApplicant = function(jobId, workerHuid, workerName) {
  firebase.database().ref('jobs/' + jobId).update({
    status: 'closed',
    selectedWorker: workerHuid,
    selectedWorkerName: workerName
  }).then(() => { T('Исполнитель выбран!'); window.closeJobDetail(); });
};

window.openJobChat = function(jobId, workerHuid, workerName) {
  if (window.chatRef) window.chatRef.off();
  var chatKey = (jobId + '_' + workerHuid).replace(/[^a-zA-Z0-9]/g,'');
  if (el('job-chat-title')) el('job-chat-title').innerText = workerName;
  if (el('job-chat-msgs')) el('job-chat-msgs').innerHTML = '';
  if (el('job-chat')) el('job-chat').style.display = 'flex';
  
  window.chatRef = firebase.database().ref('job_chats/' + chatKey);
  window.chatRef.on('child_added', snap => {
    var m = snap.val();
    var d = document.createElement('div');
    d.className = m.senderHuid === U.huid ? 'msg my' : 'msg';
    d.innerHTML = `<small>${m.senderName}</small><div>${m.text}</div>`;
    if (el('job-chat-msgs')) {
        el('job-chat-msgs').appendChild(d);
        el('job-chat-msgs').scrollTop = el('job-chat-msgs').scrollHeight;
    }
  });
};

window.sendJobChatMsg = function() {
  var inp = el('job-chat-inp');
  if (!inp || !inp.value.trim() || !window.chatRef) return;
  window.chatRef.push({ 
      text: inp.value.trim(), 
      senderName: U.name, 
      senderHuid: U.huid, 
      time: Date.now() 
  });
  inp.value = '';
};

window.closeJobChat = function() { 
    if (window.chatRef) window.chatRef.off();
    if (el('job-chat')) el('job-chat').style.display = 'none'; 
};

window.openRating = function(jobId, targetHuid, targetName, targetRole) {
  if (el('rating-title')) el('rating-title').innerText = 'Оценить: ' + targetName;
  window.ratingContext = { jobId, targetHuid, targetRole };
  if (el('rating-panel')) el('rating-panel').style.display = 'flex';
  window.renderStars(0);
};

window.renderStars = function(n) {
  window.currentRatingScore = n;
  var s = el('rating-stars');
  if (s) s.innerHTML = [1,2,3,4,5].map(i => `<span onclick="window.renderStars(${i})" style="font-size:30px; cursor:pointer;">${i <= n ? '⭐' : '☆'}</span>`).join('');
};

window.submitRating = function() {
  if (!window.currentRatingScore) return T('Выберите количество звезд');
  var key = window.ratingContext.targetHuid.replace(/[^a-zA-Z0-9]/g,'');
  firebase.database().ref('ratings/' + key).push({
    score: window.currentRatingScore,
    from: U.name,
    time: Date.now()
  }).then(() => {
    if (window.currentRatingScore >= 4) window.addToken(window.ratingContext.targetHuid, 'qrt', 2);
    T('Оценка сохранена!');
    if (el('rating-panel')) el('rating-panel').style.display = 'none';
  });
};

window.closeJobDetail = function() { if (el('job-detail')) el('job-detail').style.display = 'none'; };
