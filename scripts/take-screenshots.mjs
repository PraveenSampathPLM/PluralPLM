import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../docs/screenshots');
mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:5173';

// Pages to screenshot: [filename, url, optional wait selector]
const PAGES = [
  ['01-dashboard.png',       '/',                          '.font-heading'],
  ['02-items.png',           '/items',                     'table'],
  ['03-formulas.png',        '/formulas',                  'table'],
  ['04-formula-detail.png',  '/formulas/cmmvm075u0004yavv3wtpzr2s', 'text=Input Structure'],
  ['05-digital-thread.png',  '/formulas/cmmvm075u0004yavv3wtpzr2s/thread', 'text=FORMULA DIGITAL THREAD'],
  ['06-npd.png',             '/npd',                       'text=NPD Projects'],
  ['07-changes.png',         '/changes',                   'table'],
  ['08-releases.png',        '/releases',                  'table'],
  ['09-reports.png',         '/reports',                   'text=KPI Overview'],
  ['10-labeling.png',        '/labeling',                  'text=Label Templates'],
  ['11-specifications.png',  '/specifications',            'text=Specification Templates'],
  ['12-fg-structures.png',   '/fg',                        'text=Finished Good Management'],
];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 820 } });
const page = await ctx.newPage();

// Set auth cookie so we don't hit login page
// First do a quick login via API
const loginRes = await page.request.post(`${BASE.replace('5173','4000')}/api/auth/login`, {
  data: { email: 'admin@plm.local', password: 'Password@123' }
});
const { token } = await loginRes.json();
await ctx.addCookies([{ name: 'token', value: token, domain: 'localhost', path: '/' }]);

// Inject token into localStorage on every page
await ctx.addInitScript((t) => { localStorage.setItem('plm_token', t); }, token);

for (const [filename, path, waitFor] of PAGES) {
  console.log(`📸 ${filename} — ${path}`);
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 15000 });
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: 8000 }).catch(() => {});
    }
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, filename), fullPage: false });
    console.log(`   ✔ saved`);
  } catch (e) {
    console.log(`   ✖ failed: ${e.message}`);
  }
}

await browser.close();
console.log('\nAll screenshots saved to docs/screenshots/');
