// БИРЖА ТРУДА
var jobsDB = null;
var currentJobId = null;
var currentRole = null;
var initAttempts = 0;

function initJobsDB() {
    if (!window.firebase || !firebase.apps || !firebase.apps.length) {
        if (initAttempts < 10) {
            initAttempts++;
            setTimeout(initJobsDB, 800);
        }
        return;
    }
    try {
        jobsDB = firebase.database().ref('jobs');
        console.log('JobsDB ready');
    } catch(e) {
        console.error('Firebase init error:', e);
    }
}

// РОЛЬ
function selectRole(role) {
    currentRole = role;
    el('jobs-role').style.display = 'none';
    if (role === 'employer') {
        el('jobs-employer').style.display = 'block';
        el('jobs-worker').style.display = 'none'; // Скрываем чужую роль
        loadMyJobs();
    } else {
        el('jobs-worker').style.display = 'block';
        el('jobs-employer').style.display = 'none';
        loadJobs();
    }
}

// РАБОТОДАТЕЛЬ: ПУБЛИКАЦИЯ
function postNewJob() {
    var title = el('jp-title').value.trim();
    var desc = el('jp-desc').value.trim();
    var price = el('jp-price').value.trim();
    var location = el('jp-location').value.trim();

    if (!title || !desc || !price) { T('Заполните обязательные поля'); return; }

    var key = U.huid.replace(/[^a-zA-Z0-9]/g, '');
    var FREE_LIMIT = 5;
    var POST_FEE = 5;

    firebase.database().ref('jobs').orderByChild('employerHuid').equalTo(U.huid).once('value', function(snap) {
        var count = snap.numChildren();

        var publishJob = function() {
            var jobId = Date.now().toString(36).toUpperCase();
            var job = {
                id: jobId,
                title: title,
                desc: desc,
                price: price,
                location: location || 'Удалённо',
                category: selectedCategory,
                employer: U.name,
                employerHuid: U.huid,
                status: 'open',
                createdAt: Date.now()
            };

            firebase.database().ref('jobs/' + jobId).set(job).then(function() {
                T('✅ Заказ опубликован!');
                el('jobs-post-form').style.display = 'none';
                el('jobs-employer-home').style.display = 'block';
                loadMyJobs();
                clearPostForm();
            });
        };

        if (count < FREE_LIMIT) {
            publishJob();
        } else {
            firebase.database().ref('tokens/' + key + '/qrt').once('value', function(qSnap) {
                var balance = qSnap.val() || 0;
                if (balance < POST_FEE) {
                    T('❌ Недостаточно QRT (нужно ' + POST_FEE + ')');
                    return;
                }
                // Списание
                firebase.database().ref('tokens/' + key + '/qrt').set(Number((balance - POST_FEE).toFixed(5)));
                firebase.database().ref('transactions/' + key).push({
                    type: 'fee_post',
                    amount: -POST_FEE,
                    desc: 'Публикация заказа',
                    time: Date.now()
                });
                publishJob();
            });
        }
    });
}

// ПОДТВЕРЖДЕНИЕ ЗАКАЗА (РАБОТНИК)
function completeJobWorker(jobId, employerHuid) {
    if (!window.firebase) return;
    var key = U.huid.replace(/[^a-zA-Z0-9]/g, '');
    
    firebase.database().ref('jobs/' + jobId + '/confirmedWorker').set(true).then(function() {
        T('✅ Вы подтвердили выполнение');
        
        // Слушаем ответ работодателя
        var ref = firebase.database().ref('jobs/' + jobId);
        ref.on('value', function(snap) {
            var j = snap.val();
            if (j && j.confirmedEmployer && j.status !== 'done') {
                ref.off(); // Важно: отключаем слушатель
                finalizeJob(jobId, key, employerHuid, j.employer);
            }
        });
    });
}

function finalizeJob(jobId, workerKey, employerHuid, employerName) {
    var CASHBACK = 0.4;
    firebase.database().ref('jobs/' + jobId + '/status').set('done');
    
    // Начисление кешбэка
    firebase.database().ref('tokens/' + workerKey + '/qrt').once('value', function(s) {
        var bal = s.val() || 0;
        firebase.database().ref('tokens/' + workerKey + '/qrt').set(Number((bal + CASHBACK).toFixed(5)));
    });

    addToken(U.huid, 'qrt', 1); // Бонус за качество
    addToken(employerHuid, 'qrt', 0.1);

    T('🎉 Заказ завершён!');
    setTimeout(function() {
        openRating(jobId, employerHuid, employerName, 'worker');
    }, 800);
}

// ЧАТ (Исправление дублирования сообщений)
function openJobChat(jobId, workerHuid, workerName) {
    var chatKey = (jobId + '_' + workerHuid).replace(/[^a-zA-Z0-9]/g,'').substring(0,60);
    var chatContainer = el('job-chat-msgs');
    chatContainer.innerHTML = '';
    
    if (chatRef) chatRef.off(); // Снимаем старый слушатель
    
    el('job-chat').style.display = 'flex';
    el('job-chat-title').innerText = workerName;
    
    chatRef = firebase.database().ref('job_chats/' + chatKey);
    chatRef.on('child_added', function(snap) {
        var msg = snap.val();
        var isMe = msg.senderHuid === U.huid;
        var d = document.createElement('div');
        d.className = 'msg ' + (isMe ? 'user' : 'bot');
        d.innerHTML = '<div style="font-size:10px;opacity:0.7;">' + (isMe ? 'Вы' : msg.senderName) + '</div>' + msg.text;
        chatContainer.appendChild(d);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}
