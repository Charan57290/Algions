import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlertBanner } from './AlertBanner';

describe('AlertBanner Component Suite', () => {
  it('renders alert message and title correctly', () => {
    render(
      <AlertBanner
        type="warning"
        title="Expiry Warning"
        message="3 batches expiring within 30 days"
      />
    );
    expect(screen.getByText('Expiry Warning')).toBeTruthy();
    expect(screen.getByText('3 batches expiring within 30 days')).toBeTruthy();
  });

  it('renders danger alert variant correctly', () => {
    const { container } = render(
      <AlertBanner
        type="danger"
        message="Critical stockout detected for Amoxicillin"
      />
    );
    expect(screen.getByText('Critical stockout detected for Amoxicillin')).toBeTruthy();
    const banner = container.firstChild as HTMLElement;
    expect(banner.className).toContain('bg-rose-50');
  });
});
