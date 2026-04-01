// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ И ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ==========================================
window.jobsDB = null;
window.currentJobId = null;
window.currentRole = null;
window.selectedCategory = '';

// Утилита поиска элементов (защищенная)
window.el = function(id) { 
    var e = document.getElementById(id);
    if (!e) console.warn('Element not found: ' + id);
    return e; 
};

// Toast-уведомления (если нет в основном коде, добавим базу)
if (typeof window.T !== 'function') {
    window.T = function(msg) { console.log("TOAST:", msg); alert(msg); };
}

function initJobsDB() {
  if (!window.firebase || !firebase.apps || !firebase.apps.length) {
    setTimeout(initJobsDB, 800); return;
  }
  try {
    window.jobsDB = firebase.database().ref('jobs');
    console.log('JobsDB ready');
  } catch(e) {
    setTimeout(initJobsDB, 800); return;
  }
}
initJobsDB();

// ==========================================
// 2. РОЛИ И КАТЕГОРИИ
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
  var roleScr = el('jobs-role');
  if (roleScr) roleScr.style.display = 'none';
  
  if (role === 'employer') {
    if (el('jobs-employer')) el('jobs-employer').style.display = 'block';
    window.loadMyJobs();
  } else {
    if (el('jobs-worker')) el('jobs-worker').style.display = 'block';
    window.loadJobs();
  }
};

window.renderCategories = function(targetId, onSelect) {
  var container = el(targetId);
  if (!container) return;
  container.innerHTML = window.jobCategories.map(function(c) {
    return '<div onclick="window.' + onSelect + '(\''+c.id+'\')" style="display:flex;align-items:center;gap:12px;padding:14px;background:white;border-radius:12px;margin-bottom:8px;cursor:pointer;border:1.5px solid var(--border);">'
      + '<span style="font-size:24px;">'+c.icon+'</span>'
      + '<span style="font-size:15px;font-weight:600;color:var(--text);">'+c.name+'</span>'
      + '</div>';
  }).join('');
};

// ==========================================
// 3. ЛОГИКА РАБОТОДАТЕЛЯ
// ==========================================
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
 
  if (!title)    { T('Введите название заказа'); return; }
  if (!desc)     { T('Опишите задание'); return; }
  if (!price)    { T('Укажите оплату'); return; }
 
  var key = U.huid.replace(/[^a-zA-Z0-9]/g, '');
  var FREE_LIMIT = 5;
  var POST_FEE   = 5;
 
  firebase.database().ref('jobs').orderByChild('employerHuid').equalTo(U.huid).once('value', function(snap) {
      var count = snap.numChildren();

      function publishJob() {
        var job = {
          id:           Date.now().toString(36).toUpperCase(),
          title:        title,
          desc:         desc,
          price:        price,
          location:     location || 'Удалённо',
          category:     window.selectedCategory,
          employer:     U.name,
          employerHuid: U.huid,
          status:       'open',
          createdAt:    Date.now(),
          applicants:   {}
        };
 
        firebase.database().ref('jobs/' + job.id).set(job).then(function() {
          T('✅ Заказ опубликован!');
          if (el('jobs-post-form')) el('jobs-post-form').style.display = 'none';
          if (el('jobs-employer-home')) el('jobs-employer-home').style.display = 'block';
          window.loadMyJobs();
          window.clearPostForm();
        }).catch(function(e) { T('Ошибка: ' + e.message); });
      }
 
      if (count < FREE_LIMIT) {
        publishJob();
      } else {
        firebase.database().ref('tokens/' + key + '/qrt').once('value', function(qSnap) {
          var balance = qSnap.val() || 0;
          if (balance < POST_FEE) {
            T('❌ Нужно ' + POST_FEE + ' QRT для публикации. Баланс: ' + balance.toFixed(1) + ' QRT');
            return;
          }
          firebase.database().ref('tokens/' + key + '/qrt').set(Math.round((balance - POST_FEE) * 100) / 100);
          publishJob();
        });
      }
  });
};

window.clearPostForm = function() {
  ['jp-title','jp-desc','jp-price','jp-location'].forEach(function(id){ var e=el(id); if(e) e.value=''; });
};

window.loadMyJobs = function() {
  var list = el('my-jobs-list');
  if (!list) return;
  firebase.database().ref('jobs').orderByChild('employerHuid').equalTo(U.huid).on('value', function(snap) {
    var jobs = snap.val();
    if (!jobs) { list.innerHTML = '<div style="text-align:center;padding:20px;opacity:0.6;">Нет активных заказов</div>'; return; }
    list.innerHTML = Object.values(jobs).reverse().map(function(j) {
      var appCount = j.applicants ? Object.keys(j.applicants).length : 0;
      var statusText = j.status==='open' ? 'Открыт' : j.status==='done' ? 'Завершён' : 'Закрыт';
      return '<div class="job-item" onclick="window.openJobDetail(\''+j.id+'\')">'
        + '<div class="job-company">' + (window.jobCategories.find(function(c){return c.id===j.category;})||{icon:'🔧'}).icon + ' ' + j.location + '</div>'
        + '<div class="job-title">' + j.title + '</div>'
        + '<div class="job-tags"><span class="job-tag">'+j.price+'</span><span class="job-tag">'+statusText+'</span></div>'
        + '<div style="font-size:12px;color:var(--green);margin-top:6px;font-weight:600;">👥 Откликов: '+appCount+'</div>'
        + '</div>';
    }).join('');
  });
};

