# 一键把本文件夹推到 GitHub

这个脚本做三件事：初始化仓库、提交全部代码、推到你的 GitHub 空仓库。

## 用法

1. 先在 GitHub 建一个**空的**仓库（不要勾选 Add a README / .gitignore / license），
   建好后页面上会显示仓库地址，形如 `https://github.com/你的账号/仓库名.git`。
2. 在本文件夹里右键「在终端中打开」，执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\push-to-github.ps1 -RepoUrl "https://github.com/你的账号/仓库名.git"
```

3. 第一次推公开/私有仓库时浏览器会弹一次 GitHub 登录，登录完就自动推上去了。
   看到 `已推送成功` 就说明代码全在仓库里了，接着去 Railway 部署。

如果提示 `git 未安装`，先装 Git：<https://git-scm.com/download/win>，装完重开终端再跑一遍。

如果提示用户名/邮箱未配置，脚本会自动给当前仓库写入一个占位身份，不影响推送。
