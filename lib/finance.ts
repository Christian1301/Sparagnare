// Logica condivisa tra Dashboard.tsx e MonthlyTrendChart.tsx per capire se
// una transazione (anche ricorrente) ricade in un dato mese/anno.
export function occursInMonth(tx: any, cursor: { year: number; month: number }) {
  const d = new Date(tx.date + "T00:00:00");
  const sy = d.getFullYear(), sm = d.getMonth();
  if (!tx.is_recurring) return sy === cursor.year && sm === cursor.month;
  const afterStart = cursor.year > sy || (cursor.year === sy && cursor.month >= sm);
  if (!afterStart) return false;
  if (tx.recurring_end_date) {
    const e = new Date(tx.recurring_end_date + "T00:00:00");
    const beforeEnd = cursor.year < e.getFullYear() || (cursor.year === e.getFullYear() && cursor.month <= e.getMonth());
    return beforeEnd;
  }
  return true;
}
