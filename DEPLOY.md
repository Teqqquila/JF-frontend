# Jellyfin 部署完整指南

## 1. 安装系统依赖（一次装齐）

这一步特别重要，避免 `ffmpeg` 缺失导致 Jellyfin 启动失败。

```bash
sudo apt update
sudo apt install -y wget git curl ffmpeg build-essential
```

验证：

```bash
ffmpeg -version | head -1
```

---

## 2. 安装 .NET SDK

**注意：** Jellyfin 仓库中的 `global.json` 会指定 .NET 版本（目前通常是 10.0）。版本不匹配会直接报错退出。

```bash
cd ~

wget https://dot.net/v1/dotnet-install.sh
chmod +x dotnet-install.sh

# 安装 .NET 10（根据实际需求调整版本）
./dotnet-install.sh --channel 10.0
```

添加到 PATH：

```bash
echo 'export DOTNET_ROOT=$HOME/.dotnet' >> ~/.bashrc
echo 'export PATH=$DOTNET_ROOT:$DOTNET_ROOT/tools:$PATH' >> ~/.bashrc
source ~/.bashrc
```

验证（必须显示 10.x.x）：

```bash
dotnet --version
```

如果之后 `global.json` 要求其他版本（例如 11.0）：

```bash
./dotnet-install.sh --channel 11.0
```

---

## 3. 安装 Node.js

**注意：** `jellyfin-web@10.12.0` 要求 **Node ≥ 24**。低版本会在 `npm ci` 时出现 `EBADENGINE` 错误。

```bash
# 使用 NodeSource 安装 Node 24
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
```

验证：

```bash
node --version   # 应为 v24.x.x
npm --version    # 应为 11.x
```

如果之前装错版本：

```bash
sudo apt remove -y nodejs
```

然后重新安装 Node 24。

---

## 4. 克隆并构建前端

```bash
cd ~

git clone https://github.com/Teqqquila/JF-frontend.git jellyfin-web
cd jellyfin-web

# 安装依赖
npm ci

# 构建 production 版本（约 5–10 分钟）
npm run build:production
```

验证：

```bash
ls dist/index.html
```

### 常见坑

* `npm ci` 出现 deprecated warning：正常现象，不影响构建
* 构建长时间无输出：正常（webpack 压缩中），不要中断
* 可用 `top` 查看 node 是否在占用 CPU

如果修改源码后重新构建：

```bash
rm -rf dist
rm -rf node_modules/.cache
npm run build:production
```

否则可能使用旧缓存导致构建结果未更新。

---

## 5. 克隆并启动后端

```bash
cd ~

git clone https://github.com/jellyfin/jellyfin.git
cd jellyfin
```

检查 .NET 版本要求：

```bash
cat global.json
```

### 启动后端

运行：

```bash
cd ~/jellyfin

dotnet run --project Jellyfin.Server -- -w /home/cc/jellyfin-web/dist
```

首次启动会下载 NuGet 依赖，需要几分钟。

当看到以下日志表示启动成功：

```
[INF] [1] Main: Startup complete
[INF] [1] Microsoft.Hosting.Lifetime: Now listening on: http://[::]:8096
```

---

## 完成

现在可以在浏览器访问：

```
http://<服务器IP>:8096
```

开始使用 Jellyfin 🎬
