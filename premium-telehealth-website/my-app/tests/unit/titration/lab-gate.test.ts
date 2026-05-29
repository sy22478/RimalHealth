/**
 * Unit tests for the GLP-1 lab gate. Prisma is mocked — the gate's job is the
 * recency decision, which is what we verify here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/prisma', () => ({
  prisma: { document: { findFirst: vi.fn() } },
}));

import { prisma } from '@/lib/db/prisma';
import { getLabGateStatus } from '@/lib/titration/lab-gate';
import { LAB_GATE } from '@/lib/intake/glp1/clinical-config';

const findFirst = prisma.document.findFirst as unknown as ReturnType<typeof vi.fn>;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

beforeEach(() => findFirst.mockReset());

describe('getLabGateStatus', () => {
  it('fails the gate when no qualifying lab exists', async () => {
    findFirst.mockResolvedValue(null);
    const status = await getLabGateStatus('patient-1');
    expect(status).toEqual({
      hasRecentLab: false,
      mostRecentLabDate: null,
      gatePassed: false,
    });
  });

  it('passes the gate for a lab uploaded within the recency window', async () => {
    const uploadedAt = new Date(Date.now() - 10 * MS_PER_DAY);
    findFirst.mockResolvedValue({ uploadedAt });
    const status = await getLabGateStatus('patient-1');
    expect(status.hasRecentLab).toBe(true);
    expect(status.gatePassed).toBe(true);
    expect(status.mostRecentLabDate).toEqual(uploadedAt);
  });

  it('fails the gate for a stale lab but still reports its date', async () => {
    const uploadedAt = new Date(Date.now() - (LAB_GATE.recencyDays + 5) * MS_PER_DAY);
    findFirst.mockResolvedValue({ uploadedAt });
    const status = await getLabGateStatus('patient-1');
    expect(status.hasRecentLab).toBe(false);
    expect(status.gatePassed).toBe(false);
    expect(status.mostRecentLabDate).toEqual(uploadedAt);
  });
});
