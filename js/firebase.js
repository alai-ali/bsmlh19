function sendSMS() {
  var inp = el('sms-phone');
  var phone = inp ? inp.value.trim() : '';
  if (!phone) { T('Введите номер телефона'); return; }
  if (!phone.startsWith('+')) phone = '+7' + phone.replace(/[^0-9]/g, '');
  if (!window.firebase) { T('Подождите, загрузка...'); return; }
  T('Отправляем код...');
  if (window.recaptchaVerifier) {
    try { window.recaptchaVerifier.clear(); } catch(e) {}
    window.recaptchaVerifier = null;
  }
  var old = document.getElementById('rc-tmp');
  if (old) old.remove();
  var rc = document.createElement('div');
  rc.id = 'rc-tmp';
  rc.style.cssText = 'position:fixed;bottom:-200px;opacity:0;pointer-events:none;';
  document.body.appendChild(rc);
  window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('rc-tmp', {
    size: 'invisible', callback: function() {}
  });
  firebase.auth().signInWithPhoneNumber(phone, window.recaptchaVerifier)
    .then(function(cr) {
      window.confirmationResult = cr;
      el('ss1').style.display = 'none';
      el('ss2').style.display = 'block';
      var hint = el('sms-hint');
      if (hint) hint.innerText = 'Код отправлен на ' + phone;
      T('Код отправлен');
    })
    .catch(function(err) {
      T('Ошибка: ' + err.message);
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch(e) {}
        window.recaptchaVerifier = null;
      }
    });
}

function verifySMS() {
  var code = el('sms-code');
  if (!code || !code.value.trim()) { T('Введите код'); return; }
  if (!window.confirmationResult) { T('Сначала отправьте код'); return; }
  window.confirmationResult.confirm(code.value.trim())
    .then(function(result) {
      U.phone = result.user.phoneNumber;
      U.uid = result.user.uid;
      try {
        localStorage.setItem('bsmlh_phone', U.phone);
        localStorage.setItem('bsmlh_uid', U.uid);
      } catch(e) {}
      T('Номер подтверждён ✅');
      var agreed = localStorage.getItem('bsmlh_terms_agreed');
      if (agreed) {
        toApp();
      } else {
        showScr('s5');
      }
    })
    .catch(function() { T('Неверный код'); });
}

function loadFirebase() {
  if (window._firebaseLoading) return;
  window._firebaseLoading = true;
  var scripts = [
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-check-compat.js'
  ];
  function loadNext(index) {
    if (index >= scripts.length) {
      initFirebase();
      return;
    }
    var s = document.createElement('script');
    s.src = scripts[index];
    s.onload = function() { loadNext(index + 1); };
    s.onerror = function() {
      T('Ошибка соединения. Проверьте интернет.');
      window._firebaseLoading = false;
    };
    document.head.appendChild(s);
  }
  loadNext(0);
}

function initFirebase() {
  if (firebase.apps.length) return;
  firebase.initializeApp({
    apiKey: 'AIzaSyBlD8lNdYdubHXr13IhPkmkCnNQQLChtVA',
    authDomain: 'bsmlh-chat.firebaseapp.com',
    databaseURL: 'https://bsmlh-chat-default-rtdb.firebaseio.com',
    projectId: 'bsmlh-chat',
    storageBucket: 'bsmlh-chat.firebasestorage.app',
    messagingSenderId: '41774666354',
    appId: '1:41774666354:web:e200d57a0bab89e26be8eb'
  });
  firebase.appCheck().activate(
    '6LdAw6AsAAAAAPpIARwm1C0pl3-hToekBX2NxLFv',
    true
  );
  console.log('Firebase готов');
  setTimeout(initJobsDB, 300);
}
