# Jellyfin Web 部署说明

## 修改内容

在页面头部添加了 **Recommend 按钮**。

### IP / 端口在哪里改

共两处，改完需要重新 build：

**1. `src/scripts/libraryMenu.js` 第 46 行**（旧版 UI）
```js
html += '<a href="http://129.114.25.107:30089/" ...>⭐ Recommend</a>';
```

**2. `src/apps/experimental/components/AppToolbar/userViews/UserViewNav.tsx` 第 135 行**（新版 UI）
```tsx
href='http://129.114.25.107:30089/'
```

---

## 首次部署

### 1. 克隆前端（本仓库）
```bash
git clone https://github.com/Teqqquila/JF-frontend.git jellyfin-web
```

### 2. 克隆后端（官方）
```bash
git clone https://github.com/jellyfin/jellyfin.git
```

### 3. 安装前端依赖并 build
```bash
cd jellyfin-web
npm ci
npm run build:production
```

### 4. 启动 Jellyfin
```bash
cd ../jellyfin
dotnet run --project Jellyfin.Server -- -w ../jellyfin-web/dist
```

默认监听端口：`8096`

---

## 修改 IP/端口后重新 build

```bash
cd jellyfin-web
rm -rf dist
npm run build:production
```

build 完成后重启 Jellyfin 即可生效。
