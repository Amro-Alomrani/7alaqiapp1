const puppeteer = require('puppeteer-core');
const EXE = process.env.BROWSER_EXE;
(async () => {
  const browser = await puppeteer.launch({ executablePath: EXE, headless: 'new', args:['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', m => console.log('[console.'+m.type()+'] '+m.text()));
  page.on('pageerror', e => console.log('[pageerror] '+e.message+'\nSTACK:\n'+e.stack));
  page.on('requestfailed', r => console.log('[reqfail] '+r.url()+' :: '+(r.failure()&&r.failure().errorText)));
  await page.goto('http://localhost:5174/',{waitUntil:'networkidle2',timeout:20000});
  await new Promise(r=>setTimeout(r,3000));
  await browser.close();
})();
