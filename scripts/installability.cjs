const { chromium } = require('playwright');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
(async () => {
  const profile = mkdtempSync(join(tmpdir(), 'gyoza-pwa-'));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      headless: true, args: ['--no-sandbox']
    });
    const page = await context.newPage();
    await page.goto(process.env.TEST_URL || 'http://localhost:3000');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    const client = await context.newCDPSession(page);
    const result = await client.send('Page.getInstallabilityErrors');
    console.log(JSON.stringify(result));
    if (result.installabilityErrors.length) throw new Error('PWA installability errors');
  } finally {
    if (context) await context.close();
    rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
