const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
// 배포 환경(클라우드)에서는 0.0.0.0으로 바인딩해야 외부 접속이 가능.
// 로컬에서도 0.0.0.0은 127.0.0.1 접속을 그대로 받는다.
const host = process.env.HOST || "0.0.0.0";
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
const BODY_LIMIT = 1 * 1024 * 1024; // 1 MB

// ── Database ──────────────────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, "openplanner.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id             TEXT    PRIMARY KEY,
    username       TEXT    UNIQUE NOT NULL,
    password_hash  TEXT    NOT NULL,
    region         TEXT    NOT NULL DEFAULT '',
    preferred_food TEXT    NOT NULL DEFAULT '',
    workplace      TEXT    NOT NULL DEFAULT '',
    created_at     INTEGER NOT NULL
  )
`);
// 기존 DB 마이그레이션
for (const col of ["preferred_food TEXT NOT NULL DEFAULT ''", "workplace TEXT NOT NULL DEFAULT ''"]) {
  try { db.exec(`ALTER TABLE users ADD COLUMN ${col}`); } catch {}
}

// 일정 저장 테이블
db.exec(`
  CREATE TABLE IF NOT EXISTS schedules (
    id         TEXT    PRIMARY KEY,
    user_id    TEXT    NOT NULL,
    title      TEXT    NOT NULL,
    date       TEXT    NOT NULL,
    end_date   TEXT    NOT NULL DEFAULT '',
    start_hour REAL    NOT NULL,
    end_hour   REAL    NOT NULL,
    private    INTEGER NOT NULL DEFAULT 0,
    category   TEXT    NOT NULL DEFAULT '기타',
    repeat     TEXT    NOT NULL DEFAULT 'none',
    created_at INTEGER NOT NULL
  )
`);

// 방 코드를 서버에 저장해 다른 기기에서도 초대코드로 입장 가능
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    code       TEXT    PRIMARY KEY,
    name       TEXT    NOT NULL,
    host_id    TEXT    NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

// 방 참여자 (서버에 저장해 방장·참여자가 같은 멤버 목록을 봄)
db.exec(`
  CREATE TABLE IF NOT EXISTS room_members (
    code      TEXT    NOT NULL,
    user_id   TEXT    NOT NULL,
    joined_at INTEGER NOT NULL,
    ready     INTEGER NOT NULL DEFAULT 0,
    pref_menu  TEXT   NOT NULL DEFAULT '',
    pref_avoid TEXT   NOT NULL DEFAULT '',
    pref_place TEXT   NOT NULL DEFAULT '',
    pref_mood  TEXT   NOT NULL DEFAULT '',
    PRIMARY KEY (code, user_id)
  )
