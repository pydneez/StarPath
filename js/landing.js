/* ============================================================
   landing.js — StarPath Thailand Landing Page
   Uses real Open-Meteo cloud data + SunCalc moon + LP bortle
   Shows loading states and updates progressively
   ============================================================ */

/* ── STARFIELD ─────────────────────────────────────────── */
(function () {
  const cv = document.getElementById('starfield');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  let stars = [];
  function resize() {
    cv.width  = window.innerWidth;
    cv.height = Math.max(document.body.scrollHeight, window.innerHeight);
  }
  function init() {
    stars = [];
    const n = Math.floor(cv.width * cv.height / 6500);
    for (let i = 0; i < n; i++) stars.push({
      x: Math.random()*cv.width, y: Math.random()*cv.height,
      r: Math.random()<0.12?1.5:0.9, a: Math.random()*0.65+0.15,
      ph: Math.random()*Math.PI*2, sp: Math.random()*0.006+0.002,
    });
  }
  function draw(t) {
    ctx.clearRect(0,0,cv.width,cv.height);
    for (const s of stars) {
      const o = s.a*(0.6+0.4*Math.sin(t*s.sp+s.ph));
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,6.2832);
      ctx.fillStyle=`rgba(220,210,255,${o.toFixed(2)})`; ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize',()=>{resize();init();});
  resize(); init(); draw(0);
})();

/* ── UTILITIES ─────────────────────────────────────────── */
const TODAY = new Date();

function scoreColor(sc) {
  return sc >= 70 ? 'var(--hi)' : sc >= 40 ? 'var(--md)' : 'var(--lo)';
}

function getSiteScore(site) {
  const moon   = Astro.getMoon(TODAY);
  const cloud  = Astro.getCloudCover(site.id, 0);
  const bData  = Astro.getBortle(site.id);
  const bortle = bData ? bData.bortle : 4;
  return Astro.calcScore(moon.illum, cloud, bortle);
}

/* ── SCORE WIDGET ──────────────────────────────────────── */
function renderScoreWidget() {
  const scored = DARKSKY_SITES
    .map(s => ({ name: s.name_en || s.name_th, sc: getSiteScore(s) }))
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 8);

  const rows = document.getElementById('score-rows');
  if (!rows) return;

  rows.innerHTML = scored.map(s => {
    const c = scoreColor(s.sc);
    const n = s.name.length > 18 ? s.name.slice(0, 17) + '…' : s.name;
    return `
      <div class="sc-row">
        <div class="sc-name">${n}</div>
        <div class="sc-bar-bg"><div class="sc-bar" style="width:0;background:${c}" data-w="${s.sc}"></div></div>
        <div class="sc-val" style="color:${c}">${s.sc}</div>
      </div>`;
  }).join('');

  // Animate bars on scroll into view
  const bars = rows.querySelectorAll('.sc-bar');
  const obs  = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { bars.forEach(b => { b.style.width = b.dataset.w + '%'; }); obs.disconnect(); }
    });
  }, { threshold: 0.2 });
  const sec = document.getElementById('scores');
  if (sec) obs.observe(sec);

  // Update data-source badge
  const badge = document.getElementById('score-data-badge');
  if (badge) {
    if (Astro.isWeatherReady()) {
      badge.textContent = '● Open-Meteo live data';
      badge.style.color = 'var(--hi)';
    } else {
      badge.textContent = '⟳ Loading live data…';
      badge.style.color = 'var(--amber)';
    }
  }
}

/* ── MAP CTA STATS ─────────────────────────────────────── */
function renderMapCtaStats() {
  const scores    = DARKSKY_SITES.map(s => getSiteScore(s));
  const best      = Math.max(...scores);
  const excellent = scores.filter(s => s >= 70).length;
  const moon      = Astro.getMoon(TODAY);

  const el = document.getElementById('cta-stats');
  if (!el) return;
  el.innerHTML = `
    <div class="preview-stat">
      <div class="preview-stat-val" style="color:${scoreColor(best)}">${best}</div>
      <div class="preview-stat-lbl">Best Score</div>
    </div>
    <div class="preview-stat">
      <div class="preview-stat-val" style="color:var(--hi)">${excellent}</div>
      <div class="preview-stat-lbl">Excellent sites</div>
    </div>
    <div class="preview-stat">
      <div class="preview-stat-val" style="color:var(--amber)">${moon.pct}%</div>
      <div class="preview-stat-lbl">Moon lit</div>
    </div>`;
}

