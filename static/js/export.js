/* export.js - Export timetable as image, Excel, ICS */

const IMAGE_PRESETS = {
  desktop:   { w: 1920, h: 1080, label: "preset_desktop" },
  macbook13: { w: 2560, h: 1600, label: "preset_macbook13" },
  macbook16: { w: 3456, h: 2234, label: "preset_macbook16" },
  ipad:      { w: 2360, h: 1640, label: "preset_ipad" },
  iphone:    { w: 1179, h: 2556, label: "preset_iphone" },
  custom:    { w: 0, h: 0, label: "preset_custom" }
};

/* ── Image Export ─────────────────────────────────── */
async function exportAsImage(tableEl, preset, customW, customH, preview = false) {
  const { w, h } = preset === "custom"
    ? { w: parseInt(customW), h: parseInt(customH) }
    : IMAGE_PRESETS[preset];

  // Use html2canvas
  const canvas = await html2canvas(tableEl, {
    scale: preview ? 0.5 : 2,
    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(),
    width: tableEl.scrollWidth,
    height: tableEl.scrollHeight
  });

  // Scale to target size
  const outCanvas = document.createElement("canvas");
  outCanvas.width = w;
  outCanvas.height = h;
  const ctx = outCanvas.getContext("2d");
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  ctx.fillRect(0, 0, w, h);

  // Center the table in the canvas
  const scale = Math.min(w / canvas.width, h / canvas.height) * 0.9;
  const dx = (w - canvas.width * scale) / 2;
  const dy = (h - canvas.height * scale) / 2;
  ctx.drawImage(canvas, dx, dy, canvas.width * scale, canvas.height * scale);

  if (preview) {
    return outCanvas.toDataURL("image/png", 0.5);
  }

  // Download
  const link = document.createElement("a");
  link.download = `compass7_timetable_${w}x${h}.png`;
  link.href = outCanvas.toDataURL("image/png");
  link.click();
}

/* ── Excel Export ─────────────────────────────────── */
function exportAsExcel(scheduleData, selections, className) {
  const DAYS = [t("monday"), t("tuesday"), t("wednesday"), t("thursday"), t("friday")];
  const PERIODS = [
    { num: 1, time: "8:00-8:40" },
    { num: 2, time: "8:45-9:25" },
    { num: 3, time: "9:35-10:15" },
    { num: 4, time: "10:20-11:00" },
    { num: 5, time: "11:05-11:55" },
    { num: 6, time: "12:00-12:40", lunch: true },
    { num: 7, time: "12:45-13:25" },
    { num: 8, time: "13:30-14:10" },
    { num: 9, time: "14:15-14:55" },
    { num: 10, time: "15:00-15:40" },
    { num: 11, time: "15:45-16:25" }
  ];

  const rows = [["", ...DAYS]];

  PERIODS.forEach(p => {
    const label = p.lunch ? t("lunch") : `P${p.num} (${p.time})`;
    const row = [label];
    for (let d = 1; d <= 5; d++) {
      const slotKey = `${d}_${p.num}`;
      const courseId = selections[slotKey];
      const slot = scheduleData[String(d)] && scheduleData[String(d)][String(p.num)];
      if (slot && courseId) {
        const course = slot.courses.find(c => c.id === courseId);
        row.push(course ? (currentLang === "zh" ? course.name_cn : course.name_en) : "");
      } else {
        row.push(p.lunch ? t("lunch") : "");
      }
    }
    rows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, className || "Timetable");
  XLSX.writeFile(wb, `compass7_${className || "timetable"}.xlsx`);
}

/* ── ICS Export ───────────────────────────────────── */
function exportAsICS(scheduleData, selections, startDate, endDate) {
  const DAY_MAP = { 1: "MO", 2: "TU", 3: "WE", 4: "TH", 5: "FR" };
  const PERIOD_TIMES = {
    1:  { start: "080000", end: "084000" },
    2:  { start: "084500", end: "092500" },
    3:  { start: "093500", end: "101500" },
    4:  { start: "102000", end: "110000" },
    5:  { start: "110500", end: "115500" },
    6:  { start: "120000", end: "124000" },
    7:  { start: "124500", end: "132500" },
    8:  { start: "133000", end: "141000" },
    9:  { start: "141500", end: "145500" },
    10: { start: "150000", end: "154000" },
    11: { start: "154500", end: "162500" }
  };

  const start = new Date(startDate);
  const end = new Date(endDate);
  const untilStr = end.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  let ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Compass7//Timetable//EN",
    "CALSCALE:GREGORIAN"
  ];

  for (let d = 1; d <= 5; d++) {
    const daySchedule = scheduleData[String(d)];
    if (!daySchedule) continue;

    for (const [period, slot] of Object.entries(daySchedule)) {
      const slotKey = `${d}_${period}`;
      const courseId = selections[slotKey];
      if (!courseId) continue;

      const course = slot.courses.find(c => c.id === courseId);
      if (!course) continue;

      const times = PERIOD_TIMES[period];
      if (!times) continue;

      // Find the first occurrence of this day of week
      const firstDay = new Date(start);
      while (firstDay.getDay() !== (d % 7)) {
        firstDay.setDate(firstDay.getDate() + 1);
      }
      const dateStr = firstDay.toISOString().split("T")[0].replace(/-/g, "");

      ics.push(
        "BEGIN:VEVENT",
        `DTSTART;TZID=Asia/Shanghai:${dateStr}T${times.start}`,
        `DTEND;TZID=Asia/Shanghai:${dateStr}T${times.end}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${DAY_MAP[d]};UNTIL=${untilStr}`,
        `SUMMARY:${currentLang === "zh" ? course.name_cn : course.name_en}`,
        `UID:${slotKey}-${courseId}@compass7`,
        "END:VEVENT"
      );
    }
  }

  ics.push("END:VCALENDAR");

  const blob = new Blob([ics.join("\r\n")], { type: "text/calendar" });
  const link = document.createElement("a");
  link.download = "compass7_timetable.ics";
  link.href = URL.createObjectURL(blob);
  link.click();
}
