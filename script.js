// 1. แสง Spotlight
const body = document.querySelector('body');
body.addEventListener('mousemove', (e) => {
    body.style.setProperty('--x', e.clientX + 'px');
    body.style.setProperty('--y', e.clientY + 'px');
});

// ฟังก์ชันโหลดข้อมูล
async function loadMangaData() {
    try {
        const response = await fetch('data.json');
        const mangaList = await response.json();
        const container = document.getElementById('manga-list');

        mangaList.forEach(manga => {
            // เช็คว่ามีลิงก์ไหม ถ้าไม่มีให้ใส่ค่าว่าง เพื่อไม่ให้ปุ่มพัง
            const lnk = manga.links || {};
            
            // สร้าง HTML ของปุ่ม โดยเช็คก่อนว่ามี URL ไหม ถ้าไม่มีจะไม่โชว์ปุ่มนั้น
            let buttonsHTML = '';
            if (lnk.mynovel) buttonsHTML += `<a href="${lnk.mynovel}" target="_blank" class="link-blue">MYNOVEL</a>`;
            if (lnk.readrealm) buttonsHTML += `<a href="${lnk.readrealm}" target="_blank" class="link-purple">ReadRealm</a>`;
            if (lnk.readtoon) buttonsHTML += `<a href="${lnk.readtoon}" target="_blank" class="link-light-purple">ReadToon</a>`;

            const mangaHTML = `
                <div class="manga-item">
                    <div class="manga-card">
                        <img src="${manga.image}" alt="${manga.title}">
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

        initMobileClick(); // รันระบบคลิกมือถือต่อ

    } catch (error) {
        console.error("โหลดข้อมูลไม่ได้มึง เช็คไฟล์ JSON ด่วน:", error);
    }
}

// 2. ระบบจัดการคลิกมือถือ (โค้ดเดิมมึง)
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

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.manga-item')) {
            document.querySelectorAll('.manga-item').forEach(i => i.classList.remove('active'));
        }
    });
}

loadMangaData();
