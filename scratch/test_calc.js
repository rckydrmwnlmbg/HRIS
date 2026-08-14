function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function calculatePayrollDate(year, month, registeredHolidayDates = []) {
  let targetDate = new Date(year, month - 1, 5, 12, 0, 0);

  while (true) {
    const dayOfWeek = targetDate.getDay();
    const dateStr = formatLocalDate(targetDate);

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = registeredHolidayDates.includes(dateStr);

    if (!isWeekend && !isHoliday) {
      return dateStr;
    }

    targetDate.setDate(targetDate.getDate() - 1);
  }
}

console.log('Aug 2026 Payroll (Wed 5th):', calculatePayrollDate(2026, 8, []));
console.log('Jul 2026 Payroll (Sun 5th -> Fri 3rd):', calculatePayrollDate(2026, 7, []));
console.log('Sep 2026 Payroll (Sat 5th -> Fri 4th):', calculatePayrollDate(2026, 9, []));
