// ═══════════════════════════════════════════════════════
// ТОКЕНОМИКА BSMLH v1.0
// 
// Регистрация:      +10 QRT стартовый бонус
// Отклик:           -2 QRT
// Кешбэк за сделку: +0.4 QRT (20% от 2)
// Работодатель:     5 заказов бесплатно, далее -5 QRT
// ═══════════════════════════════════════════════════════


// ───────────────────────────────────────────────────────
// 1. В app.js — в функции toApp()
//    НАЙДИТЕ блок "Новый пользователь — начислить 1 BSMLH"
//    и ДОБАВЬТЕ после ref.set(1):
// ───────────────────────────────────────────────────────

/*
  // Стартовый бонус 10 QRT новому пользователю
  var qrtRef = firebase.database().ref('tokens/' + key + '/qrt');
  qrtRef.once('value', function(qSnap) {
    if (!qSnap.val()) {
      qrtRef.set(10);
      T('🎁 Добро пожаловать! Начислено 10 QRT');
    }
  });

  // Дата регистрации для статистики
  var regRef = firebase.database().ref('tokens/' + key + '/regDate');
  regRef.once('value', function(rSnap) {
    if (!rSnap.val()) {
      regRef.set(Date.now());
      localStorage.setItem('bsmlh_reg_date', Date.now());
    }
  });
*/


// ───────────────────────────────────────────────────────
// 2. В jobs.js — ЗАМЕНИТЬ функцию applyToJob()
// ───────────────────────────────────────────────────────

function applyToJob(jobId, btn) {
  if (!U.huid) { T('Войдите в аккаунт'); return; }
  if (!window.firebase || !firebase.apps.length) { T('Нет соединения'); return; }

  var key = U.huid.replace(/[^a-zA-Z0-9]/g, '');
  var FEE = 2; // QRT за отклик

  if (btn) btn.disabled = true;

  firebase.database().ref('tokens/' + key + '/qrt').once('value', function(snap) {
    var balance = snap.val() || 0;

    if (balance < FEE) {
      T('❌ Нужно ' + FEE + ' QRT для отклика. Баланс: ' + balance.toFixed(1) + ' QRT');
      if (btn) btn.disabled = false;
      return;
    }

    // Списываем 2 QRT
    firebase.database().ref('tokens/' + key + '/qrt').set(
      Math.round((balance - FEE) * 100000) / 100000
    );

    // Сохраняем транзакцию
    firebase.database().ref('transactions/' + key).push({
      type:   'fee_apply',
      amount: -FEE,
      jobId:  jobId,
      desc:   'Отклик на заказ',
      time:   Date.now()
    });

    // Отправляем отклик
    firebase.database().ref('jobs/' + jobId + '/applicants/' + key).set({
      name:      U.name,
      huid:      U.huid,
      appliedAt: Date.now(),
      status:    'pending'
    }).then(function() {
      T('✅ Отклик отправлен! Списано ' + FEE + ' QRT');
      loadJobs();
    }).catch(function(e) {
      T('Ошибка: ' + e.message);
      if (btn) btn.disabled = false;
    });
  });
}


// ───────────────────────────────────────────────────────
// 3. В jobs.js — ЗАМЕНИТЬ функцию completeJobWorker()
// ───────────────────────────────────────────────────────

