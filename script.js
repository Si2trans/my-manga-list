const DATA_URL = 'data/site-data.json';
const CACHE_KEY = 'si2trans.catalog.v2';
const CACHE_TTL = 5 * 60 * 1000;
const RECENT_LIMIT = 5;
const GROUP_SIZE = 50;

let siteData = { platforms: [], series: [] };
let allSeries = [];
let currentFilter = 'all';
let currentQuery = '';
let activeDrawerSeries = null;
let newestFirst = true;

const catalogEl = document.getElementById('catalog');
const searchEl = document.getElementById('search');
const resultCountEl = document.getElementById('result-count');
const bootEl = document.getElementById('boot');
const drawerEl = document.getElementById('drawer');
const drawerBackdropEl = document.getElementById('drawer-backdrop');
const drawerChaptersEl = document.getElementById('drawer-chapters');
const chapterOrderEl = document.getElementById('chapter-order');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url) {
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '#';
  } catch {
    return '#';
  }
}

function freshUrl(url) {
  const glue = url.includes('?') ? '&' : '?';
  return `${url}${glue}_=${Date.now()}`;
}

function platformById(id) {
  return siteData.platforms.find(platform => platform.id === id);
}

function chapterNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : -1;
}

function hasCoin(chapter) {
  return chapter.sources.some(source => source.access?.type === 'coin');
}

function chapterLabel(chapter, compact = false) {
  const no = chapterNumber(chapter.no);
  const text = compact ? String(no) : (chapter.label || `ตอนที่ ${no}`);
  return `${esc(text)}${hasCoin(chapter) ? '<span class="coin-dot" title="ติดเหรียญ"></span>' : ''}`;
}

function normalizeSeries(raw, order) {
  const chapters = Array.isArray(raw.chapters)
    ? raw.chapters
      .filter(chapter => Number.isFinite(Number(chapter.no)) && Array.isArray(chapter.sources))
      .map(chapter => ({
        ...chapter,
        no: Number(chapter.no),
        label: chapter.label || `ตอนที่ ${chapter.no}`,
        sources: chapter.sources
          .filter(source => source.platform && safeUrl(source.url) !== '#')
          .map(source => ({ ...source, url: safeUrl(source.url) }))
      }))
      .filter(chapter => chapter.sources.length)
      .sort((a, b) => chapterNumber(a.no) - chapterNumber(b.no))
    : [];

  return {
    id: raw.id || raw.slug || `series-${order}`,
    slug: raw.slug || raw.id || `series-${order}`,
    title: raw.title || '',
    image: raw.cover || raw.image || '',
    status: raw.status || '',
    description: raw.description || '',
    latest: raw.latest || (chapters.length ? String(chapters[chapters.length - 1].no) : ''),
    powerLevel: raw.powerLevel || '',
    sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : order,
    visible: raw.visible !== false,
    sources: Array.isArray(raw.sources)
      ? raw.sources
        .filter(source => source.visible !== false && safeUrl(source.url) !== '#')
        .map(source => ({ ...source, url: safeUrl(source.url) }))
      : [],
    chapters
  };
}

function normalizeData(raw) {
  siteData = {
    generatedAt: raw.generatedAt || '',
    platforms: Array.isArray(raw.platforms)
      ? raw.platforms
        .filter(platform => platform.visible !== false)
        .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
      : [],
    series: []
  };

  allSeries = Array.isArray(raw.series)
    ? raw.series.map(normalizeSeries).filter(series => series.visible)
    : [];
  siteData.series = allSeries;
}

function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // Cache is optional.
  }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.ts > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached.data;
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

function sourcePills(sources) {
  return sources.map(source => {
    const platform = platformById(source.platform);
    if (!platform) return '';
    return `
      <a class="source-pill" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">
        <img src="${esc(platform.icon)}" alt="" loading="lazy">
        <span>${esc(platform.label || platform.id)}</span>
      </a>
    `;
  }).join('');
}

function sourceChoices(chapter) {
  return chapter.sources.map(source => {
    const platform = platformById(source.platform);
    if (!platform) return '';
    const coin = source.access?.type === 'coin' ? ' ติดเหรียญ' : '';
    return `
      <a class="source-chip" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer" title="${esc((platform.label || platform.id) + coin)}">
        <img src="${esc(platform.icon)}" alt="${esc(platform.label || platform.id)}" loading="lazy">
      </a>
    `;
  }).join('');
}

