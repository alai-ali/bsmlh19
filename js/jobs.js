// БИРЖА ТРУДА
var jobsDB = null;
var currentJobId = null;
var currentRole = null; // 'employer' или 'worker'

function initJobsDB() {
  if (!window.firebase || !firebase.apps || !firebase.apps.length) {
    setTimeout(initJobsDB, 800); return;
  }
  try {
    jobsDB = firebase.database().ref('jobs');
    console.log('JobsDB ready');
  } catch(e) {
    setTimeout(initJobsDB, 800); return;
  }
}

// РОЛЬ
function selectRole(role) {
  currentRole = role;
  el('jobs-role').style.display = 'none';
  if (role === 'employer') {
    el('jobs-employer').style.display = 'block';
  } else {
    el('jobs-worker').style.display = 'block';
    loadJobs();
  }
}

// КАТЕГОРИИ
var jobCategories = [
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

function renderCategories(targetId, onSelect) {
  var container = el(targetId);
  if (!container) return;
  container.innerHTML = jobCategories.map(function(c) {
    return '<div onclick="(' + onSelect + ')(\''+c.id+'\')" style="display:flex;align-items:center;gap:12px;padding:14px;background:white;border-radius:12px;margin-bottom:8px;cursor:pointer;border:1.5px solid var(--border);">'
      + '<span style="font-size:24px;">'+c.icon+'</span>'
      + '<span style="font-size:15px;font-weight:600;color:var(--text);">'+c.name+'</span>'
      + '</div>';
  }).join('');
}

// РАБОТОДАТЕЛЬ
var selectedCategory = '';

function showPostJob() {
  el('jobs-cat-select').style.display = 'block';
  el('jobs-employer-home').style.display = 'none';
  renderCategories('jobs-cat-list', 'selectJobCategory');
}

function selectJobCategory(catId) {
  selectedCategory = catId;
  var cat = jobCategories.find(function(c){ return c.id === catId; });
  el('jobs-cat-select').style.display = 'none';
  el('jobs-post-form').style.display = 'block';
  el('jobs-post-cat-label').innerText = cat ? cat.icon + ' ' + cat.name : catId;
}

function postNewJob() {
  if (!jobsDB) {
    T('⏳ Подключение...');
    initJobsDB();
    setTimeout(postNewJob, 1500);
    return; }
  var title = el('jp-title').value.trim();
  var desc = el('jp-desc').value.trim();
  var price = el('jp-price').value.trim();
  var location = el('jp-location').value.trim();
  if (!title) { T('Введите название заказа'); return; }
  if (!desc) { T('Опишите задание'); return; }
  if (!price) { T('Укажите оплату'); return; }

  var job = {
    id: Date.now().toString(36).toUpperCase(),
    title: title,
    desc: desc,
    price: price,
    location: location || 'Удалённо',
    category: selectedCategory,
    employer: U.name,
    employerHuid: U.huid,
    status: 'open',
    createdAt: Date.now(),
    applicants: {}
  };

  if (jobsDB) {
    jobsDB.child(job.id).set(job).then(function() {
      T('✅ Заказ опубликован!');
      el('jobs-post-form').style.display = 'none';
      el('jobs-employer-home').style.display = 'block';
      loadMyJobs();
      clearPostForm();
    }).catch(function(e){ T('Ошибка: ' + e.message); });
  } else {
  T('⏳ Подключение... попробуйте ещё раз');
    initJobsDB();
  }
}

function clearPostForm() {
  ['jp-title','jp-desc','jp-price','jp-location'].forEach(function(id){ var e=el(id); if(e) e.value=''; });
}

function loadMyJobs() {
  if (!jobsDB) return;
  var list = el('my-jobs-list');
  if (!list) return;
  jobsDB.orderByChild('employerHuid').equalTo(U.huid).on('value', function(snap) {
    var jobs = snap.val();
    if (!jobs) { list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text2);font-size:13px;">Нет активных заказов</div>'; return; }
    list.innerHTML = Object.values(jobs).reverse().map(function(j) {
      var appCount = j.applicants ? Object.keys(j.applicants).length : 0;
      return '<div class="job-item" onclick="openJobDetail(\''+j.id+'\')" style="cursor:pointer;">'
        + '<div class="job-company">' + (jobCategories.find(function(c){return c.id===j.category;})||{icon:'🔧'}).icon + ' ' + j.location + '</div>'
        + '<div class="job-title">' + j.title + '</div>'
        + '<div class="job-tags"><span class="job-tag">'+j.price+'</span><span class="job-tag" style="background:'+(j.status==='open'?'var(--green-light)':'#FEE2E2')+';color:'+(j.status==='open'?'var(--green)':'#EF4444')+'">'+(j.status==='open'?'Открыт':'Закрыт')+'</span></div>'
        + '<div style="font-size:12px;color:var(--green);margin-top:6px;font-weight:600;">👥 Откликов: '+appCount+'</div>'
        + '</div>';
    }).join('');
  });
}

// РАБОТНИК
function loadJobs() {
  var list = el('worker-jobs-list');
  if (!list) return;
firebase.database().ref('jobs').on('value', function(snap) {    var jobs = snap.val();
    if (!jobs) { list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text2);font-size:13px;">Нет доступных заказов</div>'; return; }
    list.innerHTML = Object.values(jobs).reverse().map(function(j) {
      var alreadyApplied = j.applicants && j.applicants[U.huid.replace(/[^a-zA-Z0-9]/g,'')];
      var cat = jobCategories.find(function(c){return c.id===j.category;})||{icon:'🔧'};
      return '<div class="job-item" onclick="openJobDetail(\''+j.id+'\')" style="cursor:pointer;">'
        + '<div class="job-company">' + cat.icon + ' ' + j.employer + '</div>'
        + '<div class="job-title">' + j.title + '</div>'
        + '<div style="font-size:13px;color:var(--text2);margin-bottom:8px;line-height:1.5;">' + j.desc.substring(0,80) + (j.desc.length>80?'...':'') + '</div>'
        + '<div class="job-tags"><span class="job-tag">'+j.price+'</span><span class="job-tag">'+j.location+'</span></div>'
        + (alreadyApplied
          ? '<div style="margin-top:10px;display:flex;gap:8px;align-items:center;"><span style="font-size:13px;color:var(--green);font-weight:600;flex:1;">✅ Вы откликнулись</span><button style="padding:8px 14px;background:var(--green);color:white;border:none;border-radius:10px;font-size:13px;cursor:pointer;" onclick="event.stopPropagation();openJobChat(\''+j.id+'\',\''+U.huid+'\',\''+j.employer+'\')">💬 Чат</button></div>'
: j.status === 'closed' 
  ? '<div style="margin-top:10px;font-size:13px;color:var(--text2);text-align:center;padding:8px;background:var(--bg);border-radius:8px;">🔒 Заказ закрыт</div>'
  : '<button class="btn" style="margin-top:10px;padding:10px;font-size:13px;" onclick="event.stopPropagation();applyToJob(\''+j.id+'\',this)">Откликнуться</button>')        + '</div>';
    }).join('');
  });
}

function applyToJob(jobId, btn) {
  if (!jobsDB) { T('Нет соединения'); return; }
  var key = U.huid.replace(/[^a-zA-Z0-9]/g,'');
  var applicant = { name: U.name, huid: U.huid, appliedAt: Date.now(), status: 'pending' };
  jobsDB.child(jobId + '/applicants/' + key).set(applicant).then(function() {
    if (btn) { btn.innerText = '✅ Отклик отправлен'; btn.disabled = true; btn.style.background = '#6B7280'; }
    T('✅ Отклик отправлен!');
  }).catch(function(e){ T('Ошибка: ' + e.message); });
}

// ДЕТАЛИ ЗАКАЗА
function openJobDetail(jobId) {
  currentJobId = jobId;
firebase.database().ref('jobs/' + jobId).once('value', function(snap) {    var j = snap.val();
    if (!j) return;
    var isEmployer = j.employerHuid === U.huid;
    var detail = el('job-detail');
    var cat = jobCategories.find(function(c){return c.id===j.category;}) || {icon:'🔧',name:'Другое'};
    var appCount = j.applicants ? Object.keys(j.applicants).length : 0;
    var alreadyApplied = j.applicants && j.applicants[U.huid.replace(/[^a-zA-Z0-9]/g,'')];

    detail.innerHTML = '<div class="pg-head" style="background:white;padding:16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border);">'
      + '<button class="pg-back" onclick="closeJobDetail()"><svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg></button>'
      + '<span style="font-size:17px;font-weight:700;">Детали заказа</span></div>'
      + '<div style="padding:16px;overflow-y:auto;flex:1;">'
      + '<div style="font-size:11px;color:var(--text2);margin-bottom:4px;">' + cat.icon + ' ' + cat.name + ' · ' + j.location + '</div>'
      + '<div style="font-size:20px;font-weight:900;color:var(--text);margin-bottom:8px;">' + j.title + '</div>'
      + '<div style="font-size:24px;font-weight:900;color:var(--green);margin-bottom:16px;">' + j.price + '</div>'
      + '<div class="card"><div class="section-title">Описание</div><div style="font-size:14px;color:var(--text);line-height:1.7;">' + j.desc + '</div></div>'
      + '<div class="card"><div class="section-title">Работодатель</div><div style="font-size:14px;font-weight:600;">' + j.employer + '</div></div>'
      + (isEmployer ? renderApplicants(j) :
          alreadyApplied ? '<div style="text-align:center;padding:20px;font-size:15px;font-weight:700;color:var(--green);">✅ Вы уже откликнулись</div>'
          : '<button class="btn" onclick="applyToJob(\''+j.id+'\',this)">Откликнуться</button>')
      + '</div>';

    el('job-detail').style.display = 'flex';
  });
}

function renderApplicants(j) {
  if (!j.applicants || Object.keys(j.applicants).length === 0) {
    return '<div class="card"><div class="section-title">Отклики</div><div style="text-align:center;padding:16px;color:var(--text2);font-size:13px;">Откликов пока нет</div></div>';
  }
  var apps = Object.values(j.applicants);
  return '<div class="card"><div class="section-title">Отклики (' + apps.length + ')</div>'
    + apps.map(function(a) {
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border);">'
        + '<div><div style="font-size:14px;font-weight:600;">' + a.name + '</div>'
        + '<div style="font-size:11px;color:var(--text2);">' + a.huid + '</div></div>'
        + '<div style="display:flex;gap:8px;">'
        + '<button style="padding:6px 12px;background:var(--green);color:white;border:none;border-radius:8px;font-size:12px;cursor:pointer;" onclick="selectApplicant(\''+j.id+'\',\''+a.huid+'\')">✓ Выбрать</button>'
        + '<button style="padding:6px 12px;background:var(--bg);color:var(--text2);border:1px solid var(--border);border-radius:8px;font-size:12px;cursor:pointer;" onclick="openJobChat(\''+j.id+'\',\''+a.huid+'\',\''+a.name+'\')">💬</button>'
        + '</div></div>';
    }).join('')
    + '</div>';
}

