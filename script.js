// 1. แสง Spotlight
const body = document.querySelector('body');
body.addEventListener('mousemove', (e) => {
    body.style.setProperty('--x', e.clientX + 'px');
    body.style.setProperty('--y', e.clientY + 'px');
});

// 2. ระบบจัดการคลิกมือถือ
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

document.querySelectorAll('.manga-item').forEach((item) => {
    if (isTouchDevice) {
        // ใช้ touchstart แทน click ในบางจังหวะจะช่วยลดอาการ "เด้งทะลุ" ได้ดีกว่า
        item.addEventListener('click', function(e) {
            const isActive = this.classList.contains('active');
            const clickedLink = e.target.closest('a');

            // เงื่อนไขเดียวที่จะยอมให้เปิดเว็บ: ต้องมี class active และต้องจิ้มโดนปุ่ม <a> เท่านั้น
            if (isActive && clickedLink) {
                return; // ปล่อยให้ไปหน้าเว็บปกติ
            }

            // ถ้ายังไม่ได้เปิดเมนู หรือจิ้มส่วนอื่น -> ห้ามไปหน้าเว็บเด็ดขาด!
            e.preventDefault();
            e.stopPropagation();

            // ปิดตัวอื่นให้หมด
            document.querySelectorAll('.manga-item').forEach(i => {
                if (i !== this) i.classList.remove('active');
            });

            // เปิด/ปิด ตัวที่จิ้ม
            this.classList.toggle('active');
        }, false);
    }
});

// คลิกที่ว่างเพื่อปิด
document.addEventListener('click', (e) => {
    if (isTouchDevice && !e.target.closest('.manga-item')) {
        document.querySelectorAll('.manga-item').forEach(i => i.classList.remove('active'));
    }
});
