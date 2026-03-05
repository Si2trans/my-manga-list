// 1. แสง Spotlight
const body = document.querySelector('body');
body.addEventListener('mousemove', (e) => {
    body.style.setProperty('--x', e.clientX + 'px');
    body.style.setProperty('--y', e.clientY + 'px');
});

const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTuttLSBMLwU8wOzRfijsjaq6ZN6nqxNfydiqEGDSRf6ezdmkNz6dz1hpUxYURoBaOW1LbiMBmhQe8D/pub?output=csv';
let allManga = []; 

// 2. โหลดข้อมูลแบบไวปรู๊ดปร๊าด (มี Cache)
async function loadMangaData() {
    const cachedData = localStorage.getItem('manga_data');
    if (cachedData) {
        allManga = JSON.parse(cachedData);
        renderManga(allManga);
    }

    try {
        const response = await fetch(csvUrl);
        const data = await response.text();
        const lines = data.split('\n');
        
        allManga = lines.slice(1).filter(line => line.trim() !== "").map(line => {
            const v = line.split(',');
            return {
                title: v[0], image: v[1], status: v[2], description: v[3],
                latest: v[4],
                links: { mynovel: v[5], readrealm: v[6], readtoon: v[7] }
            };
        });

        localStorage.setItem('manga_data', JSON.stringify(allManga));
        renderManga(allManga);
    } catch (error) {
        console.error("ดึงจาก Sheets ไม่ได้ว่ะ:", error);
    }
}

// 3. Render การ์ด (ดึง status มาใส่ Ribbon)
function renderManga(mangaList) {
    const container = document.getElementById('manga-list');
    container.innerHTML = ''; 
    mangaList.forEach((manga, index) => {
        // ดึง status มาโชว์ ถ้า status ว่างจะไม่โชว์ป้าย
        const ribbonHTML = manga.status ? `<div class="ribbon">${manga.status}</div>` : '';
        
        container.insertAdjacentHTML('beforeend', `
            <div class="manga-item" onclick="openMangaModal(${index})">
                <div class="manga-card">
                    ${ribbonHTML}
                    <img src="${manga.image}" alt="${manga.title}" loading="lazy">
                </div>
                <div class="manga-title">${manga.title}</div>
            </div>
        `);
    });
}

// 4. เปิด Modal (วางเลขตอนไว้ข้างๆ สถานะ)
function openMangaModal(index) {
    const manga = allManga[index];
    const modal = document.getElementById('manga-modal');
    
    document.getElementById('modal-img').src = manga.image;
    document.getElementById('modal-title').innerText = manga.title;
    
    document.getElementById('modal-status').innerHTML = 
        `${manga.status || 'ยังไม่ระบุ'} <span style="color:#00d2ff; margin-left:8px;">| ${manga.latest || ''}</span>`;
    
    document.getElementById('modal-description').innerText = manga.description || 'ไม่มีเรื่องย่อ...';

    const linksContainer = document.getElementById('modal-links');
    linksContainer.innerHTML = '';
    const lnk = manga.links || {};
    if (lnk.mynovel?.trim()) linksContainer.innerHTML += createModalBtn(lnk.mynovel, 'MYNOVEL', 'link-blue', 'icon-mynovel.png');
    if (lnk.readrealm?.trim()) linksContainer.innerHTML += createModalBtn(lnk.readrealm, 'ReadRealm', 'link-purple', 'icon-readrealm.png');
    if (lnk.readtoon?.trim()) linksContainer.innerHTML += createModalBtn(lnk.readtoon, 'ReadToon', 'link-light-purple', 'icon-readtoon.png');

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function createModalBtn(url, name, className, icon) {
    return `<a href="${url.trim()}" target="_blank" class="${className}">
                <img src="images/${icon}" style="width:18px; height:18px; object-fit:contain;"> ${name}
            </a>`;
}

// 5. ปิด Modal & Search
document.querySelector('.close-modal').onclick = () => closeModal();
window.onclick = (e) => { if (e.target == document.getElementById('manga-modal')) closeModal(); };
function closeModal() { document.getElementById('manga-modal').style.display = 'none'; document.body.style.overflow = 'auto'; }
document.getElementById('manga-search').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    renderManga(allManga.filter(m => m.title.toLowerCase().includes(term)));
});

loadMangaData();
