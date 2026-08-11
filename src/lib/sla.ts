/**
 * Motor de Cálculo de SLA em Horas Úteis
 * Regra: 24 horas úteis no horário comercial (Segunda a Sexta, das 09:00 às 18:00).
 */

export interface SLACalculationResult {
  businessHoursElapsed: number;
  businessHoursRemaining: number;
  isOverdue: boolean;
  targetHours: number;
}

const BUSINESS_START_HOUR = 9; // 09:00
const BUSINESS_END_HOUR = 18; // 18:00
const BUSINESS_HOURS_PER_DAY = BUSINESS_END_HOUR - BUSINESS_START_HOUR; // 9 horas úteis por dia

export function calculateBusinessHoursSLA(
  startDateInput: string | Date,
  targetHours: number = 24,
  currentDateInput: string | Date = new Date()
): SLACalculationResult {
  const start = new Date(startDateInput);
  const current = new Date(currentDateInput);

  if (isNaN(start.getTime()) || current <= start) {
    return {
      businessHoursElapsed: 0,
      businessHoursRemaining: targetHours,
      isOverdue: false,
      targetHours,
    };
  }

  let totalBusinessSeconds = 0;
  const cursor = new Date(start);

  while (cursor < current) {
    const dayOfWeek = cursor.getDay(); // 0 = Domingo, 6 = Sábado
    const isBusinessDay = dayOfWeek >= 1 && dayOfWeek <= 5;

    if (isBusinessDay) {
      const currentHour = cursor.getHours() + cursor.getMinutes() / 60;

      if (currentHour >= BUSINESS_START_HOUR && currentHour < BUSINESS_END_HOUR) {
        // Incrementa em passos de 15 minutos (900 segundos) para cálculo eficiente e preciso
        totalBusinessSeconds += 900;
      }
    }

    cursor.setMinutes(cursor.getMinutes() + 15);
  }

  const businessHoursElapsed = Math.round((totalBusinessSeconds / 3600) * 10) / 10;
  const businessHoursRemaining = Math.max(0, Math.round((targetHours - businessHoursElapsed) * 10) / 10);
  const isOverdue = businessHoursElapsed >= targetHours;

  return {
    businessHoursElapsed,
    businessHoursRemaining,
    isOverdue,
    targetHours,
  };
}