function recentChapters(series) {
  return [...series.chapters]
    .sort((a, b) => chapterNumber(b.no) - chapterNumber(a.no))
    .slice(0, RECENT_LIMIT);
}

function createChapterSlot(chapter) {
  return `
    <div class="chapter-slot" data-chapter="${esc(chapter.no)}">
      <button class="chapter-btn" type="button" data-chapter-toggle>
        ${chapterLabel(chapter, true)}
      </button>
      <div class="source-choice-row">
        ${sourceChoices(chapter)}
      </div>
    </div>
  `;
}

function cardTemplate(series) {
  const chapters = recentChapters(series);
  return `
    <article class="manga-card" data-series-id="${esc(series.id)}">
      <a class="cover-link" href="#${esc(series.slug)}" data-open-details aria-label="ดูรายละเอียด ${esc(series.title)}">
        <img src="${esc(series.image)}" alt="${esc(series.title)}" loading="lazy">
      </a>

      <div class="card-main">
        <div class="card-top">
          <div class="meta-line">
            <span class="status-pill">${esc(series.status || 'อัปเดต')}</span>
            <span class="latest-pill">ตอนล่าสุด ${esc(series.latest || '-')}</span>
          </div>
        </div>

        <a class="title-link" href="#${esc(series.slug)}" data-open-details>
          <h2 class="card-title">${esc(series.title)}</h2>
        </a>

        <p class="card-desc">${esc(series.description || 'ไม่มีเรื่องย่อ')}</p>

        <div class="source-pills">
          ${sourcePills(series.sources)}
        </div>

        <div class="chapter-strip" aria-label="ตอนล่าสุดของ ${esc(series.title)}">
          ${chapters.map(createChapterSlot).join('')}
          <button class="all-btn" type="button" data-open-details>ทั้งหมด</button>
        </div>
      </div>
    </article>
  `;
}

function sortSeries(list) {
  return [...list].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.title.localeCompare(b.title, 'th');
  });
}

function filteredSeries() {
  const query = currentQuery.trim().toLowerCase();
  return sortSeries(allSeries.filter(series => {
    const filterOk = currentFilter === 'all'
      || series.status.includes(currentFilter)
      || (currentFilter === 'อัปเดต' && series.status.includes('อัป'));
    const queryOk = !query
      || series.title.toLowerCase().includes(query)
      || series.description.toLowerCase().includes(query);
    return filterOk && queryOk;
  }));
}

function updateStats(list) {
  const chapterCount = allSeries.reduce((sum, series) => sum + series.chapters.length, 0);
  document.getElementById('stat-series').textContent = String(allSeries.length);
  document.getElementById('stat-chapters').textContent = new Intl.NumberFormat('th-TH').format(chapterCount);
  resultCountEl.textContent = `${list.length} เรื่องที่แสดง`;
}

function bindCardEvents() {
  catalogEl.querySelectorAll('[data-chapter-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const slot = button.closest('.chapter-slot');
      const card = button.closest('.manga-card');
      if (!slot || !card) return;
      card.querySelectorAll('.chapter-slot.is-open').forEach(openSlot => {
        if (openSlot !== slot) openSlot.classList.remove('is-open');
        const openButton = openSlot.querySelector('[data-chapter-toggle]');
        if (openButton) openButton.classList.remove('is-open');
      });
      slot.classList.toggle('is-open');
      button.classList.toggle('is-open');
    });
  });

  catalogEl.querySelectorAll('[data-open-details]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      const card = button.closest('.manga-card');
      const series = allSeries.find(item => item.id === card?.dataset.seriesId);
      if (series) openDrawer(series);
    });
  });
}

function renderCatalog() {
  const list = filteredSeries();
  updateStats(list);
  catalogEl.innerHTML = list.length
    ? list.map(cardTemplate).join('')
    : '<div class="empty-state">ไม่พบเรื่องที่ตรงกับการค้นหา</div>';
  bindCardEvents();
}

function chapterGroups(series) {
  const chapters = [...series.chapters].sort((a, b) => (
    newestFirst
      ? chapterNumber(b.no) - chapterNumber(a.no)
      : chapterNumber(a.no) - chapterNumber(b.no)
  ));
  const groups = new Map();
  for (const chapter of chapters) {
    const no = chapterNumber(chapter.no);
    const start = Math.floor((no - 1) / GROUP_SIZE) * GROUP_SIZE + 1;
    const end = start + GROUP_SIZE - 1;
    const key = `${start}-${end}`;
    if (!groups.has(key)) groups.set(key, { start, end, items: [] });
    groups.get(key).items.push(chapter);
  }
  return [...groups.values()].sort((a, b) => newestFirst ? b.start - a.start : a.start - b.start);
}