`);
// 마이그레이션 (기존 방 멤버 테이블에 컬럼 추가)
for (const col of [
  "ready INTEGER NOT NULL DEFAULT 0",
  "pref_menu TEXT NOT NULL DEFAULT ''",
  "pref_avoid TEXT NOT NULL DEFAULT ''",
  "pref_place TEXT NOT NULL DEFAULT ''",
  "pref_mood TEXT NOT NULL DEFAULT ''",
]) { try { db.exec(`ALTER TABLE room_members ADD COLUMN ${col}`); } catch {} }
try { db.exec("ALTER TABLE rooms ADD COLUMN decision TEXT NOT NULL DEFAULT ''"); } catch {}

// 오래된 방·멤버 정리 (24시간 이상 지난 방 삭제) — 시작 시 + 1시간마다
function cleanupOldRooms() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const stale = db.prepare("SELECT code FROM rooms WHERE created_at < ?").all(cutoff);
  for (const r of stale) {
    db.prepare("DELETE FROM room_members WHERE code = ?").run(r.code);
    db.prepare("DELETE FROM rooms WHERE code = ?").run(r.code);
  }
  if (stale.length) console.log(`[cleanup] 오래된 방 ${stale.length}개 정리`);
}
cleanupOldRooms();
setInterval(cleanupOldRooms, 60 * 60 * 1000).unref();

// ── Session store (in-memory) ─────────────────────────────────────────────────
const sessions = new Map(); // token → { id, username, region, preferred_food, workplace }

function profileFields(user) {
  return {
    id: user.id,
    username: user.username,
    region: user.region ?? "",
    preferred_food: user.preferred_food ?? "",
    workplace: user.workplace ?? "",
  };
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, profileFields(user));
  return token;
}

function getSession(token) {
  if (!token) return null;
  return sessions.get(token) ?? null;
}

function deleteSession(token) {
  sessions.delete(token);
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > BODY_LIMIT) throw new Error("요청 본문이 너무 큽니다.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new Error("잘못된 JSON 형식입니다.");
  }
}

// ── Auth handlers ─────────────────────────────────────────────────────────────
async function handleRegister(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return sendJson(res, 400, { error: e.message });
  }

  const { username, password } = body;

  if (!username || !password) {
    return sendJson(res, 400, { error: "이름과 비밀번호가 필요합니다." });
  }
  if (typeof username !== "string" || username.trim().length < 2 || username.trim().length > 20) {
    return sendJson(res, 400, { error: "이름은 2~20자여야 합니다." });
  }
  if (typeof password !== "string" || password.length < 6) {
    return sendJson(res, 400, { error: "비밀번호는 6자 이상이어야 합니다." });
  }

  const uname = username.trim();
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(uname);
  if (existing) {
    return sendJson(res, 409, { error: "이미 사용 중인 이름입니다." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = crypto.randomBytes(16).toString("hex");

  db.prepare(
    "INSERT INTO users (id, username, password_hash, region, preferred_food, workplace, created_at) VALUES (?, ?, ?, '', '', '', ?)"
  ).run(id, uname, passwordHash, Date.now());

  const newUser = { id, username: uname, region: "", preferred_food: "", workplace: "" };
  const token = createSession(newUser);
  sendJson(res, 201, { token, user: newUser, needsProfile: true });
}

async function handleLogin(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return sendJson(res, 400, { error: e.message });
  }

  const { username, password } = body;

  if (!username || !password) {
    return sendJson(res, 400, { error: "이름과 비밀번호를 입력해주세요." });
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

  const dummyHash = "$2a$12$invalidhashfortimingprotection00000000000000000000000000";
  const ok = user ? await bcrypt.compare(password, user.password_hash)
                   : await bcrypt.compare(password, dummyHash).then(() => false);

  if (!ok) {
    return sendJson(res, 401, { error: "이름 또는 비밀번호가 올바르지 않습니다." });
  }

  const token = createSession(user);
  sendJson(res, 200, { token, user: profileFields(user) });
}

async function handleUpdateProfile(req, res) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return sendJson(res, 401, { error: "로그인이 필요합니다." });

  let body;
  try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }

  const region = (body.region ?? "").trim();
  const preferred_food = (body.preferred_food ?? "").trim();
  const workplace = (body.workplace ?? "").trim();

  db.prepare(
    "UPDATE users SET region = ?, preferred_food = ?, workplace = ? WHERE id = ?"
  ).run(region, preferred_food, workplace, session.id);

  const updated = { ...session, region, preferred_food, workplace };
  sessions.set(token, updated);
  sendJson(res, 200, { user: updated });
}

function handleGetSchedules(req, res) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return sendJson(res, 401, { error: "로그인이 필요합니다." });
  const schedules = db.prepare(
    "SELECT * FROM schedules WHERE user_id = ? ORDER BY date, start_hour"
  ).all(session.id);
  sendJson(res, 200, { schedules });
}

async function handleAddSchedule(req, res) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return sendJson(res, 401, { error: "로그인이 필요합니다." });
  let body;
  try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
  const id = crypto.randomBytes(8).toString("hex");
  db.prepare(
    "INSERT INTO schedules (id, user_id, title, date, end_date, start_hour, end_hour, private, category, repeat, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, session.id, body.title, body.date, body.end_date || body.date,
        body.start_hour, body.end_hour, body.private ? 1 : 0,
        body.category || "기타", body.repeat || "none", Date.now());
  sendJson(res, 201, { id });
}

function handleDeleteSchedule(req, res) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return sendJson(res, 401, { error: "로그인이 필요합니다." });
  const scheduleId = req.url.replace("/api/schedules/", "");
  db.prepare("DELETE FROM schedules WHERE id = ? AND user_id = ?").run(scheduleId, session.id);
  sendJson(res, 200, { ok: true });
}

// 방 멤버 목록을 프로필·일정과 함께 조립 (requesterId 본인 선호만 포함 — 개인정보 보호)
function buildRoomPayload(room, requesterId = null) {
  const members = db.prepare(`
    SELECT u.id, u.username, u.region, u.preferred_food, u.workplace,
           m.joined_at, m.ready, m.pref_menu, m.pref_avoid, m.pref_place, m.pref_mood
    FROM room_members m JOIN users u ON u.id = m.user_id
    WHERE m.code = ? ORDER BY m.joined_at
  `).all(room.code);

  const getSchedules = db.prepare("SELECT * FROM schedules WHERE user_id = ? ORDER BY date, start_hour");

  const memberData = members.map((u) => ({
    id: u.id,
    name: u.username,
    region: u.region,
    role: u.id === room.host_id ? "주최자" : "참여자",
    ready: !!u.ready,
    // 선호는 본인 것만 노출
    preference: u.id === requesterId
      ? { menu: u.pref_menu, avoid: u.pref_avoid, place: u.pref_place, mood: u.pref_mood }
      : null,
    profile: { preferred_food: u.preferred_food, workplace: u.workplace, region: u.region },
    schedules: getSchedules.all(u.id).map((s) => {
      const isMine = u.id === requesterId;
      const isPrivate = !!s.private;
      // 남의 비공개 일정은 제목을 노출하지 않음 (충돌 계산엔 시간만 필요)
      return {
        date: s.date, endDate: s.end_date || s.date,
        title: (isPrivate && !isMine) ? "바쁨" : s.title,
        start: s.start_hour, end: s.end_hour, private: isPrivate,
        category: (isPrivate && !isMine) ? "기타" : s.category, repeat: s.repeat,
      };
    }),
  }));

  let decision = null;
  if (room.decision) { try { decision = JSON.parse(room.decision); } catch {} }

  return {
    code: room.code, name: room.name, hostId: room.host_id,
    members: memberData, decision,
  };
}

async function handleCreateRoom(req, res) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return sendJson(res, 401, { error: "로그인이 필요합니다." });

  let body;
  try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }

  const name = (body.name ?? "새 약속").trim() || "새 약속";
  const code = `OP-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  db.prepare("INSERT OR REPLACE INTO rooms (code, name, host_id, created_at) VALUES (?, ?, ?, ?)")
    .run(code, name, session.id, Date.now());
  // 방장을 첫 멤버로 등록
  db.prepare("INSERT OR REPLACE INTO room_members (code, user_id, joined_at) VALUES (?, ?, ?)")
    .run(code, session.id, Date.now());

  const room = db.prepare("SELECT * FROM rooms WHERE code = ?").get(code);
  sendJson(res, 201, buildRoomPayload(room, session.id));
}

