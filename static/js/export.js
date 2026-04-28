/* export.js - Export timetable as image, Excel, ICS */

/* ── Image Export ─────────────────────────────────── */
async function exportAsImage(tableEl) {
  // Auto-detect device resolution
  const w = screen.width * (window.devicePixelRatio || 1);
  const h = screen.height * (window.devicePixelRatio || 1);
  const isPortrait = h > w;

  // Clone table into an offscreen container with controlled dimensions
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `position:fixed;left:-9999px;top:0;padding:24px;box-sizing:border-box;background:${getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()};`;
  // Set wrapper to target aspect ratio, but keep font size the same (no scaling of text)
  // For portrait (phone), make it tall and narrow; for landscape, wide
  wrapper.style.width = isPortrait ? `${Math.min(w, 800)}px` : `${Math.max(w / 2, 900)}px`;
  wrapper.style.fontSize = "14px";

  const clone = tableEl.cloneNode(true);
  clone.style.width = "100%";
  clone.style.fontSize = "inherit";
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  // Render with html2canvas at 2x for crisp output
  const canvas = await html2canvas(wrapper, {
    scale: 2,
    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(),
    width: wrapper.offsetWidth,
    height: wrapper.offsetHeight
  });

  document.body.removeChild(wrapper);

  // Download
  const link = document.createElement("a");
  link.download = `compass7_timetable_${canvas.width}x${canvas.height}.png`;
  link.href = canvas.toDataURL("image/png");
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
    { num: 7, time: "12:45-13:25", label: "P6" },
    { num: 8, time: "13:30-14:10", label: "P7" },
    { num: 9, time: "14:15-14:55", label: "P8" },
    { num: 10, time: "15:00-15:40", label: "P9" },
    { num: 11, time: "15:45-16:25", label: "P10" }
  ];

  const rows = [["", ...DAYS]];

  PERIODS.forEach(p => {
    const label = p.lunch ? t("lunch") : `${p.label || "P" + p.num} (${p.time})`;
    const row = [label];
    for (let d = 1; d <= 5; d++) {
      const slotKey = `${d}_${p.num}`;
      const courseId = selections[slotKey];
      const slot = scheduleData[String(d)] && scheduleData[String(d)][String(p.num)];
      if (slot && courseId) {
        const course = slot.courses.find(c => c.name_cn === courseId || c.id === courseId);
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
      if (!courseId || courseId === "__skip__") continue;

      const course = slot.courses.find(c => c.name_cn === courseId || c.id === courseId);
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
        course.room ? `LOCATION:${course.room}` : null,
        `UID:${slotKey}-${courseId}@compass7`,
        "END:VEVENT"
      ).filter(Boolean);
    }
  }

  ics.push("END:VCALENDAR");

  const blob = new Blob([ics.join("\r\n")], { type: "text/calendar" });
  const link = document.createElement("a");
  link.download = "compass7_timetable.ics";
  link.href = URL.createObjectURL(blob);
  link.click();
}
