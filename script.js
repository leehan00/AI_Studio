const users = [];
const timetable = []; // { id, subject, day, start, end, room, color }

const CATEGORIES = {
  수업: { bg: "#dbeafe", text: "#1e40af", emoji: "🎓" },
  알바: { bg: "#fef3c7", text: "#92400e", emoji: "💼" },
  약속: { bg: "#d1fae5", text: "#065f46", emoji: "🎉" },
  운동: { bg: "#fee2e2", text: "#991b1b", emoji: "💪" },
  개인: { bg: "#ede9fe", text: "#5b21b6", emoji: "🔵" },
  기타: { bg: "#f3f4f6", text: "#374151", emoji: "⚙️" },
};

const CLASS_COLORS = {
  blue:   { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" },
  green:  { bg: "#d1fae5", text: "#065f46", border: "#6ee7b7" },
  red:    { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" },
  amber:  { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  purple: { bg: "#ede9fe", text: "#5b21b6", border: "#c4b5fd" },
};

const TIMETABLE_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const TIMETABLE_DAYS = ["월", "화", "수", "목", "금", "토"];

const state = {
  currentUser: null,
  room: null,
  joinedUserIds: [],
  selectedCandidates: [],
  editingSchedule: null, // { index } — 수정 중인 일정
  popupDate: null,       // 팝업에 표시 중인 날짜
  popupView: "list",     // "list" | "form"
};

const weekdayNames = ["일", "월", "화", "수", "목", "금", "토"];
const meetingSlots = [12, 14, 16, 18, 19, 20];

const els = {
  // Auth
  loginScreen: document.querySelector("#loginScreen"),
  appScreen: document.querySelector("#appScreen"),
  loginForm: document.querySelector("#loginForm"),
  loginId: document.querySelector("#loginId"),
  loginPassword: document.querySelector("#loginPassword"),
  registerForm: document.querySelector("#registerForm"),
  registerId: document.querySelector("#registerId"),
  registerPassword: document.querySelector("#registerPassword"),
  registerPasswordConfirm: document.querySelector("#registerPasswordConfirm"),
  tabLogin: document.querySelector("#tabLogin"),
  tabRegister: document.querySelector("#tabRegister"),
  authError: document.querySelector("#authError"),
  signedInUser: document.querySelector("#signedInUser"),
  logoutButton: document.querySelector("#logoutButton"),
  // Profile
  profileScreen: document.querySelector("#profileScreen"),
  profileForm: document.querySelector("#profileForm"),
  profileRegion: document.querySelector("#profileRegion"),
  profileFood: document.querySelector("#profileFood"),
  profileWorkplace: document.querySelector("#profileWorkplace"),
  profileSkipBtn: document.querySelector("#profileSkipBtn"),
  // Navigation
  navItems: document.querySelectorAll(".nav-item"),
  viewTitle: document.querySelector("#viewTitle"),
  views: {
    calendar: document.querySelector("#calendarView"),
    room: document.querySelector("#roomView"),
  },
  decisionResults: document.querySelector("#decisionResults"),
  // Calendar
  calendarGrid: document.querySelector("#calendarGrid"),
  // Calendar popup
  calendarPopup: document.querySelector("#calendarPopup"),
  calendarPopupDate: document.querySelector("#calendarPopupDate"),
  calendarPopupList: document.querySelector("#calendarPopupList"),
  calendarPopupClose: document.querySelector("#calendarPopupClose"),
  calendarPopupAddBtn: document.querySelector("#calendarPopupAddBtn"),
  popupBackBtn: document.querySelector("#popupBackBtn"),
  popupListView: document.querySelector("#popupListView"),
  popupFormView: document.querySelector("#popupFormView"),
  popupScheduleForm: document.querySelector("#popupScheduleForm"),
  popupTitle: document.querySelector("#popupTitle"),
  popupStart: document.querySelector("#popupStart"),
  popupEnd: document.querySelector("#popupEnd"),
  popupCategory: document.querySelector("#popupCategory"),
  popupEndDate: document.querySelector("#popupEndDate"),
  popupRepeat: document.querySelector("#popupRepeat"),
  popupPrivate: document.querySelector("#popupPrivate"),
  popupSubmitBtn: document.querySelector("#popupSubmitBtn"),
  popupCancelBtn: document.querySelector("#popupCancelBtn"),
  // Timetable
  timetableGrid: document.querySelector("#timetableGrid"),
  addClassBtn: document.querySelector("#addClassBtn"),
  classPopup: document.querySelector("#classPopup"),
  classForm: document.querySelector("#classForm"),
  classSubject: document.querySelector("#classSubject"),
  classDay: document.querySelector("#classDay"),
  classColor: document.querySelector("#classColor"),
  classStart: document.querySelector("#classStart"),
  classEnd: document.querySelector("#classEnd"),
  classRoom: document.querySelector("#classRoom"),
  classPopupClose: document.querySelector("#classPopupClose"),
  classPopupCancelBtn: document.querySelector("#classPopupCancelBtn"),
  roomName: document.querySelector("#roomName"),
  createRoom: document.querySelector("#createRoom"),
  joinCode: document.querySelector("#joinCode"),
  joinError: document.querySelector("#joinError"),
  joinRoom: document.querySelector("#joinRoom"),
  inviteCode: document.querySelector("#inviteCode"),
  memberCount: document.querySelector("#memberCount"),
  decisionStatus: document.querySelector("#decisionStatus"),
  roomEntry: document.querySelector("#roomEntry"),
  roomActive: document.querySelector("#roomActive"),
  roomTitle: document.querySelector("#roomTitle"),
  roomStatusBadge: document.querySelector("#roomStatusBadge"),
  roomInviteCode: document.querySelector("#roomInviteCode"),
  copyCodeBtn: document.querySelector("#copyCodeBtn"),
  copyToast: document.querySelector("#copyToast"),
  roomMemberBadge: document.querySelector("#roomMemberBadge"),
  leaveRoomBtn: document.querySelector("#leaveRoomBtn"),
  participantList: document.querySelector("#participantList"),
  preferenceList: document.querySelector("#preferenceList"),
  readyBtn: document.querySelector("#readyBtn"),
  aiSection: document.querySelector("#aiSection"),
  readyStatus: document.querySelector("#readyStatus"),
  waitingNotice: document.querySelector("#waitingNotice"),
  rangeStart: document.querySelector("#rangeStart"),
  rangeEnd: document.querySelector("#rangeEnd"),
  runDecision: document.querySelector("#runDecision"),
  timeResults: document.querySelector("#timeResults"),
  availabilityBoard: document.querySelector("#availabilityBoard"),
  recommendedSlot: document.querySelector("#recommendedSlot"),
  sharedBadge: document.querySelector("#sharedBadge"),
  recommendationResult: document.querySelector("#recommendationResult"),
  aiModeBadge: document.querySelector("#aiModeBadge"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makeId(prefix = "user") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createUser({ name, region, role = "참여자" }) {
  return {
    id: makeId("user"),
    name,
    role,
    region,
    schedules: [],
    preference: {
      menu: "",
      avoid: "",
      place: "",
      mood: "",
    },
  };
}

function timeToHour(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours + minutes / 60;
}

function formatHour(hour) {
  const whole = Math.floor(hour);
  const minutes = Math.round((hour - whole) * 60);
  return `${String(whole).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value) {
  const date = parseDate(value);
  return `${date.getMonth() + 1}월 ${date.getDate()}일(${weekdayNames[date.getDay()]})`;
}

function isWeekend(value) {
  const day = parseDate(value).getDay();
  return day === 0 || day === 6;
}

function dateRange(start, end) {
  const dates = [];
  const current = parseDate(start);
  const last = parseDate(end);

  while (current <= last) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, "0");
    const dd = String(current.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function hasConflict(user, date, start, end) {
  return user.schedules.some(
    (schedule) =>
      schedule.date === date && start < schedule.end && end > schedule.start,
  );
}

function visibleSchedules(user) {
  return user.schedules.map((schedule) => ({
    ...schedule,
    title: schedule.private ? "바쁨" : schedule.title,
  }));
}

function joinedUsers() {
  return users.filter((user) => state.joinedUserIds.includes(user.id));
}

function showView(viewName) {
  Object.entries(els.views).forEach(([key, view]) => {
    view.classList.toggle("hidden", key !== viewName);
  });

  els.navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewName);
  });

  const titles = {
    calendar: "내 캘린더",
    room: "이날 어때",
    decision: "공용 결과",
  };
  els.viewTitle.textContent = titles[viewName];
}

function refreshAll() {
  renderCalendar();
  renderTimetable();
  renderRoom();
  renderPreferences();
  if (state.room) {
    renderRoomControls();
    renderDecisionIfAny();
  }
}

function showAuthError(message) {
  els.authError.textContent = message;
  els.authError.classList.remove("hidden");
}

function clearAuthError() {
  els.authError.textContent = "";
  els.authError.classList.add("hidden");
}

async function loadSchedulesFromServer() {
  const token = sessionStorage.getItem("op_token");
  if (!token || !state.currentUser) return;
  try {
    const res = await fetch("/api/schedules", { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const { schedules } = await res.json();
    state.currentUser.schedules = schedules.map((s) => ({
      serverId: s.id,
      date: s.date,
      endDate: s.end_date || s.date,
      title: s.title,
      start: s.start_hour,
      end: s.end_hour,
      private: !!s.private,
      category: s.category,
      repeat: s.repeat,
    }));
    renderCalendar();
  } catch {}
}

async function saveScheduleToServer(schedule) {
  const token = sessionStorage.getItem("op_token");
  if (!token) return null;
  try {
    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: schedule.title, date: schedule.date, end_date: schedule.endDate,
        start_hour: schedule.start, end_hour: schedule.end,
        private: schedule.private ? 1 : 0, category: schedule.category, repeat: schedule.repeat,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.id;
  } catch { return null; }
}

async function deleteScheduleFromServer(serverId) {
  const token = sessionStorage.getItem("op_token");
  if (!token || !serverId) return;
  try {
    await fetch(`/api/schedules/${serverId}`, {
      method: "DELETE", headers: { authorization: `Bearer ${token}` },
    });
  } catch {}
}

async function startSession(userData) {
  const user = createUser({ name: userData.username, region: userData.region ?? "", role: "주최자" });
  user.id = userData.id;
  user.profile = {
    preferred_food: userData.preferred_food ?? "",
    workplace: userData.workplace ?? "",
    region: userData.region ?? "",
  };
  users.length = 0;
  users.push(user);
  state.currentUser = user;
  state.joinedUserIds = [user.id];
  state.room = null;
  state.selectedCandidates = [];
  els.loginScreen.classList.add("hidden");
  els.profileScreen.classList.add("hidden");
  els.appScreen.classList.remove("hidden");
  els.signedInUser.textContent = `${user.name} · ${user.role}`;
  els.decisionStatus.textContent = "방 생성 전";
  await loadSchedulesFromServer();
  refreshAll();
}

function showProfileSetup(userData) {
  // 임시로 세션 데이터를 저장해두고 프로필 화면 표시
  els.loginScreen.classList.add("hidden");
  els.profileScreen.classList.remove("hidden");
  // 이미 region이 있으면 채워두기
  if (userData.region) els.profileRegion.value = userData.region;
  if (userData.preferred_food) els.profileFood.value = userData.preferred_food;
  if (userData.workplace) els.profileWorkplace.value = userData.workplace;
}

async function submitProfile(event) {
  event.preventDefault();
  const token = sessionStorage.getItem("op_token");
  if (!token) return;

  const region = els.profileRegion.value.trim();
  const preferred_food = els.profileFood.value.trim();
  const workplace = els.profileWorkplace.value.trim();

  if (!region) {
    els.profileRegion.focus();
    return;
  }

  try {
    const res = await fetch("/api/auth/profile", {
      method: "PUT",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ region, preferred_food, workplace }),
    });
    const data = await res.json();
    if (res.ok) {
      startSession(data.user);
    }
  } catch {
    // 실패해도 진행
    if (state.currentUser) startSession({ ...state.currentUser, region, preferred_food, workplace });
  }
}

function skipProfile() {
  // 기존 세션으로 그냥 진입 (region 없이)
  const token = sessionStorage.getItem("op_token");
  if (!token) return;
  // state.currentUser가 이미 있으면 그대로 진입
  if (state.currentUser) {
    els.profileScreen.classList.add("hidden");
    els.appScreen.classList.remove("hidden");
  }
}

async function login(event) {
  event.preventDefault();
  clearAuthError();
  const username = els.loginId.value.trim();
  const password = els.loginPassword.value;

  if (!username || !password) return;

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      showAuthError(data.error ?? "로그인에 실패했습니다.");
      return;
    }
    sessionStorage.setItem("op_token", data.token);
    startSession(data.user);
  } catch {
    showAuthError("서버에 연결할 수 없습니다. node server.js로 실행 중인지 확인하세요.");
  }
}

async function register(event) {
  event.preventDefault();
  clearAuthError();
  const username = els.registerId.value.trim();
  const password = els.registerPassword.value;
  const confirm = els.registerPasswordConfirm.value;

  if (password !== confirm) {
    showAuthError("비밀번호가 일치하지 않습니다.");
    return;
  }

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      showAuthError(data.error ?? "회원가입에 실패했습니다.");
      return;
    }
    sessionStorage.setItem("op_token", data.token);
    if (data.needsProfile) {
      // 임시로 세션만 만들어두고 프로필 설정 화면으로
      const user = createUser({ name: data.user.username, region: "", role: "주최자" });
      user.id = data.user.id;
      user.profile = { preferred_food: "", workplace: "", region: "" };
      users.length = 0;
      users.push(user);
      state.currentUser = user;
      state.joinedUserIds = [user.id];
      showProfileSetup(data.user);
    } else {
      startSession(data.user);
    }
  } catch {
    showAuthError("서버에 연결할 수 없습니다. node server.js로 실행 중인지 확인하세요.");
  }
}

async function logout() {
  const token = sessionStorage.getItem("op_token");
  if (token) {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
    } catch {}
    sessionStorage.removeItem("op_token");
  }
  users.length = 0;
  state.currentUser = null;
  state.room = null;
  state.joinedUserIds = [];
  state.selectedCandidates = [];
  els.loginScreen.classList.remove("hidden");
  els.appScreen.classList.add("hidden");
  clearAuthError();
}

// 날짜에 표시할 일정 (반복·기간 포함) 반환
function schedulesForDate(user, date) {
  if (!user) return [];
  const targetDow = parseDate(date).getDay();
  return user.schedules.filter((s) => {
    if (s.date === date) return true;
    // 기간 일정
    if (s.endDate && s.date <= date && s.endDate >= date) return true;
    // 매주 반복
    if (s.repeat === "weekly" && s.date <= date) {
      return parseDate(s.date).getDay() === targetDow;
    }
    return false;
  });
}

// 시간표에서 이 날짜 해당 요일의 수업 반환
function timetableForDate(date) {
  const dow = parseDate(date).getDay();
  return timetable.filter((c) => Number(c.day) === dow);
}

function renderCalendar() {
  const firstDayOffset = 1;
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const currentUser = state.currentUser;
  const cells = [];

  for (let i = 0; i < firstDayOffset; i++) {
    cells.push('<div class="calendar-cell muted-cell"></div>');
  }

  days.forEach((day) => {
    const date = `2026-06-${String(day).padStart(2, "0")}`;
    const allSchedules = schedulesForDate(currentUser, date);
    const visible = allSchedules.map((s) => ({
      ...s,
      title: s.private ? "바쁨" : s.title,
    }));
    const classes = timetableForDate(date);
    const isSelected = date === state.popupDate;

    const schedulePills = visible.slice(0, 2).map((s) => {
      const cat = CATEGORIES[s.category] ?? CATEGORIES["기타"];
      return `<span class="event-pill" style="background:${cat.bg};color:${cat.text}">${cat.emoji} ${escapeHtml(s.title)}</span>`;
    }).join("");

    const classPills = classes.slice(0, 1).map((c) => {
      const col = CLASS_COLORS[c.color] ?? CLASS_COLORS.blue;
      return `<span class="event-pill" style="background:${col.bg};color:${col.text};border-left:3px solid ${col.border}">${escapeHtml(c.subject)}</span>`;
    }).join("");

    const overflow = (visible.length + classes.length) > 3
      ? `<span class="event-more">+${visible.length + classes.length - 2}개</span>` : "";

    cells.push(`
      <article class="calendar-cell${isSelected ? " selected" : ""}" data-date="${date}" role="button" tabindex="0" aria-label="${day}일 일정 확인">
        <span class="day-number">${day}</span>
        <div class="calendar-events">${schedulePills}${classPills}${overflow}</div>
      </article>
    `);
  });

  els.calendarGrid.innerHTML = `
    ${weekdayNames.map((d) => `<div class="calendar-weekday">${d}</div>`).join("")}
    ${cells.join("")}
  `;
}

function showPopupListView() {
  state.popupView = "list";
  els.popupListView.classList.remove("hidden");
  els.popupFormView.classList.add("hidden");
  els.popupBackBtn.classList.add("hidden");
}

function showPopupFormView(editMode = false) {
  state.popupView = "form";
  els.popupListView.classList.add("hidden");
  els.popupFormView.classList.remove("hidden");
  els.popupBackBtn.classList.remove("hidden");
  els.popupSubmitBtn.textContent = editMode ? "일정 수정" : "일정 추가";
  if (!editMode) {
    els.popupTitle.value = "";
    els.popupStart.value = "09:00";
    els.popupEnd.value = "11:00";
    els.popupCategory.value = "수업";
    els.popupEndDate.value = "";
    els.popupRepeat.value = "none";
    els.popupPrivate.checked = false;
  }
}

function openCalendarPopup(date) {
  state.popupDate = date;
  state.editingSchedule = null;
  els.calendarPopupDate.textContent = formatDate(date);
  renderPopupList();
  showPopupListView();
  els.calendarPopup.classList.remove("hidden");
}

function renderPopupList() {
  const date = state.popupDate;
  if (!date) return;
  const user = state.currentUser;
  // 그 날짜에 해당하는 원본 일정들 (반복/기간 포함)
  const schedules = user?.schedules.filter((s, i) => {
    if (s.date === date) return true;
    if (s.endDate && s.date <= date && s.endDate >= date) return true;
    if (s.repeat === "weekly" && parseDate(s.date).getDay() === parseDate(date).getDay() && s.date <= date) return true;
    return false;
  }) ?? [];

  // 시간표 수업
  const classes = timetableForDate(date);

  let html = "";
  if (schedules.length === 0 && classes.length === 0) {
    html = '<p class="popup-empty">이 날짜에 일정이 없습니다</p>';
  } else {
    // 일정
    const originalIndexes = user?.schedules.reduce((acc, s, i) => {
      if (schedules.includes(s)) acc.push(i);
      return acc;
    }, []) ?? [];

    html += schedules.map((s, pos) => {
      const cat = CATEGORIES[s.category] ?? CATEGORIES["기타"];
      const origIdx = user.schedules.indexOf(s);
      const repeatBadge = s.repeat === "weekly" ? '<span class="popup-repeat-badge">매주</span>' : "";
      const rangeBadge = s.endDate && s.endDate !== s.date ? '<span class="popup-repeat-badge">기간</span>' : "";
      return `
        <div class="popup-schedule-item ${s.private ? "private" : ""}">
          <div class="popup-schedule-info">
            <span class="popup-schedule-title">${cat.emoji} ${s.private ? "비공개" : escapeHtml(s.title)}${repeatBadge}${rangeBadge}</span>
            <span class="popup-schedule-time">${formatHour(s.start)} – ${formatHour(s.end)}</span>
          </div>
          <div class="popup-schedule-actions">
            <button class="popup-btn edit-btn" data-action="edit" data-index="${origIdx}">수정</button>
            <button class="popup-btn delete-btn" data-action="delete" data-index="${origIdx}">삭제</button>
          </div>
        </div>`;
    }).join("");

    // 시간표 수업 (삭제만)
    html += classes.map((c) => {
      const col = CLASS_COLORS[c.color] ?? CLASS_COLORS.blue;
      return `
        <div class="popup-schedule-item" style="border-left:3px solid ${col.border}">
          <div class="popup-schedule-info">
            <span class="popup-schedule-title">🏫 ${escapeHtml(c.subject)}${c.room ? ` · ${escapeHtml(c.room)}` : ""}<span class="popup-repeat-badge">시간표</span></span>
            <span class="popup-schedule-time">${formatHour(c.start)} – ${formatHour(c.end)}</span>
          </div>
          <div class="popup-schedule-actions">
            <button class="popup-btn delete-btn" data-action="delete-class" data-id="${c.id}">삭제</button>
          </div>
        </div>`;
    }).join("");
  }

  els.calendarPopupList.innerHTML = html;
}

function closeCalendarPopup() {
  els.calendarPopup.classList.add("hidden");
  state.popupDate = null;
  state.editingSchedule = null;
  state.popupView = "list";
}

function deleteSchedule(index) {
  if (!state.currentUser) return;
  const removed = state.currentUser.schedules.splice(index, 1)[0];
  if (removed?.serverId) deleteScheduleFromServer(removed.serverId);
  renderPopupList();
  renderCalendar();
}

function startEditSchedule(index) {
  if (!state.currentUser) return;
  const s = state.currentUser.schedules[index];
  if (!s) return;

  state.editingSchedule = { index };
  els.popupTitle.value = s.private ? "" : s.title;
  els.popupStart.value = formatHour(s.start);
  els.popupEnd.value = formatHour(s.end);
  els.popupCategory.value = s.category ?? "기타";
  els.popupEndDate.value = s.endDate ?? "";
  els.popupRepeat.value = s.repeat ?? "none";
  els.popupPrivate.checked = s.private;

  showPopupFormView(true);
}

function addScheduleFromPopup(event) {
  event.preventDefault();
  if (!state.currentUser || !state.popupDate) return;

  const data = {
    title: els.popupTitle.value.trim(),
    date: state.popupDate,
    endDate: els.popupEndDate.value || state.popupDate,
    start: timeToHour(els.popupStart.value),
    end: timeToHour(els.popupEnd.value),
    isPrivate: els.popupPrivate.checked,
    category: els.popupCategory.value,
    repeat: els.popupRepeat.value,
  };

  if (!data.title || data.start >= data.end) return;

  if (state.editingSchedule !== null) {
    state.currentUser.schedules.splice(state.editingSchedule.index, 1);
    state.editingSchedule = null;
  }

  const newSchedule = {
    date: data.date, endDate: data.endDate, title: data.title,
    start: data.start, end: data.end, private: data.isPrivate,
    category: data.category, repeat: data.repeat,
  };
  state.currentUser.schedules.push(newSchedule);
  state.currentUser.schedules.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  // 서버에 저장 (비동기, 실패해도 로컬은 유지)
  saveScheduleToServer(newSchedule).then((id) => { if (id) newSchedule.serverId = id; });

  renderPopupList();
  showPopupListView();
  renderCalendar();
}

// ── Timetable ─────────────────────────────────────────────────────────────────
function renderTimetable() {
  const days = TIMETABLE_DAYS;
  const hours = TIMETABLE_HOURS;

  // 헤더
  let headerHtml = `<div class="tt-corner"></div>${days.map((d) => `<div class="tt-day-head">${d}</div>`).join("")}`;

  // 시간 행
  let rowsHtml = hours.map((h) => {
    const timeLabel = `${String(h).padStart(2, "0")}:00`;
    const cells = days.map((_, di) => {
      const dayNum = di + 1; // 1=월, 6=토
      const cls = timetable.find((c) => Number(c.day) === dayNum && c.start <= h && c.end > h);
      if (!cls) return `<div class="tt-cell"></div>`;
      const col = CLASS_COLORS[cls.color] ?? CLASS_COLORS.blue;
      const isStart = cls.start === h;
      const span = cls.end - cls.start;
      if (!isStart) return `<div class="tt-cell occupied"></div>`;
      return `
        <div class="tt-cell tt-class" style="background:${col.bg};color:${col.text};border:1.5px solid ${col.border};grid-row:span ${span}" data-class-id="${cls.id}">
          <strong>${escapeHtml(cls.subject)}</strong>
          ${cls.room ? `<small>${escapeHtml(cls.room)}</small>` : ""}
          <button class="tt-delete-btn" data-class-id="${cls.id}" title="삭제">×</button>
        </div>`;
    }).join("");
    return `<div class="tt-time-label">${timeLabel}</div>${cells}`;
  }).join("");

  els.timetableGrid.innerHTML = `
    <div class="tt-header">${headerHtml}</div>
    <div class="tt-body">${rowsHtml}</div>
  `;
}

function addClass(event) {
  event.preventDefault();
  const subject = els.classSubject.value.trim();
  const day = Number(els.classDay.value);
  const start = timeToHour(els.classStart.value);
  const end = timeToHour(els.classEnd.value);
  const room = els.classRoom.value.trim();
  const color = els.classColor.value;

  if (!subject || start >= end) return;

  timetable.push({ id: makeId("cls"), subject, day, start, end, room, color });

  // 시간표 수업을 캘린더 반복 일정으로도 추가
  const dowNames = ["일", "월", "화", "수", "목", "금", "토"];
  // 6월 해당 요일 첫 번째 날 찾기
  for (let d = 1; d <= 30; d++) {
    const date = `2026-06-${String(d).padStart(2, "0")}`;
    if (parseDate(date).getDay() === day) {
      addScheduleToUser(state.currentUser, {
        title: subject + (room ? ` (${room})` : ""),
        date,
        endDate: date,
        start,
        end,
        isPrivate: false,
        category: "수업",
        repeat: "weekly",
      });
      break;
    }
  }

  els.classSubject.value = "";
  els.classRoom.value = "";
  els.classPopup.classList.add("hidden");
  renderTimetable();
  renderCalendar();
}

function deleteTimetableClass(id) {
  const idx = timetable.findIndex((c) => c.id === id);
  if (idx !== -1) timetable.splice(idx, 1);
  // 관련 반복 일정도 제거
  if (state.currentUser) {
    state.currentUser.schedules = state.currentUser.schedules.filter(
      (s) => !(s.repeat === "weekly" && s.category === "수업")
    );
  }
  renderTimetable();
  renderCalendar();
  if (state.popupDate) renderPopupList();
}

function handleCalendarClick(event) {
  const cell = event.target.closest("[data-date]");
  if (!cell) return;
  const date = cell.dataset.date;
  document.querySelectorAll(".calendar-cell.selected").forEach((c) => c.classList.remove("selected"));
  cell.classList.add("selected");
  openCalendarPopup(date);
}

function addScheduleToUser(user, { title, date, endDate, start, end, isPrivate, category, repeat }) {
  if (!user || start >= end) return false;
  user.schedules.push({
    date,
    endDate: endDate ?? date,
    title,
    start,
    end,
    private: isPrivate ?? false,
    category: category ?? "기타",
    repeat: repeat ?? "none",
  });
  user.schedules.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  return true;
}


// 이름 기반 일관된 아바타 색상
const AVATAR_COLORS = [
  { bg: "#fee2e2", text: "#991b1b" },
  { bg: "#fef3c7", text: "#92400e" },
  { bg: "#d1fae5", text: "#065f46" },
  { bg: "#dbeafe", text: "#1e40af" },
  { bg: "#ede9fe", text: "#5b21b6" },
  { bg: "#fce7f3", text: "#9d174d" },
  { bg: "#e0f2fe", text: "#0369a1" },
  { bg: "#fef9c3", text: "#713f12" },
];

function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function showRoomActive() {
  els.roomEntry.classList.add("hidden");
  els.roomActive.classList.remove("hidden");
}

function leaveRoom() {
  stopRoomPolling();
  // 서버에서 멤버 제거
  const token = sessionStorage.getItem("op_token");
  if (token && state.room) {
    fetch("/api/rooms/leave", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: state.room.code }),
    }).catch(() => {});
  }

  state.room = null;
  state.selectedCandidates = [];
  // 현재 사용자만 남기고 나머지 제거
  const host = state.currentUser;
  users.length = 0;
  if (host) {
    users.push(host);
    state.joinedUserIds = [host.id];
  } else {
    state.joinedUserIds = [];
  }
  els.roomActive.classList.add("hidden");
  els.roomEntry.classList.remove("hidden");
  els.decisionResults.classList.add("hidden");
  els.inviteCode.textContent = "방 없음";
  els.memberCount.textContent = "0명";
  els.decisionStatus.textContent = "방 생성 전";
  // 아코디언 닫기
  document.querySelectorAll(".accordion.open").forEach((acc) => {
    acc.classList.remove("open");
    acc.querySelector(".accordion-body")?.classList.add("hidden");
  });
  refreshAll();
}

async function copyInviteCode() {
  const code = state.room?.code ?? "";
  try {
    await navigator.clipboard.writeText(code);
  } catch {
    // clipboard API 실패 시 fallback
  }
  els.copyToast.classList.remove("hidden");
  setTimeout(() => els.copyToast.classList.add("hidden"), 2000);
}

function toggleAccordion(event) {
  const btn = event.currentTarget;
  const targetId = btn.dataset.target;
  const body = document.getElementById(targetId);
  if (!body) return;
  const isOpen = !body.classList.contains("hidden");
  body.classList.toggle("hidden", isOpen);
  btn.closest(".accordion").classList.toggle("open", !isOpen);
}

// ── 방 멤버 동기화 ────────────────────────────────────────────────────────────
let roomPollTimer = null;

// 서버 payload(멤버 목록)로 users 배열과 joinedUserIds 재구성
function syncRoomFromPayload(payload) {
  state.room = { name: payload.name, code: payload.code, hostId: payload.hostId };
  state.decision = payload.decision ?? null;

  const prevById = {};
  users.forEach((u) => { prevById[u.id] = u; });

  users.length = 0;
  state.joinedUserIds = [];
  state.readyMap = {};

  payload.members.forEach((m) => {
    const isMe = m.id === state.currentUser?.id;
    const prev = prevById[m.id];
    // 선호: 로컬 편집값 우선, 없으면 서버에서 내려온 본인 선호, 그것도 없으면 빈값
    const preference = prev?.preference
      ?? (m.preference ? { menu: m.preference.menu || "", avoid: m.preference.avoid || "", place: m.preference.place || "", mood: m.preference.mood || "" } : null)
      ?? { menu: "", avoid: "", place: "", mood: "" };
    const user = {
      id: m.id,
      name: m.name,
      role: m.role,
      region: m.region,
      ready: m.ready,
      schedules: isMe && state.currentUser ? state.currentUser.schedules : m.schedules,
      profile: m.profile,
      preference,
    };
    users.push(user);
    state.joinedUserIds.push(m.id);
    state.readyMap[m.id] = m.ready;
    if (isMe) state.currentUser = user;
  });
}

// 현재 입력 중인 선호 값을 user 객체에 저장 (폴링 시 입력 손실 방지)
function capturePreferenceInputs() {
  const card = document.querySelector(".preference-card");
  if (!card) return;
  const user = users.find((u) => u.id === card.dataset.userId);
  if (!user) return;
  const values = {};
  card.querySelectorAll("input[data-field]").forEach((input) => {
    values[input.dataset.field] = input.value.trim();
  });
  user.preference = { ...user.preference, ...values };
}

async function refreshRoomFromServer() {
  if (!state.room) return;
  try {
    const token = sessionStorage.getItem("op_token");
    const res = await fetch(`/api/rooms/${encodeURIComponent(state.room.code)}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const payload = await res.json();
    capturePreferenceInputs();
    syncRoomFromPayload(payload);
    renderRoom();
    renderRoomControls();
    renderDecisionIfAny();
  } catch {}
}

function startRoomPolling() {
  stopRoomPolling();
  roomPollTimer = setInterval(refreshRoomFromServer, 3000);
}

function stopRoomPolling() {
  if (roomPollTimer) { clearInterval(roomPollTimer); roomPollTimer = null; }
}

async function createRoom() {
  if (!state.currentUser) return;
  const token = sessionStorage.getItem("op_token");
  const roomName = els.roomName.value.trim() || "새 약속";

  try {
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: roomName }),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error);
    syncRoomFromPayload(payload);
  } catch {
    els.decisionStatus.textContent = "방 생성 실패 (서버 확인)";
    return;
  }

  state.selectedCandidates = [];
  els.decisionStatus.textContent = "참여 대기";
  showRoomActive();
  refreshAll();
  startRoomPolling();
  showView("room");
}

async function joinRoom() {
  const code = els.joinCode.value.trim().toUpperCase();
  if (els.joinError) els.joinError.classList.add("hidden");

  if (!code) {
    if (els.joinError) { els.joinError.textContent = "초대코드를 입력하세요."; els.joinError.classList.remove("hidden"); }
    return;
  }

  const token = sessionStorage.getItem("op_token");
  try {
    const res = await fetch("/api/rooms/join", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ code }),
    });
    const payload = await res.json();
    if (!res.ok) {
      if (els.joinError) { els.joinError.textContent = payload.error ?? "입장 실패"; els.joinError.classList.remove("hidden"); }
      return;
    }
    syncRoomFromPayload(payload);
  } catch {
    if (els.joinError) { els.joinError.textContent = "서버에 연결할 수 없습니다."; els.joinError.classList.remove("hidden"); }
    return;
  }

  els.joinCode.value = "";
  state.selectedCandidates = [];
  els.decisionStatus.textContent = "방 입장 완료";
  showRoomActive();
  refreshAll();
  startRoomPolling();
  showView("room");
}