// POST /api/rooms/join — 현재 로그인한 사용자가 초대코드로 입장
async function handleJoinRoom(req, res) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return sendJson(res, 401, { error: "로그인이 필요합니다." });

  let body;
  try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
  const code = (body.code ?? "").trim().toUpperCase();
  if (!code) return sendJson(res, 400, { error: "초대코드가 필요합니다." });

  const room = db.prepare("SELECT * FROM rooms WHERE code = ?").get(code);
  if (!room) return sendJson(res, 404, { error: "초대코드가 올바르지 않습니다." });

  db.prepare("INSERT OR IGNORE INTO room_members (code, user_id, joined_at) VALUES (?, ?, ?)")
    .run(code, session.id, Date.now());
  // 멤버 변동 → 기존 결정 무효화
  db.prepare("UPDATE rooms SET decision = '' WHERE code = ?").run(code);

  const fresh = db.prepare("SELECT * FROM rooms WHERE code = ?").get(code);
  sendJson(res, 200, buildRoomPayload(fresh, session.id));
}

// GET /api/rooms/:code — 방 멤버 목록 조회 (폴링용)
function handleGetRoom(req, res, code) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const session = getSession(token);
  const room = db.prepare("SELECT * FROM rooms WHERE code = ?").get(code.toUpperCase());
  if (!room) return sendJson(res, 404, { error: "방을 찾을 수 없습니다." });
  sendJson(res, 200, buildRoomPayload(room, session?.id ?? null));
}

// POST /api/rooms/leave — 방 나가기
async function handleLeaveRoom(req, res) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return sendJson(res, 401, { error: "로그인이 필요합니다." });
  let body;
  try { body = await readBody(req); } catch { body = {}; }
  const code = (body.code ?? "").trim().toUpperCase();
  if (code) {
    db.prepare("DELETE FROM room_members WHERE code = ? AND user_id = ?").run(code, session.id);
    db.prepare("UPDATE rooms SET decision = '' WHERE code = ?").run(code);
  }
  sendJson(res, 200, { ok: true });
}