function selectApplicant(jobId, workerHuid) {
  if (!jobsDB) return;
  jobsDB.child(jobId + '/status').set('closed');
  jobsDB.child(jobId + '/selectedWorker').set(workerHuid);
  T('✅ Работник выбран!');
  closeJobDetail();
}

function closeJobDetail() {
  el('job-detail').style.display = 'none';
}

// ЧАТ
var chatRef = null;
var chatJobId = null;
var chatWorkerHuid = null;

function openJobChat(jobId, workerHuid, workerName) {
  // Отключить старый listener
  if (chatRef) { chatRef.off(); chatRef = null; }
  
  chatJobId = jobId;
  chatWorkerHuid = workerHuid;
  
  var chatTitle = el('job-chat-title');
  if (chatTitle) chatTitle.innerText = workerName;
  
  // Очистить сообщения
  el('job-chat-msgs').innerHTML = '';
  el('job-chat').style.display = 'flex';

  // Ключ чата = jobId + HUID работника
  var chatKey = (jobId + '_' + workerHuid).replace(/[^a-zA-Z0-9]/g,'').substring(0,60);
  
  if (!window.firebase || !firebase.apps.length) { 
    T('Нет соединения'); 
    return; 
  }
  
  chatRef = firebase.database().ref('job_chats/' + chatKey);
  chatRef.on('child_added', function(snap) {
    var msg = snap.val();
    if (!msg) return;
    var msgs = el('job-chat-msgs');
    var isMe = msg.senderHuid === U.huid;
    var d = document.createElement('div');
    d.className = 'msg ' + (isMe ? 'user' : 'bot');
    d.innerHTML = '<div style="font-size:10px;opacity:0.7;margin-bottom:2px;">' + (isMe ? 'Вы' : msg.senderName) + '</div>' + msg.text;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  });
}

