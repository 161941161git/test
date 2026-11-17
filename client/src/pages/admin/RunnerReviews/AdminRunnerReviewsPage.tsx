import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { UserCheck, XCircle, Clock, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';

import { admin } from '@client/src/api/modules';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { formatDate } from '@client/src/utils/format';
import { EmptyState } from '@client/src/components/EmptyState';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@client/src/components/ui/dialog';
import { Textarea } from '@client/src/components/ui/textarea';
import { Image } from '@client/src/components/ui/image';
import type { RunnerApplication, RunnerApplyStatus } from '@shared/api.interface';
import { RUNNER_APPLY_STATUS_LABELS } from '@shared/api.interface';
import { useAdmin } from '@client/src/store/userStore';

const tabs: Array<{ key: string; label: string; status?: RunnerApplyStatus | 'all' }> = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待审核', status: 'pending' },
  { key: 'approved', label: '已通过', status: 'approved' },
  { key: 'rejected', label: '已拒绝', status: 'rejected' },
];

const AdminRunnerReviewsPage: React.FC = () => {
  const { admin: adminUser } = useAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get('status');
  const initialTab = urlStatus && tabs.some((t) => t.key === urlStatus)
    ? urlStatus
    : 'all';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [applications, setApplications] = useState<RunnerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false);
  const [qrPreviewUrl, setQrPreviewUrl] = useState('');

  const loadApplications = useCallback(async () => {
    setLoading(true);
    try {
      const params: { status?: string; pageSize?: number } = { pageSize: 50 };
      const currentTab = tabs.find((t) => t.key === activeTab);
      if (currentTab?.status && currentTab.status !== 'all') {
        params.status = currentTab.status;
      }
      const resp = await admin.runnerApplications(params);
      if (resp.success) {
        setApplications(resp.data.items);
      } else {
        toast.error(resp.message || '加载申请列表失败');
      }

      // 加载待审核数量
      const pendingResp = await admin.runnerApplications({ status: 'pending', pageSize: 1 });
      if (pendingResp.success) {
        setPendingCount(pendingResp.data.total);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '加载失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  const getStatusClass = (status: RunnerApplyStatus): string => {
    switch (status) {
      case 'pending':
        return 'bg-warning/15 text-warning';
      case 'approved':
        return 'bg-status-completed/10 text-status-completed';
      case 'rejected':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const handleApprove = async () => {
    if (!selectedId || !adminUser) return;
    setSubmitting(true);
    try {
      const resp = await admin.approveRunnerApplication(selectedId, adminUser.name);
      if (resp.success) {
        toast.success('已通过申请');
        setApproveDialogOpen(false);
        setSelectedId(null);
        void loadApplications();
      } else {
        toast.error(resp.message || '操作失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '操作失败，请稍后重试'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedId || !adminUser) return;
    if (!rejectReason.trim()) {
      toast.error('请填写拒绝原因');
      return;
    }
    setSubmitting(true);
    try {
      const resp = await admin.rejectRunnerApplication(
        selectedId,
        adminUser.name,
        rejectReason.trim(),
      );
      if (resp.success) {
        toast.success('已拒绝申请');
        setRejectDialogOpen(false);
        setSelectedId(null);
        setRejectReason('');
        void loadApplications();
      } else {
        toast.error(resp.message || '操作失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '操作失败，请稍后重试'));
    } finally {
      setSubmitting(false);
    }
  };

  const openApproveDialog = (id: string) => {
    setSelectedId(id);
    setApproveDialogOpen(true);
  };

  const openQrPreview = (url: string) => {
    setQrPreviewUrl(url);
    setQrPreviewOpen(true);
  };

  const openRejectDialog = (id: string) => {
    setSelectedId(id);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="px-4 pt-3 pb-2 bg-background sticky top-0 z-10 border-b border-border/50">
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                const next = new URLSearchParams(searchParams);
                if (tab.key === 'all') {
                  next.delete('status');
                } else {
                  next.set('status', tab.key);
                }
                setSearchParams(next, { replace: true });
              }}
              className={clsx(
                'flex-1 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap relative',
                activeTab === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              {tab.label}
              {tab.key === 'pending' && pendingCount > 0 && (
                <span className="absolute -top-0.5 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 p-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-xl border border-border p-4 space-y-2"
              >
                <div className="flex justify-between items-start">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-28" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-7 flex-1 rounded-md" />
                  <Skeleton className="h-7 flex-1 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : applications.length === 0 ? (
          <EmptyState
            icon="user"
            title="暂无兼职申请"
            description="有新的跑腿员申请会在这里显示"
          />
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <div
                key={app.id}
                className="bg-card rounded-xl border border-border p-4 shadow-sm rise"
              >
                {/* 顶部：姓名 + 状态 */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary text-sm font-bold">
                        {app.name?.charAt(0) || '?'}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {app.name}
                    </span>
                  </div>
                  <span
                    className={clsx(
                      'inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full',
                      getStatusClass(app.status),
                    )}
                  >
                    {RUNNER_APPLY_STATUS_LABELS[app.status]}
                  </span>
                </div>

                {/* 详情信息 */}
                <div className="space-y-1.5 text-sm mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs w-14">手机号</span>
                    <span className="text-foreground text-xs">{app.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs w-14">微信号</span>
                    <span className="text-foreground text-xs">{app.wechatId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs w-14">申请时间</span>
                    <span className="text-foreground text-xs">
                      {formatDate(app.createdAt)}
                    </span>
                  </div>
                  {app.status !== 'pending' && app.reviewedAt && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs w-14">处理时间</span>
                      <span className="text-foreground text-xs">
                        {formatDate(app.reviewedAt)}
                      </span>
                    </div>
                  )}
                  {app.status !== 'pending' && app.reviewedBy && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs w-14">处理人</span>
                      <span className="text-foreground text-xs">开发者</span>
                    </div>
                  )}
                  {app.status === 'rejected' && app.rejectReason && (
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground text-xs w-14 flex-shrink-0">拒绝原因</span>
                      <span className="text-destructive text-xs">{app.rejectReason}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-muted-foreground text-xs w-14 flex-shrink-0">收款码</span>
                    {app.paymentQrUrl ? (
                      <button
                        type="button"
                        onClick={() => openQrPreview(app.paymentQrUrl)}
                        className="rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors cursor-pointer"
                        aria-label="点击查看收款码大图"
                      >
                        <Image
                          src={app.paymentQrUrl}
                          alt="收款码"
                          width={60}
                          height={60}
                          className="w-[60px] h-[60px] object-cover rounded-lg"
                        />
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">暂无收款码</span>
                    )}
                  </div>
                </div>

                {/* 操作按钮 */}
                {app.status === 'pending' && (
                  <div className="flex gap-2 pt-3 border-t border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 text-status-completed border-status-completed/30 hover:bg-status-completed/5"
                      onClick={() => openApproveDialog(app.id)}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" strokeWidth={2} />
                      通过
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 text-destructive border-destructive/30 hover:bg-destructive/5"
                      onClick={() => openRejectDialog(app.id)}
                    >
                      <XCircle className="w-4 h-4 mr-1" strokeWidth={2} />
                      拒绝
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 收款码大图预览 */}
      <Dialog open={qrPreviewOpen} onOpenChange={setQrPreviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>收款码</DialogTitle>
            <DialogClose />
          </DialogHeader>
          <div className="flex justify-center py-4">
            <Image
              src={qrPreviewUrl}
              alt="收款码"
              width={280}
              height={280}
              className="max-w-[280px] max-h-[280px] rounded-xl"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* 通过确认对话框 */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-status-completed" strokeWidth={2} />
              通过兼职申请
            </DialogTitle>
            <DialogDescription>
              确认通过该用户的跑腿员申请？通过后该用户即可接单。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button onClick={handleApprove} disabled={submitting}>
              {submitting ? '处理中...' : '确认通过'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 拒绝对话框 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" strokeWidth={2} />
              拒绝兼职申请
            </DialogTitle>
            <DialogDescription>
              请填写拒绝原因，用户会收到通知。
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="请输入拒绝原因..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="min-h-[100px] resize-none"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={submitting}
            >
              {submitting ? '处理中...' : '确认拒绝'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRunnerReviewsPage;