// ==========================================
// 4. ЛОГИКА РАБОТНИКА И ОТКЛИКИ
// ==========================================
window.loadJobs = function() {
  var list = el('worker-jobs-list');
  if (!list) return;
  firebase.database().ref('jobs').on('value', function(snap) {
    var jobs = snap.val();
    if (!jobs) { list.innerHTML = '<div style="text-align:center;padding:20px;opacity:0.6;">Нет заказов</div>'; return; }
    var myKey = U.huid.replace(/[^a-zA-Z0-9]/g,'');
    var jobList = Object.values(jobs).filter(function(j) {
      var iApplied = j.applicants && j.applicants[myKey];
      return j.status === 'open' || iApplied || j.selectedWorker === U.huid;
    });
    list.innerHTML = jobList.reverse().map(function(j) {
      var alreadyApplied = j.applicants && j.applicants[myKey];
      var isSelected = j.selectedWorker === U.huid;
      var cat = window.jobCategories.find(function(c){return c.id===j.category;})||{icon:'🔧'};
      var btn = '';
      
      if (j.status === 'done') {
        btn = '<div class="status-box done">✅ Завершён</div>';
      } else if (j.status === 'closed') {
        if (isSelected) {
            var cBtn = j.confirmedWorker ? '<span>⏳ Ждём заказчика...</span>' : '<button onclick="event.stopPropagation();window.completeJobWorker(\''+j.id+'\',\''+j.employerHuid+'\')">✅ Завершить</button>';
            btn = '<div style="display:flex;gap:5px;">'+cBtn+'<button onclick="event.stopPropagation();window.openJobChat(\''+j.id+'\',\''+U.huid+'\',\''+j.employer+'\')">💬 Чат</button></div>';
        } else { btn = '🔒 Закрыт'; }
      } else {
        if (alreadyApplied) {
            btn = '<button onclick="event.stopPropagation();window.openJobChat(\''+j.id+'\',\''+U.huid+'\',\''+j.employer+'\')">💬 Чат</button>';
        } else {
            btn = '<button class="btn" onclick="event.stopPropagation();window.applyToJob(\''+j.id+'\',this)">Откликнуться</button>';
        }
      }

      return '<div class="job-item">'
        + '<div class="job-company">' + cat.icon + ' ' + j.employer + '</div>'
        + '<div class="job-title" onclick="window.openJobDetail(\''+j.id+'\')">' + j.title + '</div>'
        + '<div class="job-tags"><span class="job-tag">'+j.price+'</span></div>'
        + btn + '</div>';
    }).join('');
  });
};

window.applyToJob = function(jobId, btn) {
  var key = U.huid.replace(/[^a-zA-Z0-9]/g, '');
  var FEE = 2;
  if (btn) btn.disabled = true;

  firebase.database().ref('tokens/' + key + '/qrt').once('value', function(snap) {
    var balance = snap.val() || 0;
    if (balance < FEE) { T('Нужно ' + FEE + ' QRT'); btn.disabled = false; return; }
    
    firebase.database().ref('tokens/' + key + '/qrt').set(Math.round((balance - FEE)*100)/100);
    firebase.database().ref('jobs/' + jobId + '/applicants/' + key).set({
      name: U.name, huid: U.huid, appliedAt: Date.now(), status: 'pending'
    }).then(function() { T('✅ Отклик отправлен!'); });
  });
};

// ==========================================
// 5. ПОДТВЕРЖДЕНИЕ И ЗАВЕРШЕНИЕ (CASHBACK)
// ==========================================
window.addToken = function(userHuid, type, amount) {
  var key = userHuid.replace(/[^a-zA-Z0-9]/g,'');
  var ref = firebase.database().ref('tokens/' + key + '/' + type);
  ref.once('value', function(snap) {
    var cur = snap.val() || 0;
    ref.set(Math.round((cur + amount) * 100) / 100);
  });
};

window.completeJobEmployer = function(jobId, workerHuid) {
  firebase.database().ref('jobs/' + jobId + '/confirmedEmployer').set(true).then(function() {
    T('✅ Подтверждено');
    window.checkJobFinish(jobId, workerHuid);
  });
};

window.completeJobWorker = function(jobId, employerHuid) {
  firebase.database().ref('jobs/' + jobId + '/confirmedWorker').set(true).then(function() {
    T('✅ Подтверждено');
    window.checkJobFinish(jobId, null, employerHuid);
  });
};

