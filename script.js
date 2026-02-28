// 1. แสง Spotlight (ของเดิมมึง)
const body = document.querySelector('body');
body.addEventListener('mousemove', (e) => {
    body.style.setProperty('--x', e.clientX + 'px');
    body.style.setProperty('--y', e.clientY + 'px');
});

// ฟังก์ชันสำหรับดึงข้อมูล JSON และวาดหน้าเว็บ
async function loadMangaData() {
    try {
        const response = await fetch('data.json'); // ดึงไฟล์ข้อมูล
        const mangaList = await response.json();
        const container = document.getElementById('manga-list');

        // วาด HTML สำหรับมังงะแต่ละเรื่อง
        mangaList.forEach(manga => {
            const mangaHTML = `
                <div class="manga-item">
                    <div class="manga-card">
                        <img src="${manga.image}" alt="${manga.title}">
                        <div class="manga-overlay">
                            <div class="overlay-content">
                                <p>เลือกช่องทางการอ่าน</p>
                                <a href="${manga.mynovel}" target="_blank" class="link-blue">MYNOVEL</a>
                                <a href="${manga.readrealm}" target="_blank" class="link-purple">ReadRealm</a>
                                <a href="${manga.readtoon}" target="_blank" class="link-light-purple">ReadToon</a>
                            </div>
                        </div>
                    </div>
                    <div class="manga-title">${manga.title}</div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', mangaHTML);
        });

        // พอโหลดข้อมูลเสร็จแล้ว ค่อยรันระบบจัดการคลิกของมึง
        initMobileClick();

    } catch (error) {
        console.error("โหลดข้อมูลไม่สำเร็จ:", error);
    }
}

// 2. ระบบจัดการคลิกมือถือ (ยกโค้ดเดิมมึงมาไว้ในนี้)
function initMobileClick() {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    document.querySelectorAll('.manga-item').forEach((item) => {
        if (isTouchDevice) {
            item.addEventListener('click', function(e) {
                const isActive = this.classList.contains('active');
                const clickedLink = e.target.closest('a');

                if (isActive && clickedLink) {
                    return; // ไปหน้าเว็บปกติ
                }

                e.preventDefault();
                e.stopPropagation();

                document.querySelectorAll('.manga-item').forEach(i => {
                    if (i !== this) i.classList.remove('active');
                });

                this.classList.toggle('active');
            }, false);
        }
    });

    // คลิกที่ว่างเพื่อปิด (ย้ายเข้ามาข้างในหรือไว้นอกก็ได้ แต่ไว้ตรงนี้จะชัวร์กว่า)
    document.addEventListener('click', (e) => {
        if (isTouchDevice && !e.target.closest('.manga-item')) {
            document.querySelectorAll('.manga-item').forEach(i => i.classList.remove('active'));
        }
    });
}

// สั่งให้เริ่มทำงาน
loadMangaData();
