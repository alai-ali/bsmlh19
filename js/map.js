// MAP - OpenStreetMap + Leaflet
var map = null;
var mapInitialized = false;
var userMarker = null;
var workersLayer = null;
var currentFilter = '';

function initMap() {
  if (map) { map.invalidateSize(); return; }
  if (!document.getElementById('map-container')) return;

  if (!document.getElementById('leaflet-css')) {
    var link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }

  // Загрузить Leaflet JS
  if (!window.L) {
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    s.onload = function() { setTimeout(createMap, 300); };
    document.head.appendChild(s);
  } else {
    setTimeout(createMap, 300);
  }
}
}

function createMap() {
  if (mapInitialized) return;
  mapInitialized = true;

  map = L.map('map-container').setView([43.238, 76.889], 12); // Алматы

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
  }).addTo(map);

  workersLayer = L.layerGroup().addTo(map);

  // Получить геолокацию пользователя
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(pos) {
      var lat = pos.coords.latitude;
      var lng = pos.coords.longitude;
      map.setView([lat, lng], 14);
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.circleMarker([lat, lng], {
        radius: 10, fillColor: '#21A038', color: 'white',
        weight: 3, fillOpacity: 1
      }).addTo(map).bindPopup('📍 Вы здесь');
    });
  }

  loadWorkersOnMap();
}

// Категории с эмодзи
var mapCategories = [
  { id:'', icon:'👥', name:'Все' },
  { id:'clean', icon:'🧹', name:'Уборка' },
  { id:'transport', icon:'🚗', name:'Водитель' },
  { id:'build', icon:'🏗️', name:'Стройка' },
  { id:'cook', icon:'🍳', name:'Повар' },
  { id:'teach', icon:'📚', name:'Репетитор' },
  { id:'med', icon:'🏥', name:'Медицина' },
  { id:'it', icon:'💻', name:'IT' },
  { id:'other', icon:'🔧', name:'Другое' },
];

function renderMapFilters() {
  var f = document.getElementById('map-filters');
  if (!f) return;
  f.innerHTML = mapCategories.map(function(c) {
    return '<button onclick="filterMapWorkers(\''+c.id+'\')" id="mf-'+c.id+'" '
      + 'style="padding:8px 14px;border-radius:99px;border:1.5px solid '+(currentFilter===c.id?'var(--green)':'var(--border)')+';'
      + 'background:'+(currentFilter===c.id?'var(--green)':'white')+';'
      + 'color:'+(currentFilter===c.id?'white':'var(--text)')+';'
      + 'font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:var(--font);">'
      + c.icon + ' ' + c.name + '</button>';
  }).join('');
}

function filterMapWorkers(catId) {
  currentFilter = catId;
  renderMapFilters();
  loadWorkersOnMap();
}

function loadWorkersOnMap() {
  if (!map || !workersLayer) return;
  workersLayer.clearLayers();

  if (!window.firebase || !firebase.apps || !firebase.apps.length) {
    showDemoWorkers();
    return;
  }

  var ref = firebase.database().ref('workers');
  var query = currentFilter ? ref.orderByChild('category').equalTo(currentFilter) : ref;

  query.once('value', function(snap) {
    var workers = snap.val();
    if (!workers) { showDemoWorkers(); return; }
    Object.values(workers).forEach(function(w) {
      if (!w.lat || !w.lng) return;
      addWorkerMarker(w);
    });
  });
}

function showDemoWorkers() {
  // Демо работники вокруг Алматы
  var demos = [
    { name:'Айгерим', category:'clean', icon:'🧹', lat:43.245, lng:76.895, rating:4.8, qrnc:42 },
    { name:'Серик', category:'transport', icon:'🚗', lat:43.232, lng:76.901, rating:4.9, qrnc:87 },
    { name:'Дина', category:'teach', icon:'📚', lat:43.251, lng:76.878, rating:5.0, qrnc:63 },
    { name:'Асем', category:'cook', icon:'🍳', lat:43.228, lng:76.912, rating:4.7, qrnc:31 },
    { name:'Нурлан', category:'build', icon:'🏗️', lat:43.241, lng:76.865, rating:4.6, qrnc:55 },
    { name:'Жанар', category:'med', icon:'🏥', lat:43.255, lng:76.890, rating:4.9, qrnc:78 },
  ];
  demos.filter(function(d){ return !currentFilter || d.category === currentFilter; })
    .forEach(function(w){ addWorkerMarker(w); });
}

