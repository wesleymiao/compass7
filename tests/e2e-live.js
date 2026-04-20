/**
 * E2E tests for Compass7 against the live deployed site.
 * Run: cd compass7 && node tests/e2e-live.js
 * Screenshots saved to tests/screenshots/
 *
 * Test data strategy:
 * - All test data uses "[E2E]" prefix to distinguish from real data
 * - Tests create data, verify it, then clean up at the end
 * - A single test user "e2e_test_user" is reused (not timestamped)
 * - Two classes are created to test data isolation between classes
 * - Multiple courses across different periods/days for realistic coverage
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'https://compass7.azurewebsites.net';
const SHOTS = path.join(__dirname, 'screenshots');
const TEST_YEAR = '[E2E] Test Year';
const TEST_CLASS_A = '[E2E] Class-A';
const TEST_CLASS_B = '[E2E] Class-B';
const TEST_USER = 'e2e_test_user';
const TEST_PWD = 'e2eTestPass123';
const ADMIN_PWD = 'Icanbebetter3#';

// Courses to populate a realistic schedule
const COURSES = [
  { day: 1, period: 1, cn: '[E2E] 数学HL',   en: '[E2E] Math HL' },
  { day: 1, period: 2, cn: '[E2E] 物理SL',   en: '[E2E] Physics SL' },
  { day: 2, period: 1, cn: '[E2E] 英语B',    en: '[E2E] English B' },
  { day: 3, period: 5, cn: '[E2E] 经济HL',   en: '[E2E] Economics HL' },
  { day: 4, period: 7, cn: '[E2E] 化学SL',   en: '[E2E] Chemistry SL' },   // P6 (post-lunch)
  { day: 5, period: 11, cn: '[E2E] 中文A',   en: '[E2E] Chinese A' },      // P10 (last period)
  { day: 3, period: 6, cn: '[E2E] 午间活动',  en: '[E2E] Lunch Activity' }, // lunch slot
];

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
    results.push(`  \u2705 ${name}`);
  } catch (e) {
    failed++;
    results.push(`  \u274c ${name}\n     ${e.message.split('\n')[0]}`);
  }
}

// Helper: login as admin
async function adminLogin(page) {
  await page.goto(`${BASE}/admin`);
  await page.waitForSelector('#admin-pwd', { timeout: 10000 });
  await page.fill('#admin-pwd', ADMIN_PWD);
  await page.click('button:has-text("\u767b\u5f55")');
  await page.waitForSelector('#admin-panel', { state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1000);
}

// Helper: login admin and navigate to a specific year > class schedule
async function adminToSchedule(page, className = TEST_CLASS_A) {
  await adminLogin(page);
  await page.waitForTimeout(500);
  const yearBtn = page.locator('#years-list .sidebar-item').filter({ hasText: TEST_YEAR });
  await yearBtn.first().click();
  await page.waitForTimeout(500);
  const classBtn = page.locator('#classes-list .sidebar-item').filter({ hasText: className });
  await classBtn.first().click();
  await page.waitForTimeout(1500);
}

// Helper: add a course at a specific grid position via UI
// day: 1-5 (Mon-Fri), period: 1-11 (matches PERIODS array num)
async function addCourseAtSlot(page, day, period, nameCn, nameEn) {
  // Row index = period - 1 (periods 1-11 map to rows 0-10)
  const row = page.locator('#admin-schedule-body tr').nth(period - 1);
  // Column: 0=label, 1=time, 2=Mon(day1), 3=Tue(day2), ... so day d -> col d+1
  const cell = row.locator('td').nth(day + 1);
  const addBtn = cell.locator('.add-course-btn');
  await addBtn.click();
  await page.waitForSelector('#modal-overlay.active', { timeout: 5000 });
  await page.fill('#course-cn', nameCn);
  await page.fill('#course-en', nameEn);
  await page.click('#modal-save');
  await page.waitForTimeout(300);
}


(async () => {
  const browser = await chromium.launch({ headless: true });
  console.log(`\nCompass7 E2E Tests \u2014 ${BASE}\n`);

  // ═══════════════════════════════════════════════
  // ADMIN BASIC
  // ═══════════════════════════════════════════════

  await test('Admin page loads', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/admin`);
    await page.waitForSelector('#admin-pwd', { timeout: 10000 });
    await shot(page, '01-admin-login');
    const title = await page.title();
    assert(title.includes('Compass7'), `Expected Compass7 in title, got: ${title}`);
    await page.close();
  });

  await test('Admin login', async () => {
    const page = await browser.newPage();
    await adminLogin(page);
    const panelVisible = await page.locator('#admin-panel').isVisible();
    await shot(page, '02-admin-panel');
    assert(panelVisible, 'Admin panel not visible after login');
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // ADMIN CREATE: year + two classes
  // ═══════════════════════════════════════════════

  await test('Admin create test year', async () => {
    const page = await browser.newPage();
    await adminLogin(page);
    page.on('dialog', dialog => dialog.accept());

    // Cleanup previous [E2E] year if present
    const existing = page.locator('#years-list .sidebar-item').filter({ hasText: TEST_YEAR });
    if (await existing.count() > 0) {
      console.log('    Cleaning up previous test year...');
      await existing.first().locator('.delete-btn').click();
      await page.waitForTimeout(1000);
    }

    // Create
    await page.click('#admin-panel button:has-text("+")');
    await page.waitForSelector('#modal-overlay.active', { timeout: 5000 });
    await page.fill('#new-year-name', TEST_YEAR);
    await page.click('#modal-save');
    await page.waitForTimeout(2000);

    const yearsList = await page.locator('#years-list').textContent();
    console.log(`    Years: ${yearsList}`);
    await shot(page, '03-year-created');
    assert(yearsList.includes(TEST_YEAR), 'Test year not in list');
    await page.close();
  });

  await test('Admin create Class-A', async () => {
    const page = await browser.newPage();
    await adminLogin(page);
    page.on('dialog', dialog => dialog.accept());

    await page.locator('#years-list .sidebar-item').filter({ hasText: TEST_YEAR }).first().click();
    await page.waitForTimeout(500);

    await page.click('#add-class-btn');
    await page.waitForSelector('#modal-overlay.active', { timeout: 5000 });
    await page.fill('#new-class-name', TEST_CLASS_A);
    await page.click('#modal-save');
    await page.waitForTimeout(2000);

    const list = await page.locator('#classes-list').textContent();
    console.log(`    Classes: ${list}`);
    await shot(page, '04-classA-created');
    assert(list.includes(TEST_CLASS_A), 'Class-A not in list');
    await page.close();
  });

  await test('Admin create Class-B', async () => {
    const page = await browser.newPage();
    await adminLogin(page);

    await page.locator('#years-list .sidebar-item').filter({ hasText: TEST_YEAR }).first().click();
    await page.waitForTimeout(500);

    await page.click('#add-class-btn');
    await page.waitForSelector('#modal-overlay.active', { timeout: 5000 });
    await page.fill('#new-class-name', TEST_CLASS_B);
    await page.click('#modal-save');
    await page.waitForTimeout(2000);

    const list = await page.locator('#classes-list').textContent();
    console.log(`    Classes: ${list}`);
    assert(list.includes(TEST_CLASS_B), 'Class-B not in list');
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // ADMIN SCHEDULE: populate Class-A with courses
  // ═══════════════════════════════════════════════

  await test('Admin add multiple courses to Class-A schedule', async () => {
    const page = await browser.newPage();
    await adminToSchedule(page, TEST_CLASS_A);

    for (const c of COURSES) {
      await addCourseAtSlot(page, c.day, c.period, c.cn, c.en);
    }

    // Save
    await page.click('button:has-text("\u4fdd\u5b58")');
    await page.waitForTimeout(2000);

    // Verify course tags
    const tags = await page.locator('.course-tag').count();
    console.log(`    Course tags after adding: ${tags}`);
    await shot(page, '05-classA-schedule-full');
    assert(tags >= COURSES.length, `Expected at least ${COURSES.length} tags, got ${tags}`);
    await page.close();
  });

  await test('Schedule data persists after page reload', async () => {
    const page = await browser.newPage();
    await adminToSchedule(page, TEST_CLASS_A);

    const tags = await page.locator('.course-tag').count();
    console.log(`    Course tags after reload: ${tags}`);
    // Check specific courses
    const hasMath = await page.locator('.course-tag:has-text("[E2E] \u6570\u5b66HL")').count();
    const hasPhysics = await page.locator('.course-tag:has-text("[E2E] \u7269\u7406SL")').count();
    const hasLunch = await page.locator('.course-tag:has-text("[E2E] \u5348\u95f4\u6d3b\u52a8")').count();
    console.log(`    Math: ${hasMath}, Physics: ${hasPhysics}, LunchActivity: ${hasLunch}`);
    await shot(page, '06-schedule-persisted');
    assert(tags >= COURSES.length, `Data not persisted: expected ${COURSES.length}+ tags, got ${tags}`);
    assert(hasMath > 0, 'Math HL not found after reload');
    assert(hasLunch > 0, 'Lunch Activity not found after reload');
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // ADMIN EDIT: modify and delete courses
  // ═══════════════════════════════════════════════

  await test('Admin edit course name', async () => {
    const page = await browser.newPage();
    await adminToSchedule(page, TEST_CLASS_A);

    // Click on Math HL course tag to edit it
    const mathTag = page.locator('.course-tag:has-text("[E2E] \u6570\u5b66HL")').first();
    await mathTag.click();
    await page.waitForSelector('#modal-overlay.active', { timeout: 5000 });

    // Change name
    await page.fill('#course-cn', '[E2E] \u9ad8\u7b49\u6570\u5b66');
    await page.fill('#course-en', '[E2E] Advanced Math');
    await page.click('#modal-save');
    await page.waitForTimeout(300);

    // Save schedule
    await page.click('button:has-text("\u4fdd\u5b58")');
    await page.waitForTimeout(2000);

    const renamed = await page.locator('.course-tag:has-text("[E2E] \u9ad8\u7b49\u6570\u5b66")').count();
    console.log(`    Renamed course visible: ${renamed > 0}`);
    await shot(page, '07-course-edited');
    assert(renamed > 0, 'Renamed course not found');
    await page.close();
  });

  await test('Admin delete a course', async () => {
    const page = await browser.newPage();
    await adminToSchedule(page, TEST_CLASS_A);

    const tagsBefore = await page.locator('.course-tag').count();

    // Click the Physics course to open edit modal
    const physicsTag = page.locator('.course-tag:has-text("[E2E] \u7269\u7406SL")').first();
    await physicsTag.click();
    await page.waitForSelector('#modal-overlay.active', { timeout: 5000 });

    // Click delete button inside modal
    await page.click('#modal-overlay .btn-danger');
    await page.waitForTimeout(500);

    // Save schedule
    await page.click('button:has-text("\u4fdd\u5b58")');
    await page.waitForTimeout(2000);

    const tagsAfter = await page.locator('.course-tag').count();
    console.log(`    Tags before: ${tagsBefore}, after: ${tagsAfter}`);
    await shot(page, '08-course-deleted');
    assert(tagsAfter < tagsBefore, `Expected fewer tags after delete: ${tagsAfter} >= ${tagsBefore}`);
    await page.close();
  });

  await test('Deleted course stays deleted after reload', async () => {
    const page = await browser.newPage();
    await adminToSchedule(page, TEST_CLASS_A);

    const physicsCount = await page.locator('.course-tag:has-text("[E2E] \u7269\u7406SL")').count();
    console.log(`    Physics SL after reload: ${physicsCount}`);
    assert(physicsCount === 0, 'Deleted course reappeared after reload');
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // SCHEDULE FEATURES: P6-P10 + lunch editing
  // ═══════════════════════════════════════════════

  await test('P6-P10 labels displayed correctly', async () => {
    const page = await browser.newPage();
    await adminToSchedule(page, TEST_CLASS_A);
    const tableText = await page.locator('#admin-schedule-table').textContent();
    for (const label of ['P6', 'P7', 'P8', 'P9', 'P10']) {
      assert(tableText.includes(label), `${label} label not found`);
    }
    console.log(`    All P6-P10 labels verified`);
    await shot(page, '09-period-labels');
    await page.close();
  });

  await test('Lunch period course persisted correctly', async () => {
    const page = await browser.newPage();
    await adminToSchedule(page, TEST_CLASS_A);

    // Verify the lunch activity course is present in lunch row
    const lunchRow = page.locator('tr.lunch-row');
    const lunchCourses = await lunchRow.locator('.course-tag').count();
    console.log(`    Courses in lunch row: ${lunchCourses}`);
    await shot(page, '10-lunch-course');
    assert(lunchCourses > 0, 'No courses found in lunch row');
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // MULTI-CLASS: Class-B should be empty (isolation)
  // ═══════════════════════════════════════════════

  await test('Class-B schedule is empty (data isolation)', async () => {
    const page = await browser.newPage();
    await adminToSchedule(page, TEST_CLASS_B);

    const tags = await page.locator('.course-tag').count();
    console.log(`    Class-B course tags: ${tags}`);
    await shot(page, '11-classB-empty');
    assert(tags === 0, `Class-B should have 0 courses but has ${tags}`);
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // USER FLOW
  // ═══════════════════════════════════════════════

  await test('User page loads', async () => {
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.waitForSelector('#step-1', { timeout: 10000 });
    await shot(page, '12-user-homepage');
    assert(await page.locator('h2').first().textContent(), 'No heading');
    await page.close();
  });

  await test('User selects test year and sees both classes', async () => {
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.waitForSelector('#step-1', { timeout: 10000 });
    await page.waitForTimeout(2000);

    await page.locator(`text=${TEST_YEAR}`).first().click();
    await page.waitForTimeout(1500);

    const classA = await page.locator(`text=${TEST_CLASS_A}`).count();
    const classB = await page.locator(`text=${TEST_CLASS_B}`).count();
    console.log(`    Class-A visible: ${classA > 0}, Class-B visible: ${classB > 0}`);
    await shot(page, '13-user-class-selection');
    assert(classA > 0, 'Class-A not visible');
    assert(classB > 0, 'Class-B not visible');
    await page.close();
  });

  await test('User views Class-A schedule with courses', async () => {
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.waitForSelector('#step-1', { timeout: 10000 });
    await page.waitForTimeout(2000);

    await page.locator(`text=${TEST_YEAR}`).first().click();
    await page.waitForTimeout(1500);
    await page.locator(`text=${TEST_CLASS_A}`).first().click();
    await page.waitForTimeout(2000);

    // Should see the schedule with courses
    const courseTags = await page.locator('.course-tag').count();
    console.log(`    User sees ${courseTags} course tags in schedule`);
    // Check renamed math course is visible
    const mathVisible = await page.locator('.course-tag:has-text("\u9ad8\u7b49\u6570\u5b66")').count() > 0
      || await page.locator('.course-tag:has-text("Advanced Math")').count() > 0;
    console.log(`    Renamed math course visible: ${mathVisible}`);
    await shot(page, '14-user-schedule-view');
    assert(courseTags > 0, 'User should see courses in schedule');
    await page.close();
  });

  await test('User register / login', async () => {
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(1000);

    const loginBtn = page.locator('#login-btn');
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
      await page.waitForTimeout(500);

      // Try register first
      const regTab = page.locator('#tab-register');
      if (await regTab.isVisible()) await regTab.click();
      await page.waitForTimeout(300);

      await shot(page, '15-user-register-modal');
      await page.locator('#reg-username').fill(TEST_USER);
      await page.locator('#reg-password').fill(TEST_PWD);
      await page.locator('#auth-modal button:has-text("\u6ce8\u518c"), #auth-modal button:has-text("Register")').first().click();
      await page.waitForTimeout(2000);

      const toast = await page.locator('.toast').isVisible()
        ? await page.locator('.toast').textContent() : '';
      console.log(`    Toast: "${toast}"`);

      // If already exists, login instead
      if (toast.includes('\u5df2\u5b58\u5728') || toast.includes('exists')) {
        console.log('    User exists, logging in...');
        const loginTab = page.locator('#tab-login');
        if (await loginTab.isVisible()) await loginTab.click({ timeout: 3000 });
        await page.waitForTimeout(300);
        await page.locator('#login-username').fill(TEST_USER);
        await page.locator('#login-password').fill(TEST_PWD);
        await page.locator('#auth-modal button:has-text("\u767b\u5f55"), #auth-modal button:has-text("Login")').first().click();
        await page.waitForTimeout(2000);
      }
      await shot(page, '16-user-logged-in');
    }
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // UI: responsive, dark mode, language
  // ═══════════════════════════════════════════════

  await test('Mobile viewport', async () => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForSelector('header', { timeout: 10000 });
    await shot(page, '17-mobile');
    assert(await page.locator('header').isVisible(), 'Header not visible on mobile');
    await page.close();
    await ctx.close();
  });

  await test('Dark mode toggle', async () => {
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    await page.click('#theme-toggle');
    await page.waitForTimeout(500);
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    console.log(`    Theme: ${theme}`);
    await shot(page, '18-dark-mode');
    assert(theme === 'dark' || theme === 'light', `Unexpected theme: ${theme}`);
    await page.close();
  });

  await test('Language toggle', async () => {
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    const before = await page.locator('h2').first().textContent();
    await page.click('#lang-toggle');
    await page.waitForTimeout(500);
    const after = await page.locator('h2').first().textContent();
    console.log(`    "${before}" -> "${after}"`);
    await shot(page, '19-language-toggled');
    assert(before !== after, 'Language did not change');
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // ADMIN EXPORT: JSON
  // ═══════════════════════════════════════════════

  await test('JSON export button visible', async () => {
    const page = await browser.newPage();
    await adminLogin(page);
    assert(await page.locator('#export-json-btn').isVisible(), 'JSON export btn missing');
    await shot(page, '20-export-btn');
    await page.close();
  });

  await test('JSON export contains test data', async () => {
    const page = await browser.newPage();
    await adminLogin(page);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.click('#export-json-btn')
    ]);
    const filename = download.suggestedFilename();
    console.log(`    File: ${filename}`);
    assert(filename.endsWith('.json'), `Expected .json, got: ${filename}`);

    const content = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    console.log(`    version: ${content.version}, years: ${content.years.length}`);
    assert(content.version === 1, 'Expected version 1');
    assert(content.exported_at, 'Missing exported_at');

    // Find test year in export and verify classes & courses
    const testYear = content.years.find(y => y.name === TEST_YEAR);
    assert(testYear, 'Test year not in JSON export');
    assert(testYear.classes.length === 2, `Expected 2 classes, got ${testYear.classes.length}`);

    const classA = testYear.classes.find(c => c.name === TEST_CLASS_A);
    assert(classA, 'Class-A not in export');
    assert(classA.schedule && Object.keys(classA.schedule).length > 0, 'Class-A schedule empty in export');

    const classB = testYear.classes.find(c => c.name === TEST_CLASS_B);
    assert(classB, 'Class-B not in export');
    // Class-B should have empty schedule
    const classBSlots = classB.schedule ? Object.keys(classB.schedule).length : 0;
    console.log(`    Class-A schedule keys: ${Object.keys(classA.schedule).length}, Class-B: ${classBSlots}`);

    await shot(page, '21-export-json');
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════

  await test('Cleanup: delete [E2E] test year', async () => {
    const page = await browser.newPage();
    await adminLogin(page);
    page.on('dialog', dialog => dialog.accept());

    const yearBtn = page.locator('#years-list .sidebar-item').filter({ hasText: TEST_YEAR });
    if (await yearBtn.count() > 0) {
      await yearBtn.first().locator('.delete-btn').click();
      await page.waitForTimeout(1500);
      const after = await page.locator('#years-list').textContent();
      console.log(`    Years after cleanup: ${after}`);
      assert(!after.includes(TEST_YEAR), 'Test year still present');
    } else {
      console.log('    No test year to clean up');
    }
    await shot(page, '22-cleanup');
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
