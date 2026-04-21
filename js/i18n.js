/* ============================================================
   i18n.js — StarPath Thailand
   Thai / English language toggle.
   Usage: i18n.t('key')  →  translated string
          i18n.setLang('th' | 'en')
   ============================================================ */

window.i18n = (() => {
  let lang = localStorage.getItem('sp-lang') || 'en';

  const T = {
    en: {
      /* ── NAV ─────────────────── */
      'nav.features':   'Features',
      'nav.scores':     'Scores',
      'nav.alerts':     'Alerts',
      'nav.how':        'How it works',
      'nav.open-map':   'Open Map',
      'nav.back':       '← Back to Home',
      'nav.toggle-lang':'ภาษาไทย',

      /* ── HERO ────────────────── */
      'hero.badge':     '68 NARIT-registered dark sky sites',
      'hero.h1':        'Plan your perfect <em>stargazing night</em>',
      'hero.sub':       "Thailand's first decision-support platform for dark sky tourism. Real-time observing scores, cloud forecasts, moon phases, and light pollution — all unified in one place.",
      'hero.cta-map':   'Explore the Interactive Map',
      'hero.cta-how':   'How it works',
      'hero.stat1':     '68',  'hero.stat1-lbl': 'Dark sky sites',
      'hero.stat2':     '7-night', 'hero.stat2-lbl': 'Forecast window',
      'hero.stat3':     '6',   'hero.stat3-lbl': 'Thai regions',
      'hero.stat4':     'Free','hero.stat4-lbl': 'Always open',

      /* ── FEATURES ────────────── */
      'feat.eyebrow':   'Core features',
      'feat.title':     'Six tools, one clear night',
      'feat.sub':       'StarPath unifies the data astrophotographers need — light pollution, lunar mechanics, and live weather — into a single decision platform.',
      'feat.1-name':    'Nightly observing score',
      'feat.1-desc':    'Composite 0–100 score from moon illumination, rise/set timing, cloud cover, and Bortle class darkness. Weighted for astrophotography.',
      'feat.1-tag':     'Updated hourly',
      'feat.2-name':    'Astronomical cloud forecast',
      'feat.2-desc':    'Open-Meteo hourly forecasts including precipitable water vapour and low, mid, and high cloud layers — far more detailed than standard weather apps.',
      'feat.2-tag':     '7-day window',
      'feat.3-name':    'Moon phase planner',
      'feat.3-desc':    'Monthly calendar highlighting the dark window — the 8–10 day band around new moon when Milky Way photography is viable. Plan trips weeks ahead.',
      'feat.3-tag':     'Dark window alert',
      'feat.4-name':    'Milky Way visibility guide',
      'feat.4-desc':    'From Thailand\'s latitude (~15°N), the galactic core is visible February–October, peaking April–August. Full seasonal calendar per site.',
      'feat.4-tag':     'Feb – Oct season',
      'feat.5-name':    'Light pollution layer',
      'feat.5-desc':    'All 68 NARIT-registered dark sky sites across 6 regions with Bortle class and Sky Quality Meter ratings where available.',
      'feat.5-tag':     'Bortle 1–9 scale',
      'feat.6-name':    'Perfect condition trigger',
      'feat.6-desc':    'Fires only when all three critical conditions align — low light pollution, dark moon phase, and clear skies. The ultimate astrophotography night.',
      'feat.6-tag':     'Rare event alert',

      /* ── MAP CTA ─────────────── */
      'cta.title':      'Live WebGIS map — all 68 sites, tonight\'s scores',
      'cta.sub':        'Click any site for its 7-night forecast, Bortle rating, moon data, and best months. Change the viewing date and every score updates instantly.',
      'cta.btn':        'Open Interactive Map',

      /* ── SCORES ──────────────── */
      'scores.eyebrow': 'Live preview',
      'scores.title':   'Tonight\'s observing scores',
      'scores.sub':     'Composite scores weighted by moon phase (40%), cloud cover (38%), and Bortle class darkness (22%). Top 8 sites shown.',
      'scores.widget':  'Site ranking · tonight',
      'scores.live':    'Live',
      'moon.calendar':  'Moon phase calendar',
      'moon.new':       'New moon',
      'moon.dark':      'Dark window',
      'moon.full':      'Full moon',

      /* ── MILKY WAY ───────────── */
      'mw.eyebrow':     'Seasonal guide',
      'mw.title':       'Milky Way visibility · Thailand 15°N',
      'mw.sub':         'The galactic core is visible for 9 months from Thailand. Peak season runs April through August when the core rises highest in the southern sky.',
      'mw.peak':        'Peak season',
      'mw.visible':     'Visible',
      'mw.none':        'Not visible',

      /* ── TRIGGERS ────────────── */
      'trg.eyebrow':    'Notification triggers',
      'trg.title':      'Get alerted when it matters',
      'trg.sub':        'Enable smart alerts for each condition. StarPath monitors all 68 sites and notifies you the moment conditions align.',
      'trg.1-name':     'Observing score',
      'trg.1-desc':     'Alert when composite score exceeds your threshold',
      'trg.1-freq':     'Daily · score ≥ 70',
      'trg.2-name':     'Cloud forecast',
      'trg.2-desc':     'Alert when sky clears at your selected site',
      'trg.2-freq':     'Hourly · <20% cloud',
      'trg.3-name':     'Moon phase planner',
      'trg.3-desc':     'Highlights best low-moon nights daily',
      'trg.3-freq':     'Daily · new moon ±5d',
      'trg.4-name':     'Light pollution map',
      'trg.4-desc':     'Uses GPS to suggest darker nearby locations',
      'trg.4-freq':     'On location change',
      'trg.5-name':     'Milky Way visibility',
      'trg.5-desc':     'Notifies when the galactic core rises above horizon',
      'trg.5-freq':     'Feb – Oct window',
      'notif.live':     'Live notification feed',
      'notif.tonight':  'Tonight',
      'notif.1-msg':    'Sky clearing at Doi Inthanon',
      'notif.1-dtl':    'Cloud cover dropping to 12% after 22:00',
      'notif.2-msg':    'Dark window opens in 2 nights',
      'notif.2-dtl':    'Moon drops below 10% · Best window this month',
      'notif.2-pill':   'Best window this month',
      'notif.3-msg':    'Milky Way core rises at 23:14',
      'notif.3-dtl':    'Peak altitude 42° · visible until 04:30',
      'notif.4-msg':    'Khao Yai score reached 74',
      'notif.4-dtl':    'Above your alert threshold of 70',
      'perf.title':     'Perfect stargazing night',
      'perf.desc':      'Low pollution · dark moon · clear skies · all three aligned',
      'perf.pill':      'Trigger active',

      /* ── HOW IT WORKS ────────── */
      'how.eyebrow':    'How it works',
      'how.title':      'Four steps to your best night',
      'how.sub':        'No technical knowledge required — StarPath does the astronomy for you.',
      'how.1-ttl':      'Pick a site',
      'how.1-dsc':      'Browse all 68 NARIT-listed dark sky sites on the interactive map with Bortle class overlay and SQM ratings.',
      'how.2-ttl':      'Check the window',
      'how.2-dsc':      'View the 7-night forecast and moon phase calendar to identify ideal dark nights weeks in advance.',
      'how.3-ttl':      'Set your alerts',
      'how.3-dsc':      'Enable notification triggers for any condition combination. StarPath monitors every site continuously.',
      'how.4-ttl':      'Go stargazing',
      'how.4-dsc':      'Head out knowing you picked the best possible night at the best site — no guesswork, no wasted trips.',

      /* ── FOOTER ──────────────── */
      'footer.copy':    'Dark sky decision platform for Thai astrophotography & astrotourism',
      'footer.tag':     'Powered by NARIT data · Open-Meteo · NASA Black Marble · SunCalc.js',
      'tech.eyebrow':   'Open-source tech stack · zero licensing cost',

      /* ── MAP PAGE ────────────── */
      'map.date-lbl':   'Viewing Date',
      'map.legend':     'Legend',
      'map.search':     'Search sites or province…',
      'map.chip-all':   'All',
      'map.chip-np':    'Park',
      'map.chip-prv':   'Private',
      'map.chip-com':   'Community',
      'map.chip-sub':   'Suburban',
      'map.tonight':    "Tonight's overview",
      'map.moon-lit':   'Moon lit',
      'map.avg-cloud':  'Avg Cloud',
      'map.best-score': 'Best Score',
      'map.sites-lbl':  'Sites — ranked by tonight\'s score',
      'map.no-sites':   'No sites match your search',
      'map.empty':      'Select a site on the map or from the list',
      /* map legend */
      'leg.score':      'Score Indicator',
      'leg.excellent':  '70–100 · Excellent',
      'leg.fair':       '40–69 · Fair',
      'leg.poor':       '0–39 · Poor',
      'leg.type':       'Site Type',
      'leg.np':         'National Park',
      'leg.prv':        'Private / Resort',
      'leg.com':        'Community',
      'leg.sub':        'Observatory / Suburban',
      /* cond pill */
      'cond.good':      'Good conditions tonight',
      'cond.fair':      'Fair conditions tonight',
      'cond.poor':      'Poor for stargazing',
      /* detail panel */
      'dp.7night':      '7-Night Forecast — Observing Score',
      'dp.now':         'Now',
      'dp.details':     'Site Details',
      'dp.province':    'Province',
      'dp.region':      'Region',
      'dp.type':        'Site Type',
      'dp.bortle':      'Bortle Class',
      'dp.sqm':         'SQM Rating',
      'dp.dark-scale':  'Sky Darkness — Bortle Scale (1 = darkest, 9 = brightest)',
      'dp.location':    'Location',
      'dp.lat':         'Latitude',
      'dp.lng':         'Longitude',
      'dp.best-months': 'Best Months to Visit',
      'dp.facilities':  'Facilities & Access',
      'dp.source':      'Data Source',
      'dp.narit-link':  'View on NARIT website ↗',
      'dp.mw-yes':      'Milky Way Core Visible Now',
      'dp.mw-yes-sub':  'Galactic centre visible Feb–Oct. Peak Apr–Aug, rises south after ~21:00.',
      'dp.mw-no':       'Milky Way Core Not Visible',
      'dp.mw-no-sub':   'Core is below horizon Nov–Jan. Deep-sky objects remain excellent.',
      'dp.not-rec':     'Not recorded',
      'dp.exceptional': 'Exceptional',
      'dp.excellent':   'Excellent',
      'dp.very-good':   'Very good',
      'dp.good':        'Good',
    },

    th: {
      /* ── NAV ─────────────────── */
      'nav.features':   'ฟีเจอร์',
      'nav.scores':     'คะแนน',
      'nav.alerts':     'การแจ้งเตือน',
      'nav.how':        'วิธีใช้งาน',
      'nav.open-map':   'เปิดแผนที่',
      'nav.back':       '← กลับหน้าหลัก',
      'nav.toggle-lang':'English',

      /* ── HERO ────────────────── */
      'hero.badge':     '68 จุดท้องฟ้ามืดจาก NARIT',
      'hero.h1':        'วางแผนคืนดู<em>ดาวที่ดีที่สุด</em>ของคุณ',
      'hero.sub':       'แพลตฟอร์มช่วยตัดสินใจด้านการท่องเที่ยวท้องฟ้ามืดแห่งแรกของไทย รวมข้อมูลคะแนน สภาพอากาศ เฟสดวงจันทร์ และมลภาวะทางแสง ไว้ในที่เดียว',
      'hero.cta-map':   'สำรวจแผนที่แบบโต้ตอบ',
      'hero.cta-how':   'วิธีใช้งาน',
      'hero.stat1':     '68',  'hero.stat1-lbl': 'สถานที่ท้องฟ้ามืด',
      'hero.stat2':     '7 คืน','hero.stat2-lbl': 'พยากรณ์ล่วงหน้า',
      'hero.stat3':     '6',   'hero.stat3-lbl': 'ภูมิภาคของไทย',
      'hero.stat4':     'ฟรี', 'hero.stat4-lbl': 'เปิดให้ใช้งานเสมอ',

      /* ── FEATURES ────────────── */
      'feat.eyebrow':   'ฟีเจอร์หลัก',
      'feat.title':     'หกเครื่องมือ คืนเดียวที่สมบูรณ์แบบ',
      'feat.sub':       'StarPath รวบรวมข้อมูลที่นักถ่ายภาพดาราศาสตร์ต้องการ — มลภาวะทางแสง กลศาสตร์ดวงจันทร์ และสภาพอากาศสด ไว้ในแพลตฟอร์มเดียว',
      'feat.1-name':    'คะแนนการสังเกตการณ์รายคืน',
      'feat.1-desc':    'คะแนน 0–100 จากแสงจันทร์ เวลาขึ้น/ตก เมฆปกคลุม และระดับความมืด Bortle ถ่วงน้ำหนักเพื่อการถ่ายภาพดาราศาสตร์',
      'feat.1-tag':     'อัปเดตทุกชั่วโมง',
      'feat.2-name':    'พยากรณ์เมฆแบบดาราศาสตร์',
      'feat.2-desc':    'ข้อมูล Open-Meteo รายชั่วโมงรวมถึงไอน้ำในชั้นบรรยากาศ เมฆต่ำ กลาง สูง — แม่นยำกว่าแอปสภาพอากาศทั่วไปมาก',
      'feat.2-tag':     'พยากรณ์ 7 วัน',
      'feat.3-name':    'แผนเฟสดวงจันทร์',
      'feat.3-desc':    'ปฏิทินรายเดือนที่เน้น "ช่วงมืด" — 8–10 วันรอบดวงจันทร์ใหม่ที่เหมาะสำหรับถ่ายทางช้างเผือก วางแผนล่วงหน้าได้หลายสัปดาห์',
      'feat.3-tag':     'แจ้งเตือนช่วงมืด',
      'feat.4-name':    'คู่มือการมองเห็นทางช้างเผือก',
      'feat.4-desc':    'จากละติจูดไทย (~15°N) แกนกาแล็กซีมองเห็นได้ตั้งแต่กุมภา–ตุลา จุดสูงสุดเมษา–สิงหา ปฏิทินฤดูกาลครบสำหรับทุกสถานที่',
      'feat.4-tag':     'ฤดูกาล กุมภา – ตุลา',
      'feat.5-name':    'ชั้นมลภาวะทางแสง',
      'feat.5-desc':    '68 สถานที่ท้องฟ้ามืดทั่วไทย 6 ภาค พร้อมค่า Bortle และ SQM',
      'feat.5-tag':     'มาตรา Bortle 1–9',
      'feat.6-name':    'ทริกเกอร์เงื่อนไขสมบูรณ์แบบ',
      'feat.6-desc':    'ทำงานเมื่อสามเงื่อนไขตรงกันพร้อมกัน — มลภาวะน้อย ดวงจันทร์มืด ท้องฟ้าใส คืนสุดยอดสำหรับถ่ายภาพดาราศาสตร์',
      'feat.6-tag':     'แจ้งเตือนเหตุการณ์หายาก',

      /* ── MAP CTA ─────────────── */
      'cta.title':      'แผนที่ WebGIS สด — 68 สถานที่ คะแนนคืนนี้',
      'cta.sub':        'คลิกสถานที่ใดก็ได้เพื่อดูพยากรณ์ 7 คืน ระดับ Bortle ข้อมูลดวงจันทร์ และเดือนที่ดีที่สุด เปลี่ยนวันที่ดูคะแนนอัปเดตทันที',
      'cta.btn':        'เปิดแผนที่แบบโต้ตอบ',

      /* ── SCORES ──────────────── */
      'scores.eyebrow': 'ตัวอย่างสด',
      'scores.title':   'คะแนนการสังเกตการณ์คืนนี้',
      'scores.sub':     'คะแนนถ่วงน้ำหนักตาม เฟสดวงจันทร์ (40%) เมฆปกคลุม (38%) และความมืด Bortle (22%) แสดง 8 อันดับแรก',
      'scores.widget':  'อันดับสถานที่ · คืนนี้',
      'scores.live':    'สด',
      'moon.calendar':  'ปฏิทินเฟสดวงจันทร์',
      'moon.new':       'ดวงจันทร์ใหม่',
      'moon.dark':      'ช่วงมืด',
      'moon.full':      'ดวงจันทร์เต็มดวง',

      /* ── MILKY WAY ───────────── */
      'mw.eyebrow':     'คู่มือฤดูกาล',
      'mw.title':       'การมองเห็นทางช้างเผือก · ไทย 15°N',
      'mw.sub':         'แกนกาแล็กซีมองเห็นได้ 9 เดือนจากประเทศไทย ช่วงสูงสุดเมษายน–สิงหาคม เมื่อแกนอยู่สูงที่สุดทางใต้',
      'mw.peak':        'ช่วงสูงสุด',
      'mw.visible':     'มองเห็นได้',
      'mw.none':        'มองไม่เห็น',

      /* ── TRIGGERS ────────────── */
      'trg.eyebrow':    'ทริกเกอร์การแจ้งเตือน',
      'trg.title':      'รับการแจ้งเตือนเมื่อถึงเวลา',
      'trg.sub':        'เปิดการแจ้งเตือนอัจฉริยะสำหรับแต่ละเงื่อนไข StarPath ตรวจสอบ 68 สถานที่และแจ้งทันทีที่เงื่อนไขตรงกัน',
      'trg.1-name':     'คะแนนการสังเกตการณ์',
      'trg.1-desc':     'แจ้งเตือนเมื่อคะแนนสูงกว่าเกณฑ์ที่กำหนด',
      'trg.1-freq':     'รายวัน · คะแนน ≥ 70',
      'trg.2-name':     'พยากรณ์เมฆ',
      'trg.2-desc':     'แจ้งเตือนเมื่อท้องฟ้าเปิดที่สถานที่ที่เลือก',
      'trg.2-freq':     'รายชั่วโมง · <20% เมฆ',
      'trg.3-name':     'แผนเฟสดวงจันทร์',
      'trg.3-desc':     'เน้นคืนที่แสงดวงจันทร์น้อยที่สุดรายวัน',
      'trg.3-freq':     'รายวัน · ดวงจันทร์ใหม่ ±5d',
      'trg.4-name':     'แผนที่มลภาวะทางแสง',
      'trg.4-desc':     'ใช้ GPS แนะนำสถานที่มืดกว่าใกล้เคียง',
      'trg.4-freq':     'เมื่อตำแหน่งเปลี่ยน',
      'trg.5-name':     'การมองเห็นทางช้างเผือก',
      'trg.5-desc':     'แจ้งเตือนเมื่อแกนกาแล็กซีขึ้นเหนือขอบฟ้า',
      'trg.5-freq':     'ช่วง กุมภา – ตุลา',
      'notif.live':     'ฟีดแจ้งเตือนสด',
      'notif.tonight':  'คืนนี้',
      'notif.1-msg':    'ท้องฟ้าใสขึ้นที่ดอยอินทนนท์',
      'notif.1-dtl':    'เมฆลดลงเหลือ 12% หลัง 22:00',
      'notif.2-msg':    'ช่วงมืดเริ่มในอีก 2 คืน',
      'notif.2-dtl':    'แสงดวงจันทร์ต่ำกว่า 10% · ช่วงดีที่สุดเดือนนี้',
      'notif.2-pill':   'ช่วงดีที่สุดเดือนนี้',
      'notif.3-msg':    'ทางช้างเผือกขึ้นเวลา 23:14',
      'notif.3-dtl':    'ระดับสูงสุด 42° · มองเห็นจนถึง 04:30',
      'notif.4-msg':    'คะแนนเขาใหญ่ถึง 74 แล้ว',
      'notif.4-dtl':    'สูงกว่าเกณฑ์แจ้งเตือน 70 ของคุณ',
      'perf.title':     'คืนดูดาวสมบูรณ์แบบ',
      'perf.desc':      'มลภาวะน้อย · ดวงจันทร์มืด · ท้องฟ้าใส · ครบสามเงื่อนไข',
      'perf.pill':      'ทริกเกอร์ทำงานอยู่',

      /* ── HOW IT WORKS ────────── */
      'how.eyebrow':    'วิธีใช้งาน',
      'how.title':      'สี่ขั้นตอนสู่คืนที่ดีที่สุด',
      'how.sub':        'ไม่ต้องมีความรู้ทางเทคนิค — StarPath จัดการดาราศาสตร์ให้คุณทั้งหมด',
      'how.1-ttl':      'เลือกสถานที่',
      'how.1-dsc':      'เรียกดูสถานที่ท้องฟ้ามืด 68 แห่งของ NARIT บนแผนที่พร้อมชั้น Bortle และค่า SQM',
      'how.2-ttl':      'ตรวจสอบช่วงเวลา',
      'how.2-dsc':      'ดูพยากรณ์ 7 คืนและปฏิทินดวงจันทร์เพื่อหาคืนมืดที่ดีที่สุดล่วงหน้าหลายสัปดาห์',
      'how.3-ttl':      'ตั้งค่าการแจ้งเตือน',
      'how.3-dsc':      'เปิดทริกเกอร์แจ้งเตือนสำหรับเงื่อนไขที่ต้องการ StarPath ตรวจสอบทุกสถานที่ตลอดเวลา',
      'how.4-ttl':      'ออกไปดูดาว',
      'how.4-dsc':      'ออกเดินทางโดยรู้ว่าคุณเลือกคืนที่ดีที่สุดในสถานที่ที่ดีที่สุด ไม่ต้องเดา ไม่ต้องเสียเที่ยว',

      /* ── FOOTER ──────────────── */
      'footer.copy':    'แพลตฟอร์มตัดสินใจสำหรับการถ่ายภาพดาราศาสตร์และการท่องเที่ยวท้องฟ้ามืดในไทย',
      'footer.tag':     'ขับเคลื่อนโดยข้อมูล NARIT · Open-Meteo · NASA Black Marble · SunCalc.js',
      'tech.eyebrow':   'Tech stack โอเพ่นซอร์ส · ไม่มีค่าลิขสิทธิ์',

      /* ── MAP PAGE ────────────── */
      'map.date-lbl':   'วันที่ดู',
      'map.legend':     'คำอธิบาย',
      'map.search':     'ค้นหาสถานที่หรือจังหวัด…',
      'map.chip-all':   'ทั้งหมด',
      'map.chip-np':    'อุทยาน',
      'map.chip-prv':   'เอกชน',
      'map.chip-com':   'ชุมชน',
      'map.chip-sub':   'ชานเมือง',
      'map.tonight':    'สภาพการณ์คืนนี้',
      'map.moon-lit':   'แสงจันทร์',
      'map.avg-cloud':  'เมฆเฉลี่ย',
      'map.best-score': 'คะแนนสูงสุด',
      'map.sites-lbl':  'สถานที่ — จัดอันดับตามคะแนนคืนนี้',
      'map.no-sites':   'ไม่พบสถานที่ที่ตรงกัน',
      'map.empty':      'เลือกสถานที่จากแผนที่หรือรายการ',
      /* map legend */
      'leg.score':      'ระดับคะแนน',
      'leg.excellent':  '70–100 · ยอดเยี่ยม',
      'leg.fair':       '40–69 · พอใช้',
      'leg.poor':       '0–39 · แย่',
      'leg.type':       'ประเภทสถานที่',
      'leg.np':         'อุทยานท้องฟ้ามืด',
      'leg.prv':        'เอกชน / รีสอร์ท',
      'leg.com':        'ชุมชน',
      'leg.sub':        'หอดูดาว / ชานเมือง',
      /* cond pill */
      'cond.good':      'สภาพดีคืนนี้',
      'cond.fair':      'สภาพพอใช้คืนนี้',
      'cond.poor':      'ไม่เหมาะสำหรับดูดาว',
      /* detail panel */
      'dp.7night':      'พยากรณ์ 7 คืน — คะแนนการสังเกตการณ์',
      'dp.now':         'ตอนนี้',
      'dp.details':     'รายละเอียดสถานที่',
      'dp.province':    'จังหวัด',
      'dp.region':      'ภาค',
      'dp.type':        'ประเภทสถานที่',
      'dp.bortle':      'ระดับ Bortle',
      'dp.sqm':         'ค่า SQM',
      'dp.dark-scale':  'ความมืดท้องฟ้า — มาตรา Bortle (1 = มืดที่สุด, 9 = สว่างที่สุด)',
      'dp.location':    'ตำแหน่ง',
      'dp.lat':         'ละติจูด',
      'dp.lng':         'ลองจิจูด',
      'dp.best-months': 'เดือนที่ดีที่สุดสำหรับการเยี่ยมชม',
      'dp.facilities':  'สิ่งอำนวยความสะดวกและการเดินทาง',
      'dp.source':      'แหล่งข้อมูล',
      'dp.narit-link':  'ดูบนเว็บไซต์ NARIT ↗',
      'dp.mw-yes':      'มองเห็นทางช้างเผือกตอนนี้',
      'dp.mw-yes-sub':  'แกนกาแล็กซีมองเห็นได้ กุมภา–ตุลา จุดสูงสุด เมษา–สิงหา ขึ้นทางใต้หลัง ~21:00',
      'dp.mw-no':       'ไม่เห็นทางช้างเผือกตอนนี้',
      'dp.mw-no-sub':   'แกนอยู่ต่ำกว่าขอบฟ้า พย.–ม.ค. วัตถุท้องฟ้าลึกยังคงยอดเยี่ยม',
      'dp.not-rec':     'ไม่มีข้อมูล',
      'dp.exceptional': 'ยอดเยี่ยมมาก',
      'dp.excellent':   'ยอดเยี่ยม',
      'dp.very-good':   'ดีมาก',
      'dp.good':        'ดี',
    },
  };

  function t(key) {
    return (T[lang] && T[lang][key]) || (T['en'][key]) || key;
  }

  function setLang(l) {
    lang = l;
    localStorage.setItem('sp-lang', l);
    applyLang();
  }

  function getLang() { return lang; }

  // Apply all data-i18n attributes
  function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      if (el.tagName === 'INPUT' && el.placeholder !== undefined) {
        el.placeholder = val;
      } else {
        el.innerHTML = val;
      }
    });
    // Update toggle button label
    document.querySelectorAll('.lang-toggle').forEach(btn => {
      btn.textContent = t('nav.toggle-lang');
    });
    // Update document lang attribute
    document.documentElement.lang = lang;
  }

  // Init on DOM ready
  function init() {
    applyLang();
  }

  return { t, setLang, getLang, applyLang, init };
})();
