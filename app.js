document.getElementById('scrapeBtn').addEventListener('click', async () => {
    const targetUrl = document.getElementById('targetUrl').value.trim();
    const statusText = document.getElementById('statusText');
    const resultContainer = document.getElementById('resultContainer');
    const outputUrls = document.getElementById('outputUrls');

    if (!targetUrl) {
        alert('กรุณาใส่ URL ก่อนครับ');
        return;
    }

    statusText.innerText = "กำลังอ่านโครงสร้างหน้าหลักเพื่อค้นหารายชื่อตอน...";
    statusText.style.background = "#252547";
    statusText.style.borderLeftColor = "#ffeaa7";
    resultContainer.style.display = "none";
    outputUrls.value = "";

    // ใช้ corsproxy.io เพื่อเลี่ยงปัญหาเรื่องบล็อกเครือข่ายและ QUIC
    const proxy = "https://corsproxy.io/?";

    try {
        // ขั้นตอนที่ 1: ดึงโค้ดหน้าหลักมาแกะปุ่มลิงก์ตอนย่อย
        const response = await fetch(proxy + encodeURIComponent(targetUrl));
        if (!response.ok) throw new Error('ไม่สามารถเชื่อมต่อหน้าเว็บหลักได้');
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        const allLinks = Array.from(doc.querySelectorAll('a'));
        const episodeList = [];

        allLinks.forEach(a => {
            const href = a.getAttribute('href') || "";
            let fullHref = href;
            
            // แปลงลิงก์สัมพัทธ์ให้เป็น URL เต็มรูปแบบ
            if (href.startsWith('/')) {
                const urlObj = new URL(targetUrl);
                fullHref = urlObj.origin + href;
            }

            const title = a.innerText.trim() || a.getAttribute('title') || "";
            
            // คัดกรองลิงก์ที่เป็นตอนย่อยของอนิเมะ
            if (fullHref.startsWith('http') && !fullHref.includes('#') &&
                (fullHref.includes('/ep') || fullHref.includes('-ep') || /\/\d+\/?$/.test(fullHref) || /ตอนที่|ep|episode/i.test(title))) {
                
                // ตรวจสอบไม่ให้ URL ซ้ำกันในลิสต์
                if (!episodeList.some(item => item.url === fullHref)) {
                    // หาชื่อตอนที่อ่านง่าย ถ้าไม่มีให้ดึงเลขท้ายลิงก์มาแทน
                    let cleanTitle = title.replace(/[\r\n\t]+/g, " ").trim();
                    if (!cleanTitle || cleanTitle.length > 50) {
                        const segments = fullHref.split('/').filter(Boolean);
                        cleanTitle = "ตอนย่อย: " + segments[segments.length - 1];
                    }
                    episodeList.push({ url: fullHref, title: cleanTitle });
                }
            }
        });

        // หากเป็นหน้าเว็บตอนเดี่ยวๆ (ไม่มีปุ่มเลือกตอนอื่น) ให้ดึงหน้าตัวเองทันที
        if (episodeList.length === 0) {
            episodeList.push({ url: targetUrl, title: "วิดีโอสตรีม" });
        }

        statusText.innerText = `พบทั้งหมด ${episodeList.length} ตอน กำลังทยอยมุดรหัสดึงลิงก์ตรง (.m3u8)...`;
        statusText.style.borderLeftColor = "#3498db";

        let m3uEntries = ["#EXTM3U"];
        // Regex แพทเทิร์นจับลิงก์วิดีโอตรงตามโค้ดต้นฉบับ (Smali) ทั้ง Moji และ 24Player
        const videoPattern = /(https?:\/\/moji\.abcdxzy\.xyz:8443\/vod\/[^\s"'`<>]+playlist\.m3u8|https?:\/\/main\.24playerhd\.com\/newplaylist\/[^\s"'`<>]+)/gi;

        // ขั้นตอนที่ 2: ลูปวิ่งเข้าแต่ละตอนเพื่อดึงวิดีโอ
        for (let i = 0; i < episodeList.length; i++) {
            statusText.innerText = `กำลังแกะข้อมูล [${i + 1}/${episodeList.length}]: ${episodeList[i].title}`;
            
            try {
                const epRes = await fetch(proxy + encodeURIComponent(episodeList[i].url));
                if (!epRes.ok) continue;
                const epHtml = await epRes.text();

                // สแกนหารอบแรกในหน้าเว็บตรงๆ
                let matches = epHtml.match(videoPattern) || [];

                // หากไม่เจอตรงๆ แปลว่าซ่อนอยู่ใน Iframe เครื่องเล่นวิดีโอ (ตาม Logic ของแอป Android)
                if (matches.length === 0) {
                    // ค้นหา URL ของ iframe ตัวเล่น
                    const iframeMatch = epHtml.match(/src=["'](https?:\/\/[^"'\s>]+(?:player|embed|v|vod|get\.php|abcdxzy)[^"'\s>]*)/i);
                    if (iframeMatch) {
                        const subRes = await fetch(proxy + encodeURIComponent(iframeMatch[1]));
                        if (subRes.ok) {
                            const subHtml = await subRes.text();
                            matches = subHtml.match(videoPattern) || [];
                        }
                    }
                }

                // หากดึงลิงก์ .m3u8 สำเร็จ ให้เก็บบันทึกข้อมูลในรูปแบบ M3U Format
                if (matches.length > 0) {
                    const cleanLink = matches[0];
                    m3uEntries.push(`#EXTINF:-1, ${episodeList[i].title}\n${cleanLink}`);
                }
            } catch (err) {
                console.log(`ข้ามตอนเนื่องจากข้อผิดพลาด: ${episodeList[i].title}`);
            }
        }

        // ขั้นตอนที่ 3: สรุปผลลัพธ์และจัดรูปแบบหน้าต่างแสดงผล
        if (m3uEntries.length > 1) {
            statusText.innerText = `เสร็จสมบูรณ์! ดึงลิงก์วิดีโอสำเร็จทั้งหมด ${m3uEntries.length - 1} ตอน`;
            statusText.style.background = "#1b4332";
            statusText.style.borderLeftColor = "#2ecc71";
            
            outputUrls.value = m3uEntries.join('\n');
            resultContainer.style.display = "flex";
        } else {
            statusText.innerText = "ไม่พบลิงก์วิดีโอสตรีมใดๆ เลย (เว็บอาจเปลี่ยนโครงสร้างระบบป้องกัน)";
            statusText.style.background = "#4a1515";
            statusText.style.borderLeftColor = "#ff7675";
        }

    } catch (error) {
        console.error(error);
        statusText.innerText = "เกิดข้อผิดพลาดร้ายแรงในการอ่านข้อมูลหน้าหลัก";
        statusText.style.background = "#4a1515";
        statusText.style.borderLeftColor = "#ff7675";
    }
});

// ฟังก์ชันปุ่มคัดลอก (Copy)
document.getElementById('copyBtn').addEventListener('click', () => {
    const outputUrls = document.getElementById('outputUrls');
    outputUrls.select();
    document.execCommand('copy');
    alert('คัดลอกเพลย์ลิสต์ M3U เรียบร้อย!');
});

// ฟังก์ชันดาวน์โหลดเป็นไฟล์ .m3u อัตโนมัติ
document.getElementById('downloadM3uBtn').addEventListener('click', () => {
    const text = document.getElementById('outputUrls').value;
    if(!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'anime_playlist.m3u';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});
