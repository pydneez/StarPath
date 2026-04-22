/* ============================================================
   map.js — StarPath Thailand WebGIS Map Page
   Real data: SunCalc moon · Open-Meteo cloud · LP bortle
   Light Pollution overlay: djlorenz LP Atlas 2022 tiles
   ============================================================ */

/* ── STATE ─────────────────────────────────────────────── */
let currentDate  = new Date();
let selectedId   = null;
let activeFilter = 'all';
let searchQuery  = '';
let leafletMap;
const markerRefs = {}; // siteId → Leaflet marker
let lpLayer      = null;
let lpVisible    = false;

/* ── HELPERS ─────────────────────────────────────────────── */
function todayStr() {
  const d = currentDate;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}
function scoreForSite(site) {
  const moon   = Astro.getMoon(currentDate);
  const cloud  = Astro.getCloudCover(site.id, 0);
  const bData  = Astro.getBortle(site.id);
  const bortle = bData ? bData.bortle : 4;
  return Astro.calcScore(moon.illum, cloud, bortle);
}

/* ── TOPBAR UPDATE ───────────────────────────────────────── */
function updateTopbar() {
  const moon = Astro.getMoon(currentDate);

  document.getElementById('moon-pct').textContent  = moon.pct + '%';
  document.getElementById('moon-name').textContent = moon.name;
  document.getElementById('moon-rise').textContent = '↑ ' + moon.rise;
  document.getElementById('moon-set').textContent  = '↓ ' + moon.set;
  const pathEl = document.getElementById('moon-path');
  if (pathEl) pathEl.setAttribute('d', Astro.moonPath(moon.illum, moon.phase));

  const scores = DARKSKY_SITES.map(s => scoreForSite(s));
  const best   = Math.max(...scores);
  const avgCl  = Math.round(
    DARKSKY_SITES.map(s => Astro.getCloudCover(s.id, 0)).reduce((a,b)=>a+b,0) / DARKSKY_SITES.length
  );

  document.getElementById('tn-moon').textContent  = moon.pct + '%';
  document.getElementById('tn-cloud').textContent = avgCl + '%';
  document.getElementById('tn-best').textContent  = best;

  const pill = document.getElementById('cond-pill');
  const txt  = document.getElementById('cond-text');
  pill.className = 'cond-pill ' + (best >= 70 ? 'good' : best >= 40 ? 'fair' : 'poor');
  txt.textContent = best >= 70 ? 'Good conditions tonight'
                  : best >= 40 ? 'Fair conditions tonight'
                  :              'Poor for stargazing';
}

/* ── LEAFLET MAP ─────────────────────────────────────────── */
function initMap() {
  leafletMap = L.map('the-map', {
    center: [13.0, 101.5], zoom: 6,
    minZoom: 5, maxZoom: 14,
    zoomControl: true,
  });

  // Base tiles — CartoDB Positron (light, readable)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd', maxZoom: 19,
  }).addTo(leafletMap);

  // ── Light Pollution Overlay — NASA GIBS VIIRS Black Marble ──────────────────
  // Source:  NASA VIIRS Black Marble annual composite, 2023
  //          Provided by NASA GIBS (Global Imagery Browse Services)
  //          https://gibs.earthdata.nasa.gov
  //
  // This is the same dataset used for per-site Bortle estimation (pixel sampling).
  // The overlay shows actual measured nighttime radiance — bright areas = more
  // light pollution = higher Bortle class. No API key required.
  //
  // Tile URL convention: NASA GIBS uses {z}/{y}/{x} (WMTS TileRow/TileCol)
  // which matches Leaflet's {z}/{y}/{x} template variables directly.
  //
  // Technical notes:
  //   • maxNativeZoom: 8  — tiles exist at z1–z8; Leaflet scales z9-14 from z8
  //   • Dedicated Leaflet pane (z-index 300) → above base tiles, below markers
  //   • opacity 0.70 — dark enough to read LP levels, light enough to see labels
  //   • mix-blend-mode: multiply (via CSS) blends seamlessly with light basemap
  // ─────────────────────────────────────────────────────────────────────────────

  // 1. Dedicated pane (between base tiles z=200 and markers z=600)
  leafletMap.createPane('lpPane');
  leafletMap.getPane('lpPane').style.zIndex        = 300;
  leafletMap.getPane('lpPane').style.pointerEvents = 'none';

  // 2. NASA GIBS VIIRS Black Marble tile layer
  // ── CONFIRMED WORKING URL FORMAT ──────────────────────────────────────────
  // Uses gibs-{s}.earthdata.nasa.gov with subdomains abc (load-balanced CDN).
  // Note the empty date field (double //) — NASA GIBS serves the latest
  // available composite when date is omitted. Extension is .png not .jpg.
  lpLayer = L.tileLayer(
    'https://gibs-{s}.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default//GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
    {
      pane:          'lpPane',
      subdomains:    'abc',            // load-balanced across gibs-a/b/c
      opacity:        0.75,
      maxNativeZoom:  8,               // tiles native up to z8
      maxZoom:        14,
      minZoom:        1,
      crossOrigin:   'anonymous',
      attribution:   'Imagery provided by services from NASA GIBS.',
      tileSize:       256,
    }
  );

  // Restrict pan to Thailand bounding box
  const bounds = L.latLngBounds([[4.5, 97.5], [21.5, 106.5]]);
  leafletMap.setMaxBounds(bounds);
  leafletMap.on('drag', () => leafletMap.panInsideBounds(bounds, { animate: false }));

  renderMarkers();
}

