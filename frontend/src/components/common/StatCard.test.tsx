import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Activity } from 'lucide-react';
import { StatCard } from './StatCard';

describe('StatCard Component Suite', () => {
  it('renders title and value accurately', () => {
    render(
      <StatCard
        title="Total Revenue"
        value="$14,520.00"
        icon={Activity}
      />
    );
    expect(screen.getByText('Total Revenue')).toBeTruthy();
    expect(screen.getByText('$14,520.00')).toBeTruthy();
  });

  it('renders positive trend metrics correctly', () => {
    render(
      <StatCard
        title="Units Sold"
        value="1,240"
        icon={Activity}
        trend={{ value: '12% vs last week', isPositive: true }}
      />
    );
    expect(screen.getByText(/12% vs last week/)).toBeTruthy();
  });

  it('renders subtitle information if provided', () => {
    render(
      <StatCard
        title="Low Stock Items"
        value="4"
        subtitle="Requires immediate reorder"
        icon={Activity}
      />
    );
    expect(screen.getByText('Requires immediate reorder')).toBeTruthy();
  });
});
