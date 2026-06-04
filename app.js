document.getElementById('scrapeBtn').addEventListener('click', async () => {
    const targetUrl = document.getElementById('targetUrl').value.trim();
    const statusText = document.getElementById('statusText');
    const resultContainer = document.getElementById('resultContainer');
    const outputUrls = document.getElementById('outputUrls');

    if (!targetUrl) {
        alert('กรุณาใส่ URL ก่อนครับ');
        return;
    }

    statusText.innerText = "กำลังดึงข้อมูลและข้ามระบบบล็อก (CORS)...";
    statusText.style.background = "#ffeaa7";
    resultContainer.style.display = "none";

    // ใช้ Public CORS Proxy เพื่อหลีกเลี่ยงการโดนบล็อกบนเว็บเบราว์เซอร์
    const proxyUrl = "https://api.allorigins.win/get?url=" + encodeURIComponent(targetUrl);

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Network response was not ok.');
        
        const data = await response.json();
        const htmlContent = data.contents; // นี่คือโค้ดหน้าเว็บเป้าหมายที่ได้มา

        // ถอดแบบ Regex ยิงหาไฟล์วิดีโอตรงตามโค้ด Smali ดั้งเดิม
        // ค้นหาลิงก์ที่ลงท้ายด้วย .m3u8 หรือ .mp4 หรือลิงก์จาก 24playerhd / moji
        const videoPattern = /(https?:\/\/[^\s"'`<>]+?\.(?:m3u8|mp4)[^\s"'`<>]*|https:\/\/main\.24playerhd\.com\/[^\s"'`<>]+|https:\/\/moji\.abcdxzy\.xyz[^\s"'`<>]+)/gi;
        
        const foundLinks = htmlContent.match(videoPattern) || [];
        
        // ลบลิงก์ที่ซ้ำกันออก
        const uniqueLinks = [...new Set(foundLinks)];

        if (uniqueLinks.length > 0) {
            statusText.innerText = `ดึงข้อมูลสำเร็จ! พบลิงก์วิดีโอ ${uniqueLinks.length} ลิงก์`;
            statusText.style.background = "#2ecc71";
            statusText.style.color = "white";
            
            outputUrls.value = uniqueLinks.join('\n');
            resultContainer.style.display = "flex";
        } else {
            statusText.innerText = "ไม่พบลิงก์วิดีโอตรง (.m3u8/.mp4) ในหน้าเว็บนี้";
            statusText.style.background = "#ff7675";
            statusText.style.color = "white";
        }

    } catch (error) {
        console.error(error);
        statusText.innerText = "เกิดข้อผิดพลาดในการเชื่อมต่อ หรือเว็บเป้าหมายป้องกันหนาแน่นเกินไป";
        statusText.style.background = "#ff7675";
        statusText.style.color = "white";
    }
});

// ฟังก์ชันปุ่มคัดลอก (Copy)
document.getElementById('copyBtn').addEventListener('click', () => {
    const outputUrls = document.getElementById('outputUrls');
    outputUrls.select();
    document.execCommand('copy');
    alert('คัดลอกลิงก์ไปยัง Clipboard แล้ว!');
});

// ฟังก์ชันสร้างและดาวน์โหลดไฟล์ .m3u สำหรับเอาไปเปิดในแอป IPTV
document.getElementById('downloadM3uBtn').addEventListener('click', () => {
    const urls = document.getElementById('outputUrls').value.split('\n');
    if(urls.length === 0 || urls[0] === "") return;

    let m3uContent = "#EXTM3U\n";
    urls.forEach((url, index) => {
        if(url.trim() !== "") {
            m3uContent += `#EXTINF:-1, Video Stream ${index + 1}\n${url}\n`;
        }
    });

    const blob = new Blob([m3uContent], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'playlist.m3u';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});
