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
    try {
        const response = await fetch(csvUrl);
        const data = await response.text();
        const lines = data.split('\n');
        
        allManga = lines.slice(1).filter(line => line.trim() !== "").map(line => {
            const v = line.split(',');
            return {
                title: v[0] || '', image: v[1] || '', status: v[2] || '', 
                description: v[3] || '', latest: v[4] || '',
                links: { mynovel: v[5], readrealm: v[6], readtoon: v[7] }
            };
        });

        localStorage.setItem('manga_data', JSON.stringify(allManga));
        document.getElementById('skeleton-loader').style.display = 'none';
        renderManga(allManga);
    } catch (error) {
        console.error("ดึงจาก Sheets ไม่ได้ว่ะ:", error);
    }
}

// 3. Render การ์ด
function renderManga(mangaList) {
    const container = document.getElementById('manga-list');
    container.innerHTML = ''; 
    
    mangaList.forEach((manga) => {
        let ribbonClass = 'ribbon';
        if (manga.status.includes('จบ')) ribbonClass += ' ribbon-end';
        else if (manga.status.includes('อัปเดต')) ribbonClass += ' ribbon-updating';
        else if (manga.status.includes('ดอง')) ribbonClass += ' ribbon-hiatus';
        else if (manga.status.includes('ใหม่')) ribbonClass += ' ribbon-new';
        
        const item = document.createElement('div');
        item.className = 'manga-item';
        item.innerHTML = `
            <div class="manga-card">
                ${manga.status ? `<div class="${ribbonClass}">${manga.status}</div>` : ''}
                <img src="${manga.image}" alt="${manga.title}" loading="lazy">
            </div>
            <div class="manga-title">${manga.title}</div>
        `;
        // แก้ไข: ใช้ arrow function เพื่อส่ง object manga ไปโดยตรง ไม่ใช้ index
        item.onclick = () => openMangaModal(manga);
        container.appendChild(item);
    });
}

// 4. Modal (รับ Object manga โดยตรง)
function openMangaModal(manga) {
    const modal = document.getElementById('manga-modal');
    document.getElementById('modal-img').src = manga.image;
    document.getElementById('modal-title').innerText = manga.title;
    
    const statusEl = document.getElementById('modal-status');
    statusEl.innerHTML = `${manga.status || 'ยังไม่ระบุ'} <span style="color:#00d2ff; margin-left:8px;">| ${manga.latest || ''}</span>`;
    document.getElementById('modal-description').innerText = manga.description || 'ไม่มีเรื่องย่อ...';

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
    a.href = url.trim();
    a.target = '_blank';
    a.className = className;
    a.innerHTML = `<img src="images/${icon}" style="width:18px; height:18px; object-fit:contain;"> ${name}`;
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
