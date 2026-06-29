// ==========================================================================
// Config
// ==========================================================================
const DATA_URL = 'data/site-data.json';

let siteData = { platforms: [], series: [] };
let allManga = [];
let currentFilter = 'all';
let bgTimeout;
let gatewayClosed = false;
let activeModalCard = null;
let closeAnimating = false;
let selectedChapter = null;

const GATEWAY_MIN_MS = 900;
const gatewayStartedAt = Date.now();
const CHAPTER_GROUP_SIZE = 50;
const CACHE_KEY = 'si2_site_data_v1';
const CACHE_TTL = 5 * 60 * 1000;
let chapterNewestFirst = true;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)');

function shouldUseHeavyEffects() {
  return !prefersReducedMotion.matches && !coarsePointer.matches;
}

function shouldUseModalEffects() {
  return !prefersReducedMotion.matches;
}

// ==========================================================================
// Utility
// ==========================================================================
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function freshUrl(url) {
  const glue = String(url).includes('?') ? '&' : '?';
  return `${url}${glue}_=${Date.now()}`;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function safeUrl(url) {
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '#';
  } catch {
    return '#';
  }
}

function platformById(platformId) {
  return siteData.platforms.find(platform => platform.id === platformId);
}

function chapterNo(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : -1;
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

// ==========================================================================
// Background
// ==========================================================================
function setBg(image) {
  const bg = document.getElementById('bg-blur');
  if (!bg || !image) return;
  bg.style.backgroundImage = `url('${image}')`;
  bg.classList.add('visible');
}

function clearBg(force = false) {
  const bg = document.getElementById('bg-blur');
  if (!bg) return;
  if (force) clearTimeout(bgTimeout);
  bg.classList.remove('visible');
}

// ==========================================================================
// Data
// ==========================================================================
function normalizeSeries(raw, order) {
  const chapters = Array.isArray(raw.chapters)
    ? raw.chapters
      .filter(chapter => Number.isFinite(Number(chapter.no)) && Array.isArray(chapter.sources) && chapter.sources.length)
      .map(chapter => ({
        ...chapter,
        no: Number(chapter.no),
        label: chapter.label || `ตอนที่ ${chapter.no}`,
        sources: chapter.sources
          .filter(source => source.platform && safeUrl(source.url) !== '#')
          .map(source => ({ ...source, url: safeUrl(source.url) }))
      }))
      .filter(chapter => chapter.sources.length)
      .sort((a, b) => a.no - b.no)
    : [];

  const latest = raw.latest || (chapters.length ? String(chapters[chapters.length - 1].no) : '');

  return {
    id: raw.id || raw.slug || raw.title || `series-${order}`,
    slug: raw.slug || raw.id || `series-${order}`,
    title: raw.title || '',
    image: raw.cover || raw.image || '',
    status: raw.status || '',
    description: raw.description || '',
    latest,
    powerLevel: raw.powerLevel || '',
    sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : order,
    visible: raw.visible !== false,
    sources: Array.isArray(raw.sources) ? raw.sources.filter(source => source.visible !== false) : [],
    chapters,
    order
  };
}

function normalizeData(raw) {
  siteData = {
    schemaVersion: raw.schemaVersion || 1,
    generatedAt: raw.generatedAt || '',
    platforms: Array.isArray(raw.platforms)
      ? raw.platforms
        .filter(platform => platform.visible !== false)
        .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
      : [],
    series: []
  };

  allManga = Array.isArray(raw.series)
    ? raw.series.map(normalizeSeries).filter(series => series.visible)
    : [];
  siteData.series = allManga;
}

function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // Ignore cache quota errors.
  }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

// ==========================================================================
// Rendering
// ==========================================================================
function sortMangaList(list) {
  return [...list].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.title.localeCompare(b.title, 'th');
  });
}

function getRibbonClass(status) {
  if (!status) return '';
  if (status.includes('จบ')) return 'ribbon-end';
  if (status.includes('อัปเดต')) return 'ribbon-updating';
  if (status.includes('ใหม่')) return 'ribbon-new';
  if (status.includes('หยุด')) return 'ribbon-pause';
  return '';
}

