// Credentials from Windows&DoorsNI
const SUPABASE_URL = 'https://skubqeoftgwbjinkevqv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrdWJxZW9mdGd3YmppbmtldnF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4ODMwMzksImV4cCI6MjA5MDQ1OTAzOX0.n-oueqH7sJI8_BTDrMvS1ryCi5uJHFRa_MUPVuITWBU';

let sbClient = null;
let jobs = [];
let stock = [];
let map = null;
let routeStops = [];

const THEME_STORAGE_KEY = 'windowsdoorsni-theme';

window.addEventListener('DOMContentLoaded', async () => {
  applySavedTheme();
  syncMobileMenuState();
  sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  initApp();
});

async function initApp() {
  await loadData();
  renderDashboard();
  renderJobs();
  renderStock();
  startAutoRefresh();
}

async function loadData() {
  const { data: jobData } = await sbClient.from('jobs').select('*');
  const { data: stockData } = await sbClient.from('stock').select('*');
  jobs = jobData || [];
  stock = stockData || [];
}

function startAutoRefresh() {
  setInterval(async () => {
    await loadData();
    renderDashboard();
    renderJobs();
    renderStock();
  }, 15000);
}

// Tab Navigation
function showPage(pageId, btn) {
  document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  if (btn) btn.classList.add('active');
  closeMobileMenu();
  if (pageId === 'routes') initMap();
}

