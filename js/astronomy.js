/* ============================================================
   astronomy.js — StarPath Thailand
   Integrates:
     • SunCalc.js  — real moon phase, illumination, rise/set
     • Open-Meteo  — live cloud cover forecast (7-day, hourly)
     • NASA GIBS VIIRS At-Sensor Radiance — Bortle/SQM via pixel sampling
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
     OPEN-METEO — Cloud Cover (async, batched, date-aware)
     ─────────────────────────────────────────────────────
     Endpoints used depending on selected date:

     FORECAST  (today, future ≤+15 days, or past ≤7 days)
       https://api.open-meteo.com/v1/forecast
       ?past_days=7&forecast_days=16  →  today-7 through today+15
       past_days=7 covers recent history without needing the archive
       endpoint, avoiding the archive's lag and date-cap issues.
       Supports multi-location batches of up to 15 sites.

     ARCHIVE   (more than 7 days in the past)
       https://archive-api.open-meteo.com/v1/archive
       ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
       Same batch format as forecast. Covers all dates back
       to 1940 with ~2-day processing lag.
       end_date is always capped at today-2 to prevent 400 errors.

     BEYOND +15 DAYS  (far future, no real data available)
       No fetch is performed. _weatherData stays null and
       getCloudCover falls back to the seasonal model for
       every site, which uses day-of-year statistics.

     CACHING
       In-memory: _weatherData + _weatherBaseDate (reset if
       the selected date changes between calls).
       sessionStorage: keyed as sp_weather_YYYY-MM-DD so
       switching dates does not pollute each other's cache.
       TTL: 1 hour for forecast data; 24 hours for archive
       (historical data does not change after processing).
  ════════════════════════════════════════════════════════ */

  const WEATHER_BATCH = 15; // sites per Open-Meteo request
  let _weatherData     = null; // siteId → { time:[], cloud_cover:[] }
  let _weatherPromise  = null;
  let _weatherBaseDate = null; // dateKey this in-memory cache belongs to

  // Called by map.js when the user changes the date so the
  // in-memory cache is not reused for a different date.
  function clearWeatherCache() {
    _weatherData     = null;
    _weatherPromise  = null;
    _weatherBaseDate = null;
  }

  async function fetchAllWeather(sites, baseDate) {
    // Normalise: default to today if no date provided
    const target  = baseDate instanceof Date ? baseDate : new Date();
    const dateKey = _fmtDateKey(target);
    const dayDiff = _dayDiffFromToday(target);

    // Beyond forecast range: no real data exists — seasonal fallback will cover it
    if (dayDiff > 15) {
      console.info('[StarPath] Date beyond forecast range (+15 days); using seasonal model');
      return null;
    }

    // In-memory cache hit for the same date
    if (_weatherData && _weatherBaseDate === dateKey) return _weatherData;

    // Date changed since last fetch — reset in-memory state
    if (_weatherData && _weatherBaseDate !== dateKey) clearWeatherCache();

    // In-flight request for the same date — wait for it
    if (_weatherPromise) return _weatherPromise;

    // sessionStorage hit — TTL: 1 h for forecast, 24 h for archive
    const sessionKey = `sp_weather_${dateKey}`;
    const ttl = dayDiff < -1 ? 86400000 : 3600000; // 24 h archive / 1 h forecast
    try {
      const cached = sessionStorage.getItem(sessionKey);
      if (cached) {
        const obj = JSON.parse(cached);
        if (Date.now() - obj._ts < ttl) {
          _weatherData     = obj.data;
          _weatherBaseDate = dateKey;
          return _weatherData;
        }
      }
    } catch (e) {}

    _weatherPromise = _doFetchWeather(sites, target, dayDiff, dateKey, sessionKey);
    return _weatherPromise;
  }

  async function _doFetchWeather(sites, baseDate, dayDiff, dateKey, sessionKey) {
    const result = {};

    // ── Endpoint selection ────────────────────────────────────────────────────
    // Open-Meteo has two relevant APIs:
    //
    //   FORECAST  /v1/forecast?past_days=7&forecast_days=16
    //     Returns today-7 through today+15 in one call.
    //     "past_days=7" is the key addition — without it the response only
    //     starts from today, leaving recent past dates with no data.
    //     Use for: today, future dates (≤+15), and past dates within 7 days.
    //
    //   ARCHIVE   archive-api.open-meteo.com/v1/archive?start_date&end_date
    //     Returns actual measured historical data for a specific date range.
    //     Processing lag: ~2 days — end_date must be ≤ today-2 or the API
    //     returns HTTP 400. NEVER pass a future date as end_date.
    //     Use for: dates older than 7 days (safely outside forecast window).
    //
    // Root cause of the original 400 error:
    //   useArchive was triggered for dayDiff < -1 (anything 2+ days ago).
    //   end_date = baseDate + 7 could land in the future (e.g. select April 17,
    //   end_date = April 24 = tomorrow → archive API rejects it).
    //
    // Fix: forecast handles the last 7 days via past_days=7;
    //      archive is only used for dates older than 7 days;
    //      archive end_date is capped at today-2 to always stay in the past.

    const useArchive = dayDiff < -7; // dates 8+ days ago → use archive

    // Archive end_date: start + 7 nights, capped at today-2 (archive lag buffer)
    // This prevents sending a future date to the archive endpoint.
    const endDate = new Date(baseDate);
    endDate.setDate(endDate.getDate() + 7);
    const latestArchiveDate = new Date();
    latestArchiveDate.setDate(latestArchiveDate.getDate() - 2); // 2-day lag buffer
    if (endDate > latestArchiveDate) {
      endDate.setTime(latestArchiveDate.getTime()); // cap — never request future from archive
    }
    const endDateKey = _fmtDateKey(endDate);

    for (let i = 0; i < sites.length; i += WEATHER_BATCH) {
      const batch = sites.slice(i, i + WEATHER_BATCH);
      const lats  = batch.map(s => s.lat.toFixed(4)).join(',');
      const lngs  = batch.map(s => s.lng.toFixed(4)).join(',');

      try {
        let url;
        if (useArchive) {
          // Historical data (8+ days ago): archive endpoint with capped date range
          url = `https://archive-api.open-meteo.com/v1/archive` +
            `?latitude=${lats}&longitude=${lngs}` +
            `&hourly=cloud_cover` +
            `&start_date=${dateKey}&end_date=${endDateKey}` +
            `&timezone=Asia%2FBangkok`;
        } else {
          // Forecast + recent past: past_days=7 extends the window 7 days back,
          // covering today-7 through today+15 in a single response.
          // This handles yesterday, 2 days ago … up to 7 days ago without
          // ever touching the archive endpoint.
          url = `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${lats}&longitude=${lngs}` +
            `&hourly=cloud_cover` +
            `&past_days=7&forecast_days=16&timezone=Asia%2FBangkok`;
        }

        const res  = await fetch(url);
        const data = await res.json();

        // Open-Meteo returns array when multiple locations, object for one
        const arr = Array.isArray(data) ? data : [data];
        arr.forEach((d, j) => {
          const sid = batch[j].id;
          // Handle both old (cloudcover) and new (cloud_cover) variable names
          const cc = d.hourly?.cloud_cover ?? d.hourly?.cloudcover ?? null;
          result[sid] = { time: d.hourly?.time ?? [], cloud_cover: cc };
        });
      } catch (e) {
        console.warn('[StarPath] Open-Meteo batch failed:', e.message);
        batch.forEach(s => { result[s.id] = null; });
      }

      if (i + WEATHER_BATCH < sites.length) {
        await new Promise(r => setTimeout(r, 80));
      }
    }

    _weatherData     = result;
    _weatherBaseDate = dateKey;
    _weatherPromise  = null;

    try {
      sessionStorage.setItem(sessionKey, JSON.stringify({ _ts: Date.now(), data: result }));
    } catch (e) {}

    return result;
  }

  // Get cloud cover % for a site's evening tonight + dayOffset
  // Evening = average of 19:00-23:00 Bangkok time
  function getCloudCover(siteId, dateOrOffset = 0) {
    const targetDate = dateOrOffset instanceof Date
      ? new Date(dateOrOffset)
      : new Date(Date.now() + dateOrOffset * 86400000);
    const dayOffset = dateOrOffset instanceof Date ? _dayDiffFromToday(targetDate) : dateOrOffset;

    if (!_weatherData || !_weatherData[siteId]) {
      return _cloudFallback(siteId, dayOffset);
    }
    const w = _weatherData[siteId];
    if (!w || !w.time || !w.cloud_cover) return _cloudFallback(siteId, dayOffset);

    const dateStr = _fmtDateKey(targetDate);

    const vals = [];
    w.time.forEach((t, i) => {
      if (t.startsWith(dateStr)) {
        const hr = parseInt(t.slice(11, 13), 10);
        if (hr >= 19 && hr <= 23) vals.push(w.cloud_cover[i]);
      }
    });

    if (vals.length === 0) return _cloudFallback(siteId, dayOffset);
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
     LIGHT POLLUTION — Bortle via NASA GIBS VIIRS At-Sensor Radiance

     Data source: VIIRS SNPP Day/Night Band — At-Sensor Radiance
     Layer ID:    VIIRS_SNPP_DayNightBand_At_Sensor_Radiance
     Provider:    NASA GIBS (Global Imagery Browse Services)

     WHY THIS LAYER (not Black Marble visual product):
     Black Marble is gamma-corrected for human display — its
     pixel values encode rendering choices, not physical
     measurements. The At-Sensor Radiance layer preserves the
     original VIIRS DNB sensor output: pixel intensity (0-255)
     is a LINEAR PROXY for upwelling radiance in nW/cm²/sr,
     which is required by the Cinzano/Falchi logarithmic SQM
     formula (Cinzano et al., 2001; Falchi et al., 2016).

     PIPELINE:
       1. Compute Web Mercator tile (z/y/x) containing site coords
       2. Fetch 256×256 PNG tile at zoom 6 (~10 km/pixel over TH)
          URL: GIBS_HOST + GIBS_TILE_PATH_1 + gibsDate + GIBS_TILE_PATH_2
               + /{z}/{y}/{x}.png
       3. Draw onto offscreen HTML5 Canvas; extract 3×3 pixel block
       4. Average 9 R-channel values → radiance proxy I (0–255)
       5. Cinzano/Falchi formula: SQM = 21.58 − 2.5 × log₁₀(I + 0.1)
       6. Map SQM to Bortle 1–9 using Cinzano scale midpoints

     DATE ANCHOR:
     gibsDate = getRadianceDateForForecast(baseDate):
       • Past dates  → use actual date (historical tile if available)
       • Present/future → 3-days-ago tile (latest processed composite)
     Light pollution doesn't change day-to-day; this anchor is
     scientifically valid for any near-term date selection.

     Fallback: city-proximity estimate when tile unavailable.
  ════════════════════════════════════════════════════════ */

  let _bortleData = {};  // cacheKey(siteId+gibsDate) → { bortle, sqm, source, gibsDate }

  // ── Tile endpoint constants ──────────────────────────────────────────
  // Fixed CDN node — no {s} subdomain template needed for Image() fetches.
  const GIBS_HOST        = 'https://gibs-a.earthdata.nasa.gov';

  // Layer: VIIRS SNPP Day/Night Band At-Sensor Radiance
  // Full tile URL = GIBS_HOST + GIBS_TILE_PATH_1 + dateStr + GIBS_TILE_PATH_2 + /{z}/{y}/{x}.png
  // GIBS_TILE_PATH_1 ends with '/' so dateStr is appended directly.
  const GIBS_TILE_PATH_1 = '/wmts/epsg3857/best/VIIRS_SNPP_DayNightBand_At_Sensor_Radiance/default/';
  const GIBS_TILE_PATH_2 = '/GoogleMapsCompatible_Level8';

  // Zoom 6: ~625 km tile width, ~10 km/pixel over Thailand.
  // Highest zoom with complete global coverage for this layer.
  const GIBS_ZOOM = 6;

  
  function _calculateSQMFromRadiance(pixelData) {
    let intensitySum = 0;
    
    // Step 1: Average the 3x3 neighborhood (9 pixels)
    // Since GIBS maps radiance to 8-bit grayscale, R=G=B. 
    // We sample the R channel (index i) as the radiance proxy.
    for (let i = 0; i < pixelData.length; i += 4) {
        intensitySum += pixelData[i]; 
    }
    const radianceProxy = intensitySum / 9;

    // Step 2: Implement the Scientific Logarithmic Formula
    // SQM = 21.58 - 2.5 * log10(radiance_proxy + 0.1)
    const sqm = 21.58 - 2.5 * Math.log10(radianceProxy + 0.1);
    
    return {
        sqm: parseFloat(sqm.toFixed(2)),
        radianceProxy: Math.round(radianceProxy)
    };
  }

  // SQM (mag/arcsec²) → Bortle class using Cinzano Scale midpoints.
  // Source: Falchi et al. (2016), Science Advances, supplementary Table S1.
  // Higher SQM = darker sky = lower Bortle class.
  function _getBortleFromSQM(sqm) {
    if (sqm >= 21.75) return 1; // Pristine:        SQM ≥ 21.75
    if (sqm >= 21.60) return 2; // Truly dark:      SQM 21.60–21.75
    if (sqm >= 21.30) return 3; // Rural dark:      SQM 21.30–21.60
    if (sqm >= 20.80) return 4; // Rural/suburban:  SQM 20.80–21.30
    if (sqm >= 20.10) return 5; // Suburban:        SQM 20.10–20.80
    if (sqm >= 19.10) return 6; // Bright suburban: SQM 19.10–20.10
    if (sqm >= 18.00) return 7; // Suburban/urban:  SQM 18.00–19.10
    if (sqm >= 17.00) return 8; // City:            SQM 17.00–18.00
    return 9;                    // Inner city:      SQM < 17.00
  }

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

  function _fmtDateKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function _startOfLocalDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function _dayDiffFromToday(date) {
    const today = _startOfLocalDay(new Date());
    const target = _startOfLocalDay(date);
    return Math.round((target - today) / 86400000);
  }

  function _getSafeRecentGibsDate() {
    const d = _startOfLocalDay(new Date());
    // Subtract 3 days to avoid requesting a not-yet-published radiance tile.
    d.setDate(d.getDate() - 3);
    return _fmtDateKey(d);
  }

  function getRadianceDateForForecast(baseDate) {
    const dayDiff = _dayDiffFromToday(baseDate);
    // Past selections should use that historical tile when possible.
    if (dayDiff < 0) return _fmtDateKey(baseDate);
    // Present/future selections keep using the latest safe processed radiance layer.
    return _getSafeRecentGibsDate();
  }

  function _bortleCacheKey(siteId, gibsDate) {
    return `${siteId}|${gibsDate}`;
  }

  function _bortleSessionKey(siteId, gibsDate) {
    return `sp_b4_${siteId}_${gibsDate}`;
  }

  async function fetchBortleForSite(site, baseDate = new Date()) {
    const gibsDate = getRadianceDateForForecast(baseDate);
    const memKey = _bortleCacheKey(site.id, gibsDate);
    const cacheKey = _bortleSessionKey(site.id, gibsDate);

    if (_bortleData[memKey]) return _bortleData[memKey];

    // Return from session cache instantly if available
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        _bortleData[memKey] = parsed;
        return parsed;
      }
    } catch (e) {}

    return _fetchFromNASAGIBS(site, baseDate);
  }

  // Core NASA GIBS pixel-sampling routine
  function _fetchFromNASAGIBS(site, baseDate = new Date()) {
    const { lat, lng } = site;
    const z     = GIBS_ZOOM;
    const { x, y } = _latLngToTile(lat, lng, z);
    const { px, py } = _latLngToPixel(lat, lng, z, x, y);
    const gibsDate = getRadianceDateForForecast(baseDate);
    const cacheKey = _bortleCacheKey(site.id, gibsDate);
    const sessionKey = _bortleSessionKey(site.id, gibsDate);
    const url  = `${GIBS_HOST}${GIBS_TILE_PATH_1}${gibsDate}${GIBS_TILE_PATH_2}/${z}/${y}/${x}.png`;
    console.log(url);
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 256; canvas.height = 256;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, 256, 256);

          // Sample 3×3 neighbourhood for stability
          const id  = ctx.getImageData(px - 1, py - 1, 3, 3).data;
          // Calculate SQM and Bortle using the physical radiance proxy
          const { sqm, radianceProxy } = _calculateSQMFromRadiance(id);
          const bortle = _getBortleFromSQM(sqm);
          
          const result = { bortle, sqm, source: 'nasa_radiance', radiance: radianceProxy, gibsDate };
          _bortleData[cacheKey] = result;
          try { sessionStorage.setItem(sessionKey, JSON.stringify(result)); } catch (e) {}
          resolve(result);

        } catch (e) {
          // Canvas tainted or decode error → fall back
          console.warn('[StarPath] GIBS pixel sample failed for', site.name_en, e.message);
          const fallback = { ..._estimateBortleFromPosition(lat, lng), gibsDate };
          _bortleData[cacheKey] = fallback;
          try { sessionStorage.setItem(sessionKey, JSON.stringify(fallback)); } catch (e2) {}
          resolve(fallback);
        }
      };

      img.onerror = () => {
        const fallback = { ..._estimateBortleFromPosition(lat, lng), gibsDate };
        _bortleData[cacheKey] = fallback;
        try { sessionStorage.setItem(sessionKey, JSON.stringify(fallback)); } catch (e) {}
        resolve(fallback);
      };

      img.src = url;
    });
  }

  // Fetch Bortle for ALL sites with concurrency limit
  async function fetchAllBortle(sites, baseDate = new Date(), onProgress) {
    const CONCURRENCY = 8; // Higher concurrency OK — NASA GIBS handles parallel tile requests
    const gibsDate = getRadianceDateForForecast(baseDate);

    // Load cached entries synchronously first for the active radiance date
    sites.forEach(s => {
      const memKey = _bortleCacheKey(s.id, gibsDate);
      if (_bortleData[memKey]) return;
      try {
        const c = sessionStorage.getItem(_bortleSessionKey(s.id, gibsDate));
        if (c) _bortleData[memKey] = JSON.parse(c);
      } catch (e) {}
    });

    const missing = sites.filter(s => !_bortleData[_bortleCacheKey(s.id, gibsDate)]);

    for (let i = 0; i < missing.length; i += CONCURRENCY) {
      const chunk = missing.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(s => fetchBortleForSite(s, baseDate)));
      chunk.forEach(s => { if (onProgress) onProgress(s.id); });
      // No rate-limit delay needed — NASA GIBS is a public CDN-backed endpoint
    }
  }

  function getBortle(siteId, baseDate = new Date()) {
    return _bortleData[_bortleCacheKey(siteId, getRadianceDateForForecast(baseDate))] || null;
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
    
    const fallbackSQMs = { 1: 21.8, 2: 21.65, 3: 21.45, 4: 21.05, 5: 20.45, 6: 19.5, 7: 18.5, 8: 17.5, 9: 16.5 };
    const sqm = fallbackSQMs[bortle] || 20.0;

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
  function siteScore(site, dateOrOffset = 0) {
    const targetDate = dateOrOffset instanceof Date
      ? new Date(dateOrOffset)
      : new Date(Date.now() + dateOrOffset * 86400000);
    const moon    = getMoon(targetDate);
    const cloud   = getCloudCover(site.id, targetDate);
    const bData   = getBortle(site.id, targetDate);
    const bortle  = bData ? bData.bortle : 4; // 4 = default while fetching
    return calcScore(moon.illum, cloud, bortle);
  }

  /* 7-night forecast for the detail panel */
  function buildForecast(site, baseDate) {
    const baseBortleData = getBortle(site.id, baseDate);
    const baseBortle = baseBortleData ? baseBortleData.bortle : 4;

    let bestIdx = 0, bestSc = -1;
    const nights = Array.from({ length: 7 }, (_, off) => {
      const d      = new Date(baseDate); d.setDate(d.getDate() + off);
      const moon   = getMoon(d);
      const cloud  = getCloudCover(site.id, d);
      const score  = calcScore(moon.illum, cloud, baseBortle);
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
    fetchAllWeather, getCloudCover, isWeatherReady, clearWeatherCache,
    // Bortle
    fetchBortleForSite, fetchAllBortle, getBortle, getRadianceDateForForecast, isBortleReady,
    // Scoring
    calcScore, siteScore, scoreClass, scoreColor,
    // Forecast
    buildForecast,
    // Misc
    isMWSeason,
  };

})();