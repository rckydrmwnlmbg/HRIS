/**
 * Daftar Hari Libur Nasional Resmi Indonesia (Statutory Public Holidays)
 */
export interface NationalHoliday {
  date: string; // Format YYYY-MM-DD
  name: string;
}

export const INDONESIAN_NATIONAL_HOLIDAYS: Record<number, NationalHoliday[]> = {
  2025: [
    { date: '2025-01-01', name: 'Tahun Baru 2025 Masehi' },
    { date: '2025-01-27', name: 'Isra Mi\'raj Nabi Muhammad SAW' },
    { date: '2025-01-29', name: 'Tahun Baru Imlek 2576 Kongzili' },
    { date: '2025-03-29', name: 'Hari Suci Nyepi (Tahun Baru Saka 1947)' },
    { date: '2025-03-31', name: 'Hari Raya Idul Fitri 1446 H' },
    { date: '2025-04-01', name: 'Hari Raya Idul Fitri 1446 H' },
    { date: '2025-04-18', name: 'Wafat Yesus Kristus' },
    { date: '2025-04-20', name: 'Kebangkitan Yesus Kristus (Paskah)' },
    { date: '2025-05-01', name: 'Hari Buruh Internasional' },
    { date: '2025-05-12', name: 'Hari Raya Waisak 2569 BE' },
    { date: '2025-05-29', name: 'Kenaikan Yesus Kristus' },
    { date: '2025-06-01', name: 'Hari Lahir Pancasila' },
    { date: '2025-06-07', name: 'Hari Raya Idul Adha 1446 H' },
    { date: '2025-06-27', name: '1 Muharram / Tahun Baru Islam 1447 H' },
    { date: '2025-08-17', name: 'Hari Kemerdekaan Republik Indonesia' },
    { date: '2025-09-05', name: 'Maulid Nabi Muhammad SAW' },
    { date: '2025-12-25', name: 'Hari Raya Natal' },
  ],
  2026: [
    { date: '2026-01-01', name: 'Tahun Baru 2026 Masehi' },
    { date: '2026-01-16', name: 'Isra Mi\'raj Nabi Muhammad SAW' },
    { date: '2026-02-17', name: 'Tahun Baru Imlek 2577 Kongzili' },
    { date: '2026-03-19', name: 'Hari Suci Nyepi (Tahun Baru Saka 1948)' },
    { date: '2026-03-21', name: 'Hari Raya Idul Fitri 1447 H' },
    { date: '2026-03-22', name: 'Hari Raya Idul Fitri 1447 H' },
    { date: '2026-04-03', name: 'Wafat Yesus Kristus (Jumat Agung)' },
    { date: '2026-04-05', name: 'Kebangkitan Yesus Kristus (Paskah)' },
    { date: '2026-05-01', name: 'Hari Buruh Internasional' },
    { date: '2026-05-14', name: 'Kenaikan Yesus Kristus' },
    { date: '2026-05-31', name: 'Hari Raya Waisak 2570 BE' },
    { date: '2026-06-01', name: 'Hari Lahir Pancasila' },
    { date: '2026-05-27', name: 'Hari Raya Idul Adha 1447 H' },
    { date: '2026-06-16', name: '1 Muharram / Tahun Baru Islam 1448 H' },
    { date: '2026-08-17', name: 'Hari Kemerdekaan Republik Indonesia' },
    { date: '2026-08-25', name: 'Maulid Nabi Muhammad SAW' },
    { date: '2026-12-25', name: 'Hari Raya Natal' },
  ],
  2027: [
    { date: '2027-01-01', name: 'Tahun Baru 2027 Masehi' },
    { date: '2027-01-06', name: 'Isra Mi\'raj Nabi Muhammad SAW' },
    { date: '2027-02-06', name: 'Tahun Baru Imlek 2578 Kongzili' },
    { date: '2027-03-09', name: 'Hari Suci Nyepi' },
    { date: '2027-03-10', name: 'Hari Raya Idul Fitri 1448 H' },
    { date: '2027-03-11', name: 'Hari Raya Idul Fitri 1448 H' },
    { date: '2027-03-26', name: 'Wafat Yesus Kristus' },
    { date: '2027-05-01', name: 'Hari Buruh Internasional' },
    { date: '2027-05-06', name: 'Kenaikan Yesus Kristus' },
    { date: '2027-05-20', name: 'Hari Raya Waisak 2571 BE' },
    { date: '2027-06-01', name: 'Hari Lahir Pancasila' },
    { date: '2027-05-16', name: 'Hari Raya Idul Adha 1448 H' },
    { date: '2027-06-06', name: 'Tahun Baru Islam 1449 H' },
    { date: '2027-08-17', name: 'Hari Kemerdekaan RI' },
    { date: '2027-08-14', name: 'Maulid Nabi Muhammad SAW' },
    { date: '2027-12-25', name: 'Hari Raya Natal' },
  ]
};

/**
 * Mengambil daftar hari libur nasional untuk tahun tertentu
 */
export function getIndonesianNationalHolidays(year: number): NationalHoliday[] {
  return INDONESIAN_NATIONAL_HOLIDAYS[year] || [];
}

/**
 * Menghitung tanggal penggajian (Payroll Day) pintar:
 * - Default: Tanggal 5 setiap bulan.
 * - Jika tgl 5 jatuh pada hari Sabtu (6) -> dimajukan ke Jumat (tgl 4).
 * - Jika tgl 5 jatuh pada hari Minggu (0) -> dimajukan ke Jumat (tgl 3).
/**
 * Format Date to YYYY-MM-DD using local time
 */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Menghitung tanggal penggajian (Payroll Day) pintar:
 * - Default: Tanggal 5 setiap bulan.
 * - Jika tgl 5 jatuh pada hari Sabtu (6) -> dimajukan ke Jumat (tgl 4).
 * - Jika tgl 5 jatuh pada hari Minggu (0) -> dimajukan ke Jumat (tgl 3).
 * - Jika tanggal hasil tersebut tercatat sebagai hari libur nasional/perusahaan -> dimajukan ke hari kerja sebelumnya.
 */
export function calculatePayrollDate(year: number, month: number, registeredHolidayDates: string[] = []): string {
  // month: 1 - 12. Set to 12:00 noon to avoid any midnight/DST boundary shifts
  let targetDate = new Date(year, month - 1, 5, 12, 0, 0);

  // Iterasi mundur jika hari Sabtu (6), Minggu (0), atau terdaftar libur
  while (true) {
    const dayOfWeek = targetDate.getDay();
    const dateStr = formatLocalDate(targetDate);

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = registeredHolidayDates.includes(dateStr);

    if (!isWeekend && !isHoliday) {
      return dateStr;
    }

    // Mundur 1 hari
    targetDate.setDate(targetDate.getDate() - 1);
  }
}
