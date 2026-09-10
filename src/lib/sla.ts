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

export interface SLAScheduleConfig {
  businessStart?: string;
  businessEnd?: string;
  weekdays?: number[];
  holidays?: string[];
}

export function isConsultationUnlocked(
  purchaseDateInput: string | Date | null | undefined,
  diagnosticSubmittedAt: string | Date | null | undefined,
  currentDateInput: string | Date = new Date(),
) {
  if (!purchaseDateInput || !diagnosticSubmittedAt) return false;
  const purchaseDate = new Date(purchaseDateInput);
  const currentDate = new Date(currentDateInput);
  if (Number.isNaN(purchaseDate.getTime()) || Number.isNaN(currentDate.getTime())) return false;
  const daysSincePurchase = (currentDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysSincePurchase >= 7;
}

const DEFAULT_SCHEDULE: Required<SLAScheduleConfig> = {
  businessStart: '09:00',
  businessEnd: '18:00',
  weekdays: [1, 2, 3, 4, 5],
  holidays: [],
};

function parseHour(value: string, fallback: number) {
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback;
  return hours + minutes / 60;
}

export function calculateBusinessHoursSLA(
  startDateInput: string | Date,
  targetHours: number = 24,
  currentDateInput: string | Date = new Date(),
  scheduleInput: SLAScheduleConfig = {}
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
  const schedule: Required<SLAScheduleConfig> = {
    businessStart: scheduleInput.businessStart ?? DEFAULT_SCHEDULE.businessStart,
    businessEnd: scheduleInput.businessEnd ?? DEFAULT_SCHEDULE.businessEnd,
    weekdays: scheduleInput.weekdays ?? DEFAULT_SCHEDULE.weekdays,
    holidays: scheduleInput.holidays ?? DEFAULT_SCHEDULE.holidays,
  };
  const businessStartHour = parseHour(schedule.businessStart, 9);
  const businessEndHour = parseHour(schedule.businessEnd, 18);
  const holidays = new Set(schedule.holidays);

  while (cursor < current) {
    const dayOfWeek = cursor.getDay(); // 0 = Domingo, 6 = Sábado
    const dateKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    const isBusinessDay = schedule.weekdays.includes(dayOfWeek) && !holidays.has(dateKey);

    if (isBusinessDay) {
      const dayStart = new Date(cursor);
      dayStart.setHours(Math.floor(businessStartHour), Math.round((businessStartHour % 1) * 60), 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(Math.floor(businessEndHour), Math.round((businessEndHour % 1) * 60), 0, 0);
      const overlapStart = Math.max(start.getTime(), dayStart.getTime());
      const overlapEnd = Math.min(current.getTime(), dayEnd.getTime());
      if (overlapEnd > overlapStart) totalBusinessSeconds += (overlapEnd - overlapStart) / 1000;
    }

    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
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
