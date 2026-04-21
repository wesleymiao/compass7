/* i18n.js - Internationalization for Compass7 */
const I18N = {
  zh: {
    // Header
    app_name: "Compass7",
    admin: "管理后台",
    login: "登录",
    register: "注册",
    logout: "退出",
    guest: "游客模式",

    // Theme
    light_mode: "浅色模式",
    dark_mode: "深色模式",

    // Auth
    username: "用户名",
    password: "密码",
    email: "邮箱（可选）",
    login_btn: "登录",
    register_btn: "注册",
    or_guest: "或以游客身份继续",
    admin_password: "管理员密码",

    // Steps
    step1: "选择学年",
    step2: "选择班级",
    step3: "选择课程",
    step4: "导出课表",

    // Schedule
    monday: "周一",
    tuesday: "周二",
    wednesday: "周三",
    thursday: "周四",
    friday: "周五",
    period: "节次",
    lunch: "午餐",
    time: "时间",

    // Admin
    academic_years: "学年",
    add_year: "添加学年",
    add_class: "添加班级",
    classes: "班级列表",
    schedule_editor: "课表编辑",
    add_course: "添加课程",
    course_name_cn: "课程名（中文）",
    course_name_en: "课程名（英文）",
    block_label: "区块名称",
    save: "保存",
    cancel: "取消",
    delete: "删除",
    confirm_delete: "确认删除？",
    edit: "编辑",
    year_name: "学年名称",
    class_name: "班级名称",

    // User
    select_year: "请选择学年",
    select_class: "请选择班级",
    select_courses: "请为每个时间段选择课程",
    no_courses: "该时间段无可选课程",
    unselected: "未选择",
    all_selected: "所有课程已选择完毕！",
    save_selections: "保存选课",
    saved: "已保存",

    // Export
    export_title: "导出课表",
    export_image: "导出为图片",
    export_excel: "导出为 Excel",
    export_ics: "导出为日历",
    preset_desktop: "桌面壁纸",
    preset_macbook13: "MacBook 13\"",
    preset_macbook16: "MacBook 16\"",
    preset_ipad: "iPad",
    preset_iphone: "iPhone",
    preset_custom: "自定义",
    width: "宽度",
    height: "高度",
    preview: "预览",
    download: "下载完整图片",
    semester_start: "学期开始日期",
    semester_end: "学期结束日期",
    generate_ics: "生成日历文件",

    // Admin Export
    export_schedule: "导出课表",
    export_all_schedules: "导出所有课表",
    export_json: "导出为 JSON",
    teacher: "教师",
    classroom: "教室",
    collapse: "收起",

    // Messages
    error_required: "此项为必填",
    error_login: "用户名或密码错误",
    error_exists: "用户名已存在",
    success_register: "注册成功",
    success_save: "保存成功",
    error_password_length: "密码至少6位",
    loading: "加载中...",
    no_data: "暂无数据",
    first_time_admin: "首次登录，请设置管理员密码",
  },
  en: {
    app_name: "Compass7",
    admin: "Admin",
    login: "Login",
    register: "Register",
    logout: "Logout",
    guest: "Guest Mode",

    light_mode: "Light Mode",
    dark_mode: "Dark Mode",

    username: "Username",
    password: "Password",
    email: "Email (optional)",
    login_btn: "Login",
    register_btn: "Register",
    or_guest: "Or continue as guest",
    admin_password: "Admin Password",

    step1: "Select Year",
    step2: "Select Class",
    step3: "Select Courses",
    step4: "Export",

    monday: "Mon",
    tuesday: "Tue",
    wednesday: "Wed",
    thursday: "Thu",
    friday: "Fri",
    period: "Period",
    lunch: "Lunch",
    time: "Time",

    academic_years: "Academic Years",
    add_year: "Add Year",
    add_class: "Add Class",
    classes: "Classes",
    schedule_editor: "Schedule Editor",
    add_course: "Add Course",
    course_name_cn: "Course Name (CN)",
    course_name_en: "Course Name (EN)",
    block_label: "Block Label",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    confirm_delete: "Confirm delete?",
    edit: "Edit",
    year_name: "Year Name",
    class_name: "Class Name",

    select_year: "Select academic year",
    select_class: "Select your class",
    select_courses: "Select a course for each time slot",
    no_courses: "No courses available for this slot",
    unselected: "Not selected",
    all_selected: "All courses selected!",
    save_selections: "Save Selections",
    saved: "Saved",

    export_title: "Export Timetable",
    export_image: "Export as Image",
    export_excel: "Export as Excel",
    export_ics: "Export as Calendar",
    preset_desktop: "Desktop",
    preset_macbook13: "MacBook 13\"",
    preset_macbook16: "MacBook 16\"",
    preset_ipad: "iPad",
    preset_iphone: "iPhone",
    preset_custom: "Custom",
    width: "Width",
    height: "Height",
    preview: "Preview",
    download: "Download Full Image",
    semester_start: "Semester Start Date",
    semester_end: "Semester End Date",
    generate_ics: "Generate Calendar File",

    export_schedule: "Export Schedule",
    export_all_schedules: "Export All Schedules",
    export_json: "Export as JSON",
    teacher: "Teacher",
    classroom: "Classroom",
    collapse: "Collapse",

    error_required: "This field is required",
    error_login: "Invalid username or password",
    error_exists: "Username already exists",
    success_register: "Registration successful",
    success_save: "Saved successfully",
    error_password_length: "Password must be at least 6 characters",
    loading: "Loading...",
    no_data: "No data",
    first_time_admin: "First login — please set admin password",
  }
};

let currentLang = localStorage.getItem("compass7_lang") || "zh";

function t(key) {
  return (I18N[currentLang] && I18N[currentLang][key]) || key;
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem("compass7_lang", lang);
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  // Re-render all elements with data-i18n attribute
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  // Dispatch custom event for dynamic re-renders
  window.dispatchEvent(new CustomEvent("langchange", { detail: { lang } }));
}

function toggleLang() {
  setLang(currentLang === "zh" ? "en" : "zh");
}
