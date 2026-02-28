// 1. ระบบแสง Spotlight วิ่งตามเมาส์
const body = document.querySelector('body');

body.addEventListener('mousemove', (e) => {
    body.style.setProperty('--x', e.clientX + 'px');
    body.style.setProperty('--y', e.clientY + 'px');
});

// 2. ระบบจัดการคลิกสำหรับมือถือ (Touch Device)
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

document.querySelectorAll('.manga-item').forEach((item) => {
    if (isTouchDevice) {
        // ดักเหตุการณ์คลิกที่ตัว Manga Item
        item.addEventListener('click', (e) => {
            
            // ถ้าจุดที่กดคือปุ่มลิงก์ (Tag A) ให้มันทำงานตามปกติ (เปิดเว็บ)
            if (e.target.tagName === 'A') {
                return; 
            }

            // ถ้ากดโดนรูปหรือพื้นที่อื่นๆ ใน Card ให้หยุดการทำงานปกติก่อน
            e.preventDefault();

            const isActive = item.classList.contains('active');

            // ปิดตัวอื่นที่เปิดค้างไว้ (ให้เปิดได้ทีละเรื่อง)
            document.querySelectorAll('.manga-item').forEach(i => i.classList.remove('active'));

            // ถ้ายังไม่ active ให้เปิด Overlay ขึ้นมา
            if (!isActive) {
                item.classList.add('active');
            }
        });
    }
});

// 3. ระบบปิด Overlay เมื่อคลิกพื้นที่ว่าง
document.addEventListener('click', (e) => {
    // ถ้าจุดที่คลิกไม่ใช่ตัวมังงะ ให้ล้าง class active ออกให้หมด
    if (isTouchDevice && !e.target.closest('.manga-item')) {
        document.querySelectorAll('.manga-item').forEach(i => i.classList.remove('active'));
    }
});

console.log("System Ready: Single Click to Show Menu on Mobile");
