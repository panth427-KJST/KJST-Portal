/**
 * KJST Portal – Timetable API
 * อ่านข้อมูลจากฐานข้อมูล "KJST Substitute Teaching" แล้วส่งออก JSON ให้หน้า KJST Portal (GitHub Pages)
 *   - Timetable : ตารางสอนปกติ (teacher, day 0-4, period 0-9, code, subject, class, room)
 *   - Teachers  : ครูและกลุ่มสาระ
 *   - Duty      : เวรประจำวัน
 *   - Items     : รายการจัดสอนแทนรายคาบ (sub / swapF / swapT / none)
 *   - Requests  : สถานะคำขอ (ใช้กรองคำขอที่ยกเลิก)
 *   - ClassAway : ห้องเรียนที่นักเรียนไม่อยู่ (ไปราชการ/ค่าย/กิจกรรม) — date, classes, periods (ว่าง = ทั้งวัน), reason, status
 *   - Settings  : TERM_*, HOLIDAYS, TT_META (เวลาแต่ละคาบ)
 *
 * PDPA: ไม่ส่ง reason, type/type_label, ไฟล์แนบ, history, ผลรับทราบรายบุคคล ออกไป
 *
 * วิธีติดตั้ง
 *  1) script.google.com > New project > วางโค้ดนี้ (หรือเพิ่มเป็นไฟล์ใหม่ในโปรเจกต์ระบบจัดสอนแทน แล้วเปลี่ยนชื่อ doGet เป็น portalApi_ และเรียกจาก doGet เดิมเมื่อ e.parameter.action === 'timetable')
 *  2) Deploy > New deployment > Web app : Execute as **Me** | Who has access **Anyone**
 *  3) นำ URL ที่ลงท้าย /exec ใส่ใน config/api_url.txt แล้วรัน python scripts/build.py
 */
const DB_ID = '1CrMI5NlO-rygxZDTtCSENSiW2BZww0DcPFHXRUEdP0U';   // KJST Substitute Teaching
const CACHE_SEC = 120;

function doGet(e) {
  const cache = CacheService.getScriptCache();
  let body = getCached_(cache);
  if (!body) { body = JSON.stringify(build_()); putCached_(cache, body); }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function build_() {
  const ss = SpreadsheetApp.openById(DB_ID);
  const recs = name => {
    const sh = ss.getSheetByName(name); if (!sh) return [];
    const v = sh.getDataRange().getDisplayValues(); const h = v.shift().map(String);
    return v.filter(r => r.some(String)).map(r => { const o = {}; h.forEach((k, i) => o[k] = String(r[i] == null ? '' : r[i]).trim()); return o; });
  };
  const S = {}; recs('Settings').forEach(r => S[r.key] = r.value);
  let meta = {}; try { meta = JSON.parse(S.TT_META || '{}'); } catch (err) {}

  const dept = {}; recs('Teachers').forEach(r => { if (r.teacher) dept[r.teacher] = r.dept; });
  const tt = recs('Timetable').filter(r => r.teacher);
  const set = {}; Object.keys(dept).forEach(n => set[n] = 1); tt.forEach(r => set[r.teacher] = 1);
  const teachers = Object.keys(set).sort((a, b) => a.localeCompare(b, 'th'));
  const ix = {}; teachers.forEach((n, i) => ix[n] = i);

  const rows = tt.map(r => [ix[r.teacher], Number(r.day) + 1, Number(r.period), r.code, r.subject, r['class']]);
  const duty = recs('Duty').filter(r => r.teacher in ix).map(r => [ix[r.teacher], Number(r.day) + 1, Number(r.period), r.label]);

  const req = {}; recs('Requests').forEach(r => req[r.id] = r);
  const DEAD = { cancelled: 1, canceled: 1, deleted: 1, rejected: 1 };
  const items = [];
  recs('Items').forEach(r => {
    const q = req[r.request_id] || {};
    if (DEAD[q.status] || /ยกเลิก/.test(r.request_status || '')) return;
    const o = { d: r.date, p: Number(r.period), a: r.teacher, code: r.code, s: r.subject, c: r['class'],
      m: r.method, ml: r.method_label, by: r.sub_teacher, sw: r.swap_teacher,
      sd: r.swap_date, sp: r.swap_period ? Number(r.swap_period) : '', ss: r.swap_subject,
      st: r.request_status, ack: r.ack };
    Object.keys(o).forEach(k => { if (o[k] === '' || o[k] == null) delete o[k]; });
    items.push(o);
  });
  items.sort((x, y) => x.d < y.d ? -1 : x.d > y.d ? 1 : x.p - y.p);

  const classAway = recs('ClassAway').filter(r => r.date && (r.status || 'active') === 'active').map(r => ({
    d: r.date,
    cls: String(r.classes || '').split(',').map(x => x.trim()).filter(String),
    ps: String(r.periods || '').split(',').map(x => x.trim()).filter(x => /^\d+$/.test(x)).map(Number),   // [] = ทั้งวัน
    note: r.reason || ''
  }));

  const groups = {}; teachers.forEach(n => groups[n] = dept[n] || 'อื่นๆ');
  return {
    updated: new Date().toISOString(), source: 'live',
    term: { name: S.TERM_NAME || '', start: S.TERM_START || '', end: S.TERM_END || '',
            holidays: String(S.HOLIDAYS || '').split(',').map(x => x.trim()).filter(String) },
    times: meta.times || [], noCover: meta.noCover || [], activity: meta.activity || [],
    teachers: teachers, groups: groups, rows: rows, duty: duty, items: items, classAway: classAway
  };
}

/* CacheService จำกัด 100KB ต่อคีย์ จึงแบ่งเก็บเป็นชิ้น */
function putCached_(cache, body) {
  const size = 90000, parts = Math.ceil(body.length / size), obj = { tt_n: String(parts) };
  for (let i = 0; i < parts; i++) obj['tt_' + i] = body.substr(i * size, size);
  try { cache.putAll(obj, CACHE_SEC); } catch (err) {}
}
function getCached_(cache) {
  const n = Number(cache.get('tt_n') || 0); if (!n) return null;
  const keys = []; for (let i = 0; i < n; i++) keys.push('tt_' + i);
  const got = cache.getAll(keys); let s = '';
  for (let i = 0; i < n; i++) { if (got['tt_' + i] == null) return null; s += got['tt_' + i]; }
  return s;
}

/** ทดสอบใน editor: Run > testBuild แล้วดู Execution log */
function testBuild() {
  const o = build_();
  Logger.log('teachers=%s rows=%s duty=%s items=%s classAway=%s', o.teachers.length, o.rows.length, o.duty.length, o.items.length, o.classAway.length);
  Logger.log(JSON.stringify(o.items.slice(-3)));
}