function renderRoom() {
  const members = joinedUsers();
  const room = state.room;

  els.inviteCode.textContent = room?.code ?? "방 없음";
  els.memberCount.textContent = `${members.length}명`;
  if (els.roomMemberBadge) els.roomMemberBadge.textContent = `${members.length}명`;

  if (!room) return;

  els.roomTitle.textContent = room.name;
  els.roomInviteCode.textContent = room.code;
  els.roomStatusBadge.textContent =
    members.length <= 1 ? "참여 대기" : `${members.length}명 참여 중`;

  els.participantList.innerHTML = members.map((user) => {
    const color = avatarColor(user.name);
    const initial = [...user.name][0];
    const scheduleCount = user.schedules.length;
    const isMe = user.id === state.currentUser?.id;
    const isHost = user.role === "주최자";
    // 주최자는 준비 배지 없음, 참여자는 준비/대기 배지
    const readyBadge = isHost
      ? ""
      : (user.ready ? '<span class="ready-pill done">✓ 준비완료</span>' : '<span class="ready-pill wait">대기중</span>');
    return `
      <div class="member-card ${user.ready && !isHost ? "is-ready" : ""}">
        <div class="member-avatar" style="background:${color.bg};color:${color.text}">${escapeHtml(initial)}</div>
        <div class="member-info">
          <strong>${escapeHtml(user.name)}${isMe ? " (나)" : ""}</strong>
          <span>${escapeHtml(user.region)} · 일정 ${scheduleCount}개</span>
        </div>
        ${readyBadge || `<span class="role-chip host">주최자</span>`}
      </div>
    `;
  }).join("");
}

