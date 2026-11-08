/**
 * KJST Portal – Timetable API
 * อ่านตารางสอน (ชีต Rowdata) และรายการสอนแทน (ชีต จันทร์–ศุกร์) จากไฟล์ "แบบจัดสอนแทน 2569"
 * แล้วส่งออกเป็น JSON ให้หน้า KJST Portal บน GitHub Pages
 *
 * PDPA: ไม่ส่ง "สาเหตุการลา" (คอลัมน์ E) ออกไปเด็ดขาด ส่งเฉพาะ วันที่ คาบ วิชา ห้อง ครูประจำวิชา ครูสอนแทน หมายเหตุการสอน
 *
 * วิธีติดตั้ง
 *  1) script.google.com > New project > วางโค้ดนี้
 *  2) Deploy > New deployment > Web app
 *     Execute as: Me   |   Who has access: Anyone
 *  3) คัดลอก URL ที่ลงท้าย /exec ไปใส่ใน CONFIG.API_URL ของ index.html (หรือไฟล์ config/api_url.txt แล้ว build ใหม่)
 */
const SHEET_ID = '13PCIKJGYA1Pe1PJpQiuzwyIIY3UsXvddb9A5rdwqsu4';   // แบบจัดสอนแทน 2569
const SEM_START = '2026-10-28';                                     // เปิดภาคเรียน 2/2569
const DAY_SHEETS = { 'จันทร์': 1, 'อังคาร': 2, 'พุธ': 3, 'พฤหัสบดี': 4, 'ศุกร์': 5 };
const CACHE_SEC = 300;

function doGet(e) {
  const cache = CacheService.getScriptCache();
  let body = getCached_(cache);
  if (!body) {
    body = JSON.stringify(build_());
    putCached_(cache, body);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function build_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // ---- ตารางสอน: Rowdata = [ชื่อครู, วัน, คาบ, วิชา, ห้อง]
  const raw = ss.getSheetByName('Rowdata').getDataRange().getDisplayValues().slice(1);
  const teachers = [];
  const idx = {};
  const rows = [];
  raw.forEach(r => {
    const name = String(r[0]).trim(), dow = DAY_SHEETS[String(r[1]).trim()], p = Number(r[2]);
    if (!name || !dow || !p) return;
    if (!(name in idx)) { idx[name] = teachers.length; teachers.push(name); }
    rows.push([idx[name], dow, p, String(r[3]).trim(), String(r[4]).trim()]);
  });
  const order = teachers.slice().sort((a, b) => a.localeCompare(b, 'th'));
  const remap = {}; order.forEach((t, i) => remap[idx[t]] = i);
  rows.forEach(r => r[0] = remap[r[0]]);

  // ---- สอนแทน: ชีตรายวัน คอลัมน์ B=วันที่ C=ชื่อครู F..N=คาบ 1..9 (ไม่อ่านคอลัมน์ E สาเหตุ)
  const subs = [];
  Object.keys(DAY_SHEETS).forEach(sh => {
    const sheet = ss.getSheetByName(sh);
    if (!sheet) return;
    const vals = sheet.getDataRange().getDisplayValues();
    for (let i = 1; i < vals.length; i++) {
      const v = vals[i];
      const d = toISO_(v[1]);
      const absent = String(v[2] || '').trim();
      if (!d || !absent || d < SEM_START) continue;
      for (let p = 1; p <= 9; p++) {
        const cell = String(v[4 + p] || '');
        if (cell.indexOf('สอนแทน') < 0) continue;
        const by = pick_(cell, /ครู(?:ผู้)?สอนแทน\s*:\s*(.+)/);
        if (!by) continue;
        subs.push({
          d: d, p: p, a: absent,
          s: pick_(cell, /รายวิชา\s*:\s*(.+)/) || pick_(cell, /📘\s*(.+)/),
          r: pick_(cell, /ห้อง\s*:\s*(.+)/) || pick_(cell, /🏫\s*(.+)/),
          by: by,
          n: pick_(cell, /หมายเหตุ\s*:\s*(.+)/)
        });
      }
    }
  });
  subs.sort((x, y) => x.d < y.d ? -1 : x.d > y.d ? 1 : x.p - y.p);

  // ---- กลุ่มสาระของครู: ชีต data คอลัมน์ A=ชื่อครู B=กลุ่มสาระ (จับคู่ด้วยชื่อเต็ม หรือนามสกุลถ้าคำนำหน้าต่างกัน)
  const gv = ss.getSheetByName('data').getRange('A2:B').getDisplayValues().filter(r => r[0] && r[1]);
  const byName = {}, bySurname = {};
  gv.forEach(r => { const n = r[0].trim(); byName[n] = r[1].trim(); bySurname[surname_(n)] = r[1].trim(); });
  const groups = {};
  order.forEach(t => groups[t] = byName[t] || bySurname[surname_(t)] || 'อื่นๆ');

  return { updated: new Date().toISOString(), source: 'live', teachers: order, groups: groups, rows: rows, subs: subs };
}

function surname_(n) { const p = String(n).trim().split(/\s+/); return p[p.length - 1]; }
function pick_(text, re) { const m = text.match(re); return m ? m[1].trim() : ''; }

/** รับ 4/11/2026, 04/11/2569, 12/06/69 → 2026-11-04 */
function toISO_(s) {
  const m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return '';
  let y = Number(m[3]);
  if (y < 100) y += 2500;          // 69 → 2569
  if (y > 2400) y -= 543;          // พ.ศ. → ค.ศ.
  return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
}

/* CacheService จำกัด 100KB ต่อคีย์ จึงแบ่งเก็บเป็นชิ้น */
function putCached_(cache, body) {
  const size = 90000, parts = Math.ceil(body.length / size), obj = { tt_n: String(parts) };
  for (let i = 0; i < parts; i++) obj['tt_' + i] = body.substr(i * size, size);
  try { cache.putAll(obj, CACHE_SEC); } catch (err) {}
}
function getCached_(cache) {
  const n = Number(cache.get('tt_n') || 0);
  if (!n) return null;
  const keys = []; for (let i = 0; i < n; i++) keys.push('tt_' + i);
  const got = cache.getAll(keys);
  let s = ''; for (let i = 0; i < n; i++) { if (got['tt_' + i] == null) return null; s += got['tt_' + i]; }
  return s;
}

/** ทดสอบใน editor: Run > testBuild แล้วดู Logs */
function testBuild() {
  const o = build_();
  Logger.log('teachers=%s rows=%s subs=%s', o.teachers.length, o.rows.length, o.subs.length);
  Logger.log(JSON.stringify(o.subs.slice(-5)));
}