/* ── MOON CALENDAR (SunCalc) ────────────────────────────── */
function renderMoonCalendar() {
  const yr = TODAY.getFullYear(), mo = TODAY.getMonth(), today = TODAY.getDate();
  const MN = ['January','February','March','April','May','June',
               'July','August','September','October','November','December'];
  const monthTxt = document.getElementById('cal-month');
  if (monthTxt) monthTxt.textContent = MN[mo] + ' ' + yr;

  const grid = document.getElementById('moon-cal');
  if (!grid) return;
  while (grid.children.length > 7) grid.removeChild(grid.lastChild);

  const days  = new Date(yr, mo + 1, 0).getDate();
  const first = new Date(yr, mo, 1).getDay();
  for (let i = 0; i < first; i++) grid.appendChild(document.createElement('div'));
  for (let d = 1; d <= days; d++) {
    const moon = Astro.getMoon(new Date(yr, mo, d));
    const div  = document.createElement('div');
    div.className   = 'mc-day';
    div.textContent = d;
    if (d === today) div.classList.add('today');
    // SunCalc phase 0-1: 0/1=new, 0.5=full, 0.25=first quarter, 0.75=last quarter
    if (moon.phase < 0.04 || moon.phase >= 0.96) div.classList.add('new-moon');
    else if (moon.phase > 0.46 && moon.phase < 0.54) div.classList.add('full');
    else if (moon.phase < 0.12 || moon.phase > 0.88) div.classList.add('dark-win');
    grid.appendChild(div);
  }
}

/* ── MILKY WAY GRID ────────────────────────────────────── */
function renderMWGrid() {
  const grid = document.getElementById('mw-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const MN  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const VIS = [0, 1, 1, 2, 2, 2, 2, 2, 1, 1, 1, 0];
  MN.forEach((m, i) => {
    const col = document.createElement('div'); col.className = 'mw-col';
    const bar = document.createElement('div'); bar.className = 'mw-bar';
    bar.style.background = VIS[i] === 2
      ? 'linear-gradient(180deg,var(--purple-l),var(--purple))'
      : VIS[i] === 1 ? 'rgba(139,127,248,0.40)' : 'rgba(255,255,255,0.05)';
    const lbl = document.createElement('div'); lbl.className = 'mw-lbl'; lbl.textContent = m;
    col.appendChild(bar); col.appendChild(lbl); grid.appendChild(col);
  });
}

/* ── SMOOTH SCROLL ─────────────────────────────────────── */
window.scrollTo2 = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

/* ── DATA LOADING ──────────────────────────────────────── */
async function loadLandingData() {
  // Phase 1: Fetch cloud cover (Open-Meteo)
  try {
    await Astro.fetchAllWeather(DARKSKY_SITES);
    renderScoreWidget();
    renderMapCtaStats();
  } catch (e) {
    console.warn('[StarPath] Cloud cover fetch failed:', e);
  }

  // Phase 2: Fetch bortle progressively (updates scores as each arrives)
  await Astro.fetchAllBortle(DARKSKY_SITES, () => {
    renderScoreWidget();
    renderMapCtaStats();
  });

  // Final refresh
  renderScoreWidget();
  renderMapCtaStats();
}

/* ── INIT ──────────────────────────────────────────────── */
window.addEventListener('load', () => {
  // Render immediately with moon data (sync)
  renderScoreWidget();
  renderMapCtaStats();
  renderMoonCalendar();
  renderMWGrid();

  // Then load live API data
  loadLandingData();
});
