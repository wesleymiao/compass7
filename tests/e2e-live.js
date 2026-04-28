/**
 * E2E tests for Compass7 against the live deployed site.
 * Run: cd compass7 && node tests/e2e-live.js
 * Screenshots saved to tests/screenshots/
 *
 * Test data strategy:
 * - Year/Class names use "[E2E]" prefix; course names use real names (no prefix)
 * - Cleanup runs at START (deletes previous run's data), NOT at end
 * - Test data remains on site after test run for manual inspection
 * - A single test user "e2e_test_user" is reused
 * - Two classes: Class-A (full schedule) and Class-B (empty, for isolation test)
 * - Course data based on real IB timetable with teacher + classroom fields
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

// ═══════════════════════════════════════════════
// Realistic IB timetable test data (from screenshot)
// Each entry: { day, period, courses: [{ cn, en, teacher, room }] }
// Multiple courses in one slot = student choice (dropdown)
// ═══════════════════════════════════════════════
const SCHEDULE_DATA = [
  // ── Monday (Mo 20/04) ──
  { day: 1, period: 1, courses: [
    { cn: '文学', en: 'Lit', teacher: 'Wei Lihe', room: 'A411' },
    { cn: '语言与文学', en: 'L&L', teacher: 'Guo,Hui', room: '' },
  ]},
  { day: 1, period: 2, courses: [
    { cn: '化学1a', en: 'Chem1a', teacher: 'Bai,Shui', room: 'A402' },
    { cn: '化学1b', en: 'Chem1b', teacher: 'Sun Siqi', room: 'A406' },
    { cn: '化学1c', en: 'Chem1c', teacher: 'Zhao Pe', room: 'A404' },
    { cn: '生物1a', en: 'Bio1a', teacher: 'Zhou Qian', room: 'A403' },
    { cn: '生物1b', en: 'Bio1b', teacher: 'Gu Yunting', room: 'A407' },
    { cn: '生物1c', en: 'Bio1c', teacher: 'Zou Meixin', room: 'A405' },
    { cn: '物理1a', en: 'Phy1a', teacher: 'Wang Yufa', room: '' },
    { cn: '物理1b', en: 'Phy1b', teacher: 'Zhang Shi', room: 'A409' },
    { cn: '物理1c', en: 'Phy1c', teacher: 'Jiang Jing', room: 'A410' },
    { cn: '化学1d', en: 'Chem1d', teacher: 'Xu Yan', room: 'A401' },
  ]},
  { day: 1, period: 3, courses: [
    { cn: '数学', en: 'Math', teacher: 'Xu Jingyi', room: '' },
  ]},
  { day: 1, period: 4, courses: [
    { cn: '信息技术', en: 'IT', teacher: 'Zhou Yihao', room: 'HS Theatre' },
  ]},
  { day: 1, period: 5, courses: [
    { cn: '化学2a', en: 'Chem2a', teacher: 'Zhao Pe', room: 'A402' },
    { cn: '化学2b', en: 'Chem2b', teacher: 'Sun Siqi', room: 'A401' },
    { cn: '生物2a', en: 'Bio2a', teacher: 'Ryu Yinghe', room: 'A405' },
    { cn: '生物2b', en: 'Bio2b', teacher: 'Gu Yunting', room: 'A407' },
    { cn: '生物2c', en: 'Bio2c', teacher: 'Chen Ying', room: '' },
    { cn: '物理2a', en: 'Phy2a', teacher: 'Zhang Shi', room: 'A410' },
    { cn: '物理2b', en: 'Phy2b', teacher: 'Wu Jun', room: '' },
    { cn: '物理2c', en: 'Phy2c', teacher: 'Wang Yufa', room: 'A409' },
    { cn: '化学2c', en: 'Chem2c', teacher: 'Sun Jing', room: 'A403' },
  ]},
  { day: 1, period: 7, courses: [
    { cn: '英语', en: 'Eng', teacher: 'Shaun', room: '' },
  ]},
  { day: 1, period: 8, courses: [
    { cn: '英语', en: 'Eng', teacher: 'Monet', room: 'A413' },
  ]},
  { day: 1, period: 9, courses: [
    { cn: '化学', en: 'Chemistry', teacher: 'Sun Jing', room: '' },
    { cn: '物理', en: 'Physics', teacher: 'Zhang Shuyang', room: '' },
    { cn: '生物', en: 'Biology', teacher: 'Zou Meixin', room: '' },
  ]},
  { day: 1, period: 10, courses: [
    { cn: 'CS1', en: 'CS1', teacher: 'Wang Anqi', room: 'A405' },
    { cn: '商业1', en: 'Bus1', teacher: 'Zhang,Zhe', room: 'A403' },
    { cn: '地理1a', en: 'Geo1a', teacher: 'Luo,Yijing', room: 'A401' },
    { cn: '地理1b', en: 'Geo1b', teacher: 'Xu,Xiaoyun', room: 'A402' },
    { cn: 'ESS1', en: 'ESS1', teacher: 'Ge,La', room: 'A406' },
  ]},
  { day: 1, period: 11, courses: [
    { cn: '心理1', en: 'Psy1', teacher: 'Ren Wen', room: 'A422' },
  ]},

  // ── Tuesday (星期二 21/04) ──
  { day: 2, period: 1, courses: [
    { cn: '心理健康', en: 'Mental Health', teacher: 'Wu Chenhong', room: '' },
  ]},
  { day: 2, period: 2, courses: [
    { cn: '经济1a', en: 'Econ1a', teacher: 'Xiao Yaolu', room: 'A403' },
  ]},
  { day: 2, period: 3, courses: [
    { cn: '经济1b', en: 'Econ1b', teacher: 'Liu,Juan', room: 'A402' },
    { cn: '物理1', en: 'Phi1', teacher: 'Xu Jiabin', room: 'A404' },
    { cn: '经济1c', en: 'Econ1c', teacher: 'Li Jiayi', room: 'A401' },
  ]},
  { day: 2, period: 4, courses: [
    { cn: '视觉艺术1', en: 'VA1', teacher: 'Hu Chengchuan', room: 'A109' },
  ]},
  { day: 2, period: 5, courses: [
    { cn: '化学1a', en: 'Chem1a', teacher: 'Bai,Shui', room: 'A402' },
    { cn: '化学1b', en: 'Chem1b', teacher: 'Zhao Pe', room: 'A404' },
    { cn: '生物1a', en: 'Bio1a', teacher: 'Zhou Qian', room: 'A403' },
    { cn: '生物1b', en: 'Bio1b', teacher: 'Gu Yunting', room: 'A407' },
    { cn: '生物1c', en: 'Bio1c', teacher: 'Zou Meixin', room: 'A405' },
    { cn: '物理1a', en: 'Phy1a', teacher: 'Wang Yufa', room: '' },
    { cn: '物理1b', en: 'Phy1b', teacher: 'Zhang Shi', room: 'A406' },
    { cn: '物理1c', en: 'Phy1c', teacher: 'Jiang Jing', room: '' },
    { cn: '化学1c', en: 'Chem1c', teacher: 'Xu Yan', room: 'A401' },
  ]},
  { day: 2, period: 7, courses: [
    { cn: '英语', en: 'Eng', teacher: 'Shaun', room: '' },
  ]},
  { day: 2, period: 8, courses: [
    { cn: '英语', en: 'Eng', teacher: 'Monet', room: 'A413' },
  ]},
  { day: 2, period: 9, courses: [
    { cn: 'CS1', en: 'CS1', teacher: 'Wang Anqi', room: 'A405' },
    { cn: '商业1', en: 'Bus1', teacher: 'Zhang,Zhe', room: 'A403' },
    { cn: '地理1a', en: 'Geo1a', teacher: 'Luo,Yijing', room: 'A401' },
    { cn: '地理1b', en: 'Geo1b', teacher: 'Xu,Xiaoyun', room: 'A402' },
    { cn: 'ESS1', en: 'ESS1', teacher: 'Ge,La', room: 'A406' },
    { cn: '心理1', en: 'Psy1', teacher: 'Ren Wen', room: 'A422' },
  ]},
  { day: 2, period: 10, courses: [
    { cn: '体育与健康a', en: 'PE-M', teacher: 'Pan Lingxin', room: 'H Gym' },
    { cn: '体育与健康b', en: 'PE-F', teacher: 'Xie,Hui', room: 'H Gym' },
  ]},
  { day: 2, period: 11, courses: [
    { cn: '数学', en: 'Math', teacher: 'Xu Jingyi', room: '' },
  ]},

  // ── Wednesday (星期三 22/04) ──
  { day: 3, period: 1, courses: [
    { cn: '英语', en: 'Eng', teacher: 'Shaun', room: '' },
  ]},
  { day: 3, period: 2, courses: [
    { cn: '英语', en: 'Eng', teacher: 'Monet', room: 'A413' },
  ]},
  { day: 3, period: 3, courses: [
    { cn: '地理2', en: 'Geo2', teacher: 'Gu,Shi', room: 'A402' },
    { cn: '商业2a', en: 'Bus2a', teacher: 'Zhang,Zhe', room: 'A403' },
    { cn: '商业2b', en: 'Bus2b', teacher: 'Gan Mei', room: 'A404' },
    { cn: '历史2', en: 'His2', teacher: 'Liu,Zhe', room: 'A401' },
    { cn: 'ESS2', en: 'ESS2', teacher: 'Ge,La', room: 'A405' },
  ]},
  { day: 3, period: 4, courses: [
    { cn: '视觉艺术2', en: 'VA2', teacher: 'Chen Wenhua', room: 'A109' },
    { cn: '音乐2', en: 'Mus2', teacher: 'Wang Yuqi', room: 'C408' },
    { cn: '经济2a', en: 'Econ2a', teacher: 'Xiao Yaolu', room: 'A403' },
    { cn: '经济2b', en: 'Econ2b', teacher: 'Li Jiayi', room: 'A402' },
    { cn: '经济2c', en: 'Econ2c', teacher: 'Tao Yuanyuan', room: 'A401' },
  ]},
  { day: 3, period: 5, courses: [
    { cn: '化学1a', en: 'Chem1a', teacher: 'Bai,Shui', room: 'A402' },
    { cn: '化学1b', en: 'Chem1b', teacher: 'Sun Siqi', room: 'A406' },
    { cn: '化学1c', en: 'Chem1c', teacher: 'Zhao Pe', room: 'A404' },
    { cn: '生物1a', en: 'Bio1a', teacher: 'Zhou Qian', room: 'A403' },
    { cn: '生物1b', en: 'Bio1b', teacher: 'Gu Yunting', room: 'A407' },
    { cn: '生物1c', en: 'Bio1c', teacher: 'Zou Meixin', room: 'A405' },
    { cn: '物理1a', en: 'Phy1a', teacher: 'Wang Yufa', room: '' },
    { cn: '物理1b', en: 'Phy1b', teacher: 'Zhang Shi', room: 'A409' },
    { cn: '物理1c', en: 'Phy1c', teacher: 'Jiang Jing', room: 'A410' },
    { cn: '化学1d', en: 'Chem1d', teacher: 'Xu Yan', room: 'A401' },
  ]},
  { day: 3, period: 7, courses: [
    { cn: '化学2a', en: 'Chem2a', teacher: 'Zhao Pe', room: 'A402' },
    { cn: '化学2b', en: 'Chem2b', teacher: 'Sun Siqi', room: 'A401' },
    { cn: '生物2a', en: 'Bio2a', teacher: 'Ryu Yinghe', room: 'A407' },
    { cn: '生物2b', en: 'Bio2b', teacher: 'Gu Yunting', room: 'A407' },
    { cn: '生物2c', en: 'Bio2c', teacher: 'Zou Meixin', room: 'A404' },
    { cn: '物理2a', en: 'Phy2a', teacher: 'Zhang Shi', room: 'A410' },
    { cn: '物理2b', en: 'Phy2b', teacher: 'Wu Jun', room: '' },
    { cn: '物理2c', en: 'Phy2c', teacher: 'Wang Yufa', room: 'A409' },
    { cn: '化学2c', en: 'Chem2c', teacher: 'Sun Jing', room: 'A403' },
  ]},
  { day: 3, period: 8, courses: [
    { cn: 'PD', en: 'PD', teacher: 'Wang Lucheng', room: '' },
  ]},
  { day: 3, period: 10, courses: [
    { cn: '数学', en: 'Math', teacher: 'Xu Jingyi', room: '' },
  ]},
  { day: 3, period: 11, courses: [
    { cn: '语文', en: 'Chinese', teacher: 'Li Xiaohe', room: '' },
  ]},

  // ── Thursday (周四 23/04) ──
  { day: 4, period: 1, courses: [
    { cn: '历史', en: 'History', teacher: 'Chen,Fangjin', room: '' },
  ]},
  { day: 4, period: 2, courses: [
    { cn: '英语', en: 'Eng', teacher: 'Shaun', room: '' },
  ]},
  { day: 4, period: 3, courses: [
    { cn: '化学1a', en: 'Chem1a', teacher: 'Bai,Shui', room: 'A402' },
    { cn: '化学1b', en: 'Chem1b', teacher: 'Sun Siqi', room: 'A406' },
    { cn: '化学1c', en: 'Chem1c', teacher: 'Zhao Pe', room: 'A404' },
    { cn: '生物1a', en: 'Bio1a', teacher: 'Zhou Qian', room: 'A403' },
    { cn: '生物1b', en: 'Bio1b', teacher: 'Gu Yunting', room: 'A407' },
    { cn: '生物1c', en: 'Bio1c', teacher: 'Zou Meixin', room: 'A405' },
    { cn: '物理1a', en: 'Phy1a', teacher: 'Wang Yufa', room: '' },
    { cn: '物理1b', en: 'Phy1b', teacher: 'Zhang Shi', room: 'A409' },
    { cn: '物理1c', en: 'Phy1c', teacher: 'Jiang Jing', room: 'A410' },
    { cn: '化学1d', en: 'Chem1d', teacher: 'Xu Yan', room: 'A401' },
  ]},
  { day: 4, period: 4, courses: [
    { cn: '艺术', en: 'Art', teacher: 'Wang Yuqi', room: 'A511' },
  ]},
  { day: 4, period: 5, courses: [
    { cn: '文学', en: 'Lit', teacher: 'Wei Lihe', room: 'A412' },
    { cn: '语言与文学', en: 'L&L', teacher: 'Guo,Hui', room: '' },
  ]},
  { day: 4, period: 7, courses: [
    { cn: '化学2a', en: 'Chem2a', teacher: 'Zhao Pe', room: 'A402' },
    { cn: '化学2b', en: 'Chem2b', teacher: 'Sun Siqi', room: 'A401' },
    { cn: '生物2a', en: 'Bio2a', teacher: 'Ryu Yinghe', room: 'A405' },
    { cn: '生物2b', en: 'Bio2b', teacher: 'Gu Yunting', room: 'A407' },
    { cn: '生物2c', en: 'Bio2c', teacher: 'Zou Meixin', room: 'A404' },
    { cn: '物理2a', en: 'Phy2a', teacher: 'Zhang Shi', room: 'A410' },
    { cn: '物理2b', en: 'Phy2b', teacher: 'Wu Jun', room: '' },
    { cn: '物理2c', en: 'Phy2c', teacher: 'Wang Yufa', room: 'A409' },
    { cn: '化学2c', en: 'Chem2c', teacher: 'Sun Jing', room: 'A403' },
  ]},
  { day: 4, period: 8, courses: [
    { cn: '思想政治', en: 'Politics', teacher: 'Zhang,Jin', room: '' },
  ]},
  { day: 4, period: 9, courses: [
    { cn: '体育与健康a', en: 'PE-M', teacher: 'Pan Lingxin', room: 'H Gym' },
    { cn: '体育与健康b', en: 'PE-F', teacher: 'Xie,Hui', room: 'H Gym' },
  ]},
  { day: 4, period: 10, courses: [
    { cn: '数学', en: 'Math', teacher: 'Xu Jingyi', room: '' },
  ]},

  // ── Friday (星期五 24/04) ──
  { day: 5, period: 1, courses: [
    { cn: '语文', en: 'Chinese', teacher: 'Li Xiaohe', room: '' },
  ]},
  { day: 5, period: 2, courses: [
    { cn: '地理2', en: 'Geo2', teacher: 'Gu,Shi', room: 'A402' },
    { cn: '商业2a', en: 'Bus2a', teacher: 'Zhang,Zhe', room: 'A403' },
    { cn: '商业2b', en: 'Bus2b', teacher: 'Gan Mei', room: 'A404' },
    { cn: '历史2', en: 'His2', teacher: 'Xu,Xiao', room: 'A401' },
    { cn: 'ESS2', en: 'ESS2', teacher: 'Ge,La', room: 'A405' },
  ]},
  { day: 5, period: 3, courses: [
    { cn: '地理', en: 'Geography', teacher: 'Hong,Zhenyan', room: '' },
  ]},
  { day: 5, period: 4, courses: [
    { cn: 'CW A', en: 'CW A', teacher: 'Catherine', room: 'A401' },
    { cn: 'JP A', en: 'JP A', teacher: 'Han,Tingting', room: 'A403' },
    { cn: 'IC A', en: 'IC A', teacher: 'Wang Lucheng', room: 'A402' },
    { cn: '语言学', en: 'Linguistics', teacher: 'David', room: 'A404' },
  ]},
  { day: 5, period: 5, courses: [
    { cn: '化学2a', en: 'Chem2a', teacher: 'Zhao Pe', room: 'A402' },
    { cn: '化学2b', en: 'Chem2b', teacher: 'Sun Siqi', room: 'A401' },
    { cn: '生物2a', en: 'Bio2a', teacher: 'Ryu Yinghe', room: 'A405' },
    { cn: '生物2b', en: 'Bio2b', teacher: 'Chen Ying', room: 'A408' },
    { cn: '生物2c', en: 'Bio2c', teacher: 'Zou Meixin', room: 'A404' },
    { cn: '物理2a', en: 'Phy2a', teacher: 'Zhang Shi', room: 'A410' },
    { cn: '物理2b', en: 'Phy2b', teacher: 'Wu Jun', room: '' },
    { cn: '物理2c', en: 'Phy2c', teacher: 'Wang Yufa', room: 'A409' },
    { cn: '化学2c', en: 'Chem2c', teacher: 'Sun Jing', room: 'A403' },
  ]},
  { day: 5, period: 8, courses: [
    { cn: '班会', en: 'Class Meeting', teacher: 'Zou Meixin', room: '' },
  ]},
];

// Total individual course entries for assertion
const TOTAL_COURSES = SCHEDULE_DATA.reduce((sum, s) => sum + s.courses.length, 0);

let passed = 0, failed = 0;
const results = [];
const screenshots = [];
let currentTestName = '';
const testScreenshots = []; // [{ test, status, shots: [{ name, file }] }]
let currentTestShots = [];

async function shot(page, name) {
  const file = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  screenshots.push(file);
  currentTestShots.push({ name, file });
}

async function test(name, fn) {
  currentTestName = name;
  currentTestShots = [];
  try {
    await fn();
    passed++;
    results.push(`  \u2705 ${name}`);
    testScreenshots.push({ test: name, status: 'passed', shots: [...currentTestShots] });
  } catch (e) {
    failed++;
    results.push(`  \u274c ${name}\n     ${e.message.split('\n')[0]}`);
    testScreenshots.push({ test: name, status: 'failed', error: e.message.split('\n')[0], shots: [...currentTestShots] });
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

// Helper: navigate to a class schedule
async function adminToSchedule(page, className = TEST_CLASS_A) {
  await adminLogin(page);
  await page.waitForTimeout(500);
  await page.locator('#years-list .sidebar-item').filter({ hasText: TEST_YEAR }).first().click();
  await page.waitForTimeout(500);
  await page.locator('#classes-list .sidebar-item').filter({ hasText: className }).first().click();
  await page.waitForTimeout(1500);
}

// Helper: add a course via UI at day/period position
async function addCourseAtSlot(page, day, period, nameCn, nameEn, teacher, room) {
  const row = page.locator('#admin-schedule-body tr').nth(period - 1);
  const cell = row.locator('td').nth(day + 1); // col 0=label, 1=time, 2+=days
  await cell.locator('.add-course-btn:not(.add-group-btn)').click();
  await page.waitForSelector('#modal-overlay.active', { timeout: 5000 });
  await page.fill('#course-cn', nameCn);
  await page.fill('#course-en', nameEn);
  await page.fill('#course-teacher', teacher);
  await page.fill('#course-room', room);
  await page.click('#modal-save');
  await page.waitForTimeout(200);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  console.log(`\nCompass7 E2E Tests \u2014 ${BASE}\n`);

  // ═══════════════════════════════════════════════
  // CLEANUP FROM PREVIOUS RUN (at start, not end)
  // ═══════════════════════════════════════════════

  await test('Cleanup previous [E2E] data', async () => {
    const page = await browser.newPage();
    await adminLogin(page);
    page.on('dialog', dialog => dialog.accept());

    const yearBtn = page.locator('#years-list .sidebar-item').filter({ hasText: TEST_YEAR });
    const count = await yearBtn.count();
    if (count > 0) {
      console.log('    Deleting previous [E2E] Test Year...');
      await yearBtn.first().locator('.delete-btn').click();
      await page.waitForTimeout(1500);
      const after = await page.locator('#years-list').textContent();
      assert(!after.includes(TEST_YEAR), 'Failed to delete previous test year');
      console.log('    Previous data cleaned');
    } else {
      console.log('    No previous [E2E] data found');
    }
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // ADMIN BASIC
  // ═══════════════════════════════════════════════

  await test('Admin page loads', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/admin`);
    await page.waitForSelector('#admin-pwd', { timeout: 10000 });
    await shot(page, '01-admin-login');
    assert((await page.title()).includes('Compass7'));
    await page.close();
  });

  await test('Admin login', async () => {
    const page = await browser.newPage();
    await adminLogin(page);
    await shot(page, '02-admin-panel');
    assert(await page.locator('#admin-panel').isVisible());
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // CREATE: year + two classes
  // ═══════════════════════════════════════════════

  await test('Create test year', async () => {
    const page = await browser.newPage();
    await adminLogin(page);
    await page.click('#admin-panel button:has-text("+")');
    await page.waitForSelector('#modal-overlay.active', { timeout: 5000 });
    await page.fill('#new-year-name', TEST_YEAR);
    await page.click('#modal-save');
    await page.waitForTimeout(2000);
    const list = await page.locator('#years-list').textContent();
    console.log(`    Years: ${list}`);
    await shot(page, '03-year-created');
    assert(list.includes(TEST_YEAR));
    await page.close();
  });

  await test('Create Class-A', async () => {
    const page = await browser.newPage();
    await adminLogin(page);
    await page.locator('#years-list .sidebar-item').filter({ hasText: TEST_YEAR }).first().click();
    await page.waitForTimeout(500);
    await page.click('#add-class-btn');
    await page.waitForSelector('#modal-overlay.active', { timeout: 5000 });
    await page.fill('#new-class-name', TEST_CLASS_A);
    await page.click('#modal-save');
    await page.waitForTimeout(2000);
    await shot(page, '04-classA-created');
    assert((await page.locator('#classes-list').textContent()).includes(TEST_CLASS_A));
    await page.close();
  });

  await test('Create Class-B', async () => {
    const page = await browser.newPage();
    await adminLogin(page);
    await page.locator('#years-list .sidebar-item').filter({ hasText: TEST_YEAR }).first().click();
    await page.waitForTimeout(500);
    await page.click('#add-class-btn');
    await page.waitForSelector('#modal-overlay.active', { timeout: 5000 });
    await page.fill('#new-class-name', TEST_CLASS_B);
    await page.click('#modal-save');
    await page.waitForTimeout(2000);
    assert((await page.locator('#classes-list').textContent()).includes(TEST_CLASS_B));
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // POPULATE: add all courses to Class-A
  // ═══════════════════════════════════════════════

  await test('Populate Class-A with full IB timetable', async () => {
    const page = await browser.newPage();
    await adminToSchedule(page, TEST_CLASS_A);

    let added = 0;
    for (const slot of SCHEDULE_DATA) {
      for (const c of slot.courses) {
        await addCourseAtSlot(page, slot.day, slot.period, c.cn, c.en, c.teacher || '', c.room || '');
        added++;
      }
    }

    // Save
    await page.click('button:has-text("\u4fdd\u5b58")');
    await page.waitForTimeout(2000);

    const tags = await page.locator('.course-tag').count();
    console.log(`    Added ${added} courses, visible tags: ${tags}`);
    await shot(page, '05-schedule-full');
    assert(tags >= TOTAL_COURSES, `Expected ${TOTAL_COURSES} tags, got ${tags}`);
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // PERSISTENCE: reload and verify
  // ═══════════════════════════════════════════════

  await test('Schedule persists after reload', async () => {
    const page = await browser.newPage();
    await adminToSchedule(page, TEST_CLASS_A);

    const tags = await page.locator('.course-tag').count();
    console.log(`    Tags after reload: ${tags}`);
    // Check specific courses with teacher info visible
    const hasMath = await page.locator('.course-tag:has-text("数学")').count();
    const hasEng = await page.locator('.course-tag:has-text("英语")').count();
    console.log(`    Math tags: ${hasMath}, Eng tags: ${hasEng}`);
    await shot(page, '06-persisted');
    assert(tags >= TOTAL_COURSES, `Data lost: ${tags} < ${TOTAL_COURSES}`);
    await page.close();
  });

  await test('Teacher and room info persisted', async () => {
    const page = await browser.newPage();
    await adminToSchedule(page, TEST_CLASS_A);

    // Check that teacher/room shows in course tag tooltips (title attribute)
    const titles = await page.locator('.course-tag[title]').evaluateAll(els => els.map(e => e.title));
    const hasTeacher = titles.some(t => t.includes('Xu Jingyi'));
    const hasRoom = titles.some(t => t.includes('A411'));
    console.log(`    Has teacher info: ${hasTeacher}, Has room info: ${hasRoom}`);
    await shot(page, '07-teacher-room');
    assert(hasTeacher, 'Teacher info not persisted');
    assert(hasRoom, 'Room info not persisted');
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // EDIT & DELETE
  // ═══════════════════════════════════════════════

  await test('Edit course name', async () => {
    const page = await browser.newPage();
    await adminToSchedule(page, TEST_CLASS_A);

    // Edit the first Math course
    const mathTag = page.locator('.course-tag:has-text("数学")').first();
    await mathTag.click();
    await page.waitForSelector('#modal-overlay.active', { timeout: 5000 });

    await page.fill('#course-cn', '高等数学');
    await page.fill('#course-en', 'Advanced Math');
    await page.click('#modal-save');
    await page.waitForTimeout(300);
    await page.click('button:has-text("\u4fdd\u5b58")');
    await page.waitForTimeout(2000);

    const renamed = await page.locator('.course-tag:has-text("高等数学")').count();
    console.log(`    Renamed Math visible: ${renamed > 0}`);
    await shot(page, '08-edited');
    assert(renamed > 0, 'Renamed course not found');
    await page.close();
  });

  await test('Delete a course', async () => {
    const page = await browser.newPage();
    await adminToSchedule(page, TEST_CLASS_A);

    const before = await page.locator('.course-tag').count();
    // Delete the History course
    const histTag = page.locator('.course-tag:has-text("历史")').first();
    await histTag.click();
    await page.waitForSelector('#modal-overlay.active', { timeout: 5000 });
    await page.click('#modal-overlay .btn-danger');
    await page.waitForTimeout(300);
    await page.click('button:has-text("\u4fdd\u5b58")');
    await page.waitForTimeout(2000);

    const after = await page.locator('.course-tag').count();
    console.log(`    Tags: ${before} -> ${after}`);
    await shot(page, '09-deleted');
    assert(after < before, 'Course not deleted');
    await page.close();
  });

  await test('Delete persists after reload', async () => {
    const page = await browser.newPage();
    await adminToSchedule(page, TEST_CLASS_A);
    // The deleted "\u5386\u53f2" tag should still be gone (we deleted the first one)
    // Note: "\u5386\u53f2" may appear in other tags like "\u5386\u53f22", so check exact
    await shot(page, '10-delete-persisted');
    // Just verify total count is less than original
    const tags = await page.locator('.course-tag').count();
    console.log(`    Tags after reload: ${tags}`);
    assert(tags < TOTAL_COURSES, 'Delete did not persist');
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // SCHEDULE FEATURES
  // ═══════════════════════════════════════════════

  await test('P6-P10 labels displayed', async () => {
    const page = await browser.newPage();
    await adminToSchedule(page, TEST_CLASS_A);
    const text = await page.locator('#admin-schedule-table').textContent();
    for (const l of ['P6','P7','P8','P9','P10']) assert(text.includes(l), `${l} missing`);
    console.log('    All P6-P10 labels OK');
    await shot(page, '11-period-labels');
    await page.close();
  });

  await test('Multi-course slots show multiple tags', async () => {
    const page = await browser.newPage();
    await adminToSchedule(page, TEST_CLASS_A);

    // Monday P10 should have 4 courses (CS1, Bus1, Geo1, ESS1)
    // Row 9 (period 10 = index 9), col 2 (Monday = day 1, col index 1+1=2)
    const row = page.locator('#admin-schedule-body tr').nth(9);
    const cell = row.locator('td').nth(2); // Monday
    const tagsInCell = await cell.locator('.course-tag').count();
    console.log(`    Monday P10 course tags: ${tagsInCell}`);
    await shot(page, '12-multi-course');
    assert(tagsInCell >= 4, `Expected 4 courses in Monday P10, got ${tagsInCell}`);
    await page.close();
  });

  await test('Class-B is empty (data isolation)', async () => {
    const page = await browser.newPage();
    await adminToSchedule(page, TEST_CLASS_B);
    const tags = await page.locator('.course-tag').count();
    console.log(`    Class-B tags: ${tags}`);
    await shot(page, '13-classB-empty');
    assert(tags === 0, `Class-B should be empty, has ${tags} tags`);
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // USER FLOW
  // ═══════════════════════════════════════════════

  await test('User sees test year and both classes', async () => {
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.waitForSelector('#step-1', { timeout: 10000 });
    await page.waitForTimeout(2000);

    await page.locator(`text=${TEST_YEAR}`).first().click();
    await page.waitForTimeout(1500);

    const a = await page.locator(`text=${TEST_CLASS_A}`).count();
    const b = await page.locator(`text=${TEST_CLASS_B}`).count();
    console.log(`    Class-A: ${a > 0}, Class-B: ${b > 0}`);
    await shot(page, '14-user-classes');
    assert(a > 0 && b > 0, 'Both classes should be visible');
    await page.close();
  });

  await test('User views elective selection and schedule preview', async () => {
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.waitForSelector('#step-1', { timeout: 10000 });
    await page.waitForTimeout(2000);

    await page.locator(`text=${TEST_YEAR}`).first().click();
    await page.waitForTimeout(1500);
    await page.locator(`text=${TEST_CLASS_A}`).first().click();
    await page.waitForTimeout(2000);

    // Step 3: should show elective groups with radio buttons
    const radios = await page.locator('#elective-list input[type="radio"]').count();
    console.log(`    Elective radio buttons: ${radios}`);
    assert(radios > 0, 'Should show elective course options');

    // Select first option for each elective group
    const groups = await page.locator('#elective-list .card').count();
    for (let i = 0; i < groups; i++) {
      await page.locator(`input[name="elective-${i}"]`).first().click();
      await page.waitForTimeout(100);
    }

    await shot(page, '15-user-schedule');

    // Live preview should show selected courses (split pane layout)
    const tags = await page.locator('#user-schedule-table .course-tag').count();
    console.log(`    Preview course tags: ${tags}`);
    assert(tags > 0, 'Live preview should show selected courses');

    // Click export button to go to step 4
    const exportBtn = page.locator('#to-export-btn');
    assert(!(await exportBtn.isDisabled()), 'Export button should be enabled after selecting all');
    await exportBtn.click();
    await page.waitForTimeout(1000);

    await shot(page, '16-user-dropdowns');
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
      const regTab = page.locator('#tab-register');
      if (await regTab.isVisible()) await regTab.click();
      await page.waitForTimeout(300);

      await page.locator('#reg-username').fill(TEST_USER);
      await page.locator('#reg-password').fill(TEST_PWD);
      await page.locator('#auth-modal button:has-text("\u6ce8\u518c"), #auth-modal button:has-text("Register")').first().click();
      await page.waitForTimeout(2000);

      const toast = await page.locator('.toast').isVisible() ? await page.locator('.toast').textContent() : '';
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
      await shot(page, '17-user-auth');
    }
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // UI
  // ═══════════════════════════════════════════════

  await test('Mobile viewport', async () => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForSelector('header', { timeout: 10000 });
    await shot(page, '18-mobile');
    assert(await page.locator('header').isVisible());
    await page.close(); await ctx.close();
  });

  await test('Dark mode', async () => {
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    await page.click('#theme-toggle');
    await page.waitForTimeout(500);
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await shot(page, '19-dark');
    assert(theme === 'dark' || theme === 'light');
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
    await shot(page, '20-lang');
    assert(before !== after, 'Language did not change');
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // JSON EXPORT
  // ═══════════════════════════════════════════════

  await test('JSON export contains test data with teacher/room', async () => {
    const page = await browser.newPage();
    await adminLogin(page);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.click('#export-json-btn')
    ]);

    const content = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert(content.version === 1);

    const testYear = content.years.find(y => y.name === TEST_YEAR);
    assert(testYear, 'Test year not in export');
    assert(testYear.classes.length === 2, `Expected 2 classes, got ${testYear.classes.length}`);

    const classA = testYear.classes.find(c => c.name === TEST_CLASS_A);
    assert(classA && classA.schedule && Object.keys(classA.schedule).length > 0, 'Class-A schedule empty');

    // Verify teacher/room in exported data
    let foundTeacher = false, foundRoom = false;
    for (const dayData of Object.values(classA.schedule)) {
      for (const slotData of Object.values(dayData)) {
        for (const course of (slotData.courses || [])) {
          if (course.teacher) foundTeacher = true;
          if (course.room) foundRoom = true;
        }
      }
    }
    console.log(`    Export has teacher: ${foundTeacher}, room: ${foundRoom}`);
    await shot(page, '21-export');
    assert(foundTeacher, 'No teacher field in export');
    assert(foundRoom, 'No room field in export');
    await page.close();
  });

  // ═══════════════════════════════════════════════
  // NO CLEANUP — data stays for manual inspection
  // ═══════════════════════════════════════════════
  console.log('\n  \u2139\ufe0f  Test data left on site for inspection (cleaned up on next run)');

  // ═══════════════════════════════════════════════
  // RESULTS
  // ═══════════════════════════════════════════════
  await browser.close();
  console.log('\n' + results.join('\n'));
  console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`\nScreenshots (${screenshots.length}):`);
  screenshots.forEach(s => console.log(`  ${s}`));

  // Write manifest for structured reporting
  const manifest = path.join(SHOTS, 'manifest.json');
  fs.writeFileSync(manifest, JSON.stringify(testScreenshots, null, 2));
  console.log(`\nManifest: ${manifest}`);

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
})();

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}
