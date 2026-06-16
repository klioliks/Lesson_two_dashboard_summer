const HOLIDAYS = [
  { id: "autumn", name: "Осенние каникулы", start: "2025-10-26", end: "2025-11-02" },
  { id: "winter", name: "Зимние каникулы", start: "2025-12-29", end: "2026-01-11" },
  { id: "spring", name: "Весенние каникулы", start: "2026-03-23", end: "2026-03-30" },
  { id: "summer", name: "Летние каникулы", start: "2026-05-26", end: "2026-08-31" },
];

const SUMMER_END = "2026-08-31";

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(from, to) {
  const ms = parseDate(to) - parseDate(from);
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function getHolidayForDate(dateStr) {
  return HOLIDAYS.find((h) => dateStr >= h.start && dateStr <= h.end) || null;
}

function getNextHoliday(today) {
  return HOLIDAYS.find((h) => h.start > today) || null;
}

function initLanding() {
  const today = formatDate(new Date());
  const holiday = getHolidayForDate(today);
  const nextHoliday = getNextHoliday(today);

  const statusEl = document.getElementById("landingStatus");
  const daysEl = document.getElementById("landingDaysLeft");
  const nextEl = document.getElementById("landingNextHoliday");

  if (holiday) {
    statusEl.textContent = `Сейчас ${holiday.name.toLowerCase()}!`;
    statusEl.classList.add("landing-hero__status--holiday");
  } else {
    statusEl.textContent = "Сейчас учебное время";
  }

  const daysLeft = today > SUMMER_END ? 0 : daysBetween(today, SUMMER_END);
  daysEl.textContent = String(daysLeft);

  if (nextHoliday) {
    const start = parseDate(nextHoliday.start).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
    });
    nextEl.textContent = `${nextHoliday.name}, ${start}`;
  } else {
    nextEl.textContent = "Учебный год завершён";
  }

}

initLanding();
