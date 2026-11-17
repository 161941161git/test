import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import {
  Send,
  Image as ImageIcon,
  ArrowLeft,
  X,
  CheckCircle,
  XCircle,
  Info,
} from 'lucide-react';
import { getDataloom } from '@client/src/lib/shims/dataloom';
import { getDefaultBucketId } from '@client/src/lib/shims/storage';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { Button } from '@client/src/components/ui/button';
import { Image } from '@client/src/components/ui/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { Textarea } from '@client/src/components/ui/textarea';
import { Input } from '@client/src/components/ui/input';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@client/src/components/ui/empty';
import { admin } from '@client/src/api/modules';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import { formatDate, formatMoney } from '@client/src/utils/format';
import type { RefundSession, RefundMessage } from '@shared/api.interface';

const AdminRefundSessionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<RefundSession | null>(null);
  const [messages, setMessages] = useState<RefundMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState<boolean>(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundRemark, setRefundRemark] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [sessionRes, messagesRes] = await Promise.all([
        admin.getRefundSession(id),
        admin.getRefundSessionMessages(id),
      ]);
      if (sessionRes.success) {
        setSession(sessionRes.data);
        // 初始化退款金额为订单金额
        if (sessionRes.data.orderAmount) {
          setRefundAmount(sessionRes.data.orderAmount);
        }
      } else {
        toast.error(sessionRes.message || '获取会话详情失败');
      }
      if (messagesRes.success) {
        setMessages(messagesRes.data || []);
      } else {
        toast.error(messagesRes.message || '获取消息失败');
      }
    } catch (e) {
      const msg = getApiErrorMessage(e, '加载失败，请重试');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sendTextMessage = async () => {
    if (!id || !inputValue.trim() || sending) return;
    setSending(true);
    try {
      const res = await admin.sendRefundSessionMessage(id, {
        msgType: 'text',
        content: inputValue.trim(),
      });
      if (res.success) {
        setMessages((prev) => [...prev, res.data]);
        setInputValue('');
      } else {
        toast.error(res.message || '发送失败');
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e, '发送失败'));
    } finally {
      setSending(false);
    }
  };

  const uploadAndSendImage = async (file: File) => {
    if (!id) return;
    setUploading(true);
    try {
      const dataloom = await getDataloom();
      const { data, error: uploadError } = await dataloom.storage
        .from(getDefaultBucketId())
        .uploadFile(file);
      if (uploadError) throw uploadError;
      if (!data) throw new Error('上传失败');
      const downloadUrl = data.download_url || '';

      const res = await admin.sendRefundSessionMessage(id, {
        msgType: 'image',
        imageUrl: downloadUrl,
        content: '[图片]',
      });
      if (res.success) {
        setMessages((prev) => [...prev, res.data]);
        toast.success('图片已发送');
      } else {
        toast.error(res.message || '发送失败');
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e, '上传失败'));
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void uploadAndSendImage(file);
    }
    e.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendTextMessage();
    }
  };

  const handleConfirmRefund = async () => {
    if (!id || actionLoading) return;
    if (!refundRemark.trim()) {
      toast.error('请填写退款说明');
      return;
    }
    const amountNum = parseFloat(refundAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('请输入有效的退款金额');
      return;
    }
    setActionLoading(true);
    try {
      const res = await admin.confirmRefund(id, {
        refundAmountFen: Math.round(amountNum * 100),
        remark: refundRemark.trim(),
      });
      if (res.success) {
        toast.success('退款已确认');
        setSession(res.data);
        setConfirmDialogOpen(false);
        setRefundRemark('');
        void loadData();
      } else {
        toast.error(res.message || '操作失败');
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e, '操作失败'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectRefund = async () => {
    if (!id || actionLoading) return;
    if (!rejectReason.trim()) {
      toast.error('请填写拒绝原因');
      return;
    }
    setActionLoading(true);
    try {
      const res = await admin.rejectRefundSession(id, {
        reason: rejectReason.trim(),
      });
      if (res.success) {
        toast.success('已拒绝退款');
        setSession(res.data);
        setRejectDialogOpen(false);
        setRejectReason('');
        void loadData();
      } else {
        toast.error(res.message || '操作失败');
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e, '操作失败'));
    } finally {
      setActionLoading(false);
    }
  };

  const renderMessage = (msg: RefundMessage) => {
    const isSystem = msg.isSystem || msg.senderRole === 'system';
    const isPlatform = msg.senderRole === 'platform';
    const isBuyer = msg.senderRole === 'buyer';

    if (isSystem) {
      return (
        <div key={msg.id} className="flex justify-center">
          <span className="text-[11px] text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {msg.content}
          </span>
        </div>
      );
    }

    // 管理员视角：平台消息靠右，买家消息靠左
    const isSelf = isPlatform;
    const alignClass = isSelf ? 'items-end' : 'items-start';

    return (
      <div
        key={msg.id}
        className={clsx('flex flex-col gap-1', alignClass)}
      >
        {msg.msgType === 'image' ? (
          <div
            className={clsx(
              'relative max-w-[200px] rounded-lg overflow-hidden cursor-pointer',
              isSelf ? 'rounded-br-sm bg-primary/10' : 'rounded-bl-sm bg-secondary',
            )}
            onClick={() => msg.imageUrl && setPreviewImage(msg.imageUrl)}
          >
            <Image
              src={msg.imageUrl}
              alt="退款图片"
              className="w-full h-auto block"
            />
          </div>
        ) : (
          <div
            className={clsx(
              'max-w-[75%] px-3 py-2 text-sm rounded-lg break-words',
              isSelf
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : isBuyer
                  ? 'bg-secondary text-secondary-foreground rounded-bl-sm'
                  : 'bg-muted text-foreground rounded-bl-sm',
            )}
          >
            {msg.content}
          </div>
        )}
        <span
          className={clsx(
            'text-[10px] text-muted-foreground',
            isSelf ? 'text-right' : 'text-left',
          )}
        >
          {formatDate(msg.createdAt)}
        </span>
      </div>
    );
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'pending':
        return '审核中';
      case 'refunded':
        return '已退款';
      case 'rejected':
        return '已拒绝';
      default:
        return status;
    }
  };

  const getStatusClass = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'bg-status-refunding/10 text-status-refunding';
      case 'refunded':
        return 'bg-status-completed/10 text-status-completed';
      case 'rejected':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="bg-card rounded-xl border border-border p-4 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i: number) => (
            <div key={i} className="flex justify-start">
              <Skeleton className="h-10 w-40 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="p-4">
        <Empty className="bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ArrowLeft />
            </EmptyMedia>
            <EmptyTitle>加载失败</EmptyTitle>
            <EmptyDescription>{error || '会话不存在'}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <button
              type="button"
              onClick={() => void loadData()}
              className="text-primary text-sm font-medium"
            >
              点击重试
            </button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const isPending = session.status === 'pending';

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {/* 退款信息卡片 */}
      <div className="bg-card border-b border-border px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">
              订单号：{session.orderNo}
            </p>
            <p className="text-lg font-bold text-primary tnum">
              {formatMoney(session.orderAmount)}
            </p>
          </div>
          <span
            className={clsx(
              'px-2.5 py-1 text-xs font-medium rounded-full',
              getStatusClass(session.status),
            )}
          >
            {getStatusLabel(session.status)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>买家：{session.buyerName}</div>
          <div>手机：{session.buyerPhone}</div>
        </div>
        <div className="text-sm text-foreground">
          <span className="text-xs text-muted-foreground">退款理由：</span>
          {session.refundReason}
        </div>
        {session.screenshotUrl && (
          <div>
            <Image
              src={session.screenshotUrl}
              alt="退款截图"
              className="w-20 h-20 object-cover rounded-lg border border-border cursor-pointer"
              onClick={() => setPreviewImage(session.screenshotUrl)}
            />
          </div>
        )}
        {session.status === 'rejected' && session.rejectReason && (
          <div className="p-2 bg-destructive/5 rounded-lg">
            <p className="text-xs text-destructive font-medium">拒绝原因：</p>
            <p className="text-xs text-destructive/80 mt-1">{session.rejectReason}</p>
          </div>
        )}
        {session.status === 'refunded' && session.refundAmountFen !== null && session.refundAmountFen !== undefined && (
          <div className="p-2 bg-status-completed/5 rounded-lg">
            <p className="text-xs text-status-completed font-medium">
              退款金额：{formatMoney(session.refundAmountFen / 100)}
            </p>
            {session.refundRemark && (
              <p className="text-xs text-status-completed/80 mt-1">
                说明：{session.refundRemark}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 消息列表 */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full py-8">
            <div className="text-center">
              <Info className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" strokeWidth={2} />
              <p className="text-xs text-muted-foreground">
                暂无消息，可在下方发送消息与买家沟通
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg: RefundMessage) => renderMessage(msg))
        )}
      </div>

      {/* 输入区 */}
      <div className="p-3 border-t border-border bg-card">
        <div className="flex items-end gap-2 mb-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center btn-press',
              uploading
                ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
            )}
            aria-label="上传图片"
            disabled={uploading}
          >
            <ImageIcon className="w-5 h-5" strokeWidth={2} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            className="flex-1 h-9 px-3 rounded-lg border border-input bg-transparent text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
            disabled={uploading || sending}
          />
          <button
            type="button"
            onClick={() => void sendTextMessage()}
            disabled={!inputValue.trim() || sending || uploading}
            className={clsx(
              'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center btn-press',
              !inputValue.trim() || sending || uploading
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
            aria-label="发送"
          >
            <Send className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* 操作按钮 */}
        {isPending && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-10"
              onClick={() => setRejectDialogOpen(true)}
              disabled={actionLoading}
            >
              <XCircle className="w-4 h-4 mr-1" strokeWidth={2} />
              拒绝退款
            </Button>
            <Button
              className="flex-1 h-10"
              onClick={() => setConfirmDialogOpen(true)}
              disabled={actionLoading}
            >
              <CheckCircle className="w-4 h-4 mr-1" strokeWidth={2} />
              确认已退款
            </Button>
          </div>
        )}
      </div>

      {/* 拒绝退款弹窗 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>拒绝退款</DialogTitle>
            <DialogDescription>请填写拒绝原因</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请输入拒绝原因..."
              className="min-h-[100px] resize-none"
              maxLength={200}
            />
            <p className="text-[11px] text-muted-foreground text-right mt-1">
              {rejectReason.length}/200
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={actionLoading}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleRejectRefund()}
              disabled={!rejectReason.trim() || actionLoading}
            >
              确认拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认退款弹窗 */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认已退款</DialogTitle>
            <DialogDescription>填写退款金额和说明</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">退款金额（元）</label>
              <Input
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">退款说明（必填）</label>
              <Textarea
                value={refundRemark}
                onChange={(e) => setRefundRemark(e.target.value)}
                placeholder="请输入退款说明..."
                className="min-h-[80px] resize-none"
                maxLength={200}
              />
              <p className="text-[11px] text-muted-foreground text-right mt-1">
                {refundRemark.length}/200
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              disabled={actionLoading}
            >
              取消
            </Button>
            <Button
              onClick={() => void handleConfirmRefund()}
              disabled={!refundRemark.trim() || actionLoading}
            >
              确认退款
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 图片预览 */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
          role="button"
          aria-label="关闭预览"
        >
          <Image
            src={previewImage}
            alt="预览"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
};

export default AdminRefundSessionPage;
