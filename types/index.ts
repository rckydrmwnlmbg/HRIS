// TypeScript types untuk seluruh aplikasi HRIS TMNB

export interface Karyawan {
  EMP_CD: string;
  EMP_NM: string;
  DT_ENTRY: string | null;
  DT_PROB: string | null;
  DT_BRT: string | null;
  PLC_BRT: string | null;
  ADRR: string | null;
  CT: string | null;
  SX: string | null; // 'L' | 'P'
  NPWP: string | null;
  PTKP_ST: string | null;
  noktp: string | null;
  agama: string | null;
  telepon: string | null;
  ACC_NO: string | null;
  DEP_CD: string | null;
  SEC_CD: string | null;
  JOB_CD: string | null;
  DIV_CD: string | null;
  OUT_CD: string | null;
  JNS_KRY: string | null;
  Act_NonAct: boolean;
  DT_RSG: string | null;
  Status_Pekerjaan: string | null;
  IMG_NM: string | null;
  FLAG_OT: string | null;
  ALL_IN: string | null;
  SPSI_NO: string | null;
  No_Reg: string | null;
  // Computed / joined fields
  DEP_DESC?: string;
  SEC_DESC?: string;
  JOB_DESC?: string;
  DIV_DESC?: string;
  JNS_DESC?: string;
  TEAM?: string;
  BS_SLR?: number;
}

export interface Department {
  DEP_CD: string;
  DEP_DESC: string;
}

export interface Seksi {
  SEC_CD: string;
  SEC_DESC: string;
  GRP_CD: string | null;
}

export interface Jabatan {
  JOB_CD: string;
  JOB_DESC: string;
}

export interface Divisi {
  DIV_CD: string;
  DIV_DESC: string;
}

export interface JenisKaryawan {
  JNS_CODE: string;
  JNS_DESC: string;
}

export interface Outsource {
  OUT_CD: string;
  OUT_DESC: string;
}

export interface Reason {
  REASON_CODE: string;
  REASON_DESC: string;
  REASON_GROUP: string | null;
}

export interface AbsensiRecord {
  DATE_TRANS: string;
  SHIFT: string;
  EMP_CD: string;
  EMP_NM: string;
  DATE_IN: string | null;
  WORK_IN: string | null;
  DATE_OUT: string | null;
  WORK_OUT: string | null;
  JAM_KERJA: number | null;
  STDJAM: number | null;
  REASON: string | null;
  REASON_GROUP?: string | null;
  STATUS_HARI: string;
  DAYTYPE: string | null;
  HOLIDAYYN: string | null;
  OT1: number | null;
  OT2: number | null;
  OT3: number | null;
  OT4: number | null;
  SEC_CD: string | null;
  // Source indicator
  source?: 'ABSEN1' | 'ABSEN2';
  // Correction tracking
  raw_work_in?: string | null;
  raw_work_out?: string | null;
  corrected_reason?: string | null;
  DATE_IN_STR?: string | null;
  WORK_IN_STR?: string | null;
  DATE_OUT_STR?: string | null;
  WORK_OUT_STR?: string | null;
  corrected_status?: string | null;
  correction_status?: 'draft' | 'applied' | null;
  correction_by?: string | null;
  correction_at?: string | null;
  correction_notes?: string | null;
}

export interface KoreksiAbsensi {
  id?: number;
  EMP_CD: string;
  DATE_TRANS: string;
  raw_work_in: string | null;
  raw_work_out: string | null;
  corrected_work_in: string | null;
  corrected_work_out: string | null;
  corrected_reason: string | null;
  corrected_status: string | null;
  correction_status: 'draft' | 'applied';
  correction_by: string;
  correction_at: string;
  correction_notes: string | null;
}

export interface LemburRecord {
  id?: number;
  EMP_CD: string;
  EMP_NM: string;
  SEC_CD: string | null;
  tanggal_lembur: string;
  jam_mulai: string;
  jam_selesai: string;
  total_jam: number;
  jenis_hari: 'kerja' | 'libur';
  ot_type: 'OT1' | 'OT2' | 'OT3' | 'OT4';
  nominal: number | null;
  no_ref_form: string | null;
  catatan: string | null;
  status: 'plan' | 'actual' | 'rekonsiliasi';
  created_by: string;
  created_at: string;
}

export interface JamKosongRecord {
  EMP_CD: string;
  EMP_NM: string;
  BAGIAN: string;
  TEAM: string;
  SEC_DESC: string;
  SEC_CD: string;
  WORK_IN: string | null;
  WORK_OUT: string | null;
  keterangan_kosong: string;
}

export interface PerluPerhatianRecord {
  EMP_CD: string;
  EMP_NM: string;
  BAGIAN: string;
  TEAM: string;
  SEC_DESC: string;
  SEC_CD: string;
  WORK_IN: string | null;
  WORK_OUT: string | null;
  jam_kerja: number;
  jenis_anomali: 'PULANG_CEPAT' | 'TERLAMBAT' | 'DURASI_SINGKAT';
  keterangan: string;
}

export interface DashboardStats {
  totalKaryawan: number;
  karyawanAktif: number;
  hadirHariIni: number;
  alphaHariIni: number;
  izinHariIni: number;
  cutiHariIni: number;
  sakitHariIni: number;
  jamKosongHariIni: number;
  jamKosongList: JamKosongRecord[];
  perluPerhatianHariIni?: number;
  perluPerhatianList?: PerluPerhatianRecord[];
  lemburBulanIni: number;
  isFingerprintIntegrated?: boolean;
  demografi?: {
    allIn: number;
    harian: number;
    pria: number;
    wanita: number;
  };
  topLembur?: {
    bagian: string;
    total: number;
  }[];
}

export interface TrendAbsensi {
  bulan: string;
  name?: string;
  hadir: number;
  alpha: number;
  izin: number;
  cuti: number;
  sakit: number;
}

export interface User {
  id: string;
  username: string;
  nama: string;
  role: string;
  Gr_Id: string;
}

export type Language = 'id' | 'en';

export interface AppSettings {
  language: Language;
  darkMode: boolean;
}

export type FilterAbsensi = {
  EMP_CD?: string;
  bulan: number;
  tahun: number;
  SEC_CD?: string;
  DEP_CD?: string;
};

export type StatusHari = 'O' | 'A' | 'I' | 'C' | 'H' | 'S' | 'L';

export const STATUS_HARI_MAP: Record<string, { label_id: string; label_en: string; color: string }> = {
  O: { label_id: 'Hadir', label_en: 'Present', color: '#10B981' },
  A: { label_id: 'Alpha', label_en: 'Absent', color: '#EF4444' },
  I: { label_id: 'Izin', label_en: 'Permitted', color: '#F59E0B' },
  C: { label_id: 'Cuti', label_en: 'Annual Leave', color: '#3B82F6' },
  H: { label_id: 'Cuti Haid/Melahirkan', label_en: 'Maternity Leave', color: '#8B5CF6' },
  S: { label_id: 'Sakit', label_en: 'Sick', color: '#F97316' },
  L: { label_id: 'Libur', label_en: 'Holiday', color: '#6B7280' },
};