// Leaflet Mapping
function initMap() {
  if (!map) {
    map = L.map('map-container').setView([54.597, -5.93], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  }
}

// ── DASHBOARD ──
function renderDashboard() {
  const revenue  = jobs.filter(j => j.status === 'Paid').reduce((s, j) => s + (j.price || 0), 0);
  const pending  = jobs.filter(j => j.status === 'Pending').length;
  const complete = jobs.filter(j => j.status === 'Complete' || j.status === 'Paid').length;
  const lowStock = stock.filter(s => s.qty <= s.min).length;

  document.getElementById('kpi-row').innerHTML = `
    <div class="kpi">
      <div class="kpi-label">Revenue</div>
      <div class="kpi-value">£${revenue.toFixed(0)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Pending Jobs</div>
      <div class="kpi-value" style="color:var(--cyan)">${pending}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Completed</div>
      <div class="kpi-value" style="color:var(--green)">${complete}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Inventory Alerts</div>
      <div class="kpi-value" style="color:${lowStock > 0 ? 'var(--red)' : 'var(--green)'}">${lowStock}</div>
    </div>
  `;
}

async function quickAddJob(e) {
  e.preventDefault();
  const job = {
    customer: document.getElementById('q-customer').value.trim(),
    address:  document.getElementById('q-address').value.trim(),
    price:    parseFloat(document.getElementById('q-price').value) || 0,
    status:   document.getElementById('q-status').value,
  };
  const { error } = await sbClient.from('jobs').insert([job]);
  if (!error) {
    e.target.reset();
    await loadData();
    renderDashboard();
    renderJobs();
  } else {
    alert('Error: ' + error.message);
  }
}

// ── JOBS ──
async function addJob(e) {
  e.preventDefault();
  const job = {
    customer: document.getElementById('job-customer').value.trim(),
    address:  document.getElementById('job-address').value.trim(),
    type:     document.getElementById('job-type').value,
    price:    parseFloat(document.getElementById('job-price').value) || 0,
    status:   document.getElementById('job-status').value,
    date:     document.getElementById('job-date').value || null,
  };
  const { error } = await sbClient.from('jobs').insert([job]);
  if (!error) {
    e.target.reset();
    await loadData();
    renderJobs();
    renderDashboard();
  } else {
    alert('Error: ' + error.message);
  }
}

function renderJobs() {
  const wrap = document.getElementById('jobs-table-wrap');
  if (!jobs.length) {
    wrap.innerHTML = '<p class="empty-state">No jobs yet. Add your first job above.</p>';
    return;
  }
  wrap.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Customer</th><th>Address</th><th>Type</th><th>Price</th><th>Status</th><th>Date</th><th></th>
        </tr></thead>
        <tbody>
          ${jobs.map(j => `
            <tr>
              <td>${esc(j.customer)}</td>
              <td>${esc(j.address)}</td>
              <td>${esc(j.type)}</td>
              <td>£${(j.price || 0).toFixed(2)}</td>
              <td><span class="badge badge-${(j.status || '').toLowerCase()}">${esc(j.status)}</span></td>
              <td>${esc(j.date)}</td>
              <td><button class="row-delete" onclick="deleteJob('${j.id}')" title="Delete">✕</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function deleteJob(id) {
  if (!confirm('Delete this job?')) return;
  const { error } = await sbClient.from('jobs').delete().eq('id', id);
  if (!error) {
    await loadData();
    renderJobs();
    renderDashboard();
  } else {
    alert('Error: ' + error.message);
  }
}

// ── STOCK ──
async function addStockItem(e) {
  e.preventDefault();
  const item = {
    name:     document.getElementById('stock-name').value.trim(),
    category: document.getElementById('stock-category').value.trim(),
    qty:      parseInt(document.getElementById('stock-qty').value) || 0,
    min:      parseInt(document.getElementById('stock-min').value) || 0,
  };
  const { error } = await sbClient.from('stock').insert([item]);
  if (!error) {
    e.target.reset();
    await loadData();
    renderStock();
    renderDashboard();
  } else {
    alert('Error: ' + error.message);
  }
}

function renderStock() {
  const wrap = document.getElementById('stock-table-wrap');
  if (!stock.length) {
    wrap.innerHTML = '<p class="empty-state">No stock items yet. Add your first item above.</p>';
    return;
  }
  wrap.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Item</th><th>Category</th><th>Qty</th><th>Min Qty</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${stock.map(s => `
            <tr>
              <td>${esc(s.name)}</td>
              <td>${esc(s.category)}</td>
              <td>${s.qty ?? 0}</td>
              <td>${s.min ?? 0}</td>
              <td><span class="badge ${s.qty <= s.min ? 'badge-alert' : 'badge-ok'}">${s.qty <= s.min ? 'Low' : 'OK'}</span></td>
              <td><button class="row-delete" onclick="deleteStockItem('${s.id}')" title="Delete">✕</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function deleteStockItem(id) {
  if (!confirm('Delete this stock item?')) return;
  const { error } = await sbClient.from('stock').delete().eq('id', id);
  if (!error) {
    await loadData();
    renderStock();
    renderDashboard();
  } else {
    alert('Error: ' + error.message);
  }
}

// ── ROUTES ──
let routePolyline = null;
let mapMarkers = [];
let routeRoadData = { totalKm: 0, totalSecs: 0, legKms: [] };

// Loose UK postcode pattern (partial or full, e.g. BT1, BT1 1AA, SW1A 2AA)
const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?(\s*\d[A-Z]{2})?$/i;

async function geocode(query) {
  if (UK_POSTCODE_RE.test(query.trim())) {
    // postcodes.io — free, no key, UK only
    const endpoint = query.trim().includes(' ') || query.trim().length >= 6
      ? `https://api.postcodes.io/postcodes/${encodeURIComponent(query.trim())}`
      : `https://api.postcodes.io/outcodes/${encodeURIComponent(query.trim())}`;
    const res  = await fetch(endpoint);
    const json = await res.json();
    if (json.status === 200 && json.result) {
      const r = json.result;
      return { lat: r.latitude, lng: r.longitude, display: r.postcode || query.toUpperCase() };
    }
  }
  // Fallback: Nominatim for full addresses
  const res  = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=gb&limit=1`
  );
  const data = await res.json();
  if (data.length) {
    return { lat: +data[0].lat, lng: +data[0].lon, display: data[0].display_name };
  }
  return null;
}

async function addRouteStop(e) {
  e.preventDefault();
  const address = document.getElementById('route-address').value.trim();
  const jobRef  = document.getElementById('route-job-ref').value.trim();
  const time    = document.getElementById('route-time').value;

  const result = await geocode(address);
  if (!result) {
    alert('Address not found. Try a full UK postcode (e.g. BT1 1AA) or a more specific address.');
    return;
  }

  const { lat, lng: lon, display: display_name } = result;
  const stopNum = routeStops.length + 1;
  routeStops.push({ lat: +lat, lng: +lon, address, display_name, jobRef, time, num: stopNum });

  const marker = L.marker([+lat, +lon]).addTo(map)
    .bindPopup(`<b>${stopNum}. ${esc(jobRef || address)}</b><br>${display_name}${time ? '<br>⏱ ' + time : ''}`);
  mapMarkers.push(marker);

  map.setView([+lat, +lon], 12);
  await drawRoute();
  renderStopList();
  recalcFuel();
  e.target.reset();
}

async function drawRoute() {
  if (routePolyline) { routePolyline.remove(); routePolyline = null; }
  if (routeStops.length < 2) return;

  const coords = routeStops.map(s => `${s.lng},${s.lat}`).join(';');
  try {
    const res  = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
    );
    const json = await res.json();
    if (json.code === 'Ok' && json.routes.length) {
      const route = json.routes[0];
      routePolyline = L.geoJSON(route.geometry, {
        style: { color: '#00d4e8', weight: 4, opacity: 0.85 }
      }).addTo(map);
      map.fitBounds(routePolyline.getBounds(), { padding: [30, 30] });
      routeRoadData.totalKm   = route.distance / 1000;
      routeRoadData.totalSecs = route.duration;
      routeRoadData.legKms    = route.legs.map(l => l.distance / 1000);
      return;
    }
  } catch (_) {}
  // Fallback: straight-line polyline if OSRM unreachable
  const latlngs = routeStops.map(s => [s.lat, s.lng]);
  routePolyline = L.polyline(latlngs, { color: '#00d4e8', weight: 3, dashArray: '6 6' }).addTo(map);
  map.fitBounds(routePolyline.getBounds(), { padding: [30, 30] });
  routeRoadData.legKms    = routeStops.slice(1).map((s, i) => haversine(routeStops[i], s));
  routeRoadData.totalKm   = routeRoadData.legKms.reduce((a, b) => a + b, 0);
  routeRoadData.totalSecs = (routeRoadData.totalKm / 50) * 3600;
}

function renderStopList() {
  const list = document.getElementById('stop-list');
  const summary = document.getElementById('route-summary');
  if (!routeStops.length) {
    list.innerHTML = '<p class="empty-state">No stops added yet.</p>';
    summary.style.display = 'none';
    return;
  }
  const totalKm   = routeRoadData.totalKm   || 0;
  const totalSecs  = routeRoadData.totalSecs  || 0;
  const driveMins  = Math.round(totalSecs / 60);
  const legKms     = routeRoadData.legKms;

  list.innerHTML = `<ol class="stop-list">
    ${routeStops.map((s, i) => `
      <li class="stop-item">
        <div class="stop-num">${i + 1}</div>
        <div class="stop-info">
          <div class="stop-addr">${esc(s.address)}</div>
          ${s.jobRef ? `<div class="stop-meta">Ref: ${esc(s.jobRef)}</div>` : ''}
          ${s.time    ? `<div class="stop-meta">⏱ ${esc(s.time)}</div>` : ''}
          ${i > 0 && legKms[i - 1] != null
            ? `<div class="stop-meta stop-dist">↑ ${legKms[i - 1].toFixed(1)} km by road</div>`
            : ''}
        </div>
        <button class="stop-remove" onclick="removeStop(${i})" title="Remove">✕</button>
      </li>`).join('')}
  </ol>`;

  summary.style.display = 'flex';
  document.getElementById('rt-distance').textContent = totalKm.toFixed(1) + ' km';
  document.getElementById('rt-time').textContent = driveMins < 60
    ? driveMins + ' min'
    : Math.floor(driveMins / 60) + 'h ' + (driveMins % 60) + 'm';
}

async function removeStop(idx) {
  routeStops.splice(idx, 1);
  // Rebuild markers
  mapMarkers.forEach(m => m.remove());
  mapMarkers = [];
  routeStops.forEach((s, i) => {
    s.num = i + 1;
    const marker = L.marker([s.lat, s.lng]).addTo(map)
      .bindPopup(`<b>${i + 1}. ${esc(s.jobRef || s.address)}</b><br>${s.display_name}${s.time ? '<br>⏱ ' + s.time : ''}`);
    mapMarkers.push(marker);
  });
  await drawRoute();
  renderStopList();
  recalcFuel();
}

function clearRoute() {
  routeStops = [];
  mapMarkers.forEach(m => m.remove());
  mapMarkers = [];
  if (routePolyline) { routePolyline.remove(); routePolyline = null; }
  routeRoadData = { totalKm: 0, totalSecs: 0, legKms: [] };
  renderStopList();
  recalcFuel();
}

// ── FUEL CALCULATOR ──
function recalcFuel() {
  const fuelType   = document.getElementById('fuel-type').value;
  const priceRaw   = parseFloat(document.getElementById('fuel-price').value);
  const mpgRaw     = parseFloat(document.getElementById('fuel-mpg').value);
  const returnTrip = document.getElementById('fuel-return').value === '1';

  // Update labels for electric
  const isElectric = fuelType === 'electric';
  document.getElementById('fuel-price-label').textContent     = isElectric ? 'Price per kWh (£)' : 'Price per Litre (£)';
  document.getElementById('fuel-efficiency-label').textContent = isElectric ? 'Miles per kWh' : 'Vehicle MPG';
  document.getElementById('fuel-used-label').textContent       = isElectric ? 'Energy Used' : 'Fuel Used';

  const totalKm = (routeRoadData.totalKm || 0) * (returnTrip ? 2 : 1);
  const totalMiles = totalKm * 0.621371;

  document.getElementById('fuel-km').textContent = totalKm.toFixed(1) + ' km (' + totalMiles.toFixed(1) + ' mi)';

  if (!routeStops.length || !priceRaw || !mpgRaw) {
    document.getElementById('fuel-litres').textContent = '—';
    document.getElementById('fuel-cost').textContent   = '£—';
    return;
  }

  let used, cost;
  if (isElectric) {
    // miles / miles-per-kWh = kWh
    used = totalMiles / mpgRaw;
    cost = used * priceRaw;
    document.getElementById('fuel-litres').textContent = used.toFixed(2) + ' kWh';
  } else {
    // litres = miles / mpg / 4.54609 (litres per gallon)
    const gallons = totalMiles / mpgRaw;
    used = gallons * 4.54609;
    cost = used * priceRaw;
    document.getElementById('fuel-litres').textContent = used.toFixed(2) + ' L';
  }
  document.getElementById('fuel-cost').textContent = '£' + cost.toFixed(2);
}

// ── DISTANCE HELPERS (straight-line fallback only) ──
function haversine(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

// ── UTILS ──
function esc(str) {
  if (!str) return '—';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  localStorage.setItem(THEME_STORAGE_KEY, isLight ? 'light' : 'dark');
  updateThemeButton(isLight);
}

function applySavedTheme() {
  const isLight = localStorage.getItem(THEME_STORAGE_KEY) === 'light';
  document.body.classList.toggle('light', isLight);
  updateThemeButton(isLight);
}

function updateThemeButton(isLight) {
  const themeButton = document.getElementById('theme-btn');
  themeButton.textContent = isLight ? '🌙' : '☀️';
  themeButton.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
}

function toggleMobileMenu() {
  document.body.classList.toggle('menu-open');
  syncMobileMenuState();
}

function closeMobileMenu() {
  if (window.innerWidth <= 860) {
    document.body.classList.remove('menu-open');
    syncMobileMenuState();
  }
}

function syncMobileMenuState() {
  const menuButton = document.getElementById('menu-btn');
  if (!menuButton) return;
  const expanded = document.body.classList.contains('menu-open');
  menuButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

window.addEventListener('resize', () => {
  if (window.innerWidth > 860) {
    document.body.classList.remove('menu-open');
    syncMobileMenuState();
  }
});