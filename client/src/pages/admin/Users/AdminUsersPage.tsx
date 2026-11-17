import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { User, Building, Award, Wallet } from 'lucide-react';

import { admin } from '@client/src/api/modules';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { formatMoney, formatDate } from '@client/src/utils/format';
import { EmptyState } from '@client/src/components/EmptyState';
import { Skeleton } from '@client/src/components/ui/skeleton';
import type { User as UserType } from '@shared/api.interface';

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'buyer', label: '买家' },
  { key: 'runner', label: '跑腿员' },
] as const;

type TabKey = (typeof tabs)[number]['key'];

const AdminUsersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: { isRunner?: boolean; pageSize?: number } = { pageSize: 50 };
      if (activeTab === 'runner') {
        params.isRunner = true;
      } else if (activeTab === 'buyer') {
        params.isRunner = false;
      }
      const resp = await admin.users(params);
      if (resp.success) {
        setUsers(resp.data.items);
      } else {
        toast.error(resp.message || '加载用户列表失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '加载失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="px-4 pt-3 pb-2 bg-background sticky top-0 z-10 border-b border-border/50">
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'flex-1 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap',
                activeTab === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 p-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-xl border border-border p-4 space-y-2"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
                <div className="flex justify-between pt-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon="user"
            title="暂无用户"
            description="当前筛选条件下没有用户"
          />
        ) : (
          <div className="space-y-3">
            {users.map((u) => (
              <div
                key={u.id}
                className="bg-card rounded-xl border border-border p-4 shadow-sm rise"
              >
                {/* 顶部：头像 + 姓名 + 手机 + 角色标签 */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {u.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {u.phone}
                      </p>
                    </div>
                  </div>
                  <span
                    className={clsx(
                      'inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full',
                      u.isRunner
                        ? 'bg-status-in-progress/10 text-status-in-progress'
                        : 'bg-primary/10 text-primary',
                    )}
                  >
                    {u.isRunner ? '跑腿员' : '买家'}
                  </span>
                </div>

                {/* 宿舍 + 完成单数 */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-1">
                    <Building className="w-3.5 h-3.5" strokeWidth={2} />
                    {u.dormitory || '未填写'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" strokeWidth={2} />
                    完成 {u.totalOrders} 单
                  </span>
                </div>

                {/* 余额 */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={2} />
                    <span className="text-xs text-muted-foreground">账户余额</span>
                  </div>
                  <span className="text-sm font-bold text-primary tnum">
                    {formatMoney(u.balance)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsersPage;
