import React from 'react';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'purple'
  | 'amber';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, { bg: string; dot: string }> = {
  success: {
    bg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200 text-amber-700',
    dot: 'bg-amber-500',
  },
  danger: {
    bg: 'bg-rose-50 border-rose-200 text-rose-700',
    dot: 'bg-rose-500',
  },
  info: {
    bg: 'bg-blue-50 border-blue-200 text-blue-700',
    dot: 'bg-blue-500',
  },
  neutral: {
    bg: 'bg-slate-100 border-slate-200 text-slate-700',
    dot: 'bg-slate-400',
  },
  purple: {
    bg: 'bg-purple-50 border-purple-200 text-purple-700',
    dot: 'bg-purple-500',
  },
  amber: {
    bg: 'bg-orange-50 border-orange-200 text-orange-700',
    dot: 'bg-orange-500',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
}) => {
  const styles = variantStyles[variant] || variantStyles.neutral;
  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${styles.bg} ${sizeClasses}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />}
      {children}
    </span>
  );
};
