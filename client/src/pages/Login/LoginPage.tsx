import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Phone, User, Home as HomeIcon } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { useUser } from '@client/src/store/userStore';
import { auth } from '@client/src/api/modules';
import { validatePhone } from '@client/src/utils/format';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useUser();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [dormitory, setDormitory] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!validatePhone(phone)) {
      toast.error('请输入正确的11位手机号');
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        toast.error('请输入姓名');
        return;
      }
      if (!dormitory.trim()) {
        toast.error('请输入宿舍号');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await auth.login({ phone });
        if (res.success) {
          setUser(res.data.user);
          toast.success('登录成功，欢迎回来～');
          navigate('/home');
        } else {
          toast.error(res.message || '登录失败');
        }
      } else {
        const res = await auth.register({ phone, name: name.trim(), dormitory: dormitory.trim() });
        if (res.success) {
          setUser(res.data.user);
          toast.success('注册成功，欢迎加入顺手捎～');
          navigate('/home');
        } else {
          toast.error(res.message || '注册失败');
        }
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = error.response?.data?.error?.message || '';

      if (mode === 'login' && msg.includes('未注册')) {
        toast.error('该手机号未注册，请先注册');
        setMode('register');
      } else {
        toast.error(msg || (mode === 'login' ? '登录失败，请稍后重试' : '注册失败，请稍后重试'));
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        {/* Logo & Title */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <HomeIcon className="w-8 h-8 text-primary-foreground" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">顺手捎</h1>
          <p className="text-sm text-muted-foreground">校园快递代取</p>
        </div>

        {/* Form Card */}
        <div className="w-full max-w-sm bg-card rounded-xl p-6 shadow-xs border border-border">
          <div className="space-y-4">
            {/* Phone */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                手机号
              </label>
              <Input
                type="tel"
                placeholder="请输入11位手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                maxLength={11}
                className="h-11"
              />
            </div>

            {/* Register-only fields */}
            {mode === 'register' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    姓名
                  </label>
                  <Input
                    type="text"
                    placeholder="请输入你的姓名"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={20}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <HomeIcon className="w-4 h-4 text-muted-foreground" />
                    宿舍号
                  </label>
                  <Input
                    type="text"
                    placeholder="如 7栋302"
                    value={dormitory}
                    onChange={(e) => setDormitory(e.target.value)}
                    maxLength={20}
                    className="h-11"
                  />
                </div>
              </>
            )}

            {/* Submit Button */}
            <Button
              className="w-full h-11 text-base rounded-lg"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
            </Button>
          </div>

          {/* Toggle Mode */}
          <div className="mt-5 text-center">
            <button
              onClick={toggleMode}
              className="text-sm text-primary hover:underline"
              type="button"
            >
              {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
            </button>
          </div>
        </div>

        {/* Dev Entry */}
        <div className="mt-8">
          <Link
            to="/admin/login"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            开发者入口
          </Link>
        </div>
      </div>
    </div>
  );
}
