// ==========================================================================
// Config
// ==========================================================================
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTuttLSBMLwU8wOzRfijsjaq6ZN6nqxNfydiqEGDSRf6ezdmkNz6dz1hpUxYURoBaOW1LbiMBmhQe8D/pub?output=csv';

let allManga      = [];
let currentFilter = 'all';
let bgTimeout;
let gatewayClosed = false;
let activeModalCard = null;
let closeAnimating = false;

const GATEWAY_MIN_MS = 1350;
const gatewayStartedAt = Date.now();
const CHAPTERS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTuttLSBMLwU8wOzRfijsjaq6ZN6nqxNfydiqEGDSRf6ezdmkNz6dz1hpUxYURoBaOW1LbiMBmhQe8D/pub?gid=883899264&single=true&output=csv';
const CHAPTER_RULES_URL = 'chapter-rules.csv';

const PLATFORMS = [
  { key: 'mynovel',   label: 'MYNOVEL',   icon: 'icon-mynovel.png'   },
  { key: 'readrealm', label: 'ReadRealm', icon: 'icon-readrealm.png' },
  { key: 'readtoon',  label: 'ReadToon',  icon: 'icon-readtoon.png'  },
];

let chapterIndex = {};
let chapterRuleIndex = {};

// ==========================================================================
// Utility
// ==========================================================================
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function freshUrl(url) {
  const glue = String(url).includes('?') ? '&' : '?';
  return `${url}${glue}_=${Date.now()}`;
}

async function closeGatewayIntro() {
  if (gatewayClosed) return;
  gatewayClosed = true;

  const elapsed = Date.now() - gatewayStartedAt;
  await wait(Math.max(0, GATEWAY_MIN_MS - elapsed));

  const intro = document.getElementById('gateway-intro');
  document.body.classList.remove('gateway-loading');
  document.body.classList.add('gateway-ready');

  if (!intro) return;
  intro.classList.add('is-exiting');

  const removeIntro = () => intro.remove();
  intro.addEventListener('animationend', removeIntro, { once: true });
  setTimeout(removeIntro, 900);
}

// Sanitize: ป้องกัน XSS จากข้อมูลใน CSV
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Validate URL — อนุญาตเฉพาะ http/https
function safeUrl(url) {
  try {
    const u = new URL(url);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? url : '#';
  } catch { return '#'; }
}

// ==========================================================================
// CSV Parser — ใช้ PapaParse รองรับ quoted fields (คอมม่าในข้อความ)
// คอลัมน์: title, image, status, description, latest,
//          mynovel, readrealm, readtoon, powerLevel
// powerLevel ใช้ | คั่นแต่ละระดับ เช่น "หลอมเอ็น|หล่อกระดูก|เปลี่ยนโลหิต"
// ==========================================================================
function parseCSV(text) {
  const { data } = Papa.parse(text, { header: false, skipEmptyLines: true });
  return data.slice(1).map((v, order) => ({
    title:       v[0]?.trim() || '',
    image:       v[1]?.trim() || '',
    status:      v[2]?.trim() || '',
    description: v[3]?.trim() || '',
    latest:      v[4]?.trim() || '',
    links: {
      mynovel:   v[5]?.trim() || '',
      readrealm: v[6]?.trim() || '',
      readtoon:  v[7]?.trim() || '',
    },
    powerLevel:  v[8]?.trim() || '',
    order,
  }));
}

function normalizeUrlKey(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.href.replace(/\/$/, '').toLowerCase();
  } catch {
    return '';
  }
}

function normalizeTitleKey(title) {
  return String(title || '').trim().toLowerCase();
}

function extractChapterNumber(value) {
  const found = String(value || '').match(/\d+(?:\.\d+)?/);
  return found ? Number(found[0]) : -1;
}

function pickRowValue(row, keys) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') return String(row[key]).trim();
  }
  return '';
}