/* ── LIGHT POLLUTION TOGGLE ──────────────────────────────── */
function toggleLightPollution() {
  const btn = document.getElementById('lp-toggle-btn');

  if (!leafletMap || !lpLayer) {
    console.warn('[StarPath] Map or LP layer not initialised');
    return;
  }

  lpVisible = !lpVisible;

  if (lpVisible) {
    // Always add fresh to avoid any stale tile-cache state
    if (leafletMap.hasLayer(lpLayer)) leafletMap.removeLayer(lpLayer);
    lpLayer.addTo(leafletMap);
    // Ensure markers stay on top after layer add
    Object.values(markerRefs).forEach(m => m && m.bringToFront && m.bringToFront());
    if (btn) { btn.classList.add('active'); btn.title = 'Hide light pollution overlay'; }
  } else {
    if (leafletMap.hasLayer(lpLayer)) leafletMap.removeLayer(lpLayer);
    if (btn) { btn.classList.remove('active'); btn.title = 'Show light pollution overlay'; }
  }
}

/* ── MARKERS ─────────────────────────────────────────────── */
function buildMarker(site) {
  const sc    = scoreForSite(site);
  const cls   = Astro.scoreClass(sc);
  const isSel = site.id === selectedId;
  const html  = `<div class="mm ${cls}${isSel ? ' sel' : ''}" id="mm-${site.id}">${sc}</div>`;
  const icon  = L.divIcon({ html, className: '', iconSize: [40, 46], iconAnchor: [20, 46] });

  const bData  = Astro.getBortle(site.id);
  const bTxt   = bData ? ` · B${bData.bortle}` : '';

  return L.marker([site.lat, site.lng], { icon, zIndexOffset: isSel ? 1000 : 0 })
    .bindTooltip(
      `<strong>${site.name_en}</strong><br>${site.province_en} · ${site.region} · Score ${sc}${bTxt}`,
      { className: 'sp-tip', direction: 'top', offset: [0, -48] }
    )
    .on('click', () => selectSite(site.id));
}

function renderMarkers() {
  Object.values(markerRefs).forEach(m => leafletMap.removeLayer(m));
  DARKSKY_SITES.forEach(site => {
    markerRefs[site.id] = buildMarker(site).addTo(leafletMap);
  });
}

function refreshMarkerScores() {
  DARKSKY_SITES.forEach(site => {
    const sc    = scoreForSite(site);
    const cls   = Astro.scoreClass(sc);
    const bData = Astro.getBortle(site.id);
    const bTxt  = bData ? ` · B${bData.bortle}` : '';

    // Update marker circle (text + colour class)
    const el = document.getElementById('mm-' + site.id);
    if (el) {
      el.className   = `mm ${cls}${selectedId === site.id ? ' sel' : ''}`;
      el.textContent = sc;
    }

    // Sync tooltip — score must always match what is shown in the circle
    const m = markerRefs[site.id];
    if (m) {
      m.setTooltipContent(
        `<strong>${site.name_en}</strong><br>${site.province_en} · ${site.region} · Score ${sc}${bTxt}`
      );
    }
  });
}

