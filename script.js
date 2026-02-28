// 1. ระบบแสง Spotlight
const body = document.querySelector('body');
body.addEventListener('mousemove', (e) => {
    body.style.setProperty('--x', e.clientX + 'px');
    body.style.setProperty('--y', e.clientY + 'px');
});

// 2. ระบบจัดการคลิกสำหรับมือถือ
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

document.querySelectorAll('.manga-item').forEach((item) => {
    if (isTouchDevice) {
        item.addEventListener('click', function(e) {
            // เช็คว่าจุดที่นิ้วจิ้มลงไป เป็น "ปุ่มลิงก์" (Tag A) หรือไม่
            const isClickOnLink = e.target.closest('a');

            // ถ้าเมนู (active) เปิดอยู่แล้ว และมึงจิ้มโดนปุ่มลิงก์จริงๆ -> ปล่อยให้ไปหน้าเว็บ
            if (this.classList.contains('active') && isClickOnLink) {
                return; // จบการทำงานตรงนี้ ไปหน้าเว็บได้เลย
            }

            // ถ้าเมนูยังไม่เปิด หรือจิ้มโดนรูป/พื้นที่อื่นๆ -> ดักไว้ก่อน ห้ามเด้ง!
            e.preventDefault();
            e.stopPropagation();

            const isActive = this.classList.contains('active');

            // ล้างเมนูของเรื่องอื่นที่เปิดค้างอยู่
            document.querySelectorAll('.manga-item').forEach(i => {
                if (i !== this) i.classList.remove('active');
            });

            // สลับสถานะ (ถ้ายังไม่เปิดก็เปิด ถ้าเปิดอยู่แล้วกดซ้ำก็ปิด)
            this.classList.toggle('active');
        }, true); // ใช้ true (Capturing phase) เพื่อดักตั้งแต่เนิ่นๆ
    }
});

// คลิกที่ว่างเพื่อปิดเมนู
document.addEventListener('click', (e) => {
    if (isTouchDevice && !e.target.closest('.manga-item')) {
        document.querySelectorAll('.manga-item').forEach(i => i.classList.remove('active'));
    }
});