function normalizeAccess(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;

  const lower = value.toLowerCase();
  if (lower === '0' || lower === 'free' || lower.includes('ฟรี')) {
    return null;
  }

  if (
    lower === 'coin' ||
    lower === 'coins' ||
    lower === 'paid' ||
    lower === 'locked' ||
    lower.includes('เหรียญ') ||
    lower.includes('ติด') ||
    lower.includes('ล็อก') ||
    lower.includes('lock') ||
    lower.includes('vip')
  ) {
    return { type: 'coin', label: '🪙' };
  }

  if (/^\d+$/.test(value)) {
    return Number(value) === 0 ? null : { type: 'coin', label: '🪙' };
  }

  return { type: 'note', label: value };
}

function getChapterAccess(row, platform) {
  const platformAccess = pickRowValue(row, [
    `${platform}Access`,
    `${platform}access`,
    `${platform}_access`,
    `${platform}Status`,
    `${platform}status`,
    `${platform}_status`,
    `${platform}Price`,
    `${platform}price`,
    `${platform}_price`,
  ]);

  const genericAccess = pickRowValue(row, ['access', 'Access', 'chapterAccess', 'status', 'price', 'coin']);
  return normalizeAccess(platformAccess || genericAccess);
}

function chapterBucketKey(type, platform, value) {
  const keyValue = type === 'url' ? normalizeUrlKey(value) : normalizeTitleKey(value);
  return keyValue ? `${type}|${platform}|${keyValue}` : '';
}

function addChapterBucket(key, chapter) {
  if (!key) return;
  if (!chapterIndex[key]) chapterIndex[key] = [];
  chapterIndex[key].push(chapter);
}

function parseChapterCSV(text) {
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
  return data.flatMap(row => {
    const platform = String(row.platform || row.Platform || '').trim().toLowerCase();
    const seriesUrl = String(row.seriesUrl || row.sourceUrl || row.pageUrl || '').trim();
    const title = String(row.title || row.series || '').trim();
    const chapter = String(row.chapter || row.episode || '').trim();
    const label = String(row.label || row.name || '').trim();
    const url = String(row.url || row.chapterUrl || row.link || '').trim();

    if (platform || url) {
      const safeChapterUrl = safeUrl(url);
      if (!platform || !url || safeChapterUrl === '#') return [];

      return [{
        platform,
        seriesUrl,
        title,
        chapter,
        label,
        access: getChapterAccess(row, platform),
        url: safeChapterUrl,
      }];
    }

    return PLATFORMS.map(p => {
      const platformUrl = String(row[p.key] || row[`${p.key}Url`] || row[`${p.key}Link`] || '').trim();
      const safeChapterUrl = safeUrl(platformUrl);
      if (!title || !platformUrl || safeChapterUrl === '#') return null;

      return {
        platform: p.key,
        seriesUrl: '',
        title,
        chapter,
        label,
        access: getChapterAccess(row, p.key),
        url: safeChapterUrl,
      };
    }).filter(Boolean);
  }).filter(Boolean);
}

function buildChapterIndex(rows) {
  chapterIndex = {};

  rows.forEach(row => {
    addChapterBucket(chapterBucketKey('url', row.platform, row.seriesUrl), row);
    addChapterBucket(chapterBucketKey('title', row.platform, row.title), row);
  });

  Object.keys(chapterIndex).forEach(key => {
    chapterIndex[key].sort((a, b) => {
      const bNo = extractChapterNumber(b.chapter || b.label || b.url);
      const aNo = extractChapterNumber(a.chapter || a.label || a.url);
      if (bNo !== aNo) return bNo - aNo;
      return String(b.label || b.url).localeCompare(String(a.label || a.url));
    });
  });
}

function applyChapterPattern(pattern, chapter) {
  return String(pattern || '').replace(/\{chapter(?::0(\d+))?\}/g, (_, width) => {
    const value = String(chapter);
    return width ? value.padStart(Number(width), '0') : value;
  });
}

function parseChapterRuleCSV(text) {
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
  return data.map(row => {
    const platform = String(row.platform || '').trim().toLowerCase();
    const seriesUrl = String(row.seriesUrl || row.sourceUrl || row.pageUrl || '').trim();
    const title = String(row.title || row.series || '').trim();
    const from = Number(String(row.from || row.start || '').trim());
    const to = Number(String(row.to || row.end || '').trim());
    const step = Number(String(row.step || '1').trim()) || 1;
    const labelPattern = String(row.labelPattern || row.label || 'ตอนที่ {chapter}').trim();
    const urlPattern = String(row.urlPattern || row.url || '').trim();
    const access = normalizeAccess(row.access || row.Access || row.status || row.price || '');

    if (!platform || !urlPattern || !Number.isFinite(from) || !Number.isFinite(to)) return null;
    if (step <= 0) return null;

    return { platform, seriesUrl, title, from, to, step, labelPattern, urlPattern, access };
  }).filter(Boolean);
}