function renderDrawerChapters(series) {
  const groups = chapterGroups(series);
  drawerChaptersEl.innerHTML = groups.length
    ? groups.map((group, index) => `
      <details class="chapter-group" ${index === 0 ? 'open' : ''}>
        <summary>
          <span>${group.start} - ${group.end}</span>
          <span>${group.items.length} ตอน</span>
        </summary>
        <div class="chapter-grid">
          ${group.items.map(createChapterSlot).join('')}
        </div>
      </details>
    `).join('')
    : '<div class="empty-state">ยังไม่มีลิงก์ตอนของเรื่องนี้</div>';

  drawerChaptersEl.querySelectorAll('[data-chapter-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const slot = button.closest('.chapter-slot');
      const group = button.closest('.chapter-group');
      if (!slot || !group) return;
      group.querySelectorAll('.chapter-slot.is-open').forEach(openSlot => {
        if (openSlot !== slot) openSlot.classList.remove('is-open');
        const openButton = openSlot.querySelector('[data-chapter-toggle]');
        if (openButton) openButton.classList.remove('is-open');
      });
      slot.classList.toggle('is-open');
      button.classList.toggle('is-open');
    });
  });
}

function openDrawer(series) {
  activeDrawerSeries = series;
  document.getElementById('drawer-cover').src = series.image;
  document.getElementById('drawer-cover').alt = series.title;
  document.getElementById('drawer-status').textContent = series.status || 'อัปเดต';
  document.getElementById('drawer-latest').textContent = series.latest ? `ตอนล่าสุด ${series.latest}` : 'ยังไม่มีตอน';
  document.getElementById('drawer-title').textContent = series.title;
  document.getElementById('drawer-desc').textContent = series.description || 'ไม่มีเรื่องย่อ';
  document.getElementById('drawer-sources').innerHTML = sourcePills(series.sources);
  renderDrawerChapters(series);
  drawerBackdropEl.hidden = false;
  drawerEl.classList.add('open');
  drawerEl.setAttribute('aria-hidden', 'false');
  document.body.classList.add('drawer-open');
  document.getElementById('drawer-close').focus();
}

function closeDrawer() {
  drawerEl.classList.remove('open');
  drawerEl.setAttribute('aria-hidden', 'true');
  drawerBackdropEl.hidden = true;
  document.body.classList.remove('drawer-open');
}

function closeBoot() {
  window.setTimeout(() => bootEl?.classList.add('is-done'), 260);
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

async function fetchData() {
  const cached = loadCache();
  if (cached) {
    normalizeData(cached);
    renderCatalog();
    closeBoot();
  }

  const response = await fetch(freshUrl(DATA_URL), { cache: 'no-store' });
  if (!response.ok) throw new Error(`โหลดข้อมูลไม่สำเร็จ (${response.status})`);
  const data = await response.json();
  saveCache(data);
  normalizeData(data);
  renderCatalog();
  closeBoot();
}

document.querySelectorAll('.segment').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.segment').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    currentFilter = button.dataset.filter || 'all';
    renderCatalog();
  });
});

searchEl.addEventListener('input', debounce(() => {
  currentQuery = searchEl.value;
  renderCatalog();
}, 120));

drawerBackdropEl.addEventListener('click', closeDrawer);
document.getElementById('drawer-close').addEventListener('click', closeDrawer);
chapterOrderEl.addEventListener('click', () => {
  newestFirst = !newestFirst;
  chapterOrderEl.textContent = newestFirst ? 'ตอนล่าสุดก่อน' : 'ตอนแรกก่อน';
  if (activeDrawerSeries) renderDrawerChapters(activeDrawerSeries);
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && drawerEl.classList.contains('open')) closeDrawer();
});

fetchData().catch(error => {
  console.error(error);
  catalogEl.innerHTML = `<div class="empty-state">${esc(error.message || 'โหลดข้อมูลไม่สำเร็จ')}</div>`;
  resultCountEl.textContent = 'เกิดข้อผิดพลาด';
  closeBoot();
});
