const STORAGE_KEY = "kanikuly-dashboard-v1";

const HOLIDAYS = [
  { id: "autumn", name: "Осенние каникулы", start: "2025-10-26", end: "2025-11-02", color: "autumn" },
  { id: "winter", name: "Зимние каникулы", start: "2025-12-29", end: "2026-01-11", color: "winter" },
  { id: "spring", name: "Весенние каникулы", start: "2026-03-23", end: "2026-03-30", color: "spring" },
  { id: "summer", name: "Летние каникулы", start: "2026-05-26", end: "2026-08-31", color: "summer" },
];

const SUMMER_END = "2026-08-31";
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const DEFAULT_CHILDREN = [
  { id: "child1", name: "Егор", color: "#ef4444" },
  { id: "child2", name: "Матвей", color: "#3b82f6" },
];

let state = loadState();
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let selectedDate = formatDate(new Date());
let editingBookId = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { children: structuredClone(DEFAULT_CHILDREN), notes: [], meetings: [], books: [] };
    const parsed = JSON.parse(raw);
    const children = parsed.children?.length
      ? parsed.children.map((c) => {
          const defaults = DEFAULT_CHILDREN.find((d) => d.id === c.id);
          if (!defaults) return c;
          const hadOldName = c.name === "Ребёнок 1" || c.name === "Ребёнок 2";
          return {
            ...c,
            name: hadOldName ? defaults.name : c.name,
            color: defaults.color,
          };
        })
      : structuredClone(DEFAULT_CHILDREN);
    return {
      children,
      notes: parsed.notes || [],
      meetings: parsed.meetings || [],
      books: parsed.books || [],
    };
  } catch {
    return { children: structuredClone(DEFAULT_CHILDREN), notes: [], meetings: [], books: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

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

function formatDisplayDate(str) {
  return parseDate(str).toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(str) {
  return parseDate(str).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

function daysBetween(from, to) {
  const a = parseDate(from);
  const b = parseDate(to);
  const ms = b - a;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function getHolidayForDate(dateStr) {
  return HOLIDAYS.find((h) => dateStr >= h.start && dateStr <= h.end) || null;
}

function getChild(childId) {
  return state.children.find((c) => c.id === childId);
}

function init() {
  populateMeetingTimeSelect();
  bindEvents();
  renderAll();
}

function populateMeetingTimeSelect() {
  const select = document.getElementById("meetingTime");
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (const minute of [0, 30]) {
      const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      options.push(`<option value="${time}">${time}</option>`);
    }
  }
  select.innerHTML = options.join("");
  select.value = "09:00";
}

function setMeetingTimeFieldsDisabled(allDay) {
  const row = document.getElementById("meetingTimeRow");
  row.classList.toggle("meeting-form__row--disabled", allDay);
  document.getElementById("meetingTime").disabled = allDay;
  document.getElementById("meetingDuration").disabled = allDay;
}

function formatMeetingTime(meeting) {
  if (meeting.allDay) return "Весь день";
  return meeting.time || "—";
}

function formatMeetingDuration(meeting) {
  if (meeting.allDay) return "весь день";
  return `${meeting.duration} мин`;
}

function compareMeetings(a, b) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  if (a.allDay && !b.allDay) return -1;
  if (!a.allDay && b.allDay) return 1;
  return (a.time || "").localeCompare(b.time || "");
}

function isMeetingUpcoming(meeting, today, nowTime) {
  if (meeting.date > today) return true;
  if (meeting.date < today) return false;
  if (meeting.allDay) return true;
  return (meeting.time || "") >= nowTime;
}

function getNoteIconMarker() {
  return `
    <span class="calendar-icon calendar-icon--note" title="Есть заметки" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
        <path d="M10 2v20"/>
        <path d="M14 7h2"/>
        <path d="M14 11h2"/>
        <path d="M14 15h2"/>
      </svg>
    </span>`;
}

function getMeetingChildMarkers(dayMeetings) {
  const seen = new Set();
  const markers = [];
  for (const meeting of dayMeetings) {
    if (seen.has(meeting.childId)) continue;
    seen.add(meeting.childId);
    const child = getChild(meeting.childId);
    if (!child) continue;
    markers.push(
      `<span class="marker marker--child" style="background:${child.color}" title="${escapeHtml(child.name)}"></span>`
    );
  }
  return markers;
}

function bindEvents() {
  document.getElementById("prevMonth").addEventListener("click", () => {
    viewMonth -= 1;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear -= 1;
    }
    renderCalendar();
  });

  document.getElementById("nextMonth").addEventListener("click", () => {
    viewMonth += 1;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear += 1;
    }
    renderCalendar();
  });

  document.getElementById("noteForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const childId = document.getElementById("noteChild").value;
    const text = document.getElementById("noteText").value.trim();
    if (!text) return;
    state.notes.push({ id: crypto.randomUUID(), date: selectedDate, childId, text });
    document.getElementById("noteText").value = "";
    saveState();
    renderAll();
  });

  document.getElementById("meetingAllDay").addEventListener("change", (e) => {
    setMeetingTimeFieldsDisabled(e.target.checked);
  });

  document.getElementById("meetingForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const childId = document.getElementById("meetingChild").value;
    const title = document.getElementById("meetingTitle").value.trim();
    const allDay = document.getElementById("meetingAllDay").checked;
    const time = allDay ? null : document.getElementById("meetingTime").value;
    const duration = Number(document.getElementById("meetingDuration").value) || 60;
    if (!title || (!allDay && !time)) return;
    state.meetings.push({
      id: crypto.randomUUID(),
      date: selectedDate,
      childId,
      title,
      allDay,
      time,
      duration,
    });
    document.getElementById("meetingTitle").value = "";
    document.getElementById("meetingAllDay").checked = false;
    document.getElementById("meetingTime").value = "09:00";
    setMeetingTimeFieldsDisabled(false);
    saveState();
    renderAll();
  });

  document.getElementById("editChildren").addEventListener("click", () => {
    document.getElementById("child1Name").value = state.children[0].name;
    document.getElementById("child2Name").value = state.children[1].name;
    document.getElementById("childrenModal").showModal();
  });

  document.getElementById("cancelChildren").addEventListener("click", () => {
    document.getElementById("childrenModal").close();
  });

  document.getElementById("childrenForm").addEventListener("submit", (e) => {
    e.preventDefault();
    state.children[0].name = document.getElementById("child1Name").value.trim() || "Егор";
    state.children[1].name = document.getElementById("child2Name").value.trim() || "Матвей";
    saveState();
    document.getElementById("childrenModal").close();
    renderAll();
  });

  document.getElementById("readingGrid").addEventListener("submit", (e) => {
    const form = e.target.closest("[data-add-book-form]");
    if (!form) return;
    e.preventDefault();
    const childId = form.dataset.addBookForm;
    const input = form.querySelector("[data-book-title-input]");
    const title = input.value.trim();
    if (!title) return;
    state.books.push({
      id: crypto.randomUUID(),
      childId,
      title,
      author: "",
      read: false,
      characters: "",
      summary: "",
      liked: null,
    });
    input.value = "";
    saveState();
    renderReading();
  });

  document.getElementById("readingGrid").addEventListener("click", (e) => {
    const toggleBtn = e.target.closest("[data-toggle-read]");
    if (toggleBtn) {
      const book = state.books.find((b) => b.id === toggleBtn.dataset.toggleRead);
      if (book) {
        book.read = !book.read;
        saveState();
        renderReading();
      }
      return;
    }

    const editBtn = e.target.closest("[data-edit-book]");
    if (editBtn) {
      openBookModal(editBtn.dataset.editBook);
    }
  });

  document.getElementById("cancelBook").addEventListener("click", () => {
    document.getElementById("bookModal").close();
  });

  document.getElementById("deleteBook").addEventListener("click", () => {
    if (!editingBookId) return;
    state.books = state.books.filter((b) => b.id !== editingBookId);
    editingBookId = null;
    saveState();
    document.getElementById("bookModal").close();
    renderReading();
  });

  document.getElementById("bookForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const book = state.books.find((b) => b.id === editingBookId);
    if (!book) return;
    book.title = document.getElementById("bookTitle").value.trim();
    book.author = document.getElementById("bookAuthor").value.trim();
    book.read = document.getElementById("bookRead").checked;
    book.characters = document.getElementById("bookCharacters").value.trim();
    book.summary = document.getElementById("bookSummary").value.trim();
    const liked = document.querySelector('input[name="bookLiked"]:checked')?.value;
    book.liked = liked === "yes" ? "yes" : liked === "no" ? "no" : null;
    saveState();
    document.getElementById("bookModal").close();
    renderReading();
  });
}