// Refresh just one marker (called when its bortle data arrives)
function refreshSingleMarker(siteId) {
  const site = DARKSKY_SITES.find(s => s.id === siteId);
  if (!site) return;
  if (markerRefs[siteId]) leafletMap.removeLayer(markerRefs[siteId]);
  markerRefs[siteId] = buildMarker(site).addTo(leafletMap);
}

/* ── SIDEBAR LIST ────────────────────────────────────────── */
function renderList() {
  const moon = Astro.getMoon(currentDate);
  const q    = searchQuery.trim().toLowerCase();

  const scored = DARKSKY_SITES
    .map(s => ({ ...s, sc: scoreForSite(s) }))
    .filter(s => activeFilter === 'all' || s.type === activeFilter)
    .filter(s => !q ||
      (s.name_en||'').toLowerCase().includes(q) ||
      (s.name_th||'').toLowerCase().includes(q) ||
      s.province_en.toLowerCase().includes(q) ||
      s.region.toLowerCase().includes(q))
    .sort((a, b) => b.sc - a.sc);

  const list = document.getElementById('site-list');
  if (!list) return;

  if (scored.length === 0) {
    list.innerHTML = `<div class="sb-empty">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>No sites match your search</div>`;
    return;
  }

  list.innerHTML = scored.map((s, i) => `
    <div class="srow${selectedId === s.id ? ' active' : ''}"
         onclick="selectSite(${s.id})"
         style="animation-delay:${Math.min(i * 0.025, 0.4)}s">
      <div class="score-badge ${Astro.scoreClass(s.sc)}">${s.sc}</div>
      <div class="sinfo">
        <div class="sname">${s.name_en}</div>
        <div class="smeta">
          <div class="type-dot ${s.type}"></div>
          <div class="sprov">${s.province_en}</div>
        </div>
      </div>
      <div class="sright"><div class="stag">${s.region}</div></div>
    </div>`).join('');
}

/* ── DETAIL PANEL ─────────────────────────────────────────── */
function selectSite(id) {
  selectedId = id;
  const site = DARKSKY_SITES.find(s => s.id === id);
  if (!site) return;

  if (leafletMap) leafletMap.flyTo([site.lat, site.lng], 10, { duration: 1.1 });
  document.querySelectorAll('.mm').forEach(el => el.classList.remove('sel'));
  const mel = document.getElementById('mm-' + id);
  if (mel) mel.classList.add('sel');

  renderPanel(site);
  renderList(); // update active state
}

