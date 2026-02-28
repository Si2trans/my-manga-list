// 1. ระบบแสง Spotlight วิ่งตามเมาส์
const body = document.querySelector('body');

body.addEventListener('mousemove', (e) => {
    // ส่งพิกัดเมาส์ไปที่ CSS ตัวแปร --x และ --y
    body.style.setProperty('--x', e.clientX + 'px');
    body.style.setProperty('--y', e.clientY + 'px');
});

// 2. ระบบคลิกที่รูป (ถ้ามึงยังอยากให้มีข้อความเด้งตอนกด)
document.querySelectorAll('.manga-item').forEach((item) => {
    item.addEventListener('click', () => {
        const title = item.querySelector('.manga-title').innerText;
        console.log("กำลังเปิดอ่าน: " + title);
        // มึงสามารถเปลี่ยน alert เป็นการเปิดลิงก์จริงได้ในอนาคต
    });
});

console.log("Manga Web System: Full Neon & Spotlight Online!");
