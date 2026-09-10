import { expect, test } from '@playwright/test';
import { calculateBusinessHoursSLA } from '@/lib/sla';

test.describe('SLA business-hours engine', () => {
  test('pauses outside configured business days and hours', () => {
    const result = calculateBusinessHoursSLA(
      new Date(2026, 7, 14, 17, 0),
      2,
      new Date(2026, 7, 17, 10, 0),
      { businessStart: '09:00', businessEnd: '18:00', weekdays: [1, 2, 3, 4, 5], holidays: [] },
    );

    expect(result.businessHoursElapsed).toBe(2);
    expect(result.businessHoursRemaining).toBe(0);
    expect(result.isOverdue).toBe(true);
  });

  test('does not count configured holidays', () => {
    const result = calculateBusinessHoursSLA(
      new Date(2026, 7, 14, 17, 0),
      2,
      new Date(2026, 7, 17, 10, 0),
      { businessStart: '09:00', businessEnd: '18:00', weekdays: [1, 2, 3, 4, 5], holidays: ['2026-08-17'] },
    );

    expect(result.businessHoursElapsed).toBe(1);
    expect(result.businessHoursRemaining).toBe(1);
    expect(result.isOverdue).toBe(false);
  });
});
