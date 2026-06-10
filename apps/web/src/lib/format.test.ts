import { describe, expect, it } from 'vitest';
import { formatDuration } from './format';

describe('formatDuration', () => {
  it('formats sub-second values in milliseconds', () => {
    expect(formatDuration(245.6)).toBe('246 ms');
  });

  it('formats second-scale values in seconds', () => {
    expect(formatDuration(1530)).toBe('1.53 s');
  });
});
