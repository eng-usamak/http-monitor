import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionIndicator } from './ConnectionIndicator';

describe('ConnectionIndicator', () => {
  it('shows Live when connected', () => {
    render(<ConnectionIndicator connected />);
    expect(screen.getByText('Live')).toBeDefined();
  });

  it('shows Disconnected when not connected', () => {
    render(<ConnectionIndicator connected={false} />);
    expect(screen.getByText('Disconnected')).toBeDefined();
  });
});