function completeJobWorker(jobId, employerHuid) {
  if (!window.firebase || !firebase.apps.length) { T('Нет соединения'); return; }

  var key = U.huid.replace(/[^a-zA-Z0-9]/g, '');
  var CASHBACK = 0.4; // 20% от 2 QRT

  firebase.database().ref('jobs/' + jobId + '/confirmedWorker').set(true).then(function() {
    T('✅ Вы подтвердили завершение');
    closeJobDetail();

    firebase.database().ref('jobs/' + jobId).once('value', function(snap) {
      var j = snap.val();
      if (!j) return;

      function finishJob(jobData) {
        firebase.database().ref('jobs/' + jobId + '/status').set('done');

        // Кешбэк работнику +0.4 QRT
        firebase.database().ref('tokens/' + key + '/qrt').once('value', function(s) {
          var bal = s.val() || 0;
          firebase.database().ref('tokens/' + key + '/qrt').set(
            Math.round((bal + CASHBACK) * 100000) / 100000
          );
          firebase.database().ref('transactions/' + key).push({
            type:   'cashback',
            amount: +CASHBACK,
            jobId:  jobId,
            desc:   'Кешбэк за завершение заказа',
            time:   Date.now()
          });
        });

        // Рейтинговые токены работнику (QRT за качество)
        addToken(U.huid, 'qrt', 1);
        // Работодателю небольшой бонус
        addToken(employerHuid, 'qrt', 0.1);

        T('🎉 Заказ завершён! +0.4 QRT кешбэк + бонус за качество');

        setTimeout(function() {
          openRating(jobId, employerHuid, jobData.employer, 'worker');
        }, 800);
      }

      if (j.confirmedEmployer) {
        finishJob(j);
      } else {
        firebase.database().ref('jobs/' + jobId + '/confirmedEmployer').on('value', function(s) {
          if (s.val() === true) {
            firebase.database().ref('jobs/' + jobId + '/confirmedEmployer').off();
            firebase.database().ref('jobs/' + jobId).once('value', function(snap2) {
              var j2 = snap2.val();
              if (j2) finishJob(j2);
            });
          }
        });
      }
    });
  });
}


// ───────────────────────────────────────────────────────
// 4. В jobs.js — ЗАМЕНИТЬ функцию completeJobEmployer()
// ───────────────────────────────────────────────────────

function completeJobEmployer(jobId, workerHuid) {
  if (!window.firebase || !firebase.apps.length) { T('Нет соединения'); return; }

  firebase.database().ref('jobs/' + jobId + '/confirmedEmployer').set(true).then(function() {
    T('✅ Вы подтвердили завершение');
    closeJobDetail();

    firebase.database().ref('jobs/' + jobId).once('value', function(snap) {
      var j = snap.val();
      if (!j) return;

      function finishJob(jobData) {
        firebase.database().ref('jobs/' + jobId + '/status').set('done');

        var workerKey = workerHuid.replace(/[^a-zA-Z0-9]/g, '');
        var CASHBACK = 0.4;

        // Кешбэк работнику
        firebase.database().ref('tokens/' + workerKey + '/qrt').once('value', function(s) {
          var bal = s.val() || 0;
          firebase.database().ref('tokens/' + workerKey + '/qrt').set(
            Math.round((bal + CASHBACK) * 100000) / 100000
          );
          firebase.database().ref('transactions/' + workerKey).push({
            type:   'cashback',
            amount: +CASHBACK,
            jobId:  jobId,
            desc:   'Кешбэк за завершение заказа',
            time:   Date.now()
          });
        });

        // Рейтинговые токены
        addToken(workerHuid, 'qrt', 1);
        addToken(U.huid, 'qrt', 0.1);

        T('🎉 Заказ завершён!');

        setTimeout(function() {
          openRating(
            jobId,
            workerHuid,
            jobData.selectedWorkerName || 'Работник',
            'employer'
          );
        }, 800);
      }

      if (j.confirmedWorker) {
        finishJob(j);
      } else {
        firebase.database().ref('jobs/' + jobId + '/confirmedWorker').on('value', function(s) {
          if (s.val() === true) {
            firebase.database().ref('jobs/' + jobId + '/confirmedWorker').off();
            firebase.database().ref('jobs/' + jobId).once('value', function(snap2) {
              var j2 = snap2.val();
              if (j2) finishJob(j2);
            });
          }
        });
      }
    });
  });
}