function addWorkerMarker(w) {
  var cat = mapCategories.find(function(c){ return c.id === w.category; }) || { icon:'👤' };
  var icon = L.divIcon({
    html: '<div style="width:44px;height:44px;border-radius:50%;background:white;border:3px solid var(--green, #21A038);display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 2px 8px rgba(0,0,0,0.2);">' + (w.icon || cat.icon) + '</div>',
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });

  var marker = L.marker([w.lat, w.lng], { icon: icon }).addTo(workersLayer);
  marker.on('click', function() { showWorkerCard(w); });
}

function showWorkerCard(w) {
  var panel = document.getElementById('worker-card');
  if (!panel) return;
  var cat = mapCategories.find(function(c){ return c.id === w.category; }) || { icon:'👤', name:'Другое' };
  panel.innerHTML =
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">'
    + '<div style="width:56px;height:56px;border-radius:50%;background:var(--green-light);border:2px solid var(--green);display:flex;align-items:center;justify-content:center;font-size:24px;">' + (w.icon||cat.icon) + '</div>'
    + '<div><div style="font-size:17px;font-weight:700;">' + w.name + '</div>'
    + '<div style="font-size:13px;color:var(--green);font-weight:600;">' + cat.name + '</div>'
    + '<div style="font-size:12px;color:var(--text2);">⭐ ' + (w.rating||'—') + ' · 🏅 ' + (w.qrnc||0) + ' QRNC</div></div>'
    + '<button onclick="document.getElementById(\'worker-card\').style.display=\'none\'" style="margin-left:auto;background:none;border:none;font-size:20px;cursor:pointer;color:var(--text2);">✕</button>'
    + '</div>'
    + '<button class="btn" onclick="openWorkerChat(\'' + (w.huid||'') + '\',\'' + w.name + '\')">💬 Написать</button>';
  panel.style.display = 'block';
}

function openWorkerChat(huid, name) {
  document.getElementById('worker-card').style.display = 'none';
  // Открыть чат
  openJobChat('direct_' + Date.now(), huid, name);
}

// Работник отмечает свою геолокацию
function shareMyLocation() {
  if (!navigator.geolocation) { T('Геолокация недоступна'); return; }
  T('Определяем местоположение...');
  navigator.geolocation.getCurrentPosition(function(pos) {
    var lat = pos.coords.latitude;
    var lng = pos.coords.longitude;

    var workerData = {
      name: U.name, huid: U.huid,
      category: U.jobCategory || 'other',
      icon: U.jobIcon || '👤',
      lat: lat, lng: lng,
      rating: 0, qrnc: 0,
      updatedAt: Date.now()
    };

    if (window.firebase && firebase.apps && firebase.apps.length) {
      var key = U.huid.replace(/[^a-zA-Z0-9]/g, '');
      firebase.database().ref('workers/' + key).set(workerData).then(function() {
        T('✅ Вы на карте!');
        loadWorkersOnMap();
      });
    } else {
      T('✅ Местоположение сохранено (демо)');
    }

    if (map) map.setView([lat, lng], 14);
  }, function() { T('Разрешите доступ к геолокации'); });
}

function selectMyCategory(catId) {
  var cat = mapCategories.find(function(c){ return c.id === catId; });
  U.jobCategory = catId;
  U.jobIcon = cat ? cat.icon : '👤';
  document.querySelectorAll('.my-cat-btn').forEach(function(b){ b.style.borderColor='var(--border)'; b.style.background='white'; });
  var btn = document.getElementById('mycat-' + catId);
  if (btn) { btn.style.borderColor='var(--green)'; btn.style.background='var(--green-light)'; }
  T(cat ? cat.icon + ' ' + cat.name + ' выбрано' : '');
}