function renderPanel(site) {
  const moon   = Astro.getMoon(currentDate);
  const cloud  = Astro.getCloudCover(site.id, 0);
  const bData  = Astro.getBortle(site.id);
  const bortle = bData ? bData.bortle : 4;
  const sqm    = bData ? bData.sqm    : null;
  const bSrc   = bData ? bData.source : 'loading';
  const sc     = Astro.calcScore(moon.illum, cloud, bortle);
  const col    = Astro.scoreColor(sc);

  // Get real moon times for this site's coordinates
  const mt     = Astro.getMoonTimesForSite(currentDate, site.lat, site.lng);

  const fc     = Astro.buildForecast(site, currentDate);
  const R = 29, circ = 2 * Math.PI * R, dash = (sc / 100) * circ;

  // Bortle scale bar: bortle 1 → 1 filled segment, bortle 9 → all 9 filled.
  // Segments represent pollution level (more lit = more polluted).
  const bSegs  = Array.from({ length: 9 }, (_, i) =>
    `<div class="b-seg${i < bortle ? ' lit' : ''}"></div>`).join('');

  const mwNow  = Astro.isMWSeason(currentDate);

  // SQM quality label
  const sqmLabel = sqm
    ? (sqm >= 21.5 ? 'Exceptional' : sqm >= 21 ? 'Excellent' : sqm >= 20 ? 'Very good' : 'Good')
    : (bSrc === 'loading' ? 'Fetching…' : 'Estimated');

  // Bortle source badge
  const srcBadge = bSrc === 'nasa_gibs' ? '<span class="src-live">● NASA</span>' :
                   bSrc === 'lp_api'    ? '<span class="src-live">● LIVE</span>'      :
                   bSrc === 'estimate'  ? '<span class="src-est">⚠ Est.</span>'       :
                   bSrc === 'loading'   ? '<span class="src-est">Loading…</span>'     : '';

  const html = `
  <div class="dp-hero">
    <div class="dp-type ${site.type}">${TYPE_LABELS[site.type] || site.type}</div>
    <div class="dp-name">${site.name_en}</div>
    <div class="dp-loc">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
      </svg>
      ${site.province_en} &nbsp;·&nbsp; ${site.region}
    </div>

    <div class="score-row">
      <div class="ring-wrap">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="${R}" fill="none" stroke="var(--surf3)" stroke-width="5"/>
          <circle cx="36" cy="36" r="${R}" fill="none" stroke="${col}" stroke-width="5"
            stroke-dasharray="${dash.toFixed(1)} ${(circ-dash).toFixed(1)}" stroke-linecap="round"/>
        </svg>
        <div class="ring-num" style="color:${col}">${sc}</div>
      </div>
      <div class="bars">
        <div class="bar-row">
          <div class="bar-lbl">Moon</div>
          <div class="bar-track"><div class="bar-fill" style="width:${moon.pct}%;background:${moon.pct<=20?'var(--hi)':moon.pct<=50?'var(--md)':'var(--lo)'}"></div></div>
          <div class="bar-val" style="color:${moon.pct<=20?'var(--hi)':moon.pct<=50?'var(--md)':'var(--lo)'}">${moon.pct}%</div>
        </div>
        <div class="bar-row">
          <div class="bar-lbl">Cloud</div>
          <div class="bar-track"><div class="bar-fill" style="width:${cloud}%;background:${cloud<=20?'var(--hi)':cloud<=60?'var(--md)':'var(--lo)'}"></div></div>
          <div class="bar-val" style="color:${cloud<=20?'var(--hi)':cloud<=60?'var(--md)':'var(--lo)'}">
            ${cloud}%${Astro.isWeatherReady() ? '' : ' <span class="src-est" style="font-size:8px">est.</span>'}
          </div>
        </div>
        <div class="bar-row">
          <div class="bar-lbl">Darkness</div>
          <div class="bar-track"><div class="bar-fill" style="width:${((9-bortle)/8*100).toFixed(0)}%;background:var(--purple-l)"></div></div>
          <div class="bar-val" style="color:var(--purple-l)">B${bortle} ${srcBadge}</div>
        </div>
      </div>
    </div>

    <div class="mw-banner${mwNow ? '' : ' off'}">
      <div class="mw-ico">🌌</div>
      <div>
        <div class="mw-ttl">${mwNow ? 'Milky Way Core Visible Now' : 'Milky Way Core Not Visible'}</div>
        <div class="mw-sub">${mwNow
          ? 'Galactic centre visible Feb–Oct. Peak Apr–Aug, rises south after ~21:00.'
          : 'Core is below horizon Nov–Jan. Deep-sky objects remain excellent.'}</div>
      </div>
    </div>
  </div>

  <div class="dp-body">

    <div class="dp-sec">
      <div class="dp-sec-ttl">
        7-Night Forecast — Observing Score
        ${Astro.isWeatherReady() ? '<span class="data-badge live">Open-Meteo live</span>' : '<span class="data-badge est">Seasonal estimate</span>'}
      </div>
      <div class="fc-strip">
        ${fc.map((n, i) => `
          <div class="fc-night${n.best ? ' best' : ''}">
            <div class="fc-day">${i === 0 ? 'Now' : DAYS[n.date.getDay()]}</div>
            <div class="fc-sc" style="color:${Astro.scoreColor(n.score)}">${n.score}</div>
            <div class="fc-moon">${n.moon.emoji}</div>
            <div class="fc-cloud"><div class="fc-bar" style="width:${n.cloud}%"></div></div>
            ${n.best ? '<div class="fc-best">Best</div>' : '<div class="fc-best" style="visibility:hidden">·</div>'}
          </div>`).join('')}
      </div>
    </div>

    <div class="dp-sec">
      <div class="dp-sec-ttl">Moon Details — ${site.name_en}</div>
      <div class="dg">
        <div class="dg-item">
          <div class="dg-lbl">Moon Phase</div>
          <div class="dg-val">${moon.name}</div>
          <div class="dg-sub">${moon.pct}% illuminated</div>
        </div>
        <div class="dg-item">
          <div class="dg-lbl">Rise / Set (local)</div>
          <div class="dg-val" style="font-size:12px">↑ ${mt.rise} &nbsp; ↓ ${mt.set}</div>
          <div class="dg-sub">at this site's location</div>
        </div>
      </div>
    </div>

    <div class="dp-sec">
      <div class="dp-sec-ttl">
        Light Pollution
        ${bSrc === 'nasa_gibs' ? '<span class="data-badge live">NASA VIIRS Radiance</span>' : bSrc === 'lp_api' ? '<span class="data-badge live">VIIRS live</span>' : bSrc === 'estimate' ? '<span class="data-badge est">Position estimate</span>' : '<span class="data-badge est">Loading…</span>'}
      </div>
      <div class="dg">
        <div class="dg-item">
          <div class="dg-lbl">Bortle Class</div>
          <div class="dg-val">Class ${bortle}</div>
          <div class="dg-sub">${BORTLE_DESC[bortle] || '—'}</div>
        </div>
        <div class="dg-item">
          <div class="dg-lbl">SQM Rating</div>
          <div class="dg-val">${sqm ? sqm + ' mpsas' : '—'}</div>
          <div class="dg-sub">${sqmLabel}</div>
        </div>
        <div class="dg-item full">
          <div class="dg-lbl">Sky Darkness — Bortle Scale (1 = darkest, 9 = brightest)</div>
          <div class="bortle-bar">${bSegs}</div>
        </div>
      </div>
    </div>

    <div class="dp-sec">
      <div class="dp-sec-ttl">Site Details</div>
      <div class="dg">
        <div class="dg-item">
          <div class="dg-lbl">Province</div>
          <div class="dg-val">${site.province_en}</div>
          <div class="dg-sub">${site.region} Region</div>
        </div>
        <div class="dg-item">
          <div class="dg-lbl">Type</div>
          <div class="dg-val">${site.type.replace('_',' ')}</div>
        </div>
        <div class="dg-item">
          <div class="dg-lbl">Latitude</div>
          <div class="dg-val">${site.lat.toFixed(4)}°N</div>
        </div>
        <div class="dg-item">
          <div class="dg-lbl">Longitude</div>
          <div class="dg-val">${site.lng.toFixed(4)}°E</div>
        </div>
      </div>
    </div>

    <div class="dp-sec">
      <div class="dp-sec-ttl">Best Months to Visit</div>
      <div class="month-row">
        ${[11,12,1,2,3,4,5,6,7,8,9,10].map(m =>
          `<span class="mchip ${site.bestMonths && site.bestMonths.includes(m) ? 'best' : 'off'}">${MONTHS[m]}</span>`
        ).join('')}
      </div>
    </div>

    ${site.facilities && site.facilities.length > 0 ? `
    <div class="dp-sec">
      <div class="dp-sec-ttl">Facilities</div>
      <div class="fac-wrap">
        ${site.facilities.map(f => `<span class="fac">${f}</span>`).join('')}
      </div>
      ${site.phone ? `<div style="margin-top:9px;font-family:var(--fm);font-size:10px;color:var(--t2);">📞 ${site.phone}</div>` : ''}
    </div>` : ''}

    <div class="dp-sec">
      <div class="dp-sec-ttl">Data Sources</div>
      <div class="fac-wrap" style="margin-bottom:6px;">
        <span class="fac">🌙 SunCalc.js moon</span>
        <span class="fac">☁️ Open-Meteo cloud</span>
        <span class="fac">💡 LP Atlas Bortle</span>
      </div>
      <div class="fac-wrap">
        <a class="fac-link" href="${site.url}" target="_blank" rel="noopener">View on NARIT ↗</a>
      </div>
    </div>
  </div>`;

  const content = document.getElementById('dp-content');
  const panel   = document.getElementById('detail-panel');
  if (!content || !panel) return;
  content.innerHTML = html;
  panel.classList.add('open');
}