// ───────────────────────────────────────────────────────
// 5. В jobs.js — ЗАМЕНИТЬ функцию postNewJob()
//    Добавляет проверку лимита 5 бесплатных заказов
//    для работодателя, далее -5 QRT за публикацию
// ───────────────────────────────────────────────────────

function postNewJob() {
  var title    = el('jp-title').value.trim();
  var desc     = el('jp-desc').value.trim();
  var price    = el('jp-price').value.trim();
  var location = el('jp-location').value.trim();

  if (!title)    { T('Введите название заказа'); return; }
  if (!desc)     { T('Опишите задание'); return; }
  if (!price)    { T('Укажите оплату'); return; }

  var key = U.huid.replace(/[^a-zA-Z0-9]/g, '');
  var FREE_LIMIT = 5;
  var POST_FEE   = 5; // QRT за публикацию после лимита

  // Считаем сколько заказов уже разместил
  firebase.database().ref('jobs')
    .orderByChild('employerHuid')
    .equalTo(U.huid)
    .once('value', function(snap) {

      var count = snap.numChildren();

      function publishJob() {
        var job = {
          id:           Date.now().toString(36).toUpperCase(),
          title:        title,
          desc:         desc,
          price:        price,
          location:     location || 'Удалённо',
          category:     selectedCategory,
          employer:     U.name,
          employerHuid: U.huid,
          status:       'open',
          createdAt:    Date.now(),
          applicants:   {}
        };

        firebase.database().ref('jobs/' + job.id).set(job).then(function() {
          T('✅ Заказ опубликован!');
          el('jobs-post-form').style.display  = 'none';
          el('jobs-employer-home').style.display = 'block';
          loadMyJobs();
          clearPostForm();
        }).catch(function(e) {
          T('Ошибка: ' + e.message);
        });
      }

      if (count < FREE_LIMIT) {
        // Бесплатно
        var left = FREE_LIMIT - count - 1;
        if (left > 0) T('📢 Публикация бесплатна! Осталось бесплатных: ' + left);
        else T('📢 Последний бесплатный заказ!');
        publishJob();

      } else {
        // Платно — проверяем баланс QRT
        firebase.database().ref('tokens/' + key + '/qrt').once('value', function(qSnap) {
          var balance = qSnap.val() || 0;

          if (balance < POST_FEE) {
            T('❌ Нужно ' + POST_FEE + ' QRT для публикации. Баланс: ' + balance.toFixed(1) + ' QRT');
            return;
          }

          // Списываем 5 QRT
          firebase.database().ref('tokens/' + key + '/qrt').set(
            Math.round((balance - POST_FEE) * 100000) / 100000
          );

          firebase.database().ref('transactions/' + key).push({
            type:   'fee_post',
            amount: -POST_FEE,
            desc:   'Публикация заказа',
            time:   Date.now()
          });

          T('✅ Заказ опубликован! Списано ' + POST_FEE + ' QRT');
          publishJob();
        });
      }
    });
}


// ───────────────────────────────────────────────────────
// 6. В app.js — ДОБАВИТЬ функцию loadStats() в конец файла
// ───────────────────────────────────────────────────────