function showGrid() {
  document.getElementById('skeleton-grid').style.display = 'none';
  document.getElementById('manga-grid').style.display = 'grid';
  document.body.classList.add('data-ready');
}

function render(list) {
  const grid = document.getElementById('manga-grid');
  const countEl = document.getElementById('grid-count');
  countEl.textContent = `${list.length} เรื่อง`;
  grid.replaceChildren();

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">!</div>
        <div class="empty-text">ไม่พบมังงะที่ค้นหา</div>
      </div>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  list.forEach((manga, index) => {
    const card = document.createElement('div');
    card.className = 'manga-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', manga.title);
    card.style.animationDelay = `${Math.min(index * 0.03, 0.5)}s`;

    const ribbonClass = getRibbonClass(manga.status);
    const ribbon = ribbonClass ? `<div class="ribbon ${ribbonClass}">${esc(manga.status)}</div>` : '';

    card.innerHTML = `
      <div class="card-thumb">
        ${ribbon}
        <img src="${esc(manga.image)}" alt="${esc(manga.title)}" loading="lazy" decoding="async">
        <div class="card-overlay">
          <div class="card-overlay-desc">${esc(manga.description)}</div>
        </div>
      </div>
      <div class="card-info">
        <div class="card-title">${esc(manga.title)}</div>
        <div class="entry-meta-row">
          ${manga.latest ? `<div class="card-latest">ตอนล่าสุด ${esc(manga.latest)}</div>` : '<div class="card-latest">ไม่ระบุตอน</div>'}
        </div>
      </div>
    `;

    if (shouldUseHeavyEffects()) {
      card.addEventListener('mouseenter', () => {
        clearTimeout(bgTimeout);
        if (manga.image) setBg(manga.image);
      });
      card.addEventListener('mouseleave', () => {
        bgTimeout = setTimeout(clearBg, 300);
      });
    }

    card.onclick = () => openModal(manga, card);
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openModal(manga, card);
      }
    });
    fragment.appendChild(card);
  });

  grid.appendChild(fragment);
}

function getFiltered() {
  const term = document.getElementById('search').value.toLowerCase().trim();
  return sortMangaList(allManga.filter(manga => {
    const matchSearch = !term || manga.title.toLowerCase().includes(term);
    const matchFilter = currentFilter === 'all' || manga.status.includes(currentFilter);
    return matchSearch && matchFilter;
  }));
}

function update() {
  render(getFiltered());
}

// ==========================================================================
// Modal
// ==========================================================================
function buildPowerLevel(raw) {
  if (!raw) return '';

  const segments = String(raw).split('|').map(level => level.trim()).filter(Boolean);
  if (!segments.length) return '';

  let currentPower = null;
  let levels = segments;
  const currentMarkerIndex = segments[0].indexOf('>>');

  if (currentMarkerIndex > -1) {
    const rawCurrentValue = segments[0].slice(currentMarkerIndex + 2).trim();
    const currentCategoryIndex = rawCurrentValue.indexOf(':');
    currentPower = {
      label: segments[0].slice(0, currentMarkerIndex).trim(),
      category: currentCategoryIndex > -1 ? rawCurrentValue.slice(0, currentCategoryIndex).trim() : '',
      value: currentCategoryIndex > -1 ? rawCurrentValue.slice(currentCategoryIndex + 1).trim() : rawCurrentValue
    };
    levels = segments.slice(1);
  }

  if (!levels.length && !currentPower) return '';
  const currentCategory = currentPower?.category || '';
  const levelGroups = buildPowerLevelGroups(levels, currentCategory);

  return `
    <div class="power-section">
      ${currentPower ? `
        <div class="power-current-card">
          <span class="power-current-label">${esc(currentPower.label || 'ระดับพลังปัจจุบัน')}</span>
          <span class="power-current-value">${esc(currentPower.value || '-')}</span>
        </div>
      ` : ''}
      ${renderPowerLevelGroups(levelGroups)}
    </div>`;
}

