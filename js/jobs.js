// ==========================================
// 1. ГЛОБАЛЬНОЕ СОСТОЯНИЕ (STATE)
// ==========================================
var U = { 
    name: localStorage.getItem('bsmlh_name') || '', 
    huid: localStorage.getItem('bsmlh_huid') || '', 
    phone: '', photo: '', hasChip: false, chipUID: '' 
};

// Категории работ
var jobCategories = [
    { id:'it', icon:'💻', name:'IT' },
    { id:'build', icon:'🏗️', name:'Стройка' },
    { id:'transport', icon:'🚗', name:'Транспорт' },
    { id:'clean', icon:'🧹', name:'Клининг' },
    { id:'other', icon:'🔧', name:'Другое' }
];

// ==========================================
// 2. УТИЛИТЫ И ИНТЕРФЕЙС
// ==========================================
function el(id) { return document.getElementById(id); }

function T(msg) {
    var t = el('toast');
    if (!t) { console.log("Toast:", msg); return; }
    t.innerText = msg;
    t.classList.add('show');
    setTimeout(function(){ t.classList.remove('show'); }, 2800);
}

function showScr(id) {
    document.querySelectorAll('.scr').forEach(function(s){ s.style.display = 'none'; });
    var s = el(id); if (s) s.style.display = 'flex';
}

function openPg(id) {
    var p = el(id); if (p) p.style.display = 'flex';
    if (id === 'pg-wal') loadWalletBalance();
    if (id === 'pg-stats') loadStats();
}

function closePg(id) {
    var p = el(id); if (p) p.style.display = 'none';
}

// ==========================================
// 3. ЛОГИКА БИРЖИ (РАБОТОДАТЕЛЬ / РАБОТНИК)
// ==========================================
function selectRole(role) {
    var roleScr = el('jobs-role');
    var empScr = el('jobs-employer');
    var wrkScr = el('jobs-worker');

    if (roleScr) roleScr.style.display = 'none';

    if (role === 'employer') {
        if (empScr) empScr.style.display = 'block';
        if (wrkScr) wrkScr.style.display = 'none';
        loadMyJobs();
    } else {
        if (wrkScr) wrkScr.style.display = 'block';
        if (empScr) empScr.style.display = 'none';
        loadJobs();
    }
}

function loadJobs() {
    var list = el('worker-jobs-list');
    if (!list || !window.firebase) return;

    var ref = firebase.database().ref('jobs');
    ref.off(); // Очистка старых слушателей чтобы не висло
    ref.on('value', function(snap) {
        var jobs = snap.val();
        if (!jobs) { list.innerHTML = '<div class="empty">Заказов пока нет</div>'; return; }
        
        var html = '';
        Object.values(jobs).reverse().forEach(function(j) {
            if (j.status === 'open') {
                html += `
                <div class="job-item">
                    <div class="job-company">🏢 ${j.employer || 'Аноним'}</div>
                    <div class="job-title" onclick="T('Детали заказа в разработке')">${j.title}</div>
                    <div class="job-tags"><span class="job-tag">${j.price} QRT</span></div>
                    <button class="btn-apply" onclick="applyJob(this, '${j.title}')">Откликнуться</button>
                </div>`;
            }
        });
        list.innerHTML = html || '<div class="empty">Нет активных заказов</div>';
    });
}

function loadMyJobs() {
    var list = el('my-jobs-list');
    if (!list || !window.firebase) return;

    firebase.database().ref('jobs').orderByChild('employerHuid').equalTo(U.huid).on('value', function(snap) {
        var jobs = snap.val();
        if (!jobs) { list.innerHTML = '<div class="empty">Вы еще не создали ни одного заказа</div>'; return; }
        
        list.innerHTML = Object.values(jobs).reverse().map(function(j) {
            return `
            <div class="job-item">
                <div class="job-title">${j.title}</div>
                <div class="job-status status-${j.status}">${j.status === 'open' ? 'Поиск исполнителя' : 'В работе'}</div>
                <div class="job-price">${j.price} QRT</div>
            </div>`;
        }).join('');
    });
}