function closePanel() {
  selectedId = null;
  document.getElementById('detail-panel')?.classList.remove('open');
  document.querySelectorAll('.mm').forEach(el => el.classList.remove('sel'));
  renderList();
}

/* ── FILTER & SEARCH ─────────────────────────────────────── */
function setFilter(type, btn) {
  activeFilter = type;
  document.querySelectorAll('.chip').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  applyMarkerFilter(); // show/hide map markers to match
  renderList();
}

function onSearch(val) {
  searchQuery = val;
  applyMarkerFilter(); // keep markers in sync with search text
  renderList();
}

// Show/hide markers based on activeFilter + searchQuery
// Does NOT rebuild markers — just adds/removes from map for performance
function applyMarkerFilter() {
  if (!leafletMap) return;
  const q = searchQuery.trim().toLowerCase();

  DARKSKY_SITES.forEach(site => {
    const m = markerRefs[site.id];
    if (!m) return;

    const matchesType = (activeFilter === 'all' || site.type === activeFilter);
    const matchesSearch = !q ||
      (site.name_en||'').toLowerCase().includes(q) ||
      (site.name_th||'').toLowerCase().includes(q) ||
      site.province_en.toLowerCase().includes(q) ||
      site.region.toLowerCase().includes(q);

    if (matchesType && matchesSearch) {
      if (!leafletMap.hasLayer(m)) m.addTo(leafletMap);
    } else {
      if (leafletMap.hasLayer(m)) leafletMap.removeLayer(m);
    }
  });
}