// 역할별 컨트롤(준비완료 버튼 / AI 섹션) 렌더
function renderRoomControls() {
  if (!state.room || !state.currentUser) return;
  const me = users.find((u) => u.id === state.currentUser.id);
  const isHost = state.room.hostId === state.currentUser.id;
  const participants = users.filter((u) => u.role !== "주최자");
  const readyCount = participants.filter((u) => u.ready).length;
  const allReady = participants.length === 0 ? true : readyCount === participants.length;

  // 준비 완료 버튼 (모두에게 보이되, 주최자는 선호만 제출 — 라벨 동일)
  const meReady = !!me?.ready;
  els.readyBtn.textContent = meReady ? "✓ 준비 완료됨 (수정하려면 클릭)" : "준비 완료";
  els.readyBtn.classList.toggle("done", meReady);

  // 주최자: AI 섹션, 참여자: 안내
  els.aiSection.classList.toggle("hidden", !isHost);
  els.waitingNotice.classList.toggle("hidden", isHost || !meReady);

  if (isHost) {
    els.readyStatus.textContent = `참여자 준비 상태: ${readyCount}/${participants.length}`;
    els.runDecision.disabled = !allReady;
    els.runDecision.classList.toggle("locked", !allReady);
  }
}

// 서버 결정이 있으면 모두에게 결과 표시
function renderDecisionIfAny() {
  if (state.decision) {
    renderDecision(state.decision);
    els.decisionResults.classList.remove("hidden");
  } else {
    els.decisionResults.classList.add("hidden");
  }
}