function applyJob(btn, title) {
    btn.innerText = '✅ Отправлено';
    btn.disabled = true;
    btn.style.background = '#6B7280';
    T('Отклик на "' + title + '" успешно отправлен!');
}

function postJob() {
    var title = el('job-post-title');
    var price = el('job-post-salary');
    if (!title || !title.value.trim()) { T('Введите название вакансии'); return; }

    var newJob = {
        id: 'JB' + Date.now(),
        title: title.value.trim(),
        price: price ? price.value : '0',
        employerHuid: U.huid,
        employer: U.name,
        status: 'open',
        date: Date.now()
    };

    firebase.database().ref('jobs/' + newJob.id).set(newJob).then(function() {
        T('✅ Вакансия опубликована!');
        title.value = '';
        if(price) price.value = '';
        selectRole('employer');
    });
}

// ==========================================
// 4. КОШЕЛЕК И ТОКЕНЫ
// ==========================================
function loadWalletBalance() {
    if (!U.huid || !window.firebase) return;
    var key = U.huid.replace(/[^a-zA-Z0-9]/g, '');

    firebase.database().ref('tokens/' + key).on('value', function(snap) {
        var data = snap.val() || { qrt: 0, qrnc: 0, bsmlh: 1 };
        if (el('wal-qrt')) el('wal-qrt').innerText = (data.qrt || 0).toFixed(3);
        if (el('wal-qrnc')) el('wal-qrnc').innerText = (data.qrnc || 0).toFixed(3);
        if (el('wal-bsmlh')) el('wal-bsmlh').innerText = data.bsmlh || 1;
    });
}

// ==========================================
// 5. ЗАПУСК ПРИЛОЖЕНИЯ
// ==========================================
function toApp() {
    try {
        if (!U.huid) {
            var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', uid = '';
            for (var i = 0; i < 16; i++) uid += chars[Math.floor(Math.random() * chars.length)];
            U.huid = 'BSMLH-2026-' + uid;
            U.name = el('inp-name') ? el('inp-name').value.trim() : 'User';
            localStorage.setItem('bsmlh_huid', U.huid);
            localStorage.setItem('bsmlh_name', U.name);
        }

        var key = U.huid.replace(/[^a-zA-Z0-9]/g, '');

        if (window.firebase && firebase.apps.length) {
            // Регистрация в БД если новый
            var userRef = firebase.database().ref('tokens/' + key);
            userRef.once('value', function(s) {
                if (!s.val()) {
                    userRef.set({ qrt: 50, qrnc: 0, bsmlh: 1, regDate: Date.now() });
                    T('🎁 Начислено 50 QRT за регистрацию!');
                }
            });
        }

        // Обновление UI
        ['id-name','p-name','set-name'].forEach(function(id){ if(el(id)) el(id).innerText = U.name.toUpperCase(); });
        ['id-huid','p-huid','set-huid'].forEach(function(id){ if(el(id)) el(id).innerText = U.huid; });

        document.querySelectorAll('.scr').forEach(function(s){ s.style.display='none'; });
        if (el('app')) el('app').style.display = 'flex';

    } catch(e) {
        console.error("Critical Start Error:", e);
    }
}

// ==========================================
// 6. СТАТИСТИКА И УРОВНИ
// ==========================================
function loadStats() {
    if (!U.huid || !window.firebase) return;
    var key = U.huid.replace(/[^a-zA-Z0-9]/g, '');

    firebase.database().ref('jobs').once('value', function(snap) {
        var done = 0;
        snap.forEach(function(child) {
            if (child.val().selectedWorker === U.huid && child.val().status === 'done') done++;
        });

        // Расчет уровня
        var level = 'Новичок 🌱', progress = 10;
        if (done >= 1) { level = 'Стартер ⚡'; progress = 30; }
        if (done >= 5) { level = 'Активный 🔥'; progress = 60; }
        
        if (el('stat-level-badge')) el('stat-level-badge').innerText = level;
        if (el('stat-progress')) el('stat-progress').style.width = progress + '%';
        if (el('stat-done')) el('stat-done').innerText = done;
    });
}

// Принудительная инициализация после загрузки страницы
window.onload = function() {
    if (localStorage.getItem('bsmlh_huid')) {
        toApp();
    }
};
