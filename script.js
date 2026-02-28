// 1. แสง Spotlight (ของเดิมมึง)
const body = document.querySelector('body');
body.addEventListener('mousemove', (e) => {
    body.style.setProperty('--x', e.clientX + 'px');
    body.style.setProperty('--y', e.clientY + 'px');
});

let allManga = []; // ตัวแปรเก็บข้อมูลมังงะทั้งหมดจาก JSON

// 2. ฟังก์ชันหลักสำหรับโหลดข้อมูล
async function loadMangaData() {
    try {
        const response = await fetch('data.json');
        allManga = await response.json();
        
        // สั่งวาดมังงะครั้งแรก (โชว์ทั้งหมด)
        renderManga(allManga);
        
    } catch (error) {
        console.error("โหลดข้อมูลไม่ได้มึง เช็คไฟล์ JSON ด่วน:", error);
    }
}

// 3. ฟังก์ชันสำหรับวาดการ์ดมังงะ (Render)
function renderManga(mangaList) {
    const container = document.getElementById('manga-list');
    
    // --- เพิ่มส่วนนี้: เช็คว่าถ้าค้นหาแล้วไม่เจอ ให้โชว์ข้อความบอกผู้ใช้ ---
    if (mangaList.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; width:100%; padding: 40px; opacity: 0.7;">
                 ไม่พบชื่อมังงะที่คุณค้นหา...
            </div>`;
        return;
    }
    // ---------------------------------------------------------

    container.innerHTML = ''; // ล้างหน้าเว็บให้ว่างก่อนวาดใหม่

    mangaList.forEach(manga => {
        const lnk = manga.links || {};
        
        let buttonsHTML = '';
        if (lnk.mynovel) buttonsHTML += `<a href="${lnk.mynovel}" target="_blank" class="link-blue">MYNOVEL</a>`;
        if (lnk.readrealm) buttonsHTML += `<a href="${lnk.readrealm}" target="_blank" class="link-purple">ReadRealm</a>`;
        if (lnk.readtoon) buttonsHTML += `<a href="${lnk.readtoon}" target="_blank" class="link-light-purple">ReadToon</a>`;

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

    // สำคัญ: พอมันวาดรูปเสร็จใหม่ๆ ต้องสั่งให้ระบบคลิกมือถือเริ่มทำงานกับปุ่มใหม่ด้วย
    initMobileClick();
}
// 4. ระบบค้นหา (Search)
document.getElementById('manga-search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    
    // กรองข้อมูลจากชื่อเรื่อง
    const filteredManga = allManga.filter(manga => 
        manga.title.toLowerCase().includes(searchTerm)
    );
    
    // วาดใหม่เฉพาะเรื่องที่ตรงกับคำค้นหา
    renderManga(filteredManga);
});

// 5. ระบบจัดการคลิกมือถือ (ตรรกะเดิมมึงเป๊ะๆ)
function initMobileClick() {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    document.querySelectorAll('.manga-item').forEach((item) => {
        item.addEventListener('click', function(e) {
            const isActive = this.classList.contains('active');
            const clickedLink = e.target.closest('a');

            if (isActive && clickedLink) return;

            e.preventDefault();
            e.stopPropagation();

            document.querySelectorAll('.manga-item').forEach(i => {
                if (i !== this) i.classList.remove('active');
            });
            this.classList.toggle('active');
        });
    });
}

// คลิกที่ว่างเพื่อปิด Overlay
document.addEventListener('click', (e) => {
    if (!e.target.closest('.manga-item')) {
        document.querySelectorAll('.manga-item').forEach(i => i.classList.remove('active'));
    }
});

// เริ่มต้นโหลดข้อมูลทันทีที่เปิดเว็บ
loadMangaData();
