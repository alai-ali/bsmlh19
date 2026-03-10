// ── ПАТЕНТ ──
var curLv = 1;
function slv(n) {
curLv = n;
[1,2,3].forEach(function(i) {
var btn = el('lv' + i);
if (!btn) return;
if (i === n) {
btn.classList.add('on');
} else {
btn.classList.remove('on');
}
});
}
function tryFixInv() {
var n = el('inv-niche') ? el('inv-niche').value : '';
var t = el('inv-t') ? el('inv-t').value.trim() : '';
var d = el('inv-d') ? el('inv-d').value.trim() : '';
if (!n) { T('Выберите нишу'); return; }
if (!t) { T('Введите название изобретения'); return; }
if (!d) { T('Введите описание'); return; }
if ('NDEFReader' in window && U.hasChip) {
scanChipForPatent(t, n, d);
} else {
fixInvData(t, n, d);
}
}
async function scanChipForPatent(t, n, d) {
var overlay = el('chip-overlay');
var ps = el('chip-overlay-title');
var pb = el('chip-overlay-sub');
if (overlay) overlay.classList.add('on');
if (ps) ps.innerText = 'Поднесите чип к телефону...';
try {
var ndef = new NDEFReader();
await ndef.scan();
var sec = 6;
var iv = setInterval(function() {
sec--;
if (ps) ps.innerText = 'Сканирование... ' + sec + 'с';
if (sec <= 0) {
clearInterval(iv);
if (overlay) overlay.classList.remove('on');
T('Чип не найден. Фиксируем без чипа.');
fixInvData(t, n, d);
}
}, 1000);
ndef.onreading = function() {
clearInterval(iv);
if (ps) ps.innerText = '✅ Чип считан!';
setTimeout(function() {
if (overlay) overlay.classList.remove('on');
fixInvData(t, n, d);
}, 800);
};
} catch(e) {
if (overlay) overlay.classList.remove('on');
fixInvData(t, n, d);
}
}
function fixInvData(t, n, d) {
var id = 'BST-' + Date.now().toString(36).toUpperCase();
var date = new Date().toLocaleString('ru-RU');
var hashVal = 0;
var str = t + '|' + U.huid + '|' + date;
for (var i = 0; i < str.length; i++) {
hashVal = ((hashVal << 5) - hashVal) + str.charCodeAt(i);
hashVal = hashVal & hashVal;
}
var hash = 'BSH-' + Math.abs(hashVal).toString(16).toUpperCase().padStart(8, '0');
var inv = { id:id, t:t, niche:n, desc:d, date:date, hash:hash, lv:curLv, author:U.name, huid:U.huid };
try { localStorage.setItem('bsmlh_patent', JSON.stringify(inv)); } catch(e) {}
el('pat-empty').style.display = 'none';
var view = el('pat-view');
if (view) {
view.style.display = 'block';
view.innerHTML = '<div class="patent-card">'
+ '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">'
+ '<div style="background:var(--green);color:white;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;">L' + curLv + '</div>'
+ '<div class="patent-title" style="margin:0;">' + t + '</div></div>'
+ '<div class="patent-id">' + id + '</div>'
+ '<div class="patent-field"><label>Дата</label><div class="val">' + date + '</div></div>'
+ '<div class="patent-field"><label>SHA</label><div class="val" style="font-family:monospace;font-size:12px;color:var(--green);">' + hash + '</div></div>'
+ '<button class="btn-ghost" style="margin-top:10px;" onclick="var p=JSON.parse(localStorage.getItem(\'bsmlh_patent\'));showCert(p);">📄 Открыть сертификат</button>'
+ '</div>';
}
T('✅ Зафиксировано на уровне L' + curLv + '!');
['inv-t','inv-d'].forEach(function(id){ var e=el(id); if(e) e.value=''; });
var ni = el('inv-niche'); if(ni) ni.value = '';
showCert(inv);
}
function showCert(inv) {
function s(id, v) { var e = document.getElementById(id); if (e) e.innerText = v || '—'; }
s('cert-author', inv.author || U.name);
s('cert-huid', inv.huid || U.huid);
s('cert-title-txt', inv.t || inv.title);
s('cert-desc', inv.desc);
s('cert-niche', inv.niche);
s('cert-level', 'L' + inv.lv + ' — ' + ['Timestamp $0.99','Prior Art $9.99','Certificate $49.99'][(inv.lv||1)-1]);
s('cert-inv-id', inv.id);
s('cert-time', inv.date);
s('cert-hash', inv.hash);
var qi = document.getElementById('cert-qr-img');
if (qi) {
var qd = encodeURIComponent('BSMLH-CERT:' + inv.id + ':' + (inv.huid || U.huid));
qi.src = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + qd + '&color=21A038&bgcolor=ffffff';
}
var cp = document.getElementById('cert-page');
if (cp) cp.style.display = 'block';
}
function closeCert() {
var cp = document.getElementById('cert-page');
if (cp) cp.style.display = 'none';
}
function loadPatent() {
try {
var p = localStorage.getItem('bsmlh_patent');
if (!p) return;
var pat = JSON.parse(p);
el('pat-empty').style.display = 'none';
var view = el('pat-view');
if (view) {
view.style.display = 'block';
view.innerHTML = '<div class="patent-card">'
+ '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">'
+ '<div style="background:var(--green);color:white;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;">' + (pat.level||'L'+pat.lv) + '</div>'
+ '<div class="patent-title" style="margin:0;">' + (pat.t||pat.title) + '</div></div>'
+ '<div class="patent-id">' + pat.id + '</div>'
+ '<div class="patent-field"><label>Дата</label><div class="val">' + pat.date + '</div></div>'
+ '<div class="patent-field"><label>SHA</label><div class="val" style="font-family:monospace;font-size:12px;color:var(--green);">' + pat.hash + '</div></div>'
+ '<button class="btn-ghost" style="margin-top:10px;" onclick="var p=JSON.parse(localStorage.getItem(\'bsmlh_patent\'));showCert(p);">📄 Открыть сертификат</button>'
+ '</div>';
}
} catch(e) {}
}