function addChapterRuleBucket(key, rule) {
  if (!key) return;
  if (!chapterRuleIndex[key]) chapterRuleIndex[key] = [];
  chapterRuleIndex[key].push(rule);
}

function buildChapterRuleIndex(rows) {
  chapterRuleIndex = {};

  rows.forEach(row => {
    addChapterRuleBucket(chapterBucketKey('url', row.platform, row.seriesUrl), row);
    addChapterRuleBucket(chapterBucketKey('title', row.platform, row.title), row);
  });
}

function expandChapterRule(rule) {
  const chapters = [];
  const direction = rule.from <= rule.to ? 1 : -1;
  const limit = 1200;

  for (let current = rule.from, count = 0;
       direction === 1 ? current <= rule.to : current >= rule.to;
       current += rule.step * direction, count += 1) {
    if (count >= limit) break;

    const url = safeUrl(applyChapterPattern(rule.urlPattern, current));
    if (url === '#') continue;

    chapters.push({
      platform: rule.platform,
      seriesUrl: rule.seriesUrl,
      title: rule.title,
      chapter: String(current),
      label: applyChapterPattern(rule.labelPattern, current),
      access: rule.access,
      url,
    });
  }

  return chapters;
}

async function loadChapterLinks() {
  try {
    const res = await fetch(freshUrl(CHAPTERS_URL), { cache: 'no-store' });
    if (!res.ok) return;
    buildChapterIndex(parseChapterCSV(await res.text()));
  } catch (err) {
    console.warn('Chapter links unavailable:', err);
  }
}

async function loadChapterRules() {
  try {
    const res = await fetch(freshUrl(CHAPTER_RULES_URL), { cache: 'no-store' });
    if (!res.ok) return;
    buildChapterRuleIndex(parseChapterRuleCSV(await res.text()));
  } catch (err) {
    console.warn('Chapter rules unavailable:', err);
  }
}

function getChaptersFor(manga, platform) {
  const keys = [
    chapterBucketKey('url', platform, manga.links?.[platform]),
    chapterBucketKey('title', platform, manga.title),
  ].filter(Boolean);

  const merged = [];
  const seen = new Set();

  keys.forEach(key => {
    (chapterIndex[key] || []).forEach(chapter => {
      if (seen.has(chapter.url)) return;
      seen.add(chapter.url);
      merged.push(chapter);
    });

    (chapterRuleIndex[key] || []).forEach(rule => {
      expandChapterRule(rule).forEach(chapter => {
        if (seen.has(chapter.url)) return;
        seen.add(chapter.url);
        merged.push(chapter);
      });
    });
  });

  merged.sort((a, b) => {
    const bNo = extractChapterNumber(b.chapter || b.label || b.url);
    const aNo = extractChapterNumber(a.chapter || a.label || a.url);
    if (bNo !== aNo) return bNo - aNo;
    return String(b.label || b.url).localeCompare(String(a.label || a.url));
  });

  return merged;
}

// ==========================================================================
// Ribbon
// ==========================================================================
function getRibbonClass(status) {
  if (!status) return '';
  if (status.includes('จบ')) return 'ribbon-end';
  if (status.includes('อัปเดต')) return 'ribbon-updating';
  if (status.includes('ใหม่')) return 'ribbon-new';
  if (status.includes('หยุด')) return 'ribbon-hiatus';
  return '';
}

function getStatusSortRank(status) {
  const s = String(status || '');
  if (s.includes('หยุด')) return 3;
  if (s.includes('จบ')) return 2;
  return 0;
}

