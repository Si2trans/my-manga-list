// 1. แสง Spotlight
const body = document.querySelector('body');
body.addEventListener('mousemove', (e) => {
    body.style.setProperty('--x', e.clientX + 'px');
    body.style.setProperty('--y', e.clientY + 'px');
});

// ลิงก์ Google Sheets ของมึง
const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTuttLSBMLwU8wOzRfijsjaq6ZN6nqxNfydiqEGDSRf6ezdmkNz6dz1hpUxYURoBaOW1LbiMBmhQe8D/pub?output=csv';

let allManga = []; 

// 2. โหลดข้อมูลจาก Google Sheets (CSV)
async function loadMangaData() {
    try {
        const response = await fetch(csvUrl);
        const data = await response.text();
        
        // แยกบรรทัดและแปลงเป็น Array
        const lines = data.split('\n');
        allManga = lines.slice(1).filter(line => line.trim() !== "").map(line => {
            const v = line.split(',');
            return {
                title: v[0],
                image: v[1],
                status: v[2],
                description: v[3],
                latest: v[4], // เลขตอนล่าสุด
                links: {
                    mynovel: v[5],
                    readrealm: v[6],
                    readtoon: v[7]
                }
            };
        });
        renderManga(allManga);
    } catch (error) {
        console.error("โหลดข้อมูลจาก Sheets ไม่ได้มึง:", error);
    }
}

// 3. ฟังก์ชัน Render
function renderManga(mangaList) {
    const container = document.getElementById('manga-list');
    container.innerHTML = ''; 

    if (mangaList.length === 0) {
        container.innerHTML = `<div style="text-align:center; width:100%; color: #fff;">ไม่พบมังงะ...</div>`;
        return;
    }

    mangaList.forEach((manga, index) => {
        const mangaHTML = `
            <div class="manga-item" onclick="openMangaModal(${index})">
                <div class="manga-card">
                    <img src="${manga.image}" alt="${manga.title}" loading="lazy">
                </div>
                <div class="manga-title">${manga.title}</div>
                <div style="color: #00d2ff; font-size: 12px; margin-top: 5px;">${manga.latest}</div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', mangaHTML);
    });
}

// 4. ระบบเปิด Modal
function openMangaModal(index) {
    const manga = allManga[index];
    const modal = document.getElementById('manga-modal');
    
    document.getElementById('modal-img').src = manga.image;
    document.getElementById('modal-title').innerText = manga.title;
    document.getElementById('modal-status').innerText = manga.status || 'ยังไม่ระบุ';
    document.getElementById('modal-description').innerText = manga.description || 'ไม่มีเรื่องย่อ...';

    const linksContainer = document.getElementById('modal-links');
    linksContainer.innerHTML = `<div style="color: #00d2ff; font-weight: bold; margin-bottom: 10px;">${manga.latest}</div>`;
    
    const lnk = manga.links || {};
    if (lnk.mynovel && lnk.mynovel.trim() !== "") linksContainer.innerHTML += createModalBtn(lnk.mynovel, 'MYNOVEL', 'link-blue', 'icon-mynovel.png');
    if (lnk.readrealm && lnk.readrealm.trim() !== "") linksContainer.innerHTML += createModalBtn(lnk.readrealm, 'ReadRealm', 'link-purple', 'icon-readrealm.png');
    if (lnk.readtoon && lnk.readtoon.trim() !== "") linksContainer.innerHTML += createModalBtn(lnk.readtoon, 'ReadToon', 'link-light-purple', 'icon-readtoon.png');

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function createModalBtn(url, name, className, icon) {
    return `<a href="${url.trim()}" target="_blank" class="${className}">
                <img src="images/${icon}" style="width:18px; height:18px; object-fit:contain;">
                ${name}
            </a>`;
}

// 5. ระบบปิด Modal
document.querySelector('.close-modal').onclick = () => closeModal();
window.onclick = (e) => { if (e.target == document.getElementById('manga-modal')) closeModal(); };

function closeModal() {
    document.getElementById('manga-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// 6. ระบบค้นหา
document.getElementById('manga-search').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    renderManga(allManga.filter(m => m.title.toLowerCase().includes(term)));
});

// เริ่มทำงาน
loadMangaData();
