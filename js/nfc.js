// ── NFC ──
async function nfcActivate(ctx) {
var btn = el('nbtn' + ctx), beam = el('beam' + ctx), st = el('nst' + ctx);
if (!('NDEFReader' in window)) {
if (st) st.innerText = 'NFC не поддерживается на этом устройстве';
return;
}
if (btn) btn.disabled = true;
if (beam) beam.style.display = 'block';
if (st) st.innerText = 'Сканирование...';
try {
var ndef = new NDEFReader();
await ndef.scan();
var to = setTimeout(function() {
if (beam) beam.style.display = 'none';
if (btn) btn.disabled = false;
if (st) st.innerText = 'Чип не найден. Попробуйте снова.';
}, 6000);
ndef.onreading = function(e) {
clearTimeout(to);
if (beam) beam.style.display = 'none';
var uid = e.serialNumber || '';
U.hasChip = true;
U.chipUID = uid;
try { localStorage.setItem('bsmlh_chip_uid', uid); } catch(err) {}
if (st) st.innerText = '✅ UID: ' + uid;
if (btn) btn.disabled = false;
refreshChipUI();
T('🛡️ Чип активирован! UID: ' + uid);
if (ctx === 1) setTimeout(showSMS, 800);
};
} catch(e) {
if (beam) beam.style.display = 'none';
if (btn) btn.disabled = false;
if (st) st.innerText = 'Разрешите доступ к NFC в браузере';
}
}
function copyUID() {
var u = el('chip-uid-val');
if (u && navigator.clipboard) navigator.clipboard.writeText(u.innerText).then(function(){ T('UID скопирован'); });
else T('UID скопирован');
}
 