function renderPreferences() {
  const currentUser = state.currentUser;
  if (!currentUser) { els.preferenceList.innerHTML = ""; return; }

  // 본인 카드만 표시 — 다른 참여자의 선호는 보이지 않음 (개인정보 보호)
  const me = joinedUsers().find((u) => u.id === currentUser.id);
  if (!me) { els.preferenceList.innerHTML = ""; return; }

  els.preferenceList.innerHTML = `
    <article class="preference-card" data-user-id="${me.id}" style="grid-column:1/-1">
      <div class="person-top">
        <div>
          <h4>${escapeHtml(me.name)}</h4>
          <span class="region">${escapeHtml(me.region)}</span>
        </div>
        <span class="privacy my-badge">내 선호</span>
      </div>
      <label>먹고 싶은 메뉴<input data-field="menu" type="text" value="${escapeHtml(me.preference.menu)}" placeholder="예: 일식, 파스타" /></label>
      <label>피하고 싶은 메뉴<input data-field="avoid" type="text" value="${escapeHtml(me.preference.avoid)}" placeholder="예: 매운 음식" /></label>
      <label>선호 장소<input data-field="place" type="text" value="${escapeHtml(me.preference.place)}" placeholder="예: 합정, 강남" /></label>
      <label>원하는 분위기<input data-field="mood" type="text" value="${escapeHtml(me.preference.mood)}" placeholder="예: 조용한 곳, 가성비" /></label>
    </article>
  `;
}