// POST /api/rooms/ready — 참여자가 선호 입력 + 준비 완료/취소
async function handleReady(req, res) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return sendJson(res, 401, { error: "로그인이 필요합니다." });
  let body;
  try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }

  const code = (body.code ?? "").trim().toUpperCase();
  const room = db.prepare("SELECT * FROM rooms WHERE code = ?").get(code);
  if (!room) return sendJson(res, 404, { error: "방을 찾을 수 없습니다." });

  const ready = body.ready ? 1 : 0;
  const p = body.preference ?? {};
  db.prepare(`
    UPDATE room_members SET ready = ?, pref_menu = ?, pref_avoid = ?, pref_place = ?, pref_mood = ?
    WHERE code = ? AND user_id = ?
  `).run(ready, p.menu ?? "", p.avoid ?? "", p.place ?? "", p.mood ?? "", code, session.id);

  // 준비 취소 시 기존 결정 무효화
  if (!ready) db.prepare("UPDATE rooms SET decision = '' WHERE code = ?").run(code);

  const fresh = db.prepare("SELECT * FROM rooms WHERE code = ?").get(code);
  sendJson(res, 200, buildRoomPayload(fresh, session.id));
}

// ── 시간 후보 계산 (서버) ──────────────────────────────────────────────────────
const MEETING_SLOTS = [12, 14, 16, 18, 19, 20];

