// 1. แสง Spotlight
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

// 3. ฟังก์ชัน Render (วาดการ์ดมังงะ + ไอคอน 3 เว็บ)
function renderManga(mangaList) {
    const container = document.getElementById('manga-list');
    container.innerHTML = ''; 

    if (mangaList.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; width:100%; padding: 40px; opacity: 0.7; color: #fff;">
                 ไม่พบชื่อมังงะที่คุณค้นหา...
            </div>`;
        return;
    }

    mangaList.forEach(manga => {
        const lnk = manga.links || {};
        
        // ฟังก์ชันช่วยสร้างปุ่มที่มีไอคอน
        const createBtn = (url, name, className, domain) => {
            if (!url) return '';
            // ใช้ favicon ของแต่ละเว็บมาแปะหน้าชื่อ
            const iconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
            return `
                <a href="${url}" target="_blank" class="${className}" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <img src="${iconUrl}" style="width:16px; height:16px; border-radius:2px;">
                    ${name}
                </a>`;
        };

        let buttonsHTML = '';
        buttonsHTML += createBtn(lnk.mynovel, 'MYNOVEL', 'link-blue', 'mynovel.co');
        buttonsHTML += createBtn(lnk.readrealm, 'ReadRealm', 'link-purple', 'readrealm.co');
        buttonsHTML += createBtn(lnk.readtoon, 'ReadToon', 'link-light-purple', 'readtoon.com');

        const mangaHTML = `
            <div class="manga-item">
                <div class="manga-card">
                    <img src="${manga.image}" alt="${manga.title}" loading="lazy">
                    <div class="manga-overlay">
                        <div class="overlay-content">
                            <p>เลือกช่องทางการอ่าน</p>
                            ${buttonsHTML}
                        </div>
                    </div>
                </div>
                <div class="manga-title">${manga.title}</div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', mangaHTML);
    });

    initMobileClick();
}

// 4. ระบบค้นหา
document.getElementById('manga-search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    const filteredManga = allManga.filter(manga => 
        manga.title.toLowerCase().includes(searchTerm)
    );
    renderManga(filteredManga);
});

// 5. ระบบจัดการคลิกมือถือ
function initMobileClick() {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    document.querySelectorAll('.manga-item').forEach((item) => {
        // ใช้ click ปกติแต่ดัก preventDefault ไว้ในจังหวะแรก
        item.onclick = function(e) {
            const isActive = this.classList.contains('active');
            const clickedLink = e.target.closest('a');

            if (isActive && clickedLink) return; // ถ้าเปิดอยู่และกดโดนลิ้ง ให้ไปตามปกติ

            e.preventDefault();
            e.stopPropagation();

            document.querySelectorAll('.manga-item').forEach(i => {
                if (i !== this) i.classList.remove('active');
            });
            this.classList.toggle('active');
        };
    });
}

// คลิกที่ว่างเพื่อปิด
document.addEventListener('click', (e) => {
    if (!e.target.closest('.manga-item')) {
        document.querySelectorAll('.manga-item').forEach(i => i.classList.remove('active'));
    }
});

loadMangaData();
