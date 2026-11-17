import React from 'react';
import { Download, Smartphone, ShieldCheck, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { detectInstallEnv } from '@client/src/components/AddToHomeSheet';

const APK_URL = '/download/shunshou.apk';
const VERSION = '1.0.0';
const SIZE_TEXT = '33 KB';

const DownloadPage: React.FC = () => {
  const navigate = useNavigate();
  const env = detectInstallEnv();
  const isAndroid = /Android/.test(navigator.userAgent);
  const isIOS = env === 'ios';

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground mb-4"
      >
        <ChevronLeft className="w-4 h-4" strokeWidth={2} />
        返回
      </button>

      <div className="max-w-[430px] mx-auto space-y-4">
        <div className="bg-card rounded-2xl border border-border p-6 flex flex-col items-center rise">
          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-md">
            <span className="text-white text-2xl font-bold">捎</span>
          </div>
          <div className="mt-4 text-lg font-semibold text-foreground">顺手捎</div>
          <div className="text-xs text-muted-foreground mt-1">校园快递代取 · 安装包 v{VERSION}</div>

          <a
            href={APK_URL}
            download="shunshou.apk"
            className="mt-6 w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 btn-press"
          >
            <Download className="w-4 h-4" strokeWidth={2} />
            下载安卓安装包（{SIZE_TEXT}）
          </a>

          <div className="mt-2 text-[11px] text-muted-foreground text-center leading-relaxed">
            {isAndroid
              ? '点上面按钮即可下载，下载完在通知栏或文件管理里点开安装。'
              : '手机浏览器打开本页后点按钮下载；电脑浏览器打开则会下载到电脑。'}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden rise">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-primary" strokeWidth={2} />
            <span className="text-sm font-semibold text-foreground">安装步骤</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">1</span>
              <span className="text-sm text-foreground leading-relaxed">点「下载安卓安装包」，等下载完成</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">2</span>
              <span className="text-sm text-foreground leading-relaxed">
                在通知栏或「文件管理 → 下载」里找到 <b>shunshou.apk</b>，点开
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">3</span>
              <span className="text-sm text-foreground leading-relaxed">
                系统提示「未知来源应用」时，选「允许安装」，装完桌面就有「顺手捎」图标
              </span>
            </div>
          </div>
        </div>

        {isIOS && (
          <div className="bg-warning/10 border border-warning/40 rounded-2xl p-4 space-y-2">
            <div className="text-sm font-semibold text-foreground">iPhone 装不了这个安装包</div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              iOS 不允许网页直接装 App。iPhone 上用 Safari 打开本站，点底部「分享」→「添加到主屏幕」，效果和 App 一样。
            </div>
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border p-4 flex items-start gap-3 rise">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" strokeWidth={2} />
          <div className="text-xs text-muted-foreground leading-relaxed">
            安装包由本平台自行签名，未上架应用商店，因此部分手机（vivo、OPPO、小米）会提示「未经安全检测」或「风险应用」。
            这是没走应用商店的常规提示，不是病毒。安装时如被拦截，选「继续安装」即可。
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadPage;