function parseYmd(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function dateRangeList(start, end) {
  const out = [];
  const cur = parseYmd(start);
  const last = parseYmd(end);
  while (cur <= last) { out.push(ymd(cur)); cur.setDate(cur.getDate() + 1); }
  return out;
}
function isWeekendYmd(value) {
  const d = parseYmd(value).getDay();
  return d === 0 || d === 6;
}
function weekdayName(value) {
  return ["일", "월", "화", "수", "목", "금", "토"][parseYmd(value).getDay()];
}
function fmtHour(h) {
  const whole = Math.floor(h);
  const min = Math.round((h - whole) * 60);
  return `${String(whole).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
function fmtDate(value) {
  const d = parseYmd(value);
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${weekdayName(value)})`;
}
// 해당 날짜에 일정이 적용되는지 (반복/기간 포함)
function scheduleAppliesOn(s, date) {
  if (s.date === date) return true;
  if (s.endDate && s.date <= date && s.endDate >= date) return true;
  if (s.repeat === "weekly" && s.date <= date && parseYmd(s.date).getDay() === parseYmd(date).getDay()) return true;
  return false;
}
function memberBusy(member, date, start, end) {
  return member.schedules.some(
    (s) => scheduleAppliesOn(s, date) && start < s.end && end > s.start
  );
}
function offsetDay(date, delta) {
  const d = parseYmd(date); d.setDate(d.getDate() + delta); return ymd(d);
}

// 컨디션 리스크: 전날 야간 일정(22시 이후 종료) / 다음날 시험 → 감점 + 사유
function conditionRisk(members, date) {
  let penalty = 0;
  const notes = [];
  const yesterday = offsetDay(date, -1);
  const tomorrow = offsetDay(date, 1);
  members.forEach((m) => {
    const lateNight = m.schedules.some((s) => scheduleAppliesOn(s, yesterday) && s.end >= 22);
    if (lateNight) { penalty += 5; notes.push(`${m.name} 전날 야간 일정`); }
    const examTomorrow = m.schedules.some(
      (s) => scheduleAppliesOn(s, tomorrow) && /시험|기말|중간고사|면접/.test(s.title || "")
    );
    if (examTomorrow) { penalty += 7; notes.push(`${m.name} 다음날 시험`); }
  });
  return { penalty, notes: [...new Set(notes)] };
}

function scoreSlot(date, start, riskPenalty) {
  const weekendBonus = isWeekendYmd(date) ? 12 : 0;
  const eveningBonus = start >= 18 ? 8 : 0;
  const travelPenalty = start === 20 ? 6 : 0;
  return 78 + weekendBonus + eveningBonus - travelPenalty - riskPenalty;
}

function computeTimeDecision(members, rangeStart, rangeEnd) {
  const dates = dateRangeList(rangeStart, rangeEnd);
  const candidates = [];
  const availabilityRows = [];

  dates.forEach((date) => {
    const slots = [];
    MEETING_SLOTS.forEach((start) => {
      if (!isWeekendYmd(date) && start < 18) return;
      const end = start + 2;
      const unavailable = members.filter((m) => memberBusy(m, date, start, end));
      const available = unavailable.length === 0;
      slots.push({
        date, start, end, available,
        unavailableNames: unavailable.map((m) => m.name),
      });
      if (available) {
        const risk = conditionRisk(members, date);
        candidates.push({ date, start, end, score: scoreSlot(date, start, risk.penalty), riskNotes: risk.notes });
      }
    });
    availabilityRows.push({ date, dateLabel: fmtDate(date), slots });
  });

  const ranked = candidates
    .sort((a, b) => b.score - a.score || a.date.localeCompare(b.date) || a.start - b.start)
    .slice(0, 3)
    .map((c, i) => {
      const riskText = c.riskNotes.length ? ` 단, ${c.riskNotes.join(", ")} 때문에 컨디션 리스크가 있습니다.` : "";
      return {
        ...c, rank: i + 1,
        title: `${fmtDate(c.date)} ${fmtHour(c.start)}-${fmtHour(c.end)}`,
        reason: (i === 0
          ? "모든 참여자의 일정과 충돌하지 않고, 시간대·이동 부담을 함께 만족하는 최우선 후보입니다."
          : "모두 가능하지만 시간대 선호나 컨디션 여유가 1순위보다 낮아 후순위로 분류했습니다.") + riskText,
      };
    });

  const selKeys = new Set(ranked.map((c) => `${c.date}-${c.start}`));
  availabilityRows.forEach((row) => row.slots.forEach((s) => { s.selected = selKeys.has(`${s.date}-${s.start}`); }));

  return { candidates: ranked, availabilityRows };
}

// 서울/수도권 주요 지역 대략 좌표 (위도, 경도) — 중간 지점 계산용
const AREA_COORDS = {
  "강남": [37.498, 127.028], "강남구": [37.498, 127.028], "강남역": [37.498, 127.028],
  "서초": [37.484, 127.033], "서초구": [37.484, 127.033],
  "송파": [37.505, 127.115], "송파구": [37.505, 127.115], "잠실": [37.513, 127.100], "잠실역": [37.513, 127.100],
  "강동": [37.530, 127.124], "강동구": [37.530, 127.124],
  "마포": [37.566, 126.901], "마포구": [37.566, 126.901], "홍대": [37.557, 126.924], "홍대입구": [37.557, 126.924], "합정": [37.549, 126.914],
  "동작": [37.512, 126.940], "동작구": [37.512, 126.940],
  "관악": [37.478, 126.951], "관악구": [37.478, 126.951],
  "영등포": [37.526, 126.896], "영등포구": [37.526, 126.896],
  "용산": [37.532, 126.990], "용산구": [37.532, 126.990],
  "성북": [37.589, 127.016], "성북구": [37.589, 127.016],
  "동대문": [37.574, 127.040], "동대문구": [37.574, 127.040],
  "광진": [37.538, 127.082], "광진구": [37.538, 127.082], "건대": [37.540, 127.069], "건국대": [37.540, 127.069], "건대입구": [37.540, 127.069],
  "중구": [37.564, 126.997], "종로": [37.573, 126.979], "종로구": [37.573, 126.979], "서울역": [37.555, 126.972],
  "노원": [37.654, 127.056], "노원구": [37.654, 127.056],
  "은평": [37.603, 126.929], "은평구": [37.603, 126.929],
  "일산": [37.658, 126.770], "고양": [37.658, 126.770], "고양시": [37.658, 126.770],
  "분당": [37.383, 127.119], "성남": [37.420, 127.127], "성남시": [37.420, 127.127],
  "부천": [37.504, 126.766], "부천시": [37.504, 126.766],
  "인천": [37.456, 126.705],
  "수원": [37.263, 127.029], "수원시": [37.263, 127.029],
};

// 교통 좋은 만남 후보지 (역 중심)
const MEETING_HUBS = [
  { name: "강남역", coord: [37.498, 127.028] },
  { name: "홍대입구역", coord: [37.557, 126.924] },
  { name: "합정역", coord: [37.549, 126.914] },
  { name: "잠실역", coord: [37.513, 127.100] },
  { name: "건대입구역", coord: [37.540, 127.069] },
  { name: "서울역", coord: [37.555, 126.972] },
  { name: "사당역", coord: [37.476, 126.981] },
  { name: "왕십리역", coord: [37.561, 127.038] },
  { name: "영등포역", coord: [37.515, 126.907] },
  { name: "신도림역", coord: [37.509, 126.891] },
];

function lookupCoord(text) {
  if (!text) return null;
  for (const key of Object.keys(AREA_COORDS)) {
    if (text.includes(key)) return AREA_COORDS[key];
  }
  return null;
}
function dist2(a, b) {
  const dx = a[0] - b[0], dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

// 전원의 위치 좌표로 중간 지점을 구하고 가장 가까운 교통 허브 선택
// 우선순위: 선호지역 > (평일이면 직장/학교, 주말이면 거주지) > 나머지
function decideMeetingPlace(prefs, isWeekday) {
  const coords = [];
  prefs.forEach((p) => {
    const place = lookupCoord(p.place);
    const work = lookupCoord(p.workplace);
    const home = lookupCoord(p.region);
    // 선호지역 우선. 없으면 평일엔 직장/학교, 주말엔 거주지를 먼저.
    const c = place || (isWeekday ? (work || home) : (home || work));
    if (c) coords.push(c);
  });
  if (coords.length === 0) return { place: "강남역", note: "선호/거주 지역 정보가 부족해 접근성 좋은 강남역을 기본 추천했습니다." };

  // 중심점(centroid)
  const cx = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const cy = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  let best = MEETING_HUBS[0], bestD = Infinity;
  for (const hub of MEETING_HUBS) {
    const d = dist2(hub.coord, [cx, cy]);
    if (d < bestD) { bestD = d; best = hub; }
  }
  const basis = isWeekday ? "평일 모임이라 선호지역·직장/학교 위치를 우선 반영한" : "주말 모임이라 선호지역·거주지를 우선 반영한";
  return { place: best.name, note: `${basis} 중간 지점이며 환승·교통 접근성이 좋은 ${best.name}을(를) 선택했습니다.` };
}

// 큰 분류를 구체적 메뉴로 변환 (avoid 제외)
const MENU_BY_CATEGORY = {
  "한식": ["삼겹살", "국밥", "비빔밥", "찜닭", "부대찌개"],
  "고기": ["삼겹살", "소고기 구이", "양꼬치"],
  "일식": ["초밥", "라멘", "돈카츠", "우동"],
  "회": ["모둠회", "초밥"],
  "중식": ["짜장면·탕수육", "마라탕", "양꼬치"],
  "양식": ["파스타", "스테이크", "수제버거"],
  "파스타": ["파스타", "리조또"],
  "분식": ["떡볶이 세트", "김밥·라면"],
  "치킨": ["후라이드·양념 치킨"],
  "피자": ["화덕 피자"],
  "브런치": ["에그베네딕트 브런치"],
  "샐러드": ["포케·샐러드볼"],
  "디저트": ["카페 디저트"],
};

function decideMenu(prefs) {
  const wants = prefs.flatMap((p) => [p.menu, p.preferred_food]).filter(Boolean).join(" ");
  const avoidText = prefs.map((p) => p.avoid).filter(Boolean).join(" ");
  const isAvoided = (dish) =>
    avoidText && avoidText.split(/[\s,]+/).some((a) => a && (dish.includes(a) || a.includes(dish)));

  // 선호 텍스트에서 카테고리 매칭
  for (const cat of Object.keys(MENU_BY_CATEGORY)) {
    if (wants.includes(cat)) {
      const pick = MENU_BY_CATEGORY[cat].find((d) => !isAvoided(d));
      if (pick) return { menu: pick, note: `참여자들이 선호한 '${cat}' 중 회피 메뉴를 빼고 '${pick}'(으)로 정했습니다.` };
    }
  }
  // 매칭 안 되면 선호 첫 단어 또는 기본값
  const firstWant = prefs.map((p) => p.menu || p.preferred_food).find(Boolean);
  if (firstWant) {
    const dish = firstWant.split(/[\s,]+/)[0];
    if (!isAvoided(dish)) return { menu: dish, note: `참여자 선호를 반영해 '${dish}'(으)로 정했습니다.` };
  }
  return { menu: "삼겹살", note: "선호 정보가 적어 무난하게 모두 즐기는 삼겹살로 정했습니다." };
}

function fallbackRecommendation(prefs, candidate) {
  // 선정된 시간이 평일이면 직장/학교 우선, 주말이면 거주지 우선
  const isWeekday = candidate?.date ? !isWeekendYmd(candidate.date) : true;
  const placeResult = decideMeetingPlace(prefs, isWeekday);
  const menuResult = decideMenu(prefs);
  const avoids = prefs.map((p) => p.avoid).filter(Boolean).join(", ");

  return {
    title: `${placeResult.place} ${menuResult.menu} 모임`,
    menu: menuResult.menu,
    place: placeResult.place,
    summary: `전원의 선호 지역과 음식을 종합해 ${placeResult.place}에서 ${menuResult.menu}를 추천합니다.`,
    reasons: [
      placeResult.note,
      menuResult.note,
      `${candidate?.title ?? "선정 시간"}에 전원이 가능합니다.${avoids ? ` (회피: ${avoids})` : ""}`,
    ],
    compromise: "특정 한 명의 선호가 아니라 전원의 위치·음식 취향을 종합해 균형 잡힌 타협안을 구성했습니다.",
  };
}

// POST /api/rooms/decide — 방장이 전원 준비 완료 시 결정 실행
async function handleDecide(req, res) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return sendJson(res, 401, { error: "로그인이 필요합니다." });
  let body;
  try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }

  const code = (body.code ?? "").trim().toUpperCase();
  const room = db.prepare("SELECT * FROM rooms WHERE code = ?").get(code);
  if (!room) return sendJson(res, 404, { error: "방을 찾을 수 없습니다." });
  if (room.host_id !== session.id) return sendJson(res, 403, { error: "주최자만 시간 선정을 할 수 있습니다." });

  // 방장 본인 선호 저장
  const hp = body.preference ?? {};
  db.prepare(`
    UPDATE room_members SET ready = 1, pref_menu = ?, pref_avoid = ?, pref_place = ?, pref_mood = ?
    WHERE code = ? AND user_id = ?
  `).run(hp.menu ?? "", hp.avoid ?? "", hp.place ?? "", hp.mood ?? "", code, session.id);

  // 전원 준비 확인
  const rows = db.prepare(`
    SELECT u.id, u.username, u.region, u.preferred_food, u.workplace,
           m.ready, m.pref_menu, m.pref_avoid, m.pref_place, m.pref_mood
    FROM room_members m JOIN users u ON u.id = m.user_id
    WHERE m.code = ? ORDER BY m.joined_at
  `).all(code);
  const notReady = rows.filter((r) => !r.ready);
  if (notReady.length > 0) {
    return sendJson(res, 400, { error: `아직 준비되지 않은 참여자가 있습니다 (${notReady.map((r) => r.username).join(", ")})` });
  }

  const getSchedules = db.prepare("SELECT * FROM schedules WHERE user_id = ?");
  const members = rows.map((r) => ({
    id: r.id, name: r.username, region: r.region,
    // 컨디션 리스크 판단용으로 title·category 포함 (서버 내부 계산, 외부 미노출)
    schedules: getSchedules.all(r.id).map((s) => ({
      date: s.date, endDate: s.end_date || s.date,
      start: s.start_hour, end: s.end_hour, repeat: s.repeat,
      title: s.title, category: s.category,
    })),
  }));

  const rangeStart = body.rangeStart || dateRangeList("2026-06-01", "2026-06-01")[0];
  const rangeEnd = body.rangeEnd || rangeStart;
  const { candidates, availabilityRows } = computeTimeDecision(members, rangeStart, rangeEnd);

  // 선호 취합 (LLM 입력) — 프로필 선호음식/직장도 포함
  const prefs = rows.map((r) => ({
    name: r.username, region: r.region,
    menu: r.pref_menu, avoid: r.pref_avoid, place: r.pref_place, mood: r.pref_mood,
    preferred_food: r.preferred_food, workplace: r.workplace,
  }));

  let recommendation = null, recSource = "fallback";
  try {
    recommendation = await createRecommendation({
      roomName: room.name, timeCandidates: candidates, participants: prefs,
    });
    recSource = "llm";
  } catch {
    recommendation = fallbackRecommendation(prefs, candidates[0] ?? null);
    recSource = "fallback";
  }

  const decision = { candidates, availabilityRows, recommendation, recSource, decidedAt: Date.now() };
  db.prepare("UPDATE rooms SET decision = ? WHERE code = ?").run(JSON.stringify(decision), code);

  const fresh = db.prepare("SELECT * FROM rooms WHERE code = ?").get(code);
  sendJson(res, 200, buildRoomPayload(fresh, session.id));
}

