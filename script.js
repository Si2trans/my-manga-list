// ตัวอย่าง: เมื่อคลิกที่รูปมังงะ ให้โชว์ Alert บอกชื่อเรื่อง
document.querySelectorAll('.manga-card').forEach((card, index) => {
    card.addEventListener('click', () => {
        alert('คุณคลิกดูมังงะเรื่องที่ ' + (index + 1));
    });
});

console.log("เว็บไซต์แนะนำมังงะพร้อมทำงาน!");
