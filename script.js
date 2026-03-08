// 1. แสง Spotlight
const body = document.querySelector('body');
body.addEventListener('mousemove', (e) => {
    body.style.setProperty('--x', e.clientX + 'px');
    body.style.setProperty('--y', e.clientY + 'px');
});

const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTuttLSBMLwU8wOzRfijsjaq6ZN6nqxNfydiqEGDSRf6ezdmkNz6dz1hpUxYURoBaOW1LbiMBmhQe8D/pub?output=csv';
let allManga = []; 

function debounce(func, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// 2. โหลดข้อมูล
async function loadMangaData() {
    // 1. ดึงข้อมูลจาก LocalStorage มาโชว์ทันทีที่เปิดเว็บ (ถ้ามี)
    const cachedData = localStorage.getItem('manga_data');
    if (cachedData) {
        allManga = JSON.parse(cachedData);
        // ซ่อน Skeleton ทันที เพราะมีข้อมูลเก่าโชว์แล้ว
        document.getElementById('skeleton-loader').style.display = 'none';
        renderManga(allManga);
    }

    // 2. ดึงข้อมูลใหม่จาก Google Sheets แบบเบื้องหลัง (Background Fetch)
    try {
        const response = await fetch(csvUrl);
        const data = await response.text();
        const lines = data.split('\n');
        
        const freshManga = lines.slice(1).filter(line => line.trim() !== "").map(line => {
            const v = line.split(',');
            return {
                title: v[0] || '', image: v[1] || '', status: v[2] || '', 
                description: v[3] || '', latest: v[4] || '',
                links: { mynovel: v[5], readrealm: v[6], readtoon: v[7] }
            };
        });

        // 3. ถ้าข้อมูลใหม่ไม่เหมือนกับที่เคยเก็บไว้ ให้บันทึกทับและ Render ใหม่
        if (JSON.stringify(freshManga) !== JSON.stringify(allManga)) {
            allManga = freshManga;
            localStorage.setItem('manga_data', JSON.stringify(allManga));
            
            // ถ้า Skeleton ยังโชว์อยู่ (กรณีตอนแรกไม่มี Cache) ให้ซ่อน
            document.getElementById('skeleton-loader').style.display = 'none';
            renderManga(allManga);
        }
    } catch (error) {
        console.error("อัปเดตข้อมูลไม่ได้ แต่ไม่เป็นไร ใช้ Cache เดิมไป:", error);
    }
}

// 3. Render การ์ด
function renderManga(mangaList) {
    const container = document.getElementById('manga-list');
    container.innerHTML = ''; 
    
    mangaList.forEach((manga) => {
        const item = document.createElement('div');
        item.className = 'manga-item';
        
        // สร้าง Card ด้านใน
        const card = document.createElement('div');
        card.className = 'manga-card';
        
        // ใส่ Ribbon ถ้ามีสถานะ
        if (manga.status) {
            const ribbon = document.createElement('div');
            let ribbonClass = 'ribbon';
            if (manga.status.includes('จบ')) ribbonClass += ' ribbon-end';
            else if (manga.status.includes('อัปเดต')) ribbonClass += ' ribbon-updating';
            // ... เพิ่มเงื่อนไขอื่นๆ
            ribbon.className = ribbonClass;
            ribbon.textContent = manga.status; // ใช้ textContent ปลอดภัยที่สุด
            card.appendChild(ribbon);
        }

        // ใส่รูปภาพ
        const img = document.createElement('img');
        img.src = manga.image;
        img.alt = manga.title;
        img.loading = 'lazy';
        card.appendChild(img);

        // ใส่ชื่อเรื่อง
        const titleEl = document.createElement('div');
        titleEl.className = 'manga-title';
        titleEl.textContent = manga.title; // ตรงนี้แหละครับหัวใจสำคัญ!

        item.appendChild(card);
        item.appendChild(titleEl);
        
        item.onclick = () => openMangaModal(manga);
        container.appendChild(item);
    });
}

// 4. Modal (รับ Object manga โดยตรง)
function openMangaModal(manga) {
    const modal = document.getElementById('manga-modal');
    document.getElementById('modal-img').src = manga.image;
    document.getElementById('modal-title').innerText = manga.title;
    
    // --- เพิ่มส่วนนี้เข้าไปครับ ---
    const descEl = document.getElementById('modal-description');
    descEl.textContent = manga.description || 'ไม่มีเรื่องย่อ...';
    // --------------------------

    const statusEl = document.getElementById('modal-status');
    statusEl.textContent = manga.status || 'ยังไม่ระบุ'; 
    const latestSpan = document.createElement('span');
    latestSpan.style.color = '#00d2ff';
    latestSpan.style.marginLeft = '8px';
    latestSpan.textContent = `| ${manga.latest || ''}`;
    statusEl.appendChild(latestSpan);

    const linksContainer = document.getElementById('modal-links');
    linksContainer.innerHTML = '';
    if (manga.links.mynovel?.trim()) linksContainer.appendChild(createModalBtn(manga.links.mynovel, 'MYNOVEL', 'link-blue', 'icon-mynovel.png'));
    if (manga.links.readrealm?.trim()) linksContainer.appendChild(createModalBtn(manga.links.readrealm, 'ReadRealm', 'link-purple', 'icon-readrealm.png'));
    if (manga.links.readtoon?.trim()) linksContainer.appendChild(createModalBtn(manga.links.readtoon, 'ReadToon', 'link-light-purple', 'icon-readtoon.png'));

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function createModalBtn(url, name, className, icon) {
    const a = document.createElement('a');
    const cleanUrl = url.trim();
    
    // ป้องกันกรณีใส่ javascript: เข้ามาในลิงก์
    if (cleanUrl.startsWith('javascript:')) {
        a.href = '#'; 
    } else {
        a.href = cleanUrl;
    }
    
    a.target = '_blank';
    a.className = className;
    
    // สร้างรูปภาพและ Text แยกกันเพื่อความปลอดภัย
    const img = document.createElement('img');
    img.src = `images/${icon}`;
    img.style.width = '18px';
    img.style.height = '18px';
    img.style.objectFit = 'contain';
    
    a.appendChild(img);
    a.appendChild(document.createTextNode(` ${name}`)); // ใช้ createTextNode ปลอดภัยกว่า
    
    return a;
}

// 5. ปิด Modal & Search
document.querySelector('.close-modal').onclick = closeModal;
window.onclick = (e) => { if (e.target == document.getElementById('manga-modal')) closeModal(); };
function closeModal() { document.getElementById('manga-modal').style.display = 'none'; document.body.style.overflow = 'auto'; }

document.getElementById('manga-search').addEventListener('input', debounce((e) => {
    const term = e.target.value.toLowerCase().trim();
    renderManga(allManga.filter(m => m.title.toLowerCase().includes(term)));
}, 300));

loadMangaData();
