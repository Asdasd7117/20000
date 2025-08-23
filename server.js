import puppeteer from 'puppeteer';

const SERVICES = {
    "برلين": "https://www.ecsc-expat.sy/berlin-service",
    "بكين": "https://www.ecsc-expat.sy/beijing-service",
    "أثينا": "https://www.ecsc-expat.sy/athens-service",
    "القاهرة": "https://www.ecsc-expat.sy/cairo-service"
};

const TYPES = ["جواز مستعجل", "جواز عادي"];
const USER_DATA = { email: "youremail@example.com", name: "اسمك الكامل", number_of_people: 1 };

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();

    while (true) {
        for (const [embassy, url] of Object.entries(SERVICES)) {
            try {
                await page.goto(url, { waitUntil: 'networkidle2' });
                const content = await page.content();
                for (const t of TYPES) {
                    if (content.includes(t)) {
                        console.log("🚨 حجز متاح!");
                        console.log(`السفارة: ${embassy}`);
                        console.log(`النوع: ${t}`);
                        console.log(USER_DATA);
                        console.log(`رابط الحجز المباشر: ${url}`);
                        console.log("-".repeat(50));
                    }
                }
            } catch (err) {
                console.log(`⚠️ خطأ في الاتصال بالسفارة ${embassy}: ${err.message}`);
            }
        }
        await new Promise(r => setTimeout(r, 1000));
    }
})();
