param(
  [string]$RepoUrl = ""
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn2($msg){ Write-Host "    $msg" -ForegroundColor Yellow }

Write-Host "顺手捎 · 源码推送脚本" -ForegroundColor White
Write-Host "当前目录：$((Get-Location).Path)"

# 1. 检查 git
Write-Step "检查 Git"
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
  Write-Host "未找到 git。请先安装 Git for Windows：https://git-scm.com/download/win" -ForegroundColor Red
  exit 1
}
Write-Ok "git: $((& git --version))"

# 2. 检查仓库地址
if ([string]::IsNullOrWhiteSpace($RepoUrl)) {
  $RepoUrl = Read-Host "请粘贴 GitHub 空仓库地址（形如 https://github.com/账号/仓库名.git）"
}
$RepoUrl = $RepoUrl.Trim()
if ($RepoUrl -notmatch "^(https://|git@)") {
  Write-Host "仓库地址格式不对：$RepoUrl" -ForegroundColor Red
  exit 1
}
Write-Ok "目标仓库: $RepoUrl"

# 3. 初始化仓库
Write-Step "初始化本地仓库"
if (-not (Test-Path -LiteralPath ".git")) {
  & git init | Out-Null
  Write-Ok "已执行 git init"
} else {
  Write-Ok "已存在 .git，跳过初始化"
}

# 4. 身份配置（缺失时补一个占位身份，仅写入本仓库）
$name  = (& git config user.name)  2>$null
$email = (& git config user.email) 2>$null
if ([string]::IsNullOrWhiteSpace($name))  { & git config user.name "shunshou-deploy"; Write-Warn2 "未配置 user.name，已写入占位值" }
if ([string]::IsNullOrWhiteSpace($email)) { & git config user.email "deploy@example.com"; Write-Warn2 "未配置 user.email，已写入占位值" }

# 5. 提交
Write-Step "提交全部代码"
& git add -A
$staged = (& git diff --cached --name-only) | Measure-Object
Write-Ok "待提交文件数: $($staged.Count)"
if ($staged.Count -eq 0) {
  Write-Warn2 "没有新文件可提交（可能已经提交过）"
} else {
  & git commit -m "顺手捎校园代取：完整前后端源码" | Out-Null
  Write-Ok "提交完成"
}

# 6. 分支与远端
Write-Step "设置分支与远端"
& git branch -M main
$existing = (& git remote) 2>$null
if ($existing -contains "origin") {
  & git remote set-url origin $RepoUrl
  Write-Ok "已更新 origin"
} else {
  & git remote add origin $RepoUrl
  Write-Ok "已添加 origin"
}

# 7. 推送
Write-Step "推送到 GitHub（第一次可能需要浏览器登录授权）"
& git push -u origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host "推送失败。常见原因：仓库不是空的（已存在 README 或初始提交）。" -ForegroundColor Red
  Write-Host "解决办法：把仓库删掉重建一个空仓库，或让我给命令强制覆盖。" -ForegroundColor Red
  exit 1
}

Write-Host "`n已推送成功：代码全部在 $RepoUrl" -ForegroundColor Green
Write-Host "下一步：去 Railway → New Project → Deploy from GitHub repo → 选这个仓库。" -ForegroundColor Green