function renderAll() {
  renderChildrenLegend();
  renderChildSelects();
  renderSummerCountdown();
  renderStats();
  renderCalendar();
  renderSelectedDay();
  renderUpcomingEvents();
  renderReading();
}

function renderChildrenLegend() {
  const el = document.getElementById("childrenLegend");
  el.innerHTML = state.children
    .map(
      (c) => `
      <span class="child-badge">
        <span class="child-badge__dot" style="background:${c.color}"></span>
        ${escapeHtml(c.name)}
      </span>`
    )
    .join("");
}

function renderChildSelects() {
  const options = state.children
    .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
    .join("");
  document.getElementById("noteChild").innerHTML = options;
  document.getElementById("meetingChild").innerHTML = options;
}

function renderSummerCountdown() {
  const today = formatDate(new Date());
  const days = daysBetween(today, SUMMER_END);
  const endFormatted = parseDate(SUMMER_END).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  document.getElementById("daysLeft").textContent = today > SUMMER_END ? "0" : String(days);
  document.getElementById("summerEndDate").textContent =
    today > SUMMER_END
      ? "Лето завершилось — скоро новый учебный год!"
      : `Летние каникулы до ${endFormatted}`;
}

function renderStats() {
  const today = formatDate(new Date());
  const holiday = getHolidayForDate(today);
  document.getElementById("currentHoliday").textContent = holiday ? holiday.name : "Учебное время";

  const upcoming = getSortedMeetings().find((m) => isMeetingUpcoming(m, today, getNowTime()));
  document.getElementById("nextEvent").textContent = upcoming
    ? `${formatShortDate(upcoming.date)} ${formatMeetingTime(upcoming)}`
    : "Нет запланированных";

  document.getElementById("notesCount").textContent = String(state.notes.length);
}

