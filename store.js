// 순수 JS 파일 기반 저장소 — 네이티브 모듈(better-sqlite3) 없이 어디서나 동작
// 데이터는 openplanner.json 한 파일에 저장된다.
const fs = require("node:fs");
const path = require("node:path");

const FILE = path.join(__dirname, "openplanner.json");

const data = {
  users: [],        // { id, username, password_hash, region, preferred_food, workplace, created_at }
  schedules: [],    // { id, user_id, title, date, end_date, start_hour, end_hour, private, category, repeat, created_at }
  rooms: [],        // { code, name, host_id, created_at, decision }
  roomMembers: [],  // { code, user_id, joined_at, ready, pref_menu, pref_avoid, pref_place, pref_mood }
};

// 로드 (기존 JSON 시드가 있으면 읽어들임)
function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
    for (const key of Object.keys(data)) {
      if (Array.isArray(raw[key])) data[key] = raw[key];
    }
  } catch {
    // 파일이 없으면 빈 상태로 시작
  }
}

// 저장 (쓰기마다 즉시 디스크에 반영 — 소규모라 충분)
let saveTimer = null;
function save() {
  if (saveTimer) return; // 같은 틱의 연속 쓰기를 한 번으로 합침
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.writeFileSync(FILE, JSON.stringify(data), "utf8");
    } catch (e) {
      console.error("[store] 저장 실패:", e.message);
    }
  }, 0);
}

load();

module.exports = { data, save };