function handleLogout(req, res) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) deleteSession(token);
  sendJson(res, 200, { ok: true });
}

// ── OpenAI ────────────────────────────────────────────────────────────────────
function extractOutputText(data) {
  if (data.output_text) return data.output_text;
  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.text) parts.push(content.text);
    }
  }
  return parts.join("\n");
}

async function createRecommendation(payload) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: [
        "너는 대학생 모임의 장소와 메뉴를 직접 결정하는 AI 의사결정 엔진이다.",
        "[장소 결정 규칙]",
        "1) 각 참여자의 'place'(선호 지역)를 우선 사용한다. place가 비어 있으면, 선정된 시간이 평일이면 'workplace'(직장/학교), 주말이면 'region'(거주 지역)을 사용한다. (평일엔 직장/학교 근처에 있고 주말엔 집 근처에 있으므로)",
        "2) 모든 참여자의 위치를 종합해 지하철·버스 등 대중교통 접근성이 좋고, 모두에게 공평한 '중간 지점' 번화가를 한 곳 정한다.",
        "3) 특정 한 명(특히 주최자)의 선호 지역을 그대로 고르지 마라. 멀리 사는 참여자가 있으면 그 사람의 이동 거리도 반영해 균형을 맞춘다.",
        "4) place에는 '강남역', '홍대입구역', '잠실역'처럼 만나기 좋은 구체적인 역/번화가 한 곳을 적는다.",
        "[메뉴 결정 규칙]",
        "1) 참여자들의 'menu'(먹고싶은 메뉴)와 'preferred_food'(선호 음식)를 취합하되, 'avoid'(피하고 싶은 메뉴)는 반드시 제외한다.",
        "2) '한식', '일식'처럼 큰 분류로 답하지 말고, 그 안에서 구체적인 메뉴 하나를 직접 정한다. 예: 한식이면 '삼겹살', 일식이면 '초밥', 양식이면 '파스타'.",
        "3) menu에는 결정한 구체적 메뉴 하나만 적는다.",
        "[출력 형식]",
        "반드시 JSON 객체만 반환한다. 마크다운 코드블록, 설명문, 주석은 쓰지 않는다.",
        '스키마: {"title": string, "menu": string, "place": string, "summary": string, "reasons": string[], "compromise": string}',
        "title은 '잠실역 초밥 모임'처럼 장소+메뉴를 담는다.",
        "reasons는 정확히 3개. 1) 왜 이 장소가 모두에게 공평한 중간 지점·교통 좋은지, 2) 왜 이 메뉴인지(선호 취합/회피 반영), 3) 시간 근거. 한국어로 짧고 구체적으로.",
      ].join("\n"),
      input: `다음 데이터를 바탕으로 추천 JSON을 작성해라. participants 배열의 각 원소에는 name, region(거주지), place(선호지역), menu(먹고싶은것), avoid(피할것), preferred_food(선호음식), workplace가 있다.\n${JSON.stringify(payload)}`,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message);
  }

  const data = await response.json();
  const text = extractOutputText(data).trim();
  const jsonText = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(jsonText);
}

