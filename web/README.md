# GPT-SoVITS WebUI-NG (web)

去 Gradio 的自研前端 SPA：React 19 + Vite + TypeScript（strict）+ Tailwind CSS v4 +
shadcn/ui 风格组件 + TanStack Query + react-router + wavesurfer.js v7 + SSE。

> 仅包含前端工程，后端仍为仓库根目录的 GPT-SoVITS 服务（默认端口 `9880`）。
> 本目录不修改仓库其它文件。

## 环境要求

- Node.js >= 20.19（推荐 22）
- pnpm

在 NixOS 上可用：

```fish
nix shell nixpkgs#nodejs_22 nixpkgs#pnpm -c fish
```

## 开发

```fish
pnpm install
pnpm dev
```

- 开发服务器默认 <http://127.0.0.1:5173>
- `VITE_API_PROXY`（默认 `http://127.0.0.1:9880`）：Vite 将 `/api` 代理到后端
- 后端未就绪时，可在「设置」中开启 **演示数据（mock）**，前端使用内置类型化模拟数据

## 构建

```fish
pnpm build      # tsc --noEmit + vite build -> dist/
pnpm preview    # 预览构建产物
```

构建产物输出到 `dist/`。部署时需将 SPA 回退（history fallback）指向 `index.html`。

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `VITE_BASE_PATH` | `/` | 前端静态资源与路由 base 路径 |
| `VITE_API_PROXY` | `http://127.0.0.1:9880` | 开发代理目标 |
| `VITE_API_BASE` | （空） | 生产环境 API 前缀；空表示同源 `/api` |
| `VITE_USE_MOCK` | （空） | 设为 `1` 强制使用演示数据 |

## 目录结构

```
web/
├─ index.html
├─ vite.config.ts          # base / 别名 / dev 代理 / dist 输出
├─ tsconfig.json           # strict + noUnused* + @/* 别名
├─ src/
│  ├─ lib/
│  │  ├─ api/              # 契约类型化客户端（real / mock）+ SSE
│  │  ├─ audio/            # 流式消费、录音、WAV 编解码与裁剪
│  │  ├─ tts.ts            # 语言 / 切分 / 预设 / 默认参数
│  │  ├─ versions.ts       # 权重版本推断与配对守卫
│  │  └─ text.ts           # 文本分语段
│  ├─ store/               # theme / settings / voice / player / tasks
│  ├─ hooks/               # useApi / queries / useJobEvents
│  ├─ components/
│  │  ├─ ui/               # shadcn 风格基础组件
│  │  ├─ layout/           # TopBar / Sidebar / MiniPlayer / TaskDrawer
│  │  ├─ audio/            # 波形播放器、录音、裁剪、参考卡片
│  │  ├─ synth/            # 语段编辑、参数面板、预设、结果历史
│  │  ├─ models/           # 权重列表、配对守卫
│  │  ├─ jobs/             # 任务卡片、阶段步进器、日志查看器
│  │  └─ common/           # 状态点、空状态、版本徽标等
│  └─ pages/               # synthesize / voices / references / jobs / settings
└─ README.md
```

## 页面

- `/synthesize` 语音合成：分语段编辑、参考音频选择/上传/录制、三档参数、预设、流式播放、结果历史
- `/voices` 音色：SoVITS / GPT 权重列表、版本徽标、版本配对守卫、热切换（全局锁定/失败回滚）
- `/voices/references` 参考音频库：卡片网格、迷你波形、上传/录制、试听、裁剪
- `/jobs` 任务：阶段步进器、进度、ETA、取消、SSE 实时日志
- `/settings` 设置：语言 / 设备 / 后端端口 / 演示数据

## 离线说明

字体（`@fontsource/*`）与图标（`lucide-react`）均本地打包，**不使用任何 CDN**。