function getNowTime() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

function getSortedMeetings() {
  return [...state.meetings].sort(compareMeetings);
}

function renderCalendar() {
  document.getElementById("monthTitle").textContent = `${MONTHS[viewMonth]} ${viewYear}`;

  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = "";

  WEEKDAYS.forEach((day) => {
    const el = document.createElement("div");
    el.className = "calendar-weekday";
    el.textContent = day;
    grid.appendChild(el);
  });

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = formatDate(new Date());

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-day calendar-day--empty";
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDate(new Date(viewYear, viewMonth, day));
    const holiday = getHolidayForDate(dateStr);
    const dayNotes = state.notes.filter((n) => n.date === dateStr);
    const dayMeetings = state.meetings.filter((m) => m.date === dateStr);

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "calendar-day";
    if (holiday) cell.classList.add(`calendar-day--${holiday.color}`);
    if (dateStr === today) cell.classList.add("calendar-day--today");
    if (dateStr === selectedDate) cell.classList.add("calendar-day--selected");

    const markers = [];
    if (dayNotes.length) markers.push(getNoteIconMarker());
    markers.push(...getMeetingChildMarkers(dayMeetings));

    cell.innerHTML = `
      <span class="calendar-day__num">${day}</span>
      <div class="calendar-day__markers">${markers.join("")}</div>
    `;

    cell.addEventListener("click", () => {
      selectedDate = dateStr;
      renderCalendar();
      renderSelectedDay();
    });

    grid.appendChild(cell);
  }
}

function renderSelectedDay() {
  document.getElementById("selectedDayTitle").textContent = formatDisplayDate(selectedDate);

  const holiday = getHolidayForDate(selectedDate);
  document.getElementById("selectedDayHoliday").textContent = holiday
    ? `🎒 ${holiday.name}`
    : "📚 Учебный день";

  const notes = state.notes.filter((n) => n.date === selectedDate);
  const noteList = document.getElementById("noteList");
  noteList.innerHTML = notes.length
    ? notes
        .map((n) => {
          const child = getChild(n.childId);
          return `
          <li class="note-item">
            <div>
              <span class="note-item__child" style="background:${child?.color || "#666"}">${escapeHtml(child?.name || "")}</span>
              <div class="note-item__text">${escapeHtml(n.text)}</div>
            </div>
            <button type="button" class="btn btn--danger" data-delete-note="${n.id}" aria-label="Удалить">✕</button>
          </li>`;
        })
        .join("")
    : '<li class="empty-state">Заметок пока нет</li>';

  noteList.querySelectorAll("[data-delete-note]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.notes = state.notes.filter((n) => n.id !== btn.dataset.deleteNote);
      saveState();
      renderAll();
    });
  });

  const meetings = state.meetings
    .filter((m) => m.date === selectedDate)
    .sort(compareMeetings);

  const meetingList = document.getElementById("meetingList");
  meetingList.innerHTML = meetings.length
    ? meetings
        .map((m) => {
          const child = getChild(m.childId);
          return `
          <li class="meeting-item">
            <div class="meeting-item__top">
              <span class="meeting-item__child" style="background:${child?.color || "#666"}">${escapeHtml(child?.name || "")}</span>
              <span>${formatMeetingTime(m)} · ${formatMeetingDuration(m)}</span>
            </div>
            <div class="meeting-item__title">${escapeHtml(m.title)}</div>
            <button type="button" class="btn btn--danger" data-delete-meeting="${m.id}" aria-label="Удалить">Удалить</button>
          </li>`;
        })
        .join("")
    : '<li class="empty-state">Встреч пока нет</li>';

  meetingList.querySelectorAll("[data-delete-meeting]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.meetings = state.meetings.filter((m) => m.id !== btn.dataset.deleteMeeting);
      saveState();
      renderAll();
    });
  });
}

