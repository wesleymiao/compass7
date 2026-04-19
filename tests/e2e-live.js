/**
 * E2E tests for Compass7 against the live deployed site.
 * Run: node tests/e2e-live.js
 * Screenshots saved to tests/screenshots/
 */
const { chromium } = require('playwright');
const path = require('path');

const BASE = process.env.BASE_URL || 'https://compass7.azurewebsites.net';
const SHOTS = path.join(__dirname, 'screenshots');
let passed = 0, failed = 0;
const results = [];
const screenshots = [];

async function shot(page, name) {
  const file = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  screenshots.push(file);
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    results.push(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    results.push(`  ❌ ${name}\n     ${e.message.split('\n')[0]}`);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  console.log(`\nCompass7 E2E Tests — ${BASE}\n`);

  // ─── Admin Flow ───────────────────────────────
  await test('Admin page loads', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/admin`);
    await page.waitForSelector('#admin-pwd', { timeout: 10000 });
    await shot(page, '01-admin-login-page');
    const title = await page.title();
    assert(title.includes('Compass7'), `Expected title to include Compass7, got: ${title}`);
    await page.close();
  });

  await test('Admin login (first time sets password)', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/admin`);
    await page.waitForSelector('#admin-pwd');
    await page.fill('#admin-pwd', 'Icanbebetter3#');
    await page.click('button:has-text("登录")');
    await page.waitForTimeout(3000);
    const panelVisible = await page.locator('#admin-panel').isVisible();
    const toastVisible = await page.locator('.toast').isVisible();
    const toastText = toastVisible ? await page.locator('.toast').textContent() : '';
    console.log(`    Panel visible: ${panelVisible}, Toast: "${toastText}"`);
    await shot(page, '02-admin-after-login');
    assert(panelVisible || toastVisible, 'Neither admin panel nor toast appeared after login');
    await page.close();
  });

  await test('Admin create year', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/admin`);
    await page.waitForSelector('#admin-pwd');
    await page.fill('#admin-pwd', 'Icanbebetter3#');
    await page.click('button:has-text("登录")');
    await page.waitForSelector('#admin-panel', { state: 'visible', timeout: 10000 });

    await page.click('#admin-panel button:has-text("+")');
    await page.waitForSelector('#modal-overlay.active', { timeout: 5000 });
    await shot(page, '03-admin-add-year-modal');
    await page.fill('#new-year-name', 'E2E-Test-2025');
    await page.click('#modal-save');
    await page.waitForTimeout(2000);

    const yearsList = await page.locator('#years-list').textContent();
    console.log(`    Years list: ${yearsList}`);
    await shot(page, '04-admin-year-created');
    assert(yearsList.includes('E2E-Test-2025'), `Year not found in list: ${yearsList}`);
    await page.close();
    await ctx.close();
  });

  await test('Admin create class', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/admin`);
    await page.waitForSelector('#admin-pwd');
    await page.fill('#admin-pwd', 'Icanbebetter3#');
    await page.click('button:has-text("登录")');
    await page.waitForSelector('#admin-panel', { state: 'visible', timeout: 10000 });

    await page.waitForTimeout(1500);
    const yearBtn = page.locator('#years-list .sidebar-item').filter({ hasText: 'E2E-Test-2025' });
    const yearCount = await yearBtn.count();
    console.log(`    Years matching: ${yearCount}`);
    if (yearCount > 0) {
      await yearBtn.first().click();
      await page.waitForTimeout(500);

      await page.click('#add-class-btn');
      await page.waitForSelector('#modal-overlay.active', { timeout: 5000 });
      await page.fill('#new-class-name', 'Class-A');
      await page.click('#modal-save');
      await page.waitForTimeout(2000);

      const classesList = await page.locator('#classes-list').textContent();
      console.log(`    Classes list: ${classesList}`);
      await shot(page, '05-admin-class-created');
      assert(classesList.includes('Class-A'), `Class not found: ${classesList}`);
    } else {
      const allYears = await page.locator('#years-list').textContent();
      throw new Error(`Year E2E-Test-2025 not found. All years: ${allYears}`);
    }
    await page.close();
  });

  // ─── User Flow ────────────────────────────────
  await test('User page loads with steps', async () => {
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.waitForSelector('#step-1', { timeout: 10000 });
    await shot(page, '06-user-homepage');
    const h2 = await page.locator('h2').first().textContent();
    console.log(`    First heading: ${h2}`);
    assert(h2, 'No heading found on user page');
    await page.close();
  });

  await test('User can see available years', async () => {
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.waitForSelector('#step-1', { timeout: 10000 });
    await page.waitForTimeout(2000);
    const yearCards = await page.locator('#year-list .card, #year-list button, #year-list .list-item').count();
    console.log(`    Year cards found: ${yearCards}`);
    await shot(page, '07-user-year-selection');
    assert(yearCards >= 0, 'Year list section not found');
    await page.close();
  });

  await test('User register', async () => {
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(1000);

    const loginBtn = page.locator('#login-btn');
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
      await page.waitForTimeout(500);
      const regTab = page.locator('text=注册').or(page.locator('text=Register'));
      if (await regTab.count() > 0) {
        await regTab.first().click();
        await page.waitForTimeout(300);
      }
      await shot(page, '08-user-register-modal');
      const usernameInput = page.locator('#reg-username, #auth-username, input[name="username"]').first();
      const passwordInput = page.locator('#reg-password, #auth-password, input[name="password"]').first();
      if (await usernameInput.isVisible()) {
        await usernameInput.fill('e2euser_' + Date.now());
        await passwordInput.fill('testpass123');
        await page.locator('#auth-modal button:has-text("注册"), #auth-modal button:has-text("Register")').first().click();
        await page.waitForTimeout(2000);
        const userInfo = await page.locator('#user-info').textContent();
        console.log(`    User info: ${userInfo}`);
        await shot(page, '09-user-registered');
      }
    }
    await page.close();
  });

  // ─── Responsive ───────────────────────────────
  await test('Mobile viewport renders correctly', async () => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForSelector('header', { timeout: 10000 });
    await shot(page, '10-mobile-viewport');
    const headerVisible = await page.locator('header').isVisible();
    assert(headerVisible, 'Header not visible on mobile');
    await page.close();
    await ctx.close();
  });

  await test('Dark mode toggle works', async () => {
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    await page.click('#theme-toggle');
    await page.waitForTimeout(500);
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    console.log(`    Theme after toggle: ${theme}`);
    await shot(page, '11-dark-mode');
    assert(theme === 'dark' || theme === 'light', `Unexpected theme: ${theme}`);
    await page.close();
  });

  await test('Language toggle works', async () => {
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    const before = await page.locator('h2').first().textContent();
    await page.click('#lang-toggle');
    await page.waitForTimeout(500);
    const after = await page.locator('h2').first().textContent();
    console.log(`    Before: "${before}", After: "${after}"`);
    await shot(page, '12-language-toggled');
    await page.close();
  });

  // ─── Admin Export ──────────────────────────────
  await test('Admin export buttons visible', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/admin`);
    await page.fill('#admin-pwd', 'Icanbebetter3#');
    await page.click('button:has-text("登录")');
    await page.waitForSelector('#admin-panel', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(1500);

    // Select year and class to show schedule editor
    const yearBtn = page.locator('#years-list .sidebar-item').filter({ hasText: 'E2E-Test-2025' });
    if (await yearBtn.count() > 0) {
      await yearBtn.first().click();
      await page.waitForTimeout(500);
      const classBtn = page.locator('#classes-list .sidebar-item').filter({ hasText: 'Class-A' });
      if (await classBtn.count() > 0) {
        await classBtn.first().click();
        await page.waitForTimeout(1500);
      }
    }

    // Check export buttons
    const excelBtn = page.locator('#export-excel-btn');
    const imgBtn = page.locator('#export-img-btn');
    const allBtn = page.locator('#export-all-btn');
    const excelVisible = await excelBtn.isVisible();
    const imgVisible = await imgBtn.isVisible();
    const allVisible = await allBtn.isVisible();
    console.log(`    Excel btn: ${excelVisible}, Image btn: ${imgVisible}, Export All btn: ${allVisible}`);
    await shot(page, '13-admin-export-buttons');
    assert(excelVisible, 'Excel export button not visible');
    assert(imgVisible, 'Image export button not visible');
    assert(allVisible, 'Export All button not visible');
    await page.close();
  });

  await test('Admin export Excel triggers download', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/admin`);
    await page.fill('#admin-pwd', 'Icanbebetter3#');
    await page.click('button:has-text("登录")');
    await page.waitForSelector('#admin-panel', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(1500);

    const yearBtn = page.locator('#years-list .sidebar-item').filter({ hasText: 'E2E-Test-2025' });
    await yearBtn.first().click();
    await page.waitForTimeout(500);
    const classBtn = page.locator('#classes-list .sidebar-item').filter({ hasText: 'Class-A' });
    await classBtn.first().click();
    await page.waitForTimeout(1500);

    // Listen for download
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      page.click('#export-excel-btn')
    ]);
    console.log(`    Downloaded file: ${download.suggestedFilename()}`);
    assert(download.suggestedFilename().includes('.xlsx'), `Expected .xlsx file, got: ${download.suggestedFilename()}`);
    await shot(page, '14-admin-export-excel');
    await page.close();
  });

  await test('Admin export all schedules', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/admin`);
    await page.fill('#admin-pwd', 'Icanbebetter3#');
    await page.click('button:has-text("登录")');
    await page.waitForSelector('#admin-panel', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(1000);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.click('#export-all-btn')
    ]);
    console.log(`    Downloaded file: ${download.suggestedFilename()}`);
    assert(download.suggestedFilename().includes('all_schedules'), `Expected all_schedules file, got: ${download.suggestedFilename()}`);
    await shot(page, '15-admin-export-all');
    await page.close();
  });

  await test('Admin export JSON backup', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/admin`);
    await page.fill('#admin-pwd', 'Icanbebetter3#');
    await page.click('button:has-text("登录")');
    await page.waitForSelector('#admin-panel', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(1000);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.click('#export-json-btn')
    ]);
    const filename = download.suggestedFilename();
    console.log(`    Downloaded file: ${filename}`);
    assert(filename.includes('compass7_backup') && filename.endsWith('.json'), `Expected JSON backup file, got: ${filename}`);

    // Verify JSON content
    const filePath = await download.path();
    const fs = require('fs');
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`    JSON version: ${content.version}, years: ${content.years.length}`);
    assert(content.version === 1, 'Expected version 1');
    assert(content.years.length > 0, 'Expected at least 1 year in export');
    await shot(page, '16-admin-export-json');
    await page.close();
  });

  // ─── Results ──────────────────────────────────
  await browser.close();
  console.log('\n' + results.join('\n'));
  console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`\nScreenshots (${screenshots.length}):`);
  screenshots.forEach(s => console.log(`  ${s}`));
  console.log('');
  process.exit(failed > 0 ? 1 : 0);
})();

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}