function loadStats() {
  if (!U.huid) return;

  // Дни на платформе
  var reg = localStorage.getItem('bsmlh_reg_date');
  if (!reg) {
    reg = Date.now();
    localStorage.setItem('bsmlh_reg_date', reg);
  }
  var days = Math.max(1, Math.floor((Date.now() - parseInt(reg)) / 86400000));
  var dEl = el('stat-days');
  if (dEl) dEl.innerText = days;

  if (!window.firebase || !firebase.apps || !firebase.apps.length) {
    setTimeout(loadStats, 1000);
    return;
  }

  var key = U.huid.replace(/[^a-zA-Z0-9]/g, '');

  // Токены
  firebase.database().ref('tokens/' + key).once('value', function(snap) {
    var data  = snap.val() || {};
    var qrt   = data.qrt   || 0;
    var qrnc  = data.qrnc  || 0;
    var earned = Math.floor(qrt * 150);

    var eq = el('stat-qrt');    if (eq) eq.innerText = qrt.toFixed(1);
    var en = el('stat-qrnc');   if (en) en.innerText = qrnc.toFixed(2);
    var ee = el('stat-earned'); if (ee) ee.innerText = earned.toLocaleString('ru-RU') + ' ₸';
  });

  // Заказы — реальные поля вашей БД
  firebase.database().ref('jobs').once('value', function(snap) {
    var done = 0, posted = 0;

    snap.forEach(function(job) {
      var d = job.val();
      if (!d) return;
      if (d.employerHuid === U.huid) posted++;
      if (d.selectedWorker === U.huid && d.status === 'done') done++;
    });

    var dEl2 = el('stat-done');   if (dEl2) dEl2.innerText = done;
    var pEl  = el('stat-posted'); if (pEl)  pEl.innerText  = posted;

    // Рейтинг
    firebase.database().ref('ratings/' + key).once('value', function(rSnap) {
      var total = 0, count = 0;
      rSnap.forEach(function(r) {
        var rv = r.val();
        if (rv && rv.rating) { total += rv.rating; count++; }
      });
      var rEl = el('stat-rating');
      if (rEl) rEl.innerText = count > 0 ? (total / count).toFixed(1) + ' ⭐' : '—';
    });

    // Уровень
    var level = 'Новичок 🌱', color = '#21A038', bg = '#E8F5E9', progress = 3;
    if (done >= 1)  { level = 'Стартер ⚡';  progress = 20; color = '#2563EB'; bg = '#EFF6FF'; }
    if (done >= 5)  { level = 'Активный 🔥'; progress = 40; color = '#7C3AED'; bg = '#EDE9FE'; }
    if (done >= 15) { level = 'Профи 🏆';    progress = 65; color = '#D97706'; bg = '#FEF3C7'; }
    if (done >= 30) { level = 'Эксперт 💎';  progress = 85; color = '#0891b2'; bg = '#E0F2FE'; }
    if (done >= 50) { level = 'Легенда 🌟';  progress = 100; color = '#0f172a'; bg = '#f1f5f9'; }

    var lb = el('stat-level-badge');
    if (lb) { lb.innerText = level; lb.style.background = bg; lb.style.color = color; }

    var pr = el('stat-progress');
    if (pr) setTimeout(function() { pr.style.width = progress + '%'; }, 200);

    var levels = [1, 5, 15, 30, 50];
    var next   = levels.find(function(n) { return n > done; });
    var lh     = el('stat-level-hint');
    if (lh) lh.innerText = next
      ? 'До следующего уровня: ещё ' + (next - done) + ' заказ(ов)'
      : '🏆 Максимальный уровень достигнут!';
  });
}

function sendInvestRequest() {
  var type    = el('invest-type');
  var name    = el('invest-name');
  var contact = el('invest-contact');
  var msg     = el('invest-msg');

  if (!type || !type.value)              { T('Выберите кто вы'); return; }
  if (!name || !name.value.trim())       { T('Введите имя'); return; }
  if (!contact || !contact.value.trim()) { T('Введите контакт'); return; }

  var data = {
    type:    type.value,
    name:    name.value.trim(),
    contact: contact.value.trim(),
    msg:     msg ? msg.value.trim() : '',
    huid:    U.huid || '—',
    date:    new Date().toISOString()
  };

  if (window.firebase && firebase.apps && firebase.apps.length) {
    firebase.database().ref('investors').push(data)
      .then(function() {
        T('✅ Заявка отправлена! Свяжемся с вами.');
        type.value = ''; name.value = ''; contact.value = '';
        if (msg) msg.value = '';
      })
      .catch(function() { T('Ошибка. Напишите на bsmlh.org@gmail.com'); });
  } else {
    T('✅ Заявка получена!');
  }
}
