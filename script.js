// 1. ระบบแสง Spotlight วิ่งตามเมาส์
const body = document.querySelector('body');

body.addEventListener('mousemove', (e) => {
    // ส่งพิกัดเมาส์ไปที่ CSS ตัวแปร --x และ --y
    body.style.setProperty('--x', e.clientX + 'px');
    body.style.setProperty('--y', e.clientY + 'px');
});

// 2. ระบบจัดการคลิกสำหรับมือถือ (Touch Device)
// ตรวจสอบว่าเป็นอุปกรณ์สัมผัสหรือไม่
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

document.querySelectorAll('.manga-item').forEach((item) => {
    if (isTouchDevice) {
        // สำหรับมือถือ: คลิกครั้งแรกเพื่อเปิด Overlay (โชว์ 3 ลิงก์)
        item.addEventListener('click', (e) => {
            // ถ้าคลิกโดนปุ่มลิงก์ (Tag A) ให้มันไปตามลิงก์ปกติ ไม่ต้องดัก
            if (e.target.tagName === 'A') return;

            const isActive = item.classList.contains('active');

            // ปิด Overlay ของตัวอื่นที่เปิดค้างไว้ก่อนหน้า
            document.querySelectorAll('.manga-item').forEach(i => i.classList.remove('active'));

            // ถ้าตัวที่กดมั้นยังไม่เปิด ก็สั่งให้มันเปิด (ใส่ class active)
            if (!isActive) {
                item.classList.add('active');
            }
            
            // Log ดูขำๆ ว่ากดตัวไหน
            const title = item.querySelector('.manga-title').innerText;
            console.log("Mobile Touch: " + title);
        });
    } else {
        // สำหรับคอมพิวเตอร์: แค่ Log ชื่อเล่นๆ เพราะ Hover ใช้ CSS จัดการไปแล้ว
        item.addEventListener('click', () => {
            const title = item.querySelector('.manga-title').innerText;
            console.log("Desktop Click: " + title);
        });
    }
});

// 3. ระบบปิด Overlay เมื่อคลิกที่ว่าง (สำหรับมือถือ)
document.addEventListener('click', (e) => {
    if (isTouchDevice && !e.target.closest('.manga-item')) {
        document.querySelectorAll('.manga-item').forEach(i => i.classList.remove('active'));
    }
});

console.log("Si2trans System: Spotlight & Touch-Ready Online!");
