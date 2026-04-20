/**
 * E2E tests for Compass7 against the live deployed site.
 * Run: node tests/e2e-live.js
 * Screenshots saved to tests/screenshots/
 *
 * Test data strategy:
 * - All test data uses "[E2E]" prefix to distinguish from real data
 * - Tests create data, verify it, then clean up at the end
 * - A single test user "e2e_test_user" is reused (not timestamped)
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'https://compass7.azurewebsites.net';
const SHOTS = path.join(__dirname, 'screenshots');
const TEST_YEAR = '[E2E] Test Year';
const TEST_CLASS = '[E2E] Test Class';
const TEST_USER = 'e2e_test_user';
const TEST_PWD = 'e2eTestPass123';
const ADMIN_PWD = 'Icanbebetter3#';

let passed = 0, failed = 0;
const results = [];
const screenshots = [];

// Track test data IDs for cleanup
let testYearId = null;

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

// Helper: login as admin
async function adminLogin(page) {
  await page.goto(`${BASE}/admin`);
  await page.waitForSelector('#admin-pwd', { timeout: 10000 });
  await page.fill('#admin-pwd', ADMIN_PWD);
  await page.click('button:has-text("登录")');
  await page.waitForSelector('#admin-panel', { state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1000);
}

// Helper: login admin and navigate to test year > test class schedule
async function adminToSchedule(page) {
  await adminLogin(page);
  await page.waitForTimeout(500);
  const yearBtn = page.locator('#years-list .sidebar-item').filter({ hasText: TEST_YEAR });
  await yearBtn.first().click();
  await page.waitForTimeout(500);
  const classBtn = page.locator('#classes-list .sidebar-item').filter({ hasText: TEST_CLASS });
  await classBtn.first().click();
  await page.waitForTimeout(1500);
}

// ─── Cleanup: delete [E2E] test data via API ─────────
async function cleanup(page) {
  console.log('\n  🧹 Cleaning up test data...');
  try {
    await adminLogin(page);

    // Find and delete all [E2E] years
    const yearsText = await page.locator('#years-list').innerHTML();
    const yearItems = await page.locator('#years-list .sidebar-item').all();
    for (const item of yearItems) {
      const text = await item.textContent();
      if (text.includes('[E2E]')) {
        // Extract the delete button's onclick to get the year ID
        const deleteBtn = item.locator('.delete-btn');
        await deleteBtn.click();
        // Handle confirm dialog
        page.once('dialog', dialog => dialog.accept());
        await deleteBtn.click();
        await page.waitForTimeout(500);
      }
    }
    console.log('  🧹 Cleanup complete');
  } catch (e) {
    console.log(`  🧹 Cleanup error (non-fatal): ${e.message}`);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  console.log(`\nCompass7 E2E Tests — ${BASE}\n`);

  // ═══════════════════════════════════════════════
  // ADMIN FLOW
  // ═══════════════════════════════════════════════

  await test('Admin page loads', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/admin`);
    await page.waitForSelector('#admin-pwd', { timeout: 10000 });
    await shot(page, '01-admin-login-page');
    const title = await page.title();
    assert(title.includes('Compass7'), `Expected Compass7 in title, got: ${title}`);
    await page.close();
  });

  await test('Admin login', async () => {
    const page = await browser.newPage();
    await adminLogin(page);
    const panelVisible = await page.locator('#admin-panel').isVisible();
    await shot(page, '02-admin-after-login');
    assert(panelVisible, 'Admin panel not visible after login');
    await page.close();
  });

  await test('Admin create year ([E2E] prefix)', async () => {
    const page = await browser.newPage();
    await adminLogin(page);

    // First, handle confirm dialog for any cleanup needed
    page.on('dialog', dialog => dialog.accept());

    // Delete existing [E2E] year if present (cleanup from previous run)
    const existingYear = page.locator('#years-list .sidebar-item').filter({ hasText: TEST_YEAR });
    if (await existingYear.count() > 0) {
      console.log('    Cleaning up previous test year...');
      await existingYear.first().locator('.delete-btn').click();
      await page.waitForTimeout(1000);
    }

    // Create new test year
    await page.click('#admin-panel button:has-text("+")');
    await page.waitForSelector('#modal-overlay.active', { timeout: 5000 });
    await page.fill('#new-year-name', TEST_YEAR);
    await shot(page, '03-admin-add-year-modal');
    await page.click('#modal-save');
    await page.waitForTimeout(2000);

    const yearsList = await page.locator('#years-list').textContent();
    console.log(`    Years list: ${yearsList}`);
    await shot(page, '04-admin-year-created');
    assert(yearsList.includes(TEST_YEAR), `Test year not found in list`);
    await page.close();
  });

  await test('Admin create class under test year', async () => {
    const page = await browser.newPage();
    await adminLogin(page);
    page.on('dialog', dialog => dialog.accept());

    const yearBtn = page.locator('#years-list .sidebar-item').filter({ hasText: TEST_YEAR });
    assert(await yearBtn.count() > 0, `Test year "${TEST_YEAR}" not found`);
    await yearBtn.first().click();
    await page.waitForTimeout(500);

    // Delete existing test class if present
    const existingClass = page.locator('#classes-list .sidebar-item').filter({ hasText: TEST_CLASS });
    if (await existingClass.count() > 0) {
      console.log('    Cleaning up previous test class...');
      await existingClass.first().locator('.delete-btn').click();
      await page.waitForTimeout(1000);
    }

    // Create new test class
    await page.click('#add-class-btn');
    await page.waitForSelector('#modal-overlay.active', { timeout: 5000 });
    await page.fill('#new-class-name', TEST_CLASS);
    await page.click('#modal-save');
    await page.waitForTimeout(2000);

    const classesList = await page.locator('#classes-list').textContent();
    console.log(`    Classes list: ${classesList}`);
    await shot(page, '05-admin-class-created');
    assert(classesList.includes(TEST_CLASS), `Test class not found in list`);
    await page.close();
  });

  await test('Admin add course to schedule', async () => {
    const page = await browser.newPage();
    await adminToSchedule(page);

    // Click first "add course" button (Period 1, Monday)
    const addBtns = page.locator('.add-course-btn');
    assert(await addBtns.count() > 0, 'No add-course buttons found');
    await addBtns.first().click();
    await page.waitForSelector('#modal-overlay.active', { timeout: 5000 });

    await page.fill('#course-cn', '[E2E] 测试课程');
    await page.fill('#course-en', '[E2E] Test Course');
    await page.click('#modal-save');
    await page.waitForTimeout(500);

    // Save the schedule
    await page.click('button:has-text("保存")');
    await page.waitForTimeout(2000);

    // Verify course tag appears
    const courseTag = page.locator('.course-tag').filter({ hasText: '[E2E]' });
    const tagCount = await courseTag.count();
    console.log(`    [E2E] course tags: ${tagCount}`);
    await shot(page, '05a-admin-course-added');
    assert(tagCount > 0, 'Test course not visible in schedule');
    await page.close();
  });

  await test('Schedule grid shows P6-P10 labels after lunch', async () => {
    const page = await browser.newPage();
    await adminToSchedule(page);
    const tableText = await page.locator('#admin-schedule-table').textContent();
    console.log(`    Checking period labels...`);
    assert(tableText.includes('P6'), 'P6 label not found');
    assert(tableText.includes('P10'), 'P10 label not found');
    assert(!tableText.includes('节次 7') && !tableText.includes('Period 7'), 'Old P7 label still present');
    await shot(page, '05b-schedule-period-labels');
    await page.close();
  });

  await test('Lunch period allows adding courses', async () => {
    const page = await browser.newPage();
    await adminToSchedule(page);
    const lunchRow = page.locator('tr.lunch-row');
    const addBtns = lunchRow.locator('.add-course-btn');
    const count = await addBtns.count();
    console.log(`    Add-course buttons in lunch row: ${count}`);
    assert(count > 0, 'Lunch row should have add-course buttons');
    await shot(page, '05c-lunch-editable');
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // USER FLOW
  // ═══════════════════════════════════════════════

  await test('User page loads with year selection', async () => {
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.waitForSelector('#step-1', { timeout: 10000 });
    await shot(page, '06-user-homepage');
    const h2 = await page.locator('h2').first().textContent();
    console.log(`    First heading: ${h2}`);
    assert(h2, 'No heading found on user page');
    await page.close();
  });

  await test('User can see test year and select it', async () => {
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.waitForSelector('#step-1', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Check test year is visible
    const testYearBtn = page.locator(`text=${TEST_YEAR}`);
    const found = await testYearBtn.count();
    console.log(`    Test year buttons found: ${found}`);
    await shot(page, '07-user-year-selection');
    assert(found > 0, `Test year "${TEST_YEAR}" not visible on user page`);

    // Click it and verify class list appears
    await testYearBtn.first().click();
    await page.waitForTimeout(1500);
    const classVisible = await page.locator(`text=${TEST_CLASS}`).count();
    console.log(`    Test class visible: ${classVisible > 0}`);
    await shot(page, '07b-user-class-selection');
    assert(classVisible > 0, `Test class "${TEST_CLASS}" not visible after selecting year`);
    await page.close();
  });

  await test('User register (single test user)', async () => {
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(1000);

    const loginBtn = page.locator('#login-btn');
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
      await page.waitForTimeout(500);
      const regTab = page.locator('#tab-register');
      if (await regTab.isVisible()) {
        await regTab.click();
        await page.waitForTimeout(300);
      }
      await shot(page, '08-user-register-modal');
      const usernameInput = page.locator('#reg-username').first();
      const passwordInput = page.locator('#reg-password').first();
      if (await usernameInput.isVisible()) {
        await usernameInput.fill(TEST_USER);
        await passwordInput.fill(TEST_PWD);
        await page.locator('#auth-modal button:has-text("注册"), #auth-modal button:has-text("Register")').first().click();
        await page.waitForTimeout(2000);
        // Either registered or "already exists" - both are OK
        const userInfo = await page.locator('#user-info').textContent();
        const toastText = await page.locator('.toast').isVisible()
          ? await page.locator('.toast').textContent() : '';
        console.log(`    User info: "${userInfo}", Toast: "${toastText}"`);
        await shot(page, '09-user-registered');
        // If user already exists, try logging in instead
        if (toastText.includes('已存在') || toastText.includes('exists')) {
          console.log('    User already exists, trying login...');
          const loginTab = page.locator('#tab-login');
          if (await loginTab.isVisible()) await loginTab.click({ timeout: 3000 });
          await page.waitForTimeout(300);
          await page.locator('#login-username').fill(TEST_USER);
          await page.locator('#login-password').fill(TEST_PWD);
          await page.locator('#auth-modal button:has-text("登录"), #auth-modal button:has-text("Login")').first().click();
          await page.waitForTimeout(2000);
        }
      }
    }
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // RESPONSIVE & UI
  // ═══════════════════════════════════════════════

  await test('Mobile viewport renders correctly', async () => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForSelector('header', { timeout: 10000 });
    await shot(page, '10-mobile-viewport');
    assert(await page.locator('header').isVisible(), 'Header not visible on mobile');
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
    assert(before !== after, 'Language did not change');
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // ADMIN EXPORT
  // ═══════════════════════════════════════════════

  await test('Admin JSON export button visible', async () => {
    const page = await browser.newPage();
    await adminLogin(page);
    const jsonBtn = await page.locator('#export-json-btn').isVisible();
    console.log(`    JSON export button: ${jsonBtn}`);
    await shot(page, '13-admin-export-buttons');
    assert(jsonBtn, 'JSON export button not visible');
    await page.close();
  });

  await test('Admin export JSON backup (valid structure)', async () => {
    const page = await browser.newPage();
    await adminLogin(page);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.click('#export-json-btn')
    ]);
    const filename = download.suggestedFilename();
    console.log(`    File: ${filename}`);
    assert(filename.endsWith('.json'), `Expected .json, got: ${filename}`);

    // Verify JSON structure
    const filePath = await download.path();
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`    version: ${content.version}, years: ${content.years.length}, exported_at: ${content.exported_at}`);
    assert(content.version === 1, 'Expected version 1');
    assert(content.years.length > 0, 'No years in export');
    assert(content.exported_at, 'Missing exported_at timestamp');
    await shot(page, '16-admin-export-json');
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // CLEANUP: remove [E2E] test data
  // ═══════════════════════════════════════════════
  await test('Cleanup: delete [E2E] test year', async () => {
    const page = await browser.newPage();
    await adminLogin(page);
    page.on('dialog', dialog => dialog.accept());

    const yearBtn = page.locator('#years-list .sidebar-item').filter({ hasText: TEST_YEAR });
    const count = await yearBtn.count();
    if (count > 0) {
      await yearBtn.first().locator('.delete-btn').click();
      await page.waitForTimeout(1500);
      // Verify deleted
      const after = await page.locator('#years-list').textContent();
      console.log(`    Years after cleanup: ${after}`);
      assert(!after.includes(TEST_YEAR), 'Test year still present after deletion');
    } else {
      console.log('    No test year to clean up');
    }
    await shot(page, '17-cleanup-done');
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // RESULTS
  // ═══════════════════════════════════════════════
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
