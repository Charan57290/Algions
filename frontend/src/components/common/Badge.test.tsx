import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge Component Suite', () => {
  it('renders badge children text correctly', () => {
    render(<Badge>In Stock</Badge>);
    expect(screen.getByText('In Stock')).toBeTruthy();
  });

  it('renders success variant with emerald styling', () => {
    const { container } = render(<Badge variant="success">Active</Badge>);
    const badgeElement = container.querySelector('span');
    expect(badgeElement?.className).toContain('text-emerald-700');
  });

  it('renders danger variant with rose styling', () => {
    const { container } = render(<Badge variant="danger">Expired</Badge>);
    const badgeElement = container.querySelector('span');
    expect(badgeElement?.className).toContain('text-rose-700');
  });

  it('renders status dot indicator when dot prop is enabled', () => {
    const { container } = render(<Badge variant="warning" dot>Expiring Soon</Badge>);
    const dot = container.querySelector('.rounded-full.w-1\\.5');
    expect(dot).toBeTruthy();
  });
});
