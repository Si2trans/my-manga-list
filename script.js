// 1. แสง Spotlight (คงเดิม)
const body = document.querySelector('body');
body.addEventListener('mousemove', (e) => {
    body.style.setProperty('--x', e.clientX + 'px');
    body.style.setProperty('--y', e.clientY + 'px');
});

// ลิงก์ Google Sheets CSV ของมึง
const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTuttLSBMLwU8wOzRfijsjaq6ZN6nqxNfydiqEGDSRf6ezdmkNz6dz1hpUxYURoBaOW1LbiMBmhQe8D/pub?output=csv';

let allManga = [];

// 2. โหลดข้อมูลจาก Google Sheets แทน JSON
async function loadMangaData() {
    try {
        const response = await fetch(csvUrl);
        const data = await response.text();
        allManga = parseCSV(data);
        renderManga(allManga);
    } catch (error) {
        console.error("ดึงข้อมูลจาก Sheets ไม่ได้ว่ะ:", error);
    }
}

// ฟังก์ชันแปลง CSV เป็น Object
function parseCSV(csvText) {
    const lines = csvText.split('\n');
    return lines.slice(1).filter(line => line.trim() !== "").map(line => {
        const vals = line.split(',').map(v => v.trim());
        return {
            title: vals[0],
            image: vals[1],
            status: vals[2],
            description: vals[3],
            latest_chapter: vals[4], // เพิ่มเลขตอน
            links: {
                mynovel: vals[5],
                readrealm: vals[6],
                readtoon: vals[7]
            }
        };
    });
}

// 3. ปรับ Render ให้แสดงเลขตอนที่การ์ดด้วย
function renderManga(mangaList) {
    const container = document.getElementById('manga-list');
    container.innerHTML = ''; 

    mangaList.forEach((manga, index) => {
        const mangaHTML = `
            <div class="manga-item" onclick="openMangaModal(${index})">
                <div class="manga-card">
                    <img src="${manga.image}" alt="${manga.title}" loading="lazy">
                </div>
                <div class="manga-title">${manga.title}</div>
                <div style="font-size: 13px; color: #00d2ff; margin-top: 5px;">${manga.latest_chapter}</div>
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
    document.getElementById('modal-status').innerText = manga.status;
    document.getElementById('modal-description').innerText = manga.description;

    const linksContainer = document.getElementById('modal-links');
    linksContainer.innerHTML = `<div style="color: #00d2ff; margin-bottom: 10px; font-weight: bold;">${manga.latest_chapter}</div>`;
    
    if (manga.links.mynovel) linksContainer.innerHTML += createModalBtn(manga.links.mynovel, 'MYNOVEL', 'link-blue', 'icon-mynovel.png');
    if (manga.links.readrealm) linksContainer.innerHTML += createModalBtn(manga.links.readrealm, 'ReadRealm', 'link-purple', 'icon-readrealm.png');
    if (manga.links.readtoon) linksContainer.innerHTML += createModalBtn(manga.links.readtoon, 'ReadToon', 'link-light-purple', 'icon-readtoon.png');

    modal.style.display = 'flex';
}

// (ฟังก์ชัน createModalBtn, closeModal และระบบ Search เหมือนเดิมเป๊ะ ไม่ต้องแก้)
// ... ก๊อปฟังก์ชันที่เหลือจากโค้ดเก่ามึงมาวางต่อได้เลย ...
