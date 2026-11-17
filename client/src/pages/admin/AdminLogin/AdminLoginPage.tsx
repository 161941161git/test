import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Lock, User, ArrowRight, Loader2 } from 'lucide-react';

import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { admin, setAdminToken } from '@client/src/api/modules';
import { useAdmin } from '@client/src/store/userStore';
import { getApiErrorMessage } from '@client/src/lib/api-error';

const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setAdmin } = useAdmin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast.error('请输入管理员账号');
      return;
    }
    if (!password.trim()) {
      toast.error('请输入管理员密码');
      return;
    }

    setLoading(true);
    try {
      const resp = await admin.login(username.trim(), password);
      if (resp.success) {
        const adminInfo = {
          adminId: resp.data.adminId,
          username: resp.data.username,
          name: resp.data.name,
          token: resp.data.token,
        };
        setAdmin(adminInfo);
        setAdminToken(adminInfo);
        toast.success('登录成功，欢迎回来！');
        navigate('/admin/dashboard', { replace: true });
      } else {
        toast.error(resp.message || '登录失败');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, '登录失败，请检查账号密码'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / 标题 */}
        <div className="text-center mb-8 rise">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Lock className="w-8 h-8 text-primary-foreground" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">
            管理员登录
          </h1>
          <p className="text-sm text-muted-foreground">
            顺手捎 · 开发者后台
          </p>
        </div>

        {/* 登录卡片 */}
        <form
          onSubmit={handleSubmit}
          className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4 rise"
          style={{ animationDelay: '0.05s' }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              管理员账号
            </label>
            <div className="relative">
              <User
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
                strokeWidth={2}
              />
              <Input
                type="text"
                placeholder="请输入账号"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-10 h-11"
                autoComplete="username"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              管理员密码
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
                strokeWidth={2}
              />
              <Input
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-11"
                autoComplete="current-password"
              />
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full h-11 text-base rounded-xl mt-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                登录中...
              </>
            ) : (
              <>
                登录
                <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </>
            )}
          </Button>
        </form>

        {/* 底部链接 */}
        <div className="text-center mt-6 rise" style={{ animationDelay: '0.1s' }}>
          <Link
            to="/login"
            className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
          >
            返回用户端
            <ArrowRight className="w-3.5 h-3.5 rotate-180" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
