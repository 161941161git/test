import React from 'react';
import { clsx } from 'clsx';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: '等待接单', className: 'bg-[hsl(224_76%_48%_/_0.08)] text-status-pending' },
  in_progress: { label: '进行中', className: 'bg-[hsl(221_83%_53%_/_0.08)] text-status-in-progress' },
  delivered: { label: '已送达', className: 'bg-[hsl(192_91%_31%_/_0.08)] text-status-delivered' },
  completed: { label: '已完成', className: 'bg-[hsl(228_84%_32%_/_0.08)] text-status-completed' },
  refunding: { label: '退款中', className: 'bg-[hsl(217_91%_60%_/_0.08)] text-status-refunding' },
  refunded: { label: '已退款', className: 'bg-[hsl(216_15%_35%_/_0.08)] text-status-refunded' },
  approved: { label: '已通过', className: 'bg-[hsl(228_84%_32%_/_0.08)] text-status-completed' },
  rejected: { label: '已拒绝', className: 'bg-[hsl(216_15%_35%_/_0.08)] text-status-refunded' },
  paid: { label: '已打款', className: 'bg-[hsl(228_84%_32%_/_0.08)] text-status-completed' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const info = STATUS_MAP[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
        info.className,
      )}
    >
      {info.label}
    </span>
  );
};
