import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

interface AlertBannerProps {
  type?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  message: string;
  onClose?: () => void;
  actionText?: string;
  onAction?: () => void;
}

const alertConfig = {
  info: {
    bg: 'bg-blue-50 border-blue-200 text-blue-900',
    icon: Info,
    iconColor: 'text-blue-500',
  },
  success: {
    bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200 text-amber-900',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
  },
  danger: {
    bg: 'bg-rose-50 border-rose-200 text-rose-900',
    icon: AlertCircle,
    iconColor: 'text-rose-500',
  },
};

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type = 'info',
  title,
  message,
  onClose,
  actionText,
  onAction,
}) => {
  const config = alertConfig[type];
  const Icon = config.icon;

  return (
    <div className={`p-4 rounded-xl border flex items-start gap-3 ${config.bg}`}>
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconColor}`} />
      <div className="flex-1">
        {title && <h4 className="text-sm font-semibold mb-0.5">{title}</h4>}
        <p className="text-sm">{message}</p>
        {actionText && onAction && (
          <button
            onClick={onAction}
            className="mt-2 text-xs font-semibold underline hover:opacity-80"
          >
            {actionText} →
          </button>
        )}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