// 현재 사용자의 선호 입력값을 DOM에서 읽어 반환
function readMyPreference() {
  const card = document.querySelector(".preference-card");
  const pref = { menu: "", avoid: "", place: "", mood: "" };
  if (!card) return pref;
  card.querySelectorAll("input[data-field]").forEach((input) => {
    pref[input.dataset.field] = input.value.trim();
  });
  return pref;
}

// ── 서버 결정 결과 렌더링 (모두 동일 화면) ────────────────────────────────────
function renderDecision(decision) {
  const { candidates, availabilityRows, recommendation, recSource } = decision;
  const top = candidates[0];

  // 1) 최적 시간
  els.recommendedSlot.classList.remove("empty-state");
  els.recommendedSlot.innerHTML = top
    ? `<div>
         <span class="result-kicker">AI가 선정한 최적 시간</span>
         <strong>${escapeHtml(top.title)}</strong>
         <p>${escapeHtml(top.reason)}</p>
       </div>`
    : "지정한 기간 안에서 모두 가능한 시간이 없습니다.";
  els.sharedBadge.textContent = top ? "모든 참여자에게 공개됨" : "후보 없음";

  // 2) 가능 시간 보드
  els.availabilityBoard.classList.remove("empty-state");
  els.availabilityBoard.innerHTML = availabilityRows.map((row) => `
    <article class="availability-row">
      <strong>${escapeHtml(row.dateLabel)}</strong>
      <div class="slot-list">
        ${row.slots.map((slot) => `
          <span class="slot-pill ${slot.available ? "available" : "blocked"} ${slot.selected ? "selected" : ""}">
            ${formatHour(slot.start)}
            <small>${slot.available ? "전원 가능" : `${escapeHtml(slot.unavailableNames.join(", "))} 불가`}</small>
          </span>`).join("")}
      </div>
    </article>`).join("");

  // 3) 후보 시간 순위
  els.timeResults.classList.remove("empty-state");
  els.timeResults.innerHTML = candidates.length
    ? candidates.map((c) => `
        <article class="result-card ${c.rank === 1 ? "recommended" : ""}">
          <h4><span>${c.rank}순위 · ${escapeHtml(c.title)}</span><span class="score">${c.score}점</span></h4>
          <p class="reason">${escapeHtml(c.reason)}</p>
        </article>`).join("")
    : "지정한 기간 안에서 모두 가능한 시간이 없습니다.";

  // 4) 메뉴·장소 추천
  const rec = recommendation ?? {};
  els.aiModeBadge.textContent = recSource === "llm" ? "LLM 추천" : "로컬 추천";
  els.recommendationResult.classList.remove("empty-state");
  els.recommendationResult.innerHTML = `
    <div class="recommendation-main">
      <span class="result-kicker">AI가 취합한 모임 추천</span>
      <strong>${escapeHtml(rec.title ?? `${rec.place ?? ""} · ${rec.menu ?? ""}`)}</strong>
      <p>${escapeHtml(rec.summary ?? rec.compromise ?? "")}</p>
    </div>
    <div class="recommendation-facts">
      <span><b>추천 메뉴</b>${escapeHtml(rec.menu ?? "미정")}</span>
      <span><b>추천 장소</b>${escapeHtml(rec.place ?? "미정")}</span>
    </div>
    <ul class="reason-list">
      ${(rec.reasons ?? []).map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
    </ul>
    <p class="compromise">${escapeHtml(rec.compromise ?? "")}</p>`;
}

