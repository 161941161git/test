import React from 'react';
import { clsx } from 'clsx';
import { Package, FileText, User, Wallet } from 'lucide-react';

interface EmptyStateProps {
  icon?: 'package' | 'file' | 'user' | 'wallet';
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

const ICONS = {
  package: Package,
  file: FileText,
  user: User,
  wallet: Wallet,
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'package',
  title,
  description,
  action,
  className,
}) => {
  const IconComp = ICONS[icon];
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className,
      )}
    >
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <IconComp className="w-8 h-8 text-muted-foreground" />
      </div>
      <p className="text-base font-medium text-foreground mb-1">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mb-4 max-w-xs">{description}</p>
      )}
      {action}
    </div>
  );
};