function sortMangaList(list) {
  return [...list].sort((a, b) => {
    const rankDiff = getStatusSortRank(a.status) - getStatusSortRank(b.status);
    if (rankDiff) return rankDiff;
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

// ==========================================================================
// Dynamic Background
// ==========================================================================
const bgBlur = document.getElementById('bg-blur');
let currentBg = '';

function setBg(imageUrl) {
  if (!imageUrl || imageUrl === currentBg) return;
  currentBg = imageUrl;
  bgBlur.style.backgroundImage = `url('${imageUrl}')`;
  bgBlur.classList.add('visible');
}

function clearBg(force = false) {
  if (!force && document.body.classList.contains('modal-open')) return;
  bgBlur.classList.remove('visible');
  currentBg = '';
}

// ==========================================================================
// Render Grid
// ==========================================================================
function render(list) {
  const grid    = document.getElementById('manga-grid');
  const countEl = document.getElementById('grid-count');
  countEl.textContent = `${list.length} เรื่อง`;
  grid.innerHTML = '';

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⌕</div>
        <div class="empty-text">ไม่พบมังงะที่ค้นหา</div>
      </div>`;
    return;
  }

  list.forEach((m, i) => {
    const card = document.createElement('div');
    card.className = 'manga-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', m.title);
    card.style.animationDelay = `${Math.min(i * 0.03, 0.5)}s`;

    const rc     = getRibbonClass(m.status);
    const ribbon = rc ? `<div class="ribbon ${rc}">${esc(m.status)}</div>` : '';

    card.innerHTML = `
      <div class="card-thumb">
        ${ribbon}
        <img src="${esc(m.image)}" alt="${esc(m.title)}" loading="lazy">
        <div class="card-overlay">
          <div class="card-overlay-desc">${esc(m.description)}</div>
        </div>
      </div>
      <div class="card-info">
        <div class="card-title">${esc(m.title)}</div>
        <div class="entry-meta-row">
          ${m.latest ? `<div class="card-latest">${esc(m.latest)}</div>` : '<div class="card-latest">ไม่ระบุตอน</div>'}
        </div>
      </div>
    `;

    // Background on hover
    card.addEventListener('mouseenter', () => {
      clearTimeout(bgTimeout);
      if (m.image) setBg(m.image);
    });
    card.addEventListener('mouseleave', () => {
      bgTimeout = setTimeout(clearBg, 300);
    });

    // Touch support
    card.addEventListener('touchstart', () => {
      if (m.image) setBg(m.image);
      card.classList.add('touched');
    }, { passive: true });
    card.addEventListener('touchend', () => {
      setTimeout(() => card.classList.remove('touched'), 300);
    }, { passive: true });

    card.onclick = () => openModal(m, card);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(m, card); }
    });
    grid.appendChild(card);
  });
}

// ==========================================================================
// Filter & Search
// ==========================================================================
function getFiltered() {
  const term = document.getElementById('search').value.toLowerCase().trim();
  return sortMangaList(allManga.filter(m => {
    const matchSearch = !term || m.title.toLowerCase().includes(term);
    const matchFilter = currentFilter === 'all' || m.status.includes(currentFilter);
    return matchSearch && matchFilter;
  }));
}
function update() { render(getFiltered()); }

document.querySelectorAll('.ftab').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    update();
  };
});

const searchInput = document.getElementById('search');
const clearBtn    = document.getElementById('search-clear');

searchInput.addEventListener('input', debounce(() => {
  clearBtn.style.display = searchInput.value ? 'block' : 'none';
  update();
}, 280));

clearBtn.onclick = () => {
  searchInput.value = '';
  clearBtn.style.display = 'none';
  update();
};

// ==========================================================================
// Modal
// ==========================================================================
function buildPowerLevel(raw) {
  if (!raw) return '';

  function buildCategories(str) {
    return str.split(';').map(s => s.trim()).filter(Boolean).map(cat => {
      const colonIdx = cat.indexOf(':');
      const catName  = colonIdx !== -1 ? cat.slice(0, colonIdx).trim() : '';
      const levelRaw = colonIdx !== -1 ? cat.slice(colonIdx + 1) : cat;
      const levels   = levelRaw.split('|').map(s => s.trim()).filter(Boolean);
      if (!levels.length) return '';
      const items = levels.map((lvl, i) =>
        `<div class="power-item">
          <span class="power-num">${i + 1}</span>
          <span class="power-name">${lvl}</span>
        </div>`
      ).join('');
      const header = catName ? `<div class="power-cat-header">${catName}</div>` : '';
      return `<div class="power-category">${header}<div class="power-list">${items}</div></div>`;
    }).join('');
  }

  // แบบมีกลุ่ม: ระดับพลังปัจจุบัน>>มนุษย์:ระดับ1|ระดับ2&&กลุ่ม2>>...
  if (raw.includes('>>')) {
    const groups = raw.split('&&').map(s => s.trim()).filter(Boolean);
    const html = groups.map(group => {
      const arrowIdx  = group.indexOf('>>');
      const groupName = group.slice(0, arrowIdx).trim();
      const rest      = group.slice(arrowIdx + 2);
      const header    = groupName ? `<div class="power-group-header">${groupName}</div>` : '';
      return `<div class="power-group">${header}${buildCategories(rest)}</div>`;
    }).join('');
    return `<div class="power-section power-multi">${html}</div>`;
  }

  // แบบหลายประเภท: มนุษย์:ระดับ1|ระดับ2;ปีศาจ:ระดับ1
  if (raw.includes(';')) {
    return `<div class="power-section power-multi">${buildCategories(raw)}</div>`;
  }

  // แบบเดิม: ระดับ1|ระดับ2|ระดับ3
  const levels = raw.split('|').map(s => s.trim()).filter(Boolean);
  if (!levels.length) return '';
  const items = levels.map((lvl, i) =>
    `<div class="power-item">
      <span class="power-num">${i + 1}</span>
      <span class="power-name">${lvl}</span>
    </div>`
  ).join('');
  return `<div class="power-section"><div class="power-list">${items}</div></div>`;
}

// Switch tab inside modal
function switchModalTab(tabName) {
  document.querySelectorAll('.mtab').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  document.getElementById('tab-detail').style.display = tabName === 'detail' ? '' : 'none';
  document.getElementById('tab-power').style.display  = tabName === 'power'  ? '' : 'none';
}

document.querySelectorAll('.mtab').forEach(btn => {
  btn.onclick = () => switchModalTab(btn.dataset.tab);
});

let lastFocused = null;

function trapFocus(e) {
  const modal = document.getElementById('modal');
  const focusable = modal.querySelectorAll(
    'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];
  if (e.key === 'Tab') {
    if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
    else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
  }
}

function spawnDetailEffect(sourceEl) {
  if (!sourceEl) return;

  const rect = sourceEl.getBoundingClientRect();
  const ghost = sourceEl.cloneNode(true);
  ghost.classList.add('morph-ghost');
  ghost.removeAttribute('role');
  ghost.removeAttribute('tabindex');
  Object.assign(ghost.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  document.body.appendChild(ghost);

  const targetW = Math.min(window.innerWidth - 40, 560);
  const targetH = Math.min(window.innerHeight - 72, 650);
  const targetL = (window.innerWidth - targetW) / 2;
  const targetT = (window.innerHeight - targetH) / 2;

  ghost.animate([
    { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, opacity: 0.78, filter: 'blur(0px)' },
    { left: `${targetL}px`, top: `${targetT}px`, width: `${targetW}px`, height: `${targetH}px`, opacity: 0, filter: 'blur(9px)' },
  ], { duration: 520, easing: 'cubic-bezier(.2,.8,.15,1)', fill: 'forwards' });

  setTimeout(() => ghost.remove(), 560);
}

function spawnCloseEffect(targetEl) {
  const modal = document.getElementById('modal');
  const modalPanel = modal.querySelector('.modal-container');
  if (!targetEl || !modalPanel) return;

  const start = modalPanel.getBoundingClientRect();
  const end = targetEl.getBoundingClientRect();
  const ghost = modalPanel.cloneNode(true);
  ghost.classList.add('morph-close-ghost');
  Object.assign(ghost.style, {
    left: `${start.left}px`,
    top: `${start.top}px`,
    width: `${start.width}px`,
    height: `${start.height}px`,
  });
  document.body.appendChild(ghost);

  ghost.animate([
    { left: `${start.left}px`, top: `${start.top}px`, width: `${start.width}px`, height: `${start.height}px`, opacity: 0.9, filter: 'blur(0px)' },
    { left: `${end.left}px`, top: `${end.top}px`, width: `${end.width}px`, height: `${end.height}px`, opacity: 0, filter: 'blur(8px)' },
  ], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });

  setTimeout(() => ghost.remove(), 470);
}

function setPlatformButtonState(platformKey) {
  document.querySelectorAll('.chapter-platform-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.platform === platformKey);
  });
}

const CHAPTER_GROUP_SIZE = 50;
let chapterNewestFirst = true;

function createChapterChip(item) {
  const a = document.createElement('a');
  a.href = item.url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.className = 'chapter-chip';
  if (item.access?.type) a.dataset.access = item.access.type;

  const label = document.createElement('span');
  label.className = 'chapter-label';
  label.textContent = item.label || (item.chapter ? `ตอนที่ ${item.chapter}` : 'อ่านตอนนี้');
  Object.assign(label.style, {
    display: 'block',
    minWidth: '0',
    height: '16px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: '#eefcff',
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px',
    fontWeight: '700',
    lineHeight: '16px',
    alignSelf: 'center',
  });
  label.style.webkitTextFillColor = '#eefcff';
  a.appendChild(label);

  if (item.access?.label) {
    const access = document.createElement('span');
    access.className = `chapter-access chapter-access-${item.access.type || 'note'}`;
    access.textContent = item.access.label;
    if (item.access.type === 'coin') access.title = 'ติดเหรียญ';
    a.appendChild(access);
  }

  return a;
}

function getChapterGroupNumber(item) {
  return extractChapterNumber(item.chapter || item.label || item.url);
}

function sortChaptersByOrder(chapters, newestFirst) {
  return [...chapters].sort((a, b) => {
    const aNo = getChapterGroupNumber(a);
    const bNo = getChapterGroupNumber(b);
    const aKnown = Number.isFinite(aNo) && aNo >= 1;
    const bKnown = Number.isFinite(bNo) && bNo >= 1;
    if (aKnown !== bKnown) return aKnown ? -1 : 1;
    if (aNo !== bNo) return newestFirst ? bNo - aNo : aNo - bNo;
    return String(a.label || a.url).localeCompare(String(b.label || b.url));
  });
}

function groupChaptersByRange(chapters, newestFirst) {
  const numbered = chapters
    .map(item => ({ item, chapterNo: getChapterGroupNumber(item) }))
    .filter(entry => Number.isFinite(entry.chapterNo) && entry.chapterNo >= 1);
  const maxChapterNo = numbered.length
    ? Math.ceil(Math.max(...numbered.map(entry => entry.chapterNo)))
    : 0;
  const groups = new Map();
  const other = [];

  chapters.forEach(item => {
    const chapterNo = getChapterGroupNumber(item);
    if (!Number.isFinite(chapterNo) || chapterNo < 1) {
      other.push(item);
      return;
    }

    const start = Math.floor((Math.floor(chapterNo) - 1) / CHAPTER_GROUP_SIZE) * CHAPTER_GROUP_SIZE + 1;
    const end = Math.min(start + CHAPTER_GROUP_SIZE - 1, maxChapterNo);
    if (!groups.has(start)) groups.set(start, { start, end, items: [] });
    groups.get(start).items.push(item);
  });

  const sortedGroups = [...groups.values()].sort((a, b) => (
    newestFirst ? b.start - a.start : a.start - b.start
  ));
  sortedGroups.forEach(group => {
    group.items = sortChaptersByOrder(group.items, newestFirst);
  });
  if (other.length) sortedGroups.push({ start: Infinity, end: Infinity, label: 'อื่น ๆ', items: other });
  return sortedGroups;
}

function updateChapterOrderButton(button) {
  if (!button) return;
  const label = button.querySelector('#chapter-order-label');
  const text = chapterNewestFirst ? 'ตอนแรกสุด' : 'ตอนล่าสุด';
  button.classList.toggle('is-newest-first', chapterNewestFirst);
  button.setAttribute('aria-label', `สลับไป${text}`);
  if (label) label.textContent = text;
}

function renderChapterGroups(chapters, listEl, newestFirst = false) {
  const orderedChapters = sortChaptersByOrder(chapters, newestFirst);
  const groups = groupChaptersByRange(orderedChapters, newestFirst);
  const shouldGroup = groups.length > 0;
  listEl.classList.toggle('chapter-list-grouped', shouldGroup);

  if (!shouldGroup) {
    orderedChapters.forEach(item => listEl.appendChild(createChapterChip(item)));
    return;
  }

  groups.forEach(group => {
    const groupEl = document.createElement('div');
    groupEl.className = 'chapter-group';

    const summary = document.createElement('button');
    summary.type = 'button';
    summary.className = 'chapter-group-summary';
    summary.setAttribute('aria-expanded', 'false');

    const groupLabel = document.createElement('span');
    groupLabel.className = 'chapter-group-label';
    groupLabel.textContent = group.label || `${group.start} - ${group.end}`;

    const groupMeta = document.createElement('span');
    groupMeta.className = 'chapter-group-meta';
    groupMeta.textContent = `${group.items.length} ตอน`;

    const chevron = document.createElement('span');
    chevron.className = 'chapter-group-chevron';
    chevron.setAttribute('aria-hidden', 'true');

    summary.appendChild(groupLabel);
    summary.appendChild(groupMeta);
    summary.appendChild(chevron);

    const groupList = document.createElement('div');
    groupList.className = 'chapter-group-list';
    groupList.hidden = true;
    group.items.forEach(item => groupList.appendChild(createChapterChip(item)));

    summary.addEventListener('click', () => {
      const isOpen = groupEl.classList.toggle('is-open');
      summary.setAttribute('aria-expanded', String(isOpen));
      groupList.hidden = !isOpen;
    });

    groupEl.appendChild(summary);
    groupEl.appendChild(groupList);
    listEl.appendChild(groupEl);
  });
}

function renderChapterPanel(m, platformKey) {
  const consoleEl = document.getElementById('chapter-console');
  const titleEl = document.getElementById('chapter-console-title');
  const sourceLink = document.getElementById('chapter-source-link');
  const orderButton = document.getElementById('chapter-order-toggle');
  const listEl = document.getElementById('chapter-list');
  const platform = PLATFORMS.find(p => p.key === platformKey);
  const sourceUrl = safeUrl(m.links?.[platformKey] || '');
  const chapters = platform ? getChaptersFor(m, platform.key) : [];

  if (!platform || sourceUrl === '#') {
    consoleEl.hidden = true;
    return;
  }

  consoleEl.hidden = false;
  titleEl.textContent = `${platform.label} / เลือกตอน`;
  sourceLink.href = sourceUrl;
  if (orderButton) {
    orderButton.hidden = !chapters.length;
    updateChapterOrderButton(orderButton);
    orderButton.onclick = () => {
      chapterNewestFirst = !chapterNewestFirst;
      renderChapterPanel(m, platformKey);
    };
  }
  listEl.innerHTML = '';
  listEl.classList.remove('chapter-list-grouped');

  if (!chapters.length) {
    const empty = document.createElement('div');
    empty.className = 'chapter-empty';
    empty.textContent = 'ยังไม่มีลิงก์ตอนของเว็บนี้';
    listEl.appendChild(empty);
    return;
  }

  renderChapterGroups(chapters, listEl, chapterNewestFirst);
}

function renderPlatformSelector(m) {
  const linksEl = document.getElementById('modal-links');
  linksEl.innerHTML = '';

  const available = PLATFORMS.filter(p => m.links?.[p.key]);
  if (!available.length) {
    document.getElementById('chapter-console').hidden = true;
    return;
  }

  const activePlatform =
    available.find(p => getChaptersFor(m, p.key).length)?.key ||
    available[0].key;

  available.forEach(p => {
    const chapters = getChaptersFor(m, p.key);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'modal-link-btn chapter-platform-btn';
    btn.dataset.platform = p.key;

    if (p.key === activePlatform) btn.classList.add('active');

    const img = document.createElement('img');
    img.src = `images/${p.icon}`;
    img.onerror = () => img.style.display = 'none';

    const label = document.createElement('span');
    label.textContent = p.label;

    btn.appendChild(img);
    btn.appendChild(label);

    btn.onclick = () => {
      setPlatformButtonState(p.key);
      renderChapterPanel(m, p.key);
    };

    linksEl.appendChild(btn);
  });

  renderChapterPanel(m, activePlatform);
}

function openModal(m, sourceEl = null) {
  lastFocused = document.activeElement;
  const modal = document.getElementById('modal');
  activeModalCard = sourceEl;
  spawnDetailEffect(sourceEl);
  if (m.image) setBg(m.image);

  document.getElementById('modal-img').src                       = m.image;
  document.getElementById('modal-bg-art').style.backgroundImage = `url('${m.image}')`;
  document.getElementById('modal-title').textContent            = m.title;
  document.getElementById('modal-status').textContent           = m.status || '—';
  document.getElementById('modal-chapter').textContent          = m.latest ? `ตอนล่าสุด ${m.latest}` : '';
  document.getElementById('modal-desc').textContent             = m.description || 'ไม่มีเรื่องย่อ';

  renderPlatformSelector(m);

  // Power Level — show/hide tab
  const powerEl  = document.getElementById('modal-power');
  const powerBtn = document.getElementById('tab-power-btn');
  const hasPower = m.powerLevel && m.powerLevel.trim();
  powerEl.innerHTML      = buildPowerLevel(m.powerLevel);
  powerBtn.style.display = hasPower ? '' : 'none';

  // Reset to detail tab
  switchModalTab('detail');

  modal.classList.add('open');
  document.body.classList.add('modal-open');
  document.body.style.overflow = 'hidden';
  document.getElementById('modal-close').focus();
  document.addEventListener('keydown', trapFocus);
}

function closeModal() {
  const modal = document.getElementById('modal');
  if (!modal.classList.contains('open') || closeAnimating) return;
  closeAnimating = true;
  spawnCloseEffect(activeModalCard);
  modal.classList.add('closing');
  setTimeout(() => {
    modal.classList.remove('open', 'closing');
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', trapFocus);
    clearBg(true);
    activeModalCard = null;
    closeAnimating = false;
    if (lastFocused) lastFocused.focus();
  }, 260);
}

document.getElementById('modal-close').onclick = closeModal;
document.getElementById('modal').onclick = e => {
  if (e.target === document.getElementById('modal')) closeModal();
};
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ==========================================================================
// Load Data
// ==========================================================================
const CACHE_KEY = 'si2_manga_v3';
const CACHE_TTL = 30 * 60 * 1000; // 30 นาที

function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* quota exceeded — ไม่ cache */ }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(CACHE_KEY); return null; }
    return data;
  } catch { localStorage.removeItem(CACHE_KEY); return null; }
}
function showGrid() {
  document.getElementById('skeleton-grid').style.display = 'none';
  document.getElementById('manga-grid').style.display    = 'grid';
  document.body.classList.add('data-ready');
}

async function load() {
  let hasRendered = false;
  await Promise.all([loadChapterLinks(), loadChapterRules()]);

  function showData(data) {
    allManga = data;
    showGrid();
    render(getFiltered());
    hasRendered = true;
  }

  const cached = loadCache();
  if (cached) {
    showData(cached);
    closeGatewayIntro();
  }

  try {
    const res   = await fetch(CSV_URL);
    if (!res.ok) throw new Error(`CSV request failed: ${res.status}`);
    const fresh = parseCSV(await res.text());
    if (JSON.stringify(fresh) !== JSON.stringify(allManga) || !hasRendered) {
      saveCache(fresh);
      showData(fresh);
    } else if (!hasRendered) {
      showData(allManga);
    }
    closeGatewayIntro();
  } catch (err) {
    console.warn('Fetch failed, using cache:', err);
    if (!hasRendered) {
      showGrid();
      document.getElementById('manga-grid').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">!</div>
          <div class="empty-text">โหลดข้อมูลไม่ได้ กรุณาลองใหม่</div>
        </div>`;
      hasRendered = true;
    }
    closeGatewayIntro();
  }
}

load();