// ── Static file server ────────────────────────────────────────────────────────
async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(root, requested));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const body = await fs.readFile(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

// ── Router ────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/auth/register") {
      await handleRegister(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/api/auth/login") {
      await handleLogin(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/api/auth/logout") {
      handleLogout(req, res);
      return;
    }
    if (req.method === "PUT" && req.url === "/api/auth/profile") {
      await handleUpdateProfile(req, res);
      return;
    }
    if (req.method === "GET" && req.url === "/api/schedules") {
      handleGetSchedules(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/api/schedules") {
      await handleAddSchedule(req, res);
      return;
    }
    if (req.method === "DELETE" && req.url.startsWith("/api/schedules/")) {
      handleDeleteSchedule(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/api/rooms") {
      await handleCreateRoom(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/api/rooms/join") {
      await handleJoinRoom(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/api/rooms/leave") {
      await handleLeaveRoom(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/api/rooms/ready") {
      await handleReady(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/api/rooms/decide") {
      await handleDecide(req, res);
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/api/rooms/")) {
      const code = decodeURIComponent(req.url.slice("/api/rooms/".length).split("?")[0]);
      handleGetRoom(req, res, code);
      return;
    }

    if (req.method === "POST" && req.url === "/api/recommend") {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!getSession(token)) {
        return sendJson(res, 401, { error: "로그인이 필요합니다." });
      }
      try {
        const payload = await readBody(req);
        const recommendation = await createRecommendation(payload);
        sendJson(res, 200, { source: "llm", recommendation });
      } catch (error) {
        sendJson(res, 200, { source: "fallback", error: error.message, recommendation: null });
      }
      return;
    }

    if (req.method === "GET") {
      await serveStatic(req, res);
      return;
    }

    res.writeHead(405);
    res.end("Method not allowed");
  } catch (error) {
    if (!res.headersSent) {
      sendJson(res, 500, { error: "서버 오류가 발생했습니다." });
    }
  }
});

server.listen(port, host, () => {
  console.log(`OpenPlanner running at http://${host}:${port}`);
});