window.checkJobFinish = function(jobId, wHuid, eHuid) {
  firebase.database().ref('jobs/' + jobId).once('value', function(snap) {
    var j = snap.val();
    if (j.confirmedEmployer && j.confirmedWorker) {
      firebase.database().ref('jobs/' + jobId + '/status').set('done');
      var workerH = wHuid || j.selectedWorker;
      var employerH = eHuid || j.employerHuid;
      
      // Начисления
      window.addToken(workerH, 'qrt', 1.4); // 1.0 бонус + 0.4 кешбэк
      window.addToken(employerH, 'qrt', 0.1);
      
      T('🎉 Заказ завершён!');
      window.openRating(jobId, workerH, j.selectedWorkerName || 'Работник', 'worker');
    }
  });
};

// ==========================================
// 6. ДЕТАЛИ, ЧАТ И РЕЙТИНГ
// ==========================================
window.openJobDetail = function(jobId) {
  window.currentJobId = jobId;
  firebase.database().ref('jobs/' + jobId).once('value', function(snap) {
    var j = snap.val(); if (!j) return;
    var isEmployer = j.employerHuid === U.huid;
    var detailEl = el('job-detail');
    if (!detailEl) return;
    
    detailEl.innerHTML = '<div class="pg-head"><button onclick="window.closeJobDetail()">Назад</button><span>Детали</span></div>'
      + '<div style="padding:15px;">'
      + '<h2>' + j.title + '</h2>'
      + '<b>Цена: ' + j.price + '</b><p>' + j.desc + '</p>'
      + (isEmployer ? window.renderApplicants(j) : '<button onclick="window.applyToJob(\''+j.id+'\',this)">Откликнуться</button>')
      + '</div>';
    detailEl.style.display = 'flex';
  });
};

window.renderApplicants = function(j) {
  if (!j.applicants) return '<div>Нет откликов</div>';
  return Object.values(j.applicants).map(function(a) {
    return `<div style="padding:10px; border-bottom:1px solid #eee;">
      ${a.name} <button onclick="window.selectApplicant('${j.id}','${a.huid}','${a.name}')">Выбрать</button>
      <button onclick="window.openJobChat('${j.id}','${a.huid}','${a.name}')">Чат</button>
    </div>`;
  }).join('');
};

window.selectApplicant = function(jobId, workerHuid, workerName) {
  firebase.database().ref('jobs/' + jobId).update({
    status: 'closed',
    selectedWorker: workerHuid,
    selectedWorkerName: workerName
  });
  T('Исполнитель выбран!');
};

window.openJobChat = function(jobId, workerHuid, workerName) {
  if (window.chatRef) window.chatRef.off();
  var chatKey = (jobId + '_' + workerHuid).replace(/[^a-zA-Z0-9]/g,'');
  el('job-chat-title').innerText = workerName;
  el('job-chat').style.display = 'flex';
  
  window.chatRef = firebase.database().ref('job_chats/' + chatKey);
  window.chatRef.on('child_added', function(snap) {
    var m = snap.val();
    var d = document.createElement('div');
    d.innerText = m.senderName + ': ' + m.text;
    el('job-chat-msgs').appendChild(d);
  });
};

window.sendJobChatMsg = function() {
  var inp = el('job-chat-inp');
  if (!inp.value.trim() || !window.chatRef) return;
  window.chatRef.push({ text: inp.value, senderName: U.name, senderHuid: U.huid, time: Date.now() });
  inp.value = '';
};

window.closeJobChat = function() {
  if (window.chatRef) window.chatRef.off();
  el('job-chat').style.display = 'none';
};

window.openRating = function(jobId, targetHuid, targetName, targetRole) {
  el('rating-title').innerText = 'Оценить: ' + targetName;
  window.ratingData = { jobId: jobId, targetHuid: targetHuid, targetRole: targetRole };
  el('rating-panel').style.display = 'flex';
  window.renderStars(0);
};

window.renderStars = function(n) {
  window.selectedRating = n;
  el('rating-stars').innerHTML = [1,2,3,4,5].map(i => 
    `<span onclick="window.renderStars(${i})">${i <= n ? '⭐' : '☆'}</span>`
  ).join('');
};

window.submitRating = function() {
  if (!window.selectedRating) return T('Поставьте оценку');
  var key = window.ratingData.targetHuid.replace(/[^a-zA-Z0-9]/g,'');
  firebase.database().ref('ratings/' + key).push({
    rating: window.selectedRating,
    from: U.name,
    time: Date.now()
  }).then(() => {
    if (window.selectedRating >= 4) window.addToken(window.ratingData.targetHuid, 'qrt', 2);
    T('Спасибо за оценку!');
    el('rating-panel').style.display = 'none';
  });
};

window.closeJobDetail = function() { el('job-detail').style.display = 'none'; };
