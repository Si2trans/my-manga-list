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

// 3. ฟังก์ชัน Render (วาดการ์ดมังงะ + ไอคอนส่วนตัว)
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
        
        // ฟังก์ชันช่วยสร้างปุ่ม (ดึงรูปจาก images/ ในเครื่องมึง)
        const createBtn = (url, name, className, iconFileName) => {
            if (!url) return '';
            return `
                <a href="${url}" target="_blank" class="${className}" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <img src="images/${iconFileName}" style="width:18px; height:18px; object-fit:contain;">
                    ${name}
                </a>`;
        };

        let buttonsHTML = '';
        // มึงเปลี่ยนชื่อไฟล์ไอคอน (ตัวสุดท้าย) ให้ตรงกับที่มึงตั้งในโฟลเดอร์ images นะ
        buttonsHTML += createBtn(lnk.mynovel, 'MYNOVEL', 'link-blue', 'icon-mynovel.png');
        buttonsHTML += createBtn(lnk.readrealm, 'ReadRealm', 'link-purple', 'icon-readrealm.png');
        buttonsHTML += createBtn(lnk.readtoon, 'ReadToon', 'link-light-purple', 'icon-readtoon.png');

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
        item.onclick = function(e) {
            const isActive = this.classList.contains('active');
            const clickedLink = e.target.closest('a');

            if (isActive && clickedLink) return;

            e.preventDefault();
            e.stopPropagation();

            document.querySelectorAll('.manga-item').forEach(i => {
                if (i !== this) i.classList.remove('active');
            });
            this.classList.toggle('active');
        };
    });
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.manga-item')) {
        document.querySelectorAll('.manga-item').forEach(i => i.classList.remove('active'));
    }
});

loadMangaData();