function renderUpcomingEvents() {
  const today = formatDate(new Date());
  const nowTime = getNowTime();
  const upcoming = getSortedMeetings()
    .filter((m) => isMeetingUpcoming(m, today, nowTime))
    .slice(0, 6);

  const list = document.getElementById("upcomingEvents");
  list.innerHTML = upcoming.length
    ? upcoming
        .map((m) => {
          const child = getChild(m.childId);
          return `
          <li class="event-item">
            <div class="event-item__top">
              <span class="event-item__date">${formatShortDate(m.date)} · ${formatMeetingTime(m)}</span>
              <span class="event-item__child" style="background:${child?.color || "#666"}">${escapeHtml(child?.name || "")}</span>
            </div>
            <div class="event-item__title">${escapeHtml(m.title)}</div>
          </li>`;
        })
        .join("")
    : '<li class="empty-state">Добавьте встречи в календарь</li>';
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getBooksForChild(childId) {
  return state.books.filter((b) => b.childId === childId);
}

function getLikeLabel(liked) {
  if (liked === "yes") return "👍 Понравилась";
  if (liked === "no") return "👎 Не понравилась";
  return "";
}

function openBookModal(bookId) {
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return;
  editingBookId = bookId;
  document.getElementById("bookModalTitle").textContent = book.title;
  document.getElementById("bookTitle").value = book.title;
  document.getElementById("bookAuthor").value = book.author;
  document.getElementById("bookRead").checked = book.read;
  document.getElementById("bookCharacters").value = book.characters;
  document.getElementById("bookSummary").value = book.summary;
  const likedValue = book.liked === "yes" ? "yes" : book.liked === "no" ? "no" : "";
  document.querySelectorAll('input[name="bookLiked"]').forEach((radio) => {
    radio.checked = radio.value === likedValue;
  });
  document.getElementById("bookModal").showModal();
}

function renderReading() {
  const grid = document.getElementById("readingGrid");
  grid.innerHTML = state.children
    .map((child) => {
      const books = getBooksForChild(child.id);
      const readCount = books.filter((b) => b.read).length;

      const bookItems = books.length
        ? books
            .map((book) => {
              const likeLabel = getLikeLabel(book.liked);
              const meta = [book.author, likeLabel].filter(Boolean).join(" · ");
              return `
              <li class="book-item ${book.read ? "book-item--read" : ""}">
                <div class="book-item__row">
                  <button
                    type="button"
                    class="book-item__check ${book.read ? "book-item__check--done" : ""}"
                    data-toggle-read="${book.id}"
                    aria-label="${book.read ? "Отметить как непрочитанную" : "Отметить как прочитанную"}"
                    title="${book.read ? "Прочитана" : "Отметить прочитанной"}"
                  >${book.read ? "✓" : ""}</button>
                  <button type="button" class="book-item__info" data-edit-book="${book.id}">
                    <span class="book-item__title">${escapeHtml(book.title)}</span>
                    ${meta ? `<span class="book-item__meta">${escapeHtml(meta)}</span>` : ""}
                    ${book.characters ? `<span class="book-item__preview">Герои: ${escapeHtml(book.characters)}</span>` : ""}
                    ${book.summary ? `<span class="book-item__preview">${escapeHtml(book.summary)}</span>` : ""}
                  </button>
                </div>
              </li>`;
            })
            .join("")
        : '<li class="empty-state">Список пуст — добавьте первую книгу</li>';

      return `
        <div class="reading-column" style="--child-color: ${child.color}">
          <div class="reading-column__header">
            <span class="child-badge">
              <span class="child-badge__dot" style="background:${child.color}"></span>
              ${escapeHtml(child.name)}
            </span>
            <span class="reading-column__progress">${readCount} / ${books.length} прочитано</span>
          </div>
          <form class="add-book-form" data-add-book-form="${child.id}">
            <input type="text" data-book-title-input placeholder="Название книги…" maxlength="120" required />
            <button type="submit" class="btn btn--primary">Добавить</button>
          </form>
          <ul class="book-list">${bookItems}</ul>
        </div>`;
    })
    .join("");
}

init();
