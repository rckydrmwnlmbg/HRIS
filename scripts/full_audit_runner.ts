import { query } from '../lib/db';

type Row = {
  EMP_CD: string; EMP_NM: string; ALL_IN: string; DATE_TRANS: string; STATUS_HARI: string;
  WORK_IN: string | null; WORK_OUT: string | null; JAM_MASUK: string | null; JAM_PULANG: string | null;
  OT_1: number; OT_2: number; OT_3: number; OT_4: number; T_OT: number; JAM_KERJA: number;
};
type Bucket = { total: number; verifiable: number; match: number; legacyDiff: number; stale: number; missing: number; crossMidnight: number; invalid: number; dbOt: number; calcOt: number };
const empty = (): Bucket => ({ total: 0, verifiable: 0, match: 0, legacyDiff: 0, stale: 0, missing: 0, crossMidnight: 0, invalid: 0, dbOt: 0, calcOt: 0 });
const buckets: Record<'HARIAN' | 'ALL IN', Bucket> = { HARIAN: empty(), 'ALL IN': empty() };
const samples: Record<string, any[]> = { LEGACY_DB_DIFF: [], EXPORT_STALE_VALUE: [], MISSING_ACTUAL_TIME: [], CROSS_MIDNIGHT: [], INVALID_SOURCE_DATA: [] };
function dateTime(date: string, time: string | null): Date | null { if (!time) return null; const d = new Date(`${date}T${time.length === 5 ? `${time}:00` : time}`); return Number.isNaN(d.getTime()) ? null : d; }
function roundOt(diffMin: number): number { return diffMin >= 50 ? Math.floor((diffMin + 10) / 60) : 0; }
function expected(row: Row) {
  const out = row.WORK_OUT ? new Date(row.WORK_OUT) : null, schedule = dateTime(row.DATE_TRANS, row.JAM_PULANG), actualIn = row.WORK_IN ? new Date(row.WORK_IN) : null;
  const crossMidnight = !!(actualIn && out && out.getTime() < actualIn.getTime());
  if (!out || Number.isNaN(out.getTime())) return { ot: 0, verifiable: false, crossMidnight, invalid: false };
  if (crossMidnight) return { ot: 0, verifiable: false, crossMidnight, invalid: true };
  const status = (row.STATUS_HARI || '').trim().toUpperCase(), day = new Date(`${row.DATE_TRANS}T00:00:00`).getDay();
  const holiday = ['LIBUR', 'OFF', 'H'].includes(status) || day === 0 || day === 6;
  if (holiday) {
    if (!actualIn) return { ot: 0, verifiable: false, crossMidnight, invalid: false };
    const mins = (out.getTime() - actualIn.getTime()) / 60000; if (mins < 0) return { ot: 0, verifiable: false, crossMidnight, invalid: true };
    const h = Math.floor(mins / 60), rem = mins % 60; return { ot: rem < 30 ? h : h + 0.5, verifiable: true, crossMidnight, invalid: false };
  }
  if (!schedule) return { ot: 0, verifiable: false, crossMidnight, invalid: false };
  return { ot: roundOt((out.getTime() - schedule.getTime()) / 60000), verifiable: true, crossMidnight, invalid: false };
}
function addSample(kind: string, row: Row, calc: number, db: number) { if (samples[kind].length < 10) samples[kind].push({ EMP_CD: row.EMP_CD.trim(), EMP_NM: row.EMP_NM?.trim(), DATE: row.DATE_TRANS, STATUS: row.STATUS_HARI, WORK_IN: row.WORK_IN, WORK_OUT: row.WORK_OUT, JAM_PULANG: row.JAM_PULANG, DB_OT: db, CALC_OT: calc, T_OT: row.T_OT }); }
function assertEdgeCases() { for (const [minutes, expectedOt] of [[49, 0], [50, 1], [59, 1], [60, 1], [90, 1], [120, 2]]) if (roundOt(minutes) !== expectedOt) throw new Error(`Edge case failed: ${minutes}`); console.log('EDGE_CASES: PASS (49/50/59/60/90/120 menit)'); }
async function main() {
  assertEdgeCases();
  const rows = await query<Row>(`
    SELECT RTRIM(a.EMP_CD) EMP_CD, RTRIM(e.EMP_NM) EMP_NM, RTRIM(ISNULL(e.ALL_IN,'0')) ALL_IN,
      CONVERT(varchar(10), a.DATE_TRANS, 120) DATE_TRANS, RTRIM(ISNULL(a.STATUS_HARI,'')) STATUS_HARI,
      CONVERT(varchar(19), a.WORK_IN, 120) WORK_IN, CONVERT(varchar(19), a.WORK_OUT, 120) WORK_OUT,
      CONVERT(varchar(8), a.JAM_MASUK, 108) JAM_MASUK, CONVERT(varchar(8), a.JAM_PULANG, 108) JAM_PULANG,
      ISNULL(a.OT_1,0) OT_1, ISNULL(a.OT_2,0) OT_2, ISNULL(a.OT_3,0) OT_3, ISNULL(a.OT_4,0) OT_4,
      ISNULL(a.T_OT,0) T_OT, ISNULL(a.JAM_KERJA,0) JAM_KERJA
    FROM TR_ABSEN a JOIN EMP_TABLE e ON RTRIM(a.EMP_CD)=RTRIM(e.EMP_CD)
    WHERE a.DATE_TRANS >= '2026-01-01' AND a.DATE_TRANS < '2026-08-01'
    ORDER BY a.DATE_TRANS
  `);
  for (const row of rows) {
    const kind = ['1', 'Y', 'TRUE'].includes(row.ALL_IN.trim().toUpperCase()) ? 'ALL IN' : 'HARIAN', b = buckets[kind]; b.total++;
    const db = [row.OT_1, row.OT_2, row.OT_3, row.OT_4].reduce((s, v) => s + Number(v || 0), 0), result = expected(row); b.dbOt += db; b.calcOt += result.ot;
    if (result.crossMidnight) { b.crossMidnight++; addSample('CROSS_MIDNIGHT', row, result.ot, db); }
    if (result.invalid) { b.invalid++; addSample('INVALID_SOURCE_DATA', row, result.ot, db); continue; }
    if (!result.verifiable) { b.missing++; addSample('MISSING_ACTUAL_TIME', row, result.ot, db); continue; }
    b.verifiable++;
    if (Math.abs(db - result.ot) < 0.001) b.match++; else { b.legacyDiff++; addSample('LEGACY_DB_DIFF', row, result.ot, db); }
    const routeValue = db > 0 ? db : result.ot; if (Math.abs(routeValue - result.ot) >= 0.001) { b.stale++; addSample('EXPORT_STALE_VALUE', row, result.ot, routeValue); }
  }
  console.log(`ROWS_READ: ${rows.length}`);
  console.table(Object.entries(buckets).map(([CATEGORY, b]) => ({ CATEGORY, ...b, MATCH_RATE: b.verifiable ? `${(b.match * 100 / b.verifiable).toFixed(2)}%` : 'N/A' })));
  for (const [kind, list] of Object.entries(samples)) { console.log(`\n${kind} SAMPLES (${list.length}):`); if (list.length) console.table(list); }
  console.log('\nREAD_ONLY_ASSERTION: PASS — script contains SELECT only; no UPDATE/INSERT/DELETE.');
}
main().then(() => process.exit(0)).catch(err => { console.error('VALIDATION_ERROR:', err); process.exit(1); });

