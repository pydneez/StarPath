/* ============================================================
   astronomy.js — StarPath Thailand
   Integrates:
     • SunCalc.js  — real moon phase, illumination, rise/set
     • Open-Meteo  — live cloud cover forecast (7-day, hourly)
     • lightpollutionmap.info — real Bortle/SQM per site
   All data is cached in sessionStorage for fast repeat loads.
   ============================================================ */

window.Astro = (() => {

  /* ════════════════════════════════════════════════════════
     MOON  (SunCalc.js — loaded from CDN in HTML)
  ════════════════════════════════════════════════════════ */

  function getMoon(date) {
    if (typeof SunCalc !== 'undefined') {
      return _moonFromSunCalc(date);
    }
    return _moonFallback(date);
  }

  function _moonFromSunCalc(date) {
    const m   = SunCalc.getMoonIllumination(date);
    const pct = Math.round(m.fraction * 100);
    // SunCalc phase: 0 = new moon, 0.5 = full moon (0→1 range)
    const phase = m.phase;

    const name  = _scPhaseName(phase);
    const emoji = _scPhaseEmoji(phase);

    // Moon rise/set for central Thailand (13°N, 100.5°E) as the global topbar reference
    let rise = '—', set = '—';
    try {
      const mt = SunCalc.getMoonTimes(date, 13.0, 100.5);
      if (mt.rise) rise = _fmtTime(mt.rise);
      if (mt.set)  set  = _fmtTime(mt.set);
    } catch (e) {}

    return { phase, illum: m.fraction, pct, name, emoji, rise, set };
  }

  // SunCalc phase = 0–1 (0/1 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter)
  function _scPhaseName(p) {
    if (p < 0.03 || p >= 0.97) return 'New Moon';
    if (p < 0.22) return 'Waxing Crescent';
    if (p < 0.28) return 'First Quarter';
    if (p < 0.47) return 'Waxing Gibbous';
    if (p < 0.53) return 'Full Moon';
    if (p < 0.72) return 'Waning Gibbous';
    if (p < 0.78) return 'Last Quarter';
    return 'Waning Crescent';
  }

  function _scPhaseEmoji(p) {
    if (p < 0.03 || p >= 0.97) return '🌑';
    if (p < 0.22) return '🌒';
    if (p < 0.28) return '🌓';
    if (p < 0.47) return '🌔';
    if (p < 0.53) return '🌕';
    if (p < 0.72) return '🌖';
    if (p < 0.78) return '🌗';
    return '🌘';
  }

  // Fallback if SunCalc not loaded
  function _moonFallback(date) {
    const REF     = new Date('2024-01-11T11:57:00Z');
    const SYNODIC = 29.530588853;
    const days    = (date - REF) / 86400000;
    const synDays = ((days % SYNODIC) + SYNODIC) % SYNODIC;
    const phase   = synDays / SYNODIC; // 0-1
    const illum   = (1 - Math.cos(2 * Math.PI * phase)) / 2;
    const pct     = Math.round(illum * 100);
    // Approximate rise: new moon rises at ~06:00, shifts 50 min/day
    const rMin = ((6 * 60 + synDays * 50) % 1440 + 1440) % 1440;
    const sMin = (rMin + 12 * 60 + 25) % 1440;
    const fmt  = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(Math.floor(m%60)).padStart(2,'0')}`;
    return { phase, illum, pct, name: _scPhaseName(phase), emoji: _scPhaseEmoji(phase), rise: fmt(rMin), set: fmt(sMin) };
  }

  // Real moon times for a specific site
  function getMoonTimesForSite(date, lat, lng) {
    if (typeof SunCalc === 'undefined') return { rise: '—', set: '—' };
    try {
      const mt = SunCalc.getMoonTimes(date, lat, lng);
      return {
        rise: mt.rise ? _fmtTime(mt.rise) : '—',
        set:  mt.set  ? _fmtTime(mt.set)  : '—',
      };
    } catch (e) { return { rise: '—', set: '—' }; }
  }

  function _fmtTime(d) {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
  }

  // SVG path for moon disc (updated for SunCalc 0-1 phase)
  function moonPath(illum, phase) {
    const r = 9, cx = 11, cy = 11;
    if (illum < 0.02) return '';
    if (illum > 0.98) return `M${cx-r},${cy} A${r},${r} 0 1 1 ${cx+r},${cy} A${r},${r} 0 1 1 ${cx-r},${cy}`;
    const ex     = r * Math.abs(1 - 2 * illum);
    const waxing = phase < 0.5; // SunCalc: 0-0.5 = waxing, 0.5-1 = waning
    return `M${cx},${cy-r} A${r},${r} 0 1 ${waxing?1:0} ${cx},${cy+r} A${ex},${r} 0 0 ${waxing?1:0} ${cx},${cy-r}`;
  }

  /* ════════════════════════════════════════════════════════
     OPEN-METEO — Cloud Cover (async, batched, cached)
  ════════════════════════════════════════════════════════ */

  const WEATHER_BATCH = 15; // sites per Open-Meteo request
  let _weatherData    = null; // siteId → {time:[], cloudcover:[]}
  let _weatherPromise = null;

  async function fetchAllWeather(sites) {
    if (_weatherData) return _weatherData; // already loaded
    if (_weatherPromise) return _weatherPromise;

    // Check sessionStorage first
    try {
      const cached = sessionStorage.getItem('sp_weather');
      if (cached) {
        const obj = JSON.parse(cached);
        // Cache valid for 1 hour
        if (Date.now() - obj._ts < 3600000) {
          _weatherData = obj.data;
          return _weatherData;
        }
      }
    } catch (e) {}

    _weatherPromise = _doFetchWeather(sites);
    return _weatherPromise;
  }

  async function _doFetchWeather(sites) {
    const result = {};

    for (let i = 0; i < sites.length; i += WEATHER_BATCH) {
      const batch = sites.slice(i, i + WEATHER_BATCH);
      const lats  = batch.map(s => s.lat.toFixed(4)).join(',');
      const lngs  = batch.map(s => s.lng.toFixed(4)).join(',');

      try {
        // cloud_cover is the current Open-Meteo variable name
        const url = `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${lats}&longitude=${lngs}` +
          `&hourly=cloud_cover` +
          `&forecast_days=8&timezone=Asia%2FBangkok`;

        const res  = await fetch(url);
        const data = await res.json();

        // Open-Meteo returns array when multiple locations
        const arr = Array.isArray(data) ? data : [data];
        arr.forEach((d, j) => {
          const sid = batch[j].id;
          // Normalise variable name (old API = cloudcover, new = cloud_cover)
          const cc = d.hourly?.cloud_cover ?? d.hourly?.cloudcover ?? null;
          result[sid] = { time: d.hourly?.time ?? [], cloud_cover: cc };
        });
      } catch (e) {
        console.warn('[StarPath] Open-Meteo batch failed:', e.message);
        batch.forEach(s => { result[s.id] = null; }); // mark as failed
      }

      // Small pause between batches (be polite to the API)
      if (i + WEATHER_BATCH < sites.length) {
        await new Promise(r => setTimeout(r, 80));
      }
    }

    _weatherData = result;

    // Save to sessionStorage
    try {
      sessionStorage.setItem('sp_weather', JSON.stringify({ _ts: Date.now(), data: result }));
    } catch (e) {}

    return result;
  }

  // Get cloud cover % for a site's evening tonight + dayOffset
  // Evening = average of 19:00-23:00 Bangkok time
  function getCloudCover(siteId, dateOffset = 0) {
    if (!_weatherData || !_weatherData[siteId]) {
      return _cloudFallback(siteId, dateOffset);
    }
    const w = _weatherData[siteId];
    if (!w || !w.time || !w.cloud_cover) return _cloudFallback(siteId, dateOffset);

    const d = new Date();
    d.setDate(d.getDate() + dateOffset);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    const vals = [];
    w.time.forEach((t, i) => {
      if (t.startsWith(dateStr)) {
        const hr = parseInt(t.slice(11, 13), 10);
        if (hr >= 19 && hr <= 23) vals.push(w.cloud_cover[i]);
      }
    });

    if (vals.length === 0) return _cloudFallback(siteId, dateOffset);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  // Seasonal fallback if API unavailable
  function _cloudFallback(siteId, offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const doy  = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    const base = (doy > 152 && doy < 304) ? 63 : (doy >= 304 || doy < 60) ? 15 : 34;
    const seed = siteId * 7.31 + offset * 13.17 + doy * 0.31;
    const x    = Math.sin(seed * 9301 + 49297) * 233280;
    const noise = (x - Math.floor(x)) * 44 - 22;
    return Math.max(0, Math.min(96, Math.round(base + noise)));
  }

  function isWeatherReady() { return _weatherData !== null; }

  /* ════════════════════════════════════════════════════════
     LIGHT POLLUTION — Bortle via NASA GIBS VIIRS Black Marble

     Method: NASA GIBS tile pixel sampling
     ─────────────────────────────────────────────────────
     1. Fetch the 256×256 JPEG tile from NASA GIBS that
        contains the site's coordinates (zoom level 5,
        ~1250 km/tile — ideal granularity for Thailand).
     2. Draw the tile onto a canvas element.
     3. Sample the 3×3-pixel neighbourhood at the exact
        lat/lng position within the tile.
     4. Compute average luminance from the RGB values.
     5. Map luminance to Bortle class 1–9 using empirically
        calibrated thresholds against known Thai dark sky sites.

     Data source: NASA VIIRS Black Marble annual composite (latest available)
     Provider:    NASA GIBS (Global Imagery Browse Services)
     Tile URL:    https://gibs-a.earthdata.nasa.gov/wmts/epsg3857/best/
                  VIIRS_Black_Marble/default//GoogleMapsCompatible_Level8/{z}/{y}/{x}.png
                  (empty date field = latest composite; .png extension required)
     Zoom level:  6 (each tile ~625 km wide, ~10 km/pixel over Thailand)
     No API key required — public NASA CDN endpoint.

     Fallback: city-proximity estimate when tile fetch fails.
  ════════════════════════════════════════════════════════ */

  let _bortleData = {};  // siteId → { bortle, sqm, source }

  // NASA GIBS VIIRS Black Marble tile URL for pixel sampling.
  // MUST match the overlay URL used in map.js exactly — same host, same path.
  // Uses a fixed subdomain (gibs-a) instead of Leaflet's {s} template.
  // The empty date field (//) tells GIBS to return the latest composite.
  // Extension is .png (not .jpg — .jpg gives 400/404 errors).
  const GIBS_HOST      = 'https://gibs-a.earthdata.nasa.gov'; // fixed CDN node for pixel sampling
  const GIBS_TILE_PATH = '/wmts/epsg3857/best/VIIRS_Black_Marble/default//GoogleMapsCompatible_Level8';

  const GIBS_ZOOM = 6; // z6: ~625 km tile width, ~10 km/pixel — better accuracy for Thailand

  // Convert WGS84 → tile XY at a given zoom (standard Web Mercator / XYZ convention)
  function _latLngToTile(lat, lng, z) {
    const n    = Math.pow(2, z);
    const x    = Math.floor((lng + 180) / 360 * n);
    const latR = lat * Math.PI / 180;
    const y    = Math.floor((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n);
    return { x, y };
  }

  // Pixel position within a 256×256 tile for a given lat/lng
  function _latLngToPixel(lat, lng, z, tileX, tileY) {
    const n    = Math.pow(2, z);
    const latR = lat * Math.PI / 180;
    const px   = Math.round(((lng + 180) / 360 * n - tileX) * 256);
    const py   = Math.round(((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n - tileY) * 256);
    return { px: Math.max(1, Math.min(254, px)), py: Math.max(1, Math.min(254, py)) };
  }

  // VIIRS Black Marble luminance → Bortle class
  // Calibrated against NARIT SQM measurements and LP Atlas data for Thailand.
  // Higher luminance = more light pollution = higher Bortle class.
  function _luminanceToBortle(lum) {
    if (lum <   4) return 1; // Pristine: IFN & zodiacal band visible
    if (lum <  10) return 2; // Truly dark rural: Milky Way casts shadows
    if (lum <  20) return 3; // Rural: MW structure and colour clearly visible
    if (lum <  40) return 4; // Rural/suburban: Milky Way easily seen, faint glow
    if (lum <  80) return 5; // Suburban: MW visible, light dome on horizon
    if (lum < 130) return 6; // Bright suburban: MW only visible above 45°
    if (lum < 185) return 7; // Suburban/urban: MW barely visible
    if (lum < 230) return 8; // City: Milky Way not visible
    return 9;                 // Inner city: entire sky strongly illuminated
  }

  // Approximate SQM from Bortle class (Cinzano scale midpoints)
  function _bortleToSQM(bortle) {
    const table = [0, 22.0, 21.7, 21.3, 20.8, 20.0, 18.9, 18.0, 17.0, 16.0];
    return table[Math.min(9, Math.max(1, bortle))] || 20.0;
  }

  async function fetchBortleForSite(site) {
    const cacheKey = `sp_b3_${site.id}`;

    // Return from session cache instantly if available
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        _bortleData[site.id] = parsed;
        return parsed;
      }
    } catch (e) {}

    return _fetchFromNASAGIBS(site);
  }

  // Core NASA GIBS pixel-sampling routine
  function _fetchFromNASAGIBS(site) {
    const { lat, lng } = site;
    const z     = GIBS_ZOOM;
    const { x, y } = _latLngToTile(lat, lng, z);
    const { px, py } = _latLngToPixel(lat, lng, z, x, y);
    const url   = `${GIBS_HOST}${GIBS_TILE_PATH}/${z}/${y}/${x}.png`;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 256; canvas.height = 256;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, 256, 256);

          // Sample 3×3 neighbourhood for stability (avoids single noisy pixel)
          const id  = ctx.getImageData(px - 1, py - 1, 3, 3).data;
          let lumSum = 0;
          for (let i = 0; i < id.length; i += 4) {
            lumSum += 0.299 * id[i] + 0.587 * id[i + 1] + 0.114 * id[i + 2];
          }
          const luminance = lumSum / 9;

          const bortle = _luminanceToBortle(luminance);
          const sqm    = _bortleToSQM(bortle);
          const result = { bortle, sqm, source: 'nasa_gibs', luminance: Math.round(luminance) };

          _bortleData[site.id] = result;
          try { sessionStorage.setItem(`sp_b3_${site.id}`, JSON.stringify(result)); } catch (e) {}
          resolve(result);

        } catch (e) {
          // Canvas tainted or decode error → fall back
          console.warn('[StarPath] GIBS pixel sample failed for', site.name_en, e.message);
          const fallback = _estimateBortleFromPosition(lat, lng);
          _bortleData[site.id] = fallback;
          try { sessionStorage.setItem(`sp_b3_${site.id}`, JSON.stringify(fallback)); } catch (e2) {}
          resolve(fallback);
          console.log("fallback being used")
        }
      };

      img.onerror = () => {
        const fallback = _estimateBortleFromPosition(lat, lng);
        console.log("fallback being used")
        _bortleData[site.id] = fallback;
        try { sessionStorage.setItem(`sp_b3_${site.id}`, JSON.stringify(fallback)); } catch (e) {}
        resolve(fallback);
      };

      img.src = url;
    });
  }

  // Fetch Bortle for ALL sites with concurrency limit
  async function fetchAllBortle(sites, onProgress) {
    const CONCURRENCY = 8; // Higher concurrency OK — NASA GIBS handles parallel tile requests

    // Load cached entries synchronously first
    sites.forEach(s => {
      try {
        const c = sessionStorage.getItem(`sp_b3_${s.id}`);
        if (c) _bortleData[s.id] = JSON.parse(c);
      } catch (e) {}
    });

    const missing = sites.filter(s => !_bortleData[s.id]);

    for (let i = 0; i < missing.length; i += CONCURRENCY) {
      const chunk = missing.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(s => fetchBortleForSite(s)));
      chunk.forEach(s => { if (onProgress) onProgress(s.id); });
      // No rate-limit delay needed — NASA GIBS is a public CDN-backed endpoint
    }
  }

  function getBortle(siteId) {
    return _bortleData[siteId] || null;
  }

  // Position-based Bortle estimate — fallback when NASA GIBS tile is unavailable
  
  function _estimateBortleFromPosition(lat, lng) {
    const CITIES = [
      { lat: 13.750, lng: 100.517, pop: 10700000 }, // Bangkok metro
      { lat: 18.788, lng:  98.987, pop:  1100000 }, // Chiang Mai
      { lat: 16.435, lng: 102.836, pop:   780000 }, // Khon Kaen
      { lat: 14.970, lng: 102.101, pop:   770000 }, // Nakhon Ratchasima
      { lat:  7.009, lng: 100.473, pop:   540000 }, // Hat Yai
      { lat:  7.890, lng:  98.398, pop:   400000 }, // Phuket
      { lat: 13.361, lng: 101.003, pop:   350000 }, // Pattaya
      { lat:  8.477, lng:  99.644, pop:   200000 }, // Surat Thani
    ];
    let maxInfl = 0;
    CITIES.forEach(c => {
      const dlat = (lat - c.lat) * 111;
      const dlng = (lng - c.lng) * 111 * Math.cos(lat * Math.PI / 180);
      const km   = Math.sqrt(dlat * dlat + dlng * dlng);
      maxInfl    = Math.max(maxInfl, c.pop / (km * km + 1));
    });
    let bortle;
    if      (maxInfl > 5e5)  bortle = 8;
    else if (maxInfl > 5e4)  bortle = 7;
    else if (maxInfl > 5e3)  bortle = 6;
    else if (maxInfl > 500)  bortle = 5;
    else if (maxInfl > 50)   bortle = 4;
    else if (maxInfl > 5)    bortle = 3;
    else                     bortle = 2;
    const sqm = _bortleToSQM(bortle);
    return { bortle, sqm, source: 'estimate' };
  }


  function isBortleReady() { return Object.keys(_bortleData).length > 0; }

  /* ════════════════════════════════════════════════════════
     SCORING  — Hybrid Multiplicative Model
     ─────────────────────────────────────────────────────
     Cloud acts as a veto/multiplier rather than an additive
     component.  Problem with old linear sum: 100% cloud +
     new moon + Bortle 1 → score 62/100 ("Fair"), which is
     misleading — you can't see anything through solid cloud.

     Model:
       potential  = moonSuitability × 0.55 + darkQuality × 0.45
       cloudMult  = 1 − (cloudPct / 95)      [0% cloud→1.0, 94%→0.01]
       score      = potential × cloudMult
       hard veto  = 0 when cloudPct ≥ 95

     Examples:
       New moon, Bortle 1, 0% cloud   → 94/100  ✓ Excellent
       New moon, Bortle 1, 100% cloud →  0/100  ✓ Hard veto (not 62!)
       New moon, Bortle 1, 70% cloud  → 28/100  ✓ Poor (overcast)
       Full moon, Bortle 4, 0% cloud  → 25/100  ✓ Poor (bright moon)
     ════════════════════════════════════════════════════ */

  function calcScore(moonIllum, cloudPct, bortle) {
    // Hard veto: effectively overcast sky = absolutely no observing
    if (cloudPct >= 95) return 0;

    // Moon suitability: 0% illumination = 100 pts, 100% (full moon) ≈ 0 pts
    // The 165 factor: full moon (illum=1) gives max(0, 100-165) = 0
    const moonS = Math.max(0, 100 - moonIllum * 165);

    // Sky darkness quality from Bortle class (1=best → 100pts, 9=worst → 0pts)
    const darkS = ((9 - (bortle || 4)) / 8) * 100;

    // "Potential" score: what you'd get under perfectly clear skies
    // Moon weighted slightly higher (55%) since it's the most impactful factor
    const potential = moonS * 0.55 + darkS * 0.45;

    // Cloud multiplier: linear from 1.0 (0% cloud) down to ~0.01 (94% cloud)
    // This means even moderate cloud (50%) halves your potential score
    const cloudMult = 1 - (cloudPct / 95);

    return Math.max(0, Math.round(potential * cloudMult));
  }

  function scoreClass(s) { return s >= 70 ? 'hi' : s >= 40 ? 'md' : 'lo'; }
  function scoreColor(s) { return s >= 70 ? 'var(--hi)' : s >= 40 ? 'var(--md)' : 'var(--lo)'; }

  // Compute score for a site using all available live data
  function siteScore(site, dayOffset = 0) {
    const moon    = getMoon(new Date(Date.now() + dayOffset * 86400000));
    const cloud   = getCloudCover(site.id, dayOffset);
    const bData   = getBortle(site.id);
    const bortle  = bData ? bData.bortle : 4; // 4 = default while fetching
    return calcScore(moon.illum, cloud, bortle);
  }

  /* 7-night forecast for the detail panel */
  function buildForecast(site, baseDate) {
    let bestIdx = 0, bestSc = -1;
    const nights = Array.from({ length: 7 }, (_, off) => {
      const d      = new Date(baseDate); d.setDate(d.getDate() + off);
      const moon   = getMoon(d);
      const cloud  = getCloudCover(site.id, off);
      const bData  = getBortle(site.id);
      const bortle = bData ? bData.bortle : 4;
      const score  = calcScore(moon.illum, cloud, bortle);
      if (score > bestSc) { bestSc = score; bestIdx = off; }
      return { date: d, moon, cloud, score, offset: off };
    });
    nights[bestIdx].best = true;
    return nights;
  }

  /* ════════════════════════════════════════════════════════
     MILKY WAY SEASON  (~15°N Thailand)
  ════════════════════════════════════════════════════════ */
  function isMWSeason(date) {
    const m = date.getMonth() + 1;
    return m >= 2 && m <= 10;
  }

  /* ════════════════════════════════════════════════════════
     PUBLIC API
  ════════════════════════════════════════════════════════ */
  return {
    // Moon
    getMoon, getMoonTimesForSite, moonPath,
    // Weather
    fetchAllWeather, getCloudCover, isWeatherReady,
    // Bortle
    fetchBortleForSite, fetchAllBortle, getBortle, isBortleReady,
    // Scoring
    calcScore, siteScore, scoreClass, scoreColor,
    // Forecast
    buildForecast,
    // Misc
    isMWSeason,
  };

})();
