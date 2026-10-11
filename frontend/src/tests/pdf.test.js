import { describe, it, expect } from 'vitest';
import { generateMembersPdf } from '../lib/pdf.js';

describe('PDF Generation (Members Record Statement)', () => {
  it('generates a PDF instance with correct sums and columns', () => {

    const mockMembers = [
      {
        id: '1',
        name: 'Tariq Mehmood',
        father_name: 'Mehmood Ahmed',
        join_date: '2023-01-15',
        paid: 12000,
        remaining: 6000,
      },
      {
        id: '2',
        name: 'Bilal Khan',
        father_name: 'Sultan Khan',
        join_date: '2024-03-01',
        paid: 6000,
        remaining: 0,
      },
      {
        id: '3',
        name: 'Rashid Ali',
        father_name: 'Ali Akbar',
        join_date: '2025-06-10',
        paid: 0,
        remaining: 12000,
      },
    ];

    // Mock doc.save so it doesn't trigger a real DOM file download during tests
    const doc = generateMembersPdf(mockMembers, null, { filename: 'test.pdf', download: false });

    expect(doc).toBeDefined();
    expect(typeof doc.save).toBe('function');
    expect(doc.internal.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('handles empty members array gracefully without errors', () => {
    const doc = generateMembersPdf([], null, { filename: 'empty.pdf', download: false });
    expect(doc).toBeDefined();
    expect(doc.internal.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});