// 참여자/주최자: 선호 제출 + 준비 완료 토글
async function markReady() {
  if (!state.room || !state.currentUser) return;
  const me = users.find((u) => u.id === state.currentUser.id);
  const willReady = !me?.ready;
  const preference = readMyPreference();
  state.currentUser.preference = preference;

  const token = sessionStorage.getItem("op_token");
  try {
    const res = await fetch("/api/rooms/ready", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: state.room.code, ready: willReady, preference }),
    });
    const payload = await res.json();
    if (res.ok) {
      syncRoomFromPayload(payload);
      renderRoom();
      renderRoomControls();
      renderDecisionIfAny();
    }
  } catch {}
}

// 주최자: AI 시간 선정 (전원 준비 완료 시)
async function runDecision() {
  if (!state.room || !state.currentUser) return;
  if (state.room.hostId !== state.currentUser.id) return;

  const preference = readMyPreference();
  state.currentUser.preference = preference;

  els.runDecision.disabled = true;
  els.aiModeBadge.textContent = "분석 중";
  els.decisionResults.classList.remove("hidden");
  els.recommendationResult.classList.remove("empty-state");
  els.recommendationResult.textContent = "전원의 선호를 취합해 추천을 생성 중입니다...";
  els.decisionResults.scrollIntoView({ behavior: "smooth", block: "start" });

  const token = sessionStorage.getItem("op_token");
  try {
    const res = await fetch("/api/rooms/decide", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        code: state.room.code,
        rangeStart: els.rangeStart.value,
        rangeEnd: els.rangeEnd.value,
        preference,
      }),
    });
    const payload = await res.json();
    if (!res.ok) {
      els.recommendationResult.textContent = payload.error ?? "시간 선정 실패";
      els.runDecision.disabled = false;
      return;
    }
    syncRoomFromPayload(payload);
    renderRoom();
    renderRoomControls();
    renderDecisionIfAny();
  } catch {
    els.recommendationResult.textContent = "서버 연결에 실패했습니다.";
    els.runDecision.disabled = false;
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
els.loginForm.addEventListener("submit", login);
els.registerForm.addEventListener("submit", register);
els.profileForm.addEventListener("submit", submitProfile);
els.profileSkipBtn.addEventListener("click", skipProfile);
els.logoutButton.addEventListener("click", logout);

els.tabLogin.addEventListener("click", () => {
  els.tabLogin.classList.add("active"); els.tabLogin.setAttribute("aria-selected", "true");
  els.tabRegister.classList.remove("active"); els.tabRegister.setAttribute("aria-selected", "false");
  els.loginForm.classList.remove("hidden"); els.registerForm.classList.add("hidden");
  clearAuthError();
});
els.tabRegister.addEventListener("click", () => {
  els.tabRegister.classList.add("active"); els.tabRegister.setAttribute("aria-selected", "true");
  els.tabLogin.classList.remove("active"); els.tabLogin.setAttribute("aria-selected", "false");
  els.registerForm.classList.remove("hidden"); els.loginForm.classList.add("hidden");
  clearAuthError();
});

// ── Navigation ────────────────────────────────────────────────────────────────
els.navItems.forEach((item) => {
  item.addEventListener("click", () => showView(item.dataset.view));
});

// ── Calendar popup ────────────────────────────────────────────────────────────
els.calendarGrid.addEventListener("click", handleCalendarClick);
els.calendarGrid.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCalendarClick(e); }
});