/* ── LEGEND ─────────────────────────────────────────────── */
let legendOpen = false;
function toggleLegend() {
  legendOpen = !legendOpen;
  document.getElementById('map-legend')?.classList.toggle('open', legendOpen);
}

/* ── FULL REFRESH ────────────────────────────────────────── */
function refresh() {
  updateTopbar();
  refreshMarkerScores();
  renderList();
  if (selectedId) {
    const site = DARKSKY_SITES.find(s => s.id === selectedId);
    if (site) renderPanel(site);
  }
}

/* ── DATA LOADING ────────────────────────────────────────── */
async function loadAllData() {
  // 1. Fetch Open-Meteo cloud cover for all sites
  setDataStatus('cloud', 'loading');
  try {
    await Astro.fetchAllWeather(DARKSKY_SITES);
    setDataStatus('cloud', 'live');
    refresh(); // re-render with real cloud data
  } catch (e) {
    setDataStatus('cloud', 'error');
  }

  // 2. Fetch Bortle for all sites progressively
  setDataStatus('bortle', 'loading');
  await Astro.fetchAllBortle(DARKSKY_SITES, (updatedSiteId) => {
    refreshSingleMarker(updatedSiteId);
    // If this site's panel is open, re-render it
    if (selectedId === updatedSiteId) {
      const site = DARKSKY_SITES.find(s => s.id === updatedSiteId);
      if (site) renderPanel(site);
    }
    renderList(); // keep list sorted by updated scores
    updateTopbar();
  });
  setDataStatus('bortle', 'live');
  refresh(); // final full refresh when all bortle done
}

function setDataStatus(type, status) {
  const el = document.getElementById(`status-${type}`);
  if (!el) return;
  const icons = { loading: '⟳', live: '●', error: '!' };
  const colors = { loading: 'var(--amber)', live: 'var(--hi)', error: 'var(--lo)' };
  el.textContent = icons[status] || '?';
  el.style.color  = colors[status] || 'var(--t3)';
  el.title = {
    loading: `${type} data loading…`,
    live:    `${type} data live`,
    error:   `${type} data unavailable`,
  }[status] || '';
}

/* ── INIT ─────────────────────────────────────────────────── */
window.addEventListener('load', () => {
  const input = document.getElementById('date-input');
  if (input) {
    input.value = todayStr();
    input.addEventListener('change', function () {
      if (!this.value) return;
      currentDate = parseLocalDate(this.value);
      // Clear weather cache on date change (different day = different data)
      try { sessionStorage.removeItem('sp_weather'); } catch (e) {}
      refresh();
    });
  }

  updateTopbar();
  initMap();
  renderList();

  // Kick off async data fetching
  loadAllData();
});