function sendJobChatMsg() {
  var inp = el('job-chat-inp');
  if (!inp || !inp.value.trim()) return;
  var text = inp.value.trim();
  inp.value = '';
  if (!chatRef) { T('Нет соединения'); return; }
  chatRef.push({ 
    text: text, 
    senderName: U.name, 
    senderHuid: U.huid, 
    time: Date.now() 
  });
}

function closeJobChat() {
  if (chatRef) { chatRef.off(); chatRef = null; }
  el('job-chat').style.display = 'none';
}

// РЕЙТИНГ
function openRating(jobId, targetHuid, targetName) {
  el('rating-title').innerText = 'Оценить: ' + targetName;
  el('rating-job-id').value = jobId;
  el('rating-target').value = targetHuid;
  el('rating-panel').style.display = 'flex';
  renderStars(0);
}

var selectedRating = 0;
function renderStars(n) {
  selectedRating = n;
  var s = el('rating-stars');
  if (!s) return;
  s.innerHTML = [1,2,3,4,5].map(function(i) {
    return '<span onclick="renderStars('+i+')" style="font-size:36px;cursor:pointer;">' + (i<=n?'⭐':'☆') + '</span>';
  }).join('');
}

function submitRating() {
  if (!selectedRating) { T('Поставьте оценку'); return; }
  var jobId = el('rating-job-id').value;
  var targetHuid = el('rating-target').value;
  var review = el('rating-review').value.trim();
  if (jobsDB) {
    firebase.database().ref('ratings/' + targetHuid.replace(/[^a-zA-Z0-9]/g,'')).push({
      rating: selectedRating, review: review, from: U.name, fromHuid: U.huid, jobId: jobId, time: Date.now()
    }).then(function(){ T('✅ Оценка отправлена!'); el('rating-panel').style.display='none'; });
  } else {
    T('✅ Оценка отправлена (демо)!');
    el('rating-panel').style.display = 'none';
  }
}