els.calendarPopupClose.addEventListener("click", closeCalendarPopup);
els.calendarPopup.addEventListener("click", (e) => {
  if (e.target === els.calendarPopup) closeCalendarPopup();
});
els.popupBackBtn.addEventListener("click", () => {
  state.editingSchedule = null;
  showPopupListView();
});
els.calendarPopupAddBtn.addEventListener("click", () => showPopupFormView(false));
els.popupCancelBtn.addEventListener("click", () => { state.editingSchedule = null; showPopupListView(); });
els.popupScheduleForm.addEventListener("submit", addScheduleFromPopup);

els.calendarPopupList.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "delete") deleteSchedule(parseInt(btn.dataset.index, 10));
  if (btn.dataset.action === "edit") startEditSchedule(parseInt(btn.dataset.index, 10));
  if (btn.dataset.action === "delete-class") deleteTimetableClass(btn.dataset.id);
});

// ── Timetable ─────────────────────────────────────────────────────────────────
els.addClassBtn.addEventListener("click", () => els.classPopup.classList.remove("hidden"));
els.classPopupClose.addEventListener("click", () => els.classPopup.classList.add("hidden"));
els.classPopupCancelBtn.addEventListener("click", () => els.classPopup.classList.add("hidden"));
els.classPopup.addEventListener("click", (e) => { if (e.target === els.classPopup) els.classPopup.classList.add("hidden"); });
els.classForm.addEventListener("submit", addClass);
els.timetableGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".tt-delete-btn");
  if (btn) deleteTimetableClass(btn.dataset.classId);
});

// ── Room ──────────────────────────────────────────────────────────────────────
els.copyCodeBtn.addEventListener("click", copyInviteCode);
els.leaveRoomBtn.addEventListener("click", leaveRoom);
document.querySelectorAll(".accordion-trigger").forEach((btn) => btn.addEventListener("click", toggleAccordion));
els.createRoom.addEventListener("click", createRoom);
els.joinRoom.addEventListener("click", joinRoom);
els.readyBtn.addEventListener("click", markReady);
els.runDecision.addEventListener("click", runDecision);
