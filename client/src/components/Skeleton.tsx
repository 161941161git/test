import React from 'react';

export const Skeleton = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`animate-pulse rounded-md bg-muted ${className}`}
    {...props}
  />
);

export const OrderCardSkeleton: React.FC = () => (
  <div className="bg-card rounded-xl border border-border p-4 space-y-3">
    <div className="flex justify-between items-start">
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-40" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
    <div className="flex gap-2">
      <Skeleton className="h-5 w-12 rounded" />
      <Skeleton className="h-5 w-14 rounded" />
    </div>
    <div className="flex justify-between items-center pt-1">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-9 w-20 rounded-lg" />
    </div>
  </div>
);

export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <OrderCardSkeleton key={i} />
    ))}
  </div>
);
