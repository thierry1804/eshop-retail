import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  subtitle?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, subtitle }) => {
  return (
    <div className="app-kpi">
      <div className="flex items-start gap-2">
        <Icon size={16} style={{ color: 'var(--app-ink-muted)' }} className="flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium leading-tight" style={{ color: 'var(--app-ink-muted)' }}>{title}</p>
          <p className="text-base font-semibold mt-0.5 truncate leading-tight" style={{ color: 'var(--app-ink)' }}>{value}</p>
          {subtitle && (
            <p className="text-[11px] mt-0.5 leading-tight line-clamp-1" style={{ color: 'var(--app-ink-muted)' }}>{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
};
