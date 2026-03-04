// 1. แสง Spotlight (เหมือนเดิม)
const body = document.querySelector('body');
body.addEventListener('mousemove', (e) => {
    body.style.setProperty('--x', e.clientX + 'px');
    body.style.setProperty('--y', e.clientY + 'px');
});

let allManga = []; 

// 2. โหลดข้อมูลจาก JSON
async function loadMangaData() {
    try {
        const response = await fetch('data.json');
        allManga = await response.json();
        renderManga(allManga);
    } catch (error) {
        console.error("โหลดข้อมูลไม่ได้มึง เช็คไฟล์ JSON ด่วน:", error);
    }
}

// 3. ฟังก์ชัน Render (สร้างการ์ดมังงะแบบใหม่ที่คลิกได้)
function renderManga(mangaList) {
    const container = document.getElementById('manga-list');
    container.innerHTML = ''; 

    if (mangaList.length === 0) {
        container.innerHTML = `<div style="text-align:center; width:100%; padding: 40px; color: #fff; opacity: 0.7;">ไม่พบชื่อมังงะที่ค้นหา...</div>`;
        return;
    }

    mangaList.forEach((manga, index) => {
        const mangaHTML = `
            <div class="manga-item" onclick="openMangaModal(${allManga.indexOf(manga)})">
                <div class="manga-card">
                    <img src="${manga.image}" alt="${manga.title}" loading="lazy">
                </div>
                <div class="manga-title">${manga.title}</div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', mangaHTML);
    });
}

// 4. ระบบเปิด Pop-up (Modal)
function openMangaModal(index) {
    const manga = allManga[index];
    const modal = document.getElementById('manga-modal');
    
    // ใส่ข้อมูลลงใน Modal
    document.getElementById('modal-img').src = manga.image;
    document.getElementById('modal-title').innerText = manga.title;
    document.getElementById('modal-status').innerText = manga.status || 'ยังไม่ระบุ';
    document.getElementById('modal-description').innerText = manga.description || 'ไม่มีเรื่องย่อ...';

    // สร้างปุ่มลิงก์
    const linksContainer = document.getElementById('modal-links');
    linksContainer.innerHTML = ''; // ล้างปุ่มเก่า
    
    const lnk = manga.links || {};
    if (lnk.mynovel) linksContainer.innerHTML += createModalBtn(lnk.mynovel, 'MYNOVEL', 'link-blue', 'icon-mynovel.png');
    if (lnk.readrealm) linksContainer.innerHTML += createModalBtn(lnk.readrealm, 'ReadRealm', 'link-purple', 'icon-readrealm.png');
    if (lnk.readtoon) linksContainer.innerHTML += createModalBtn(lnk.readtoon, 'ReadToon', 'link-light-purple', 'icon-readtoon.png');

    // แสดง Modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // กันพื้นหลังเลื่อน
}

// ฟังก์ชันช่วยสร้างปุ่มใน Modal
function createModalBtn(url, name, className, icon) {
    return `<a href="${url}" target="_blank" class="${className}">
                <img src="images/${icon}" style="width:18px; height:18px; object-fit:contain;">
                ${name}
            </a>`;
}

// 5. ระบบปิด Pop-up
const modal = document.getElementById('manga-modal');
const closeBtn = document.querySelector('.close-modal');

closeBtn.onclick = () => closeModal();

// คลิกข้างนอกหน้าต่างเพื่อปิด
window.onclick = (event) => {
    if (event.target == modal) closeModal();
};

function closeModal() {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto'; // คืนค่าการเลื่อนหน้าจอ
}

// 6. ระบบค้นหา
document.getElementById('manga-search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    const filteredManga = allManga.filter(manga => 
        manga.title.toLowerCase().includes(searchTerm)
    );
    renderManga(filteredManga);
});

// เริ่มทำงาน
loadMangaData();