function closeRating() { el('rating-panel').style.display = 'none'; }

// ФИЛЬТР
function filterJobs(catId) {
  if (!jobsDB) return;
  var list = el('worker-jobs-list');
  var query = catId ? jobsDB.orderByChild('category').equalTo(catId) : jobsDB.orderByChild('status').equalTo('open');
  query.on('value', function(snap) {
    var jobs = snap.val();
    if (!jobs) { list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text2);">Нет заказов</div>'; return; }
    var filtered = Object.values(jobs).filter(function(j){ return j.status==='open'; });
    if (!filtered.length) { list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text2);">Нет заказов в этой категории</div>'; return; }
    list.innerHTML = filtered.reverse().map(function(j) {
      var cat = jobCategories.find(function(c){return c.id===j.category;})||{icon:'🔧'};
      return '<div class="job-item" onclick="openJobDetail(\''+j.id+'\')" style="cursor:pointer;">'
        + '<div class="job-company">' + cat.icon + ' ' + j.employer + '</div>'
        + '<div class="job-title">' + j.title + '</div>'
        + '<div style="font-size:13px;color:var(--text2);margin-bottom:8px;">' + j.desc.substring(0,80) + '...</div>'
        + '<div class="job-tags"><span class="job-tag">'+j.price+'</span><span class="job-tag">'+j.location+'</span></div>'
        + '<button class="btn" style="margin-top:10px;padding:10px;font-size:13px;" onclick="event.stopPropagation();applyToJob(\''+j.id+'\',this)">Откликнуться</button>'
        + '</div>';
    }).join('');
  });
}
