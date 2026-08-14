import { describe, it, expect, vi } from 'vitest';
import { roleBlockers, matchesNeedingReview } from '../../src/lib/assistant-tools.server';

describe('Assistant Grounding Logic', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };

  it('roleBlockers should detect payment_unpaid from gate', async () => {
    mockSupabase.select.mockResolvedValueOnce({
      data: [{
        id: 'pos-1',
        title: 'Blocked Role',
        status: 'active',
        payment_status: 'unpaid',
      }],
      error: null
    });
    mockSupabase.select.mockResolvedValueOnce({ data: [], error: null });

    const result = await roleBlockers(mockSupabase as any, 'org-1', null);
    expect(result.data.roles[0].blockers).toContain('Payment incomplete');
  });

  it('matchesNeedingReview should identify ready to publish candidates', async () => {
    mockSupabase.select.mockResolvedValueOnce({
      data: [{
        id: 'match-1',
        admin_status: 'approved',
        client_visibility: 'hidden',
        processing_state: 'scored',
        positions: { title: 'Engineer', status: 'active' },
        candidate_profiles: { full_name: 'John Doe' },
        approved_run: { status: 'completed', evidence: ['some evidence'], contradiction_status: 'none' }
      }],
      error: null
    });

    const result = await matchesNeedingReview(mockSupabase as any, 'org-1');
    expect(result.data.pending_reviews[0].reason).toBe('Ready to publish to client');
    expect(result.data.pending_reviews[0].can_publish).toBe(true);
  });
});
