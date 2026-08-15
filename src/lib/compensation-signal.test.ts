import { describe, it, expect } from 'vitest';
import { classifyAlignment, type MoneyRange } from './compensation-signal';

describe('classifyAlignment', () => {
  const roleRange: MoneyRange = {
    min: 55000,
    max: 75000,
    currency: 'EUR',
    period: 'year',
    raw: '€55,000 – €75,000/year'
  };

  it('detects "in_range" within boundaries', () => {
    const cand: MoneyRange = { min: 60000, max: null, currency: 'EUR', period: 'year', raw: '' };
    expect(classifyAlignment(roleRange, cand)).toBe('in_range');
  });

  it('detects "above_range" for values exceeding max', () => {
    const cand: MoneyRange = { min: 78000, max: null, currency: 'EUR', period: 'year', raw: '' };
    expect(classifyAlignment(roleRange, cand)).toBe('above_range');
  });

  it('detects "below_range" for values under min', () => {
    const cand: MoneyRange = { min: 32000, max: null, currency: 'EUR', period: 'year', raw: '' };
    expect(classifyAlignment(roleRange, cand)).toBe('below_range');
  });

  it('handles boundary cases (max) correctly', () => {
    const cand: MoneyRange = { min: 75000, max: null, currency: 'EUR', period: 'year', raw: '' };
    expect(classifyAlignment(roleRange, cand)).toBe('in_range');
  });

  it('handles boundary cases (min) correctly', () => {
    const cand: MoneyRange = { min: 55000, max: null, currency: 'EUR', period: 'year', raw: '' };
    expect(classifyAlignment(roleRange, cand)).toBe('in_range');
  });

  it('returns "unknown" for missing data', () => {
    expect(classifyAlignment(null, null)).toBe('unknown');
    expect(classifyAlignment(roleRange, null)).toBe('unknown');
  });

  it('returns "unknown" for currency mismatch', () => {
    const cand: MoneyRange = { min: 60000, max: null, currency: 'USD', period: 'year', raw: '' };
    expect(classifyAlignment(roleRange, cand)).toBe('unknown');
  });
});