function buildPowerLevelGroups(levels, initialCategory = '') {
  const groups = [];
  let currentGroup = { name: initialCategory, levels: [] };

  const pushCurrentGroup = () => {
    if (currentGroup.name || currentGroup.levels.length) groups.push(currentGroup);
  };

  levels.flatMap(level => String(level).split(';').map(part => part.trim()).filter(Boolean))
    .forEach(level => {
      const categoryIndex = level.indexOf(':');
      if (categoryIndex > -1) {
        pushCurrentGroup();
        currentGroup = {
          name: level.slice(0, categoryIndex).trim(),
          levels: []
        };
        const firstLevel = level.slice(categoryIndex + 1).trim();
        if (firstLevel) currentGroup.levels.push(firstLevel);
        return;
      }

      currentGroup.levels.push(level);
    });

  pushCurrentGroup();
  return groups.filter(group => group.levels.length);
}

function renderPowerList(levels) {
  if (!levels.length) return '';
  return `
    <div class="power-list">
      ${levels.map((level, index) => `
      <div class="power-item">
        <span class="power-num">${String(index + 1).padStart(2, '0')}</span>
        <span class="power-name">${esc(level)}</span>
      </div>
      `).join('')}
    </div>
  `;
}

function renderPowerLevelGroups(groups) {
  if (!groups.length) return '';

  const shouldGroup = groups.length > 1 || groups.some(group => group.name);
  if (!shouldGroup) return renderPowerList(groups[0].levels);

  return `
    <div class="power-categories">
      ${groups.map(group => `
        <section class="power-category">
          ${group.name ? `<div class="power-cat-header">${esc(group.name)}</div>` : ''}
          ${renderPowerList(group.levels)}
        </section>
      `).join('')}
    </div>
  `;
}

function switchModalTab(tabName) {
  document.querySelectorAll('.mtab').forEach(button => button.classList.toggle('active', button.dataset.tab === tabName));
  document.getElementById('tab-detail').style.display = tabName === 'detail' ? '' : 'none';
  document.getElementById('tab-power').style.display = tabName === 'power' ? '' : 'none';
}

let lastFocused = null;

