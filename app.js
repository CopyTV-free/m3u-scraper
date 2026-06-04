document.getElementById('scrapeBtn').addEventListener('click', async () => {
    const targetUrl = document.getElementById('targetUrl').value.trim();
    const statusText = document.getElementById('statusText');
    const resultContainer = document.getElementById('resultContainer');
    const outputUrls = document.getElementById('outputUrls');

    if (!targetUrl) return alert('ใส่ URL ก่อนครับ');

    statusText.innerText = "กำลังเริ่มต้นสแกนทั้งหน้า...";
    statusText.style.background = "#ffeaa7";
    resultContainer.style.display = "none";
    outputUrls.value = "";

    const proxy = "https://corsproxy.io/?";

    try {
        // ขั้นตอนที่ 1: ดึงหน้าหลักเพื่อหารายชื่อตอน (Episodes)
        const response = await fetch(proxy + encodeURIComponent(targetUrl));
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        // ค้นหาลิงก์ของทุกตอน (ปรับตามโครงสร้างเว็บ Animemeiji)
        // ปกติลิงก์ตอนจะอยู่ในแท็ก <a> ที่มีคำว่า 'EP' หรืออยู่ในลิสต์รายการตอน
        const episodeLinks = Array.from(doc.querySelectorAll('a'))
            .map(a => a.href)
            .filter(href => href.includes('-th') || href.includes('/ep-')) // กรองเฉพาะลิงก์ตอน
            .filter((v, i, a) => a.indexOf(v) === i); // ลบลิงก์ซ้ำ

        if (episodeLinks.length === 0) {
            // ถ้าไม่เจอรายการตอน ให้ลองดึงแค่หน้าเดียวที่ใส่มา
            episodeLinks.push(targetUrl);
        }

        statusText.innerText = `พบทั้งหมด ${episodeLinks.length} ตอน กำลังทยอยแกะลิงก์วิดีโอ...`;

        let allVideoLinks = [];

        // ขั้นตอนที่ 2: วนลูปเข้าไปแกะทีละตอน (Recursive)
        for (let i = 0; i < episodeLinks.length; i++) {
            statusText.innerText = `กำลังดึงตอนที่ ${i + 1}/${episodeLinks.length}...`;
            
            try {
                const epRes = await fetch(proxy + encodeURIComponent(episodeLinks[i]));
                const epHtml = await epRes.text();

                // Regex หาลิงก์ Moji หรือ 24player เหมือนใน Smali
                const videoPattern = /(https?:\/\/moji\.abcdxzy\.xyz:8443\/vod\/[^\s"'`<>]+playlist\.m3u8|https?:\/\/main\.24playerhd\.com\/[^\s"'`<>]+)/gi;
                let matches = epHtml.match(videoPattern) || [];

                // ถ้าในหน้าตอนไม่เจอลิงก์ตรง ให้หา Iframe ต่อ (Nested Scrape)
                if (matches.length === 0) {
                    const iframeMatch = epHtml.match(/src=["'](https?:\/\/[^"'\s>]+(?:player|embed|v|vod|get\.php|abcdxzy)[^"'\s>]*)/i);
                    if (iframeMatch) {
                        const subRes = await fetch(proxy + encodeURIComponent(iframeMatch[1]));
                        const subHtml = await subRes.text();
                        matches = subHtml.match(videoPattern) || [];
                    }
                }

                if (matches.length > 0) {
                    allVideoLinks.push(...matches);
                }
            } catch (err) {
                console.log(`ข้ามตอนที่ ${i+1} เพราะเข้าถึงไม่ได้`);
            }
        }

        // สรุปผล
        const uniqueFinalLinks = [...new Set(allVideoLinks)];
        if (uniqueFinalLinks.length > 0) {
            statusText.innerText = `เสร็จสมบูรณ์! ดึงได้ทั้งหมด ${uniqueFinalLinks.length} ลิงก์`;
            statusText.style.background = "#2ecc71";
            outputUrls.value = uniqueFinalLinks.join('\n');
            resultContainer.style.display = "flex";
        } else {
            statusText.innerText = "ดึงไม่สำเร็จ อาจเพราะระบบป้องกันของเว็บ";
            statusText.style.background = "#ff7675";
        }

    } catch (error) {
        statusText.innerText = "เกิดข้อผิดพลาดในการเชื่อมต่อ";
        statusText.style.background = "#ff7675";
    }
});
