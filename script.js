// ==========================================================================
// Config
// ==========================================================================
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTuttLSBMLwU8wOzRfijsjaq6ZN6nqxNfydiqEGDSRf6ezdmkNz6dz1hpUxYURoBaOW1LbiMBmhQe8D/pub?output=csv';

let allManga      = [];
let currentFilter = 'all';
let bgTimeout;

// ==========================================================================
// Utility
// ==========================================================================
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
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
// CSV Parser
// คอลัมน์: title, image, status, description, latest,
//          mynovel, readrealm, readtoon, powerLevel
// powerLevel ใช้ | คั่นแต่ละระดับ เช่น "หลอมเอ็น|หล่อกระดูก|เปลี่ยนโลหิต"
// ==========================================================================
function parseCSV(text) {
  return text.split('\n').slice(1).filter(l => l.trim()).map(line => {
    const v = line.split(',');
    return {
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
      // v[8]: ระดับพลัง คั่นด้วย | เช่น "หลอมเอ็น|หล่อกระดูก|ห้วงจิตวิญญาณ"
      powerLevel: v[8]?.trim() || '',
    };
  });
}

// ==========================================================================
// Ribbon
// ==========================================================================
function getRibbonClass(status) {
  if (!status) return '';
  if (status.includes('จบ'))     return 'ribbon-end';
  if (status.includes('อัปเดต')) return 'ribbon-updating';
  if (status.includes('ใหม่'))   return 'ribbon-new';
  if (status.includes('หยุด'))   return 'ribbon-hiatus';
  return '';
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

function clearBg() {
  bgBlur.classList.remove('visible');
  currentBg = '';
}

// ==========================================================================
// Render Grid
// ==========================================================================
function render(list) {
  const grid    = document.getElementById('manga-grid');
  const countEl = document.getElementById('grid-count');
  countEl.textContent = `${list.length} รายการ`;
  grid.innerHTML = '';

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-text">ไม่พบมังงะที่ค้นหา</div>
      </div>`;
    return;
  }

  list.forEach((m, i) => {
    const card = document.createElement('div');
    card.className = 'manga-card';
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
        ${m.latest ? `<div class="card-latest">${esc(m.latest)}</div>` : ''}
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

    card.onclick = () => openModal(m);
    grid.appendChild(card);
  });
}

// ==========================================================================
// Filter & Search
// ==========================================================================
function getFiltered() {
  const term = document.getElementById('search').value.toLowerCase().trim();
  return allManga.filter(m => {
    const matchSearch = !term || m.title.toLowerCase().includes(term);
    const matchFilter = currentFilter === 'all' || m.status.includes(currentFilter);
    return matchSearch && matchFilter;
  });
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

function openModal(m) {
  document.getElementById('modal-img').src                       = m.image;
  document.getElementById('modal-bg-art').style.backgroundImage = `url('${m.image}')`;
  document.getElementById('modal-title').textContent            = m.title;
  document.getElementById('modal-status').textContent           = m.status || '—';
  document.getElementById('modal-chapter').textContent          = m.latest ? `📖 ${m.latest}` : '';
  document.getElementById('modal-desc').textContent             = m.description || 'ไม่มีเรื่องย่อ';

  // Links
  const linksEl = document.getElementById('modal-links');
  linksEl.innerHTML = '';
  const platforms = [
    { key: 'mynovel',   label: 'MYNOVEL',   icon: 'icon-mynovel.png'   },
    { key: 'readrealm', label: 'ReadRealm', icon: 'icon-readrealm.png' },
    { key: 'readtoon',  label: 'ReadToon',  icon: 'icon-readtoon.png'  },
  ];
  platforms.forEach(p => {
    const url = m.links[p.key];
    if (!url) return;
    const a = document.createElement('a');
    a.href = safeUrl(url);
    a.target = '_blank';
    a.className = 'modal-link-btn';
    const img = document.createElement('img');
    img.src = `images/${p.icon}`;
    img.onerror = () => img.style.display = 'none';
    a.appendChild(img);
    a.appendChild(document.createTextNode(p.label));
    linksEl.appendChild(a);
  });

  // Power Level — show/hide tab
  const powerEl  = document.getElementById('modal-power');
  const powerBtn = document.getElementById('tab-power-btn');
  const hasPower = m.powerLevel && m.powerLevel.trim();
  powerEl.innerHTML      = buildPowerLevel(m.powerLevel);
  powerBtn.style.display = hasPower ? '' : 'none';

  // Reset to detail tab
  switchModalTab('detail');

  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('modal-close').onclick = closeModal;
document.getElementById('modal').onclick = e => {
  if (e.target === document.getElementById('modal')) closeModal();
};
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ==========================================================================
// Load Data
// ==========================================================================
function showGrid() {
  document.getElementById('skeleton-grid').style.display = 'none';
  document.getElementById('manga-grid').style.display    = 'grid';
}

async function load() {
  try {
    const cached = localStorage.getItem('si2_manga_v3');
    if (cached) {
      allManga = JSON.parse(cached);
      showGrid(); render(allManga);
    }
  } catch { localStorage.removeItem('si2_manga_v3'); }

  try {
    const res   = await fetch(CSV_URL);
    const fresh = parseCSV(await res.text());
    if (JSON.stringify(fresh) !== JSON.stringify(allManga)) {
      allManga = fresh;
      localStorage.setItem('si2_manga_v3', JSON.stringify(allManga));
      showGrid(); render(allManga);
    }
  } catch (err) {
    console.warn('Fetch failed, using cache:', err);
    if (!allManga.length) {
      showGrid();
      document.getElementById('manga-grid').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div class="empty-text">โหลดข้อมูลไม่ได้ กรุณาลองใหม่</div>
        </div>`;
    }
  }
}

load();