function trapFocus(event) {
  const modal = document.getElementById('modal');
  const focusable = modal.querySelectorAll(
    'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.key !== 'Tab' || !first || !last) return;

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function spawnDetailEffect(sourceEl) {
  if (!shouldUseModalEffects() || !sourceEl) return;

  const rect = sourceEl.getBoundingClientRect();
  const ghost = sourceEl.cloneNode(true);
  ghost.classList.add('morph-ghost');
  ghost.removeAttribute('role');
  ghost.removeAttribute('tabindex');
  Object.assign(ghost.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`
  });
  document.body.appendChild(ghost);

  const targetW = Math.min(window.innerWidth - 40, 560);
  const targetH = Math.min(window.innerHeight - 72, 650);
  const targetL = (window.innerWidth - targetW) / 2;
  const targetT = (window.innerHeight - targetH) / 2;
  const heavy = shouldUseHeavyEffects();

  ghost.animate([
    { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, opacity: heavy ? 0.78 : 0.58, filter: 'blur(0px)' },
    { left: `${targetL}px`, top: `${targetT}px`, width: `${targetW}px`, height: `${targetH}px`, opacity: 0, filter: heavy ? 'blur(9px)' : 'blur(0px)' }
  ], { duration: heavy ? 520 : 320, easing: 'cubic-bezier(.2,.8,.15,1)', fill: 'forwards' });

  setTimeout(() => ghost.remove(), heavy ? 560 : 360);
}

function spawnCloseEffect(targetEl) {
  if (!shouldUseModalEffects()) return;
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
    height: `${start.height}px`
  });
  document.body.appendChild(ghost);

  const heavy = shouldUseHeavyEffects();
  ghost.animate([
    { left: `${start.left}px`, top: `${start.top}px`, width: `${start.width}px`, height: `${start.height}px`, opacity: heavy ? 0.9 : 0.62, filter: 'blur(0px)' },
    { left: `${end.left}px`, top: `${end.top}px`, width: `${end.width}px`, height: `${end.height}px`, opacity: 0, filter: heavy ? 'blur(8px)' : 'blur(0px)' }
  ], { duration: heavy ? 420 : 280, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });

  setTimeout(() => ghost.remove(), heavy ? 470 : 320);
}

function sortChaptersByOrder(chapters, newestFirst) {
  return [...chapters].sort((a, b) => newestFirst ? chapterNo(b.no) - chapterNo(a.no) : chapterNo(a.no) - chapterNo(b.no));
}

function groupChaptersByRange(chapters, newestFirst) {
  const groups = new Map();
  const maxChapterNo = chapters.length ? Math.max(...chapters.map(chapter => chapterNo(chapter.no))) : 0;

  chapters.forEach(chapter => {
    const no = chapterNo(chapter.no);
    if (no < 1) return;
    const start = Math.floor((Math.floor(no) - 1) / CHAPTER_GROUP_SIZE) * CHAPTER_GROUP_SIZE + 1;
    const end = Math.min(start + CHAPTER_GROUP_SIZE - 1, maxChapterNo);
    if (!groups.has(start)) groups.set(start, { start, end, items: [] });
    groups.get(start).items.push(chapter);
  });

  const sorted = [...groups.values()].sort((a, b) => newestFirst ? b.start - a.start : a.start - b.start);
  sorted.forEach(group => {
    group.items = sortChaptersByOrder(group.items, newestFirst);
  });
  return sorted;
}

function updateChapterOrderButton(button) {
  if (!button) return;
  const label = button.querySelector('#chapter-order-label');
  const text = chapterNewestFirst ? 'ตอนแรกสุด' : 'ตอนล่าสุด';
  button.classList.toggle('is-newest-first', chapterNewestFirst);
  button.setAttribute('aria-label', `สลับไป${text}`);
  if (label) label.textContent = text;
}

function sourceCoinIcon(source) {
  return source.access?.type === 'coin' ? '<span class="chapter-source-coin" title="ติดเหรียญ">◉</span>' : '';
}

function chapterCoinIcon(chapter) {
  return chapter.sources.some(source => source.access?.type === 'coin')
    ? '<span class="chapter-source-coin" title="ติดเหรียญ">◉</span>'
    : '';
}

function createPlatformButton(source, compact = false) {
  const platform = platformById(source.platform) || { id: source.platform, label: source.platform, icon: '' };
  const a = document.createElement('a');
  a.className = compact ? 'source-choice source-choice-compact' : 'source-choice';
  a.href = safeUrl(source.url);
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.dataset.platform = platform.id;
  a.title = platform.label;
  a.setAttribute('aria-label', platform.label);

  const icon = platform.icon ? `<img src="${esc(platform.icon)}" alt="" onerror="this.style.display='none'">` : '';
  a.innerHTML = `
    ${icon}
    <span>${esc(platform.label)}</span>
  `;
  return a;
}

function getSeriesSources(manga) {
  return (Array.isArray(manga.sources) ? manga.sources : [])
    .filter(source => source.visible !== false && safeUrl(source.url) !== '#')
    .sort((a, b) => (platformById(a.platform)?.sortOrder || 0) - (platformById(b.platform)?.sortOrder || 0));
}

function createSeriesSourceChoiceList(sources) {
  const choices = document.createElement('div');
  choices.className = 'source-choice-list series-source-choices';
  sources.forEach(source => choices.appendChild(createPlatformButton(source)));
  return choices;
}

function createSourceChoiceList(chapter) {
  const choices = document.createElement('div');
  choices.className = 'source-choice-list chapter-source-choices';
  chapter.sources
    .slice()
    .sort((a, b) => (platformById(a.platform)?.sortOrder || 0) - (platformById(b.platform)?.sortOrder || 0))
    .forEach(source => choices.appendChild(createPlatformButton(source, true)));

  return choices;
}

function selectChapter(chapter, entryEl) {
  selectedChapter = chapter;
  document.querySelectorAll('.chapter-chip').forEach(button => {
    button.classList.toggle('active', Number(button.dataset.chapterNo) === Number(chapter.no));
  });
  document.querySelectorAll('.chapter-entry').forEach(entry => {
    const isActive = entry === entryEl;
    entry.classList.toggle('is-selected', isActive);
    const picker = entry.querySelector('.chapter-inline-sources');
    if (picker) picker.hidden = !isActive;
  });

  const picker = entryEl.querySelector('.chapter-inline-sources');
  if (!picker) return;
  picker.innerHTML = '';
  picker.appendChild(createSourceChoiceList(chapter));
}

function createChapterChip(chapter) {
  const entry = document.createElement('div');
  entry.className = 'chapter-entry';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chapter-chip';
  button.dataset.chapterNo = String(chapter.no);

  const label = document.createElement('span');
  label.className = 'chapter-label';
  label.innerHTML = `${esc(chapter.label || `ตอนที่ ${chapter.no}`)}${chapterCoinIcon(chapter)}`;
  button.appendChild(label);

  const picker = document.createElement('div');
  picker.className = 'chapter-inline-sources';
  picker.hidden = true;

  button.onclick = () => selectChapter(chapter, entry);
  entry.appendChild(button);
  entry.appendChild(picker);
  return entry;
}

function renderChapterGroups(chapters, listEl, newestFirst = false) {
  const orderedChapters = sortChaptersByOrder(chapters, newestFirst);
  const groups = groupChaptersByRange(orderedChapters, newestFirst);
  listEl.classList.toggle('chapter-list-grouped', groups.length > 0);

  groups.forEach((group, index) => {
    const isFirstGroup = index === 0;
    const groupEl = document.createElement('div');
    groupEl.className = 'chapter-group';
    if (isFirstGroup) groupEl.classList.add('is-open');

    const summary = document.createElement('button');
    summary.type = 'button';
    summary.className = 'chapter-group-summary';
    summary.setAttribute('aria-expanded', String(isFirstGroup));

    const groupLabel = document.createElement('span');
    groupLabel.className = 'chapter-group-label';
    groupLabel.textContent = `${group.start} - ${group.end}`;

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
    groupList.hidden = !isFirstGroup;
    group.items.forEach(chapter => groupList.appendChild(createChapterChip(chapter)));

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

function renderChapterPanel(manga) {
  const consoleEl = document.getElementById('chapter-console');
  const titleEl = document.getElementById('chapter-console-title');
  const sourceLink = document.getElementById('chapter-source-link');
  const orderButton = document.getElementById('chapter-order-toggle');
  const listEl = document.getElementById('chapter-list');
  const linksEl = document.getElementById('modal-links');
  const seriesSources = getSeriesSources(manga);

  selectedChapter = null;
  listEl.innerHTML = '';
  linksEl.innerHTML = '';
  linksEl.hidden = true;
  if (linksEl.previousElementSibling) linksEl.previousElementSibling.hidden = true;
  listEl.classList.remove('chapter-list-grouped');

  if (!manga.chapters.length) {
    consoleEl.hidden = true;
    linksEl.innerHTML = '<div class="source-picker-empty">ยังไม่มีลิงก์ตอนของเรื่องนี้</div>';
    linksEl.hidden = false;
    if (linksEl.previousElementSibling) linksEl.previousElementSibling.hidden = false;
    return;
  }

  consoleEl.hidden = false;
  titleEl.textContent = 'เลือกตอน';
  sourceLink.href = seriesSources[0]?.url ? safeUrl(seriesSources[0].url) : '#';
  sourceLink.textContent = 'หน้าเรื่อง';
  sourceLink.setAttribute('aria-expanded', 'false');
  sourceLink.classList.toggle('has-source-picker', seriesSources.length > 1);
  sourceLink.onclick = event => {
    if (seriesSources.length <= 1) return;

    event.preventDefault();
    const willOpen = linksEl.hidden;
    linksEl.innerHTML = '';
    if (willOpen) linksEl.appendChild(createSeriesSourceChoiceList(seriesSources));
    linksEl.hidden = !willOpen;
    if (linksEl.previousElementSibling) linksEl.previousElementSibling.hidden = !willOpen;
    sourceLink.setAttribute('aria-expanded', String(willOpen));
  };

  if (orderButton) {
    orderButton.hidden = !manga.chapters.length;
    updateChapterOrderButton(orderButton);
    orderButton.onclick = () => {
      chapterNewestFirst = !chapterNewestFirst;
      renderChapterPanel(manga);
    };
  }

  renderChapterGroups(manga.chapters, listEl, chapterNewestFirst);
}

function openModal(manga, sourceEl = null) {
  lastFocused = document.activeElement;
  const modal = document.getElementById('modal');
  activeModalCard = sourceEl;
  spawnDetailEffect(sourceEl);
  if (manga.image) setBg(manga.image);

  document.getElementById('modal-img').src = manga.image;
  document.getElementById('modal-bg-art').style.backgroundImage = `url('${manga.image}')`;
  document.getElementById('modal-title').textContent = manga.title;
  document.getElementById('modal-status').textContent = manga.status || '-';
  document.getElementById('modal-chapter').textContent = manga.latest ? `ตอนล่าสุด ${manga.latest}` : '';
  document.getElementById('modal-desc').textContent = manga.description || 'ไม่มีเรื่องย่อ';

  renderChapterPanel(manga);

  const powerEl = document.getElementById('modal-power');
  const powerBtn = document.getElementById('tab-power-btn');
  const hasPower = manga.powerLevel && manga.powerLevel.trim();
  powerEl.innerHTML = buildPowerLevel(manga.powerLevel);
  powerBtn.style.display = hasPower ? '' : 'none';

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
    selectedChapter = null;
    if (lastFocused) lastFocused.focus();
  }, 260);
}

// ==========================================================================
// Events
// ==========================================================================
document.querySelectorAll('.ftab').forEach(button => {
  button.onclick = () => {
    document.querySelectorAll('.ftab').forEach(tab => tab.classList.remove('active'));
    button.classList.add('active');
    currentFilter = button.dataset.filter;
    update();
  };
});

document.querySelectorAll('.mtab').forEach(button => {
  button.onclick = () => switchModalTab(button.dataset.tab);
});

const searchInput = document.getElementById('search');
const clearBtn = document.getElementById('search-clear');

searchInput.addEventListener('input', debounce(() => {
  clearBtn.style.display = searchInput.value ? 'block' : 'none';
  update();
}, 280));

clearBtn.onclick = () => {
  searchInput.value = '';
  clearBtn.style.display = 'none';
  update();
};

document.getElementById('modal-close').onclick = closeModal;
document.getElementById('modal').onclick = event => {
  if (event.target === document.getElementById('modal')) closeModal();
};
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeModal();
});

// ==========================================================================
// Load
// ==========================================================================
async function load() {
  let rendered = false;

  function showData(data) {
    normalizeData(data);
    showGrid();
    render(getFiltered());
    rendered = true;
  }

  const cached = loadCache();
  if (cached) {
    showData(cached);
    closeGatewayIntro();
  }

  try {
    const res = await fetch(freshUrl(DATA_URL), { cache: 'no-store' });
    if (!res.ok) throw new Error(`Data request failed: ${res.status}`);
    const fresh = await res.json();
    saveCache(fresh);
    showData(fresh);
    closeGatewayIntro();
  } catch (error) {
    console.warn('Fetch failed, using cache:', error);
    if (!rendered) {
      showGrid();
      document.getElementById('manga-grid').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">!</div>
          <div class="empty-text">โหลดข้อมูลไม่ได้ กรุณาลองใหม่</div>
        </div>`;
      rendered = true;
    }
    closeGatewayIntro();
  }
}

load();
