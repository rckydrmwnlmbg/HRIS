import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

import { TEAM_NAME_CASE } from '@/lib/queries';

// GET /api/master — Fetch all master data tables in one call
export async function GET() {
  try {
    const [departemen, seksi, jabatan, divisi, jenisKaryawan, reasons, shifts, teams] = await Promise.all([
      query<any>('SELECT DEP_CD, DEP_DESC FROM MS_DEP ORDER BY DEP_DESC'),
      query<any>('SELECT SEC_CD, SEC_DESC, GRP_CD FROM MS_SEC ORDER BY SEC_DESC'),
      query<any>('SELECT JOB_CD, JOB_DESC FROM MS_JOBS ORDER BY JOB_DESC'),
      query<any>('SELECT DIV_CD, DIV_DESC FROM MS_DIV ORDER BY DIV_DESC'),
      query<any>('SELECT JNS_CODE, JNS_DESC FROM MSJNS_KRY ORDER BY JNS_CODE'),
      query<any>('SELECT REASON_CODE, REASON_DESC, REASON_GROUP FROM Ms_Reason ORDER BY REASON_CODE'),
      query<any>('SELECT * FROM msSHIFT ORDER BY shift_CODE'),
      query<any>(`
        SELECT DISTINCT 
          ${TEAM_NAME_CASE} AS TEAM_NAME
        FROM EMP_TABLE e
        LEFT JOIN MS_SEC s ON e.SEC_CD = s.SEC_CD
        LEFT JOIN MS_DEP d ON e.DEP_CD = d.DEP_CD
        WHERE e.Act_NonAct = 1 AND e.SEC_CD IS NOT NULL
        ORDER BY TEAM_NAME
      `),
    ]);

    return NextResponse.json({
      departemen: departemen.map((d: any) => ({ DEP_CD: d.DEP_CD?.trim(), DEP_DESC: d.DEP_DESC?.trim() })),
      seksi: seksi.map((s: any) => ({ SEC_CD: s.SEC_CD?.trim(), SEC_DESC: s.SEC_DESC?.trim(), GRP_CD: s.GRP_CD?.trim() })),
      jabatan: jabatan.map((j: any) => ({ JOB_CD: j.JOB_CD?.trim(), JOB_DESC: j.JOB_DESC?.trim() })),
      divisi: divisi.map((d: any) => ({ DIV_CD: d.DIV_CD?.trim(), DIV_DESC: d.DIV_DESC?.trim() })),
      jenisKaryawan: jenisKaryawan.map((j: any) => ({ JNS_CODE: j.JNS_CODE?.trim(), JNS_DESC: j.JNS_DESC?.trim() })),
      reasons: reasons.map((r: any) => ({ REASON_CODE: r.REASON_CODE?.trim(), REASON_DESC: r.REASON_DESC?.trim(), REASON_GROUP: r.REASON_GROUP?.trim() })),
      shifts: shifts.map((s: any) => ({ shift_CODE: s.shift_CODE?.trim(), keterangan: s.keterangan?.trim(), WORK_IN: s.WORK_IN, WORK_OUT: s.WORK_OUT })),
      teams: teams.map((t: any) => t.TEAM_NAME?.trim()).filter(Boolean),
    });
  } catch (error: any) {
    console.error('API /master error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
