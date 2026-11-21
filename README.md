# 青禾生活费管家 · 便携版

> 一款嵌入银行 APP 的学生生活费规划服务：通过用户授权的消费记录归类，把生活费按周期拆成可执行的预算层级，帮助学生在有限的生活费内养成合理的开支习惯。

**Windows 10 / 11 64 位** · 解压即用 · 无需安装 Node.js 或 .NET

---

## 快速开始

1. 克隆或下载本仓库，解压到任意目录（路径可含中文，但请勿在压缩包内直接运行）。
2. 双击 **`Start.bat`**。
3. 脚本会自动完成三件事：
   - 启动桌面圆形桌宠（屏幕右下角，始终置顶）
   - 启动本地服务（模拟银行流水 + 托管网页）
   - 打开浏览器 <http://localhost:3000>

`node.exe` 已内置于仓库，无需另外安装 Node.js；`.NET Framework 4.8` 由 Windows 10/11 系统自带。

> 仓库中包含 89 MB 的 `node.exe` 运行时，首次 `git clone` 会比较慢，这是为了保证「开箱即用」的便携性。

## 功能亮点

| 模块 | 说明 |
|---|---|
| 预算分层 | 生活费按月拆成「1–7 / 8–14 / 15–21 / 22–月末」四段周预算，逐段推进 |
| 消费归类 | 三档置信度自动归类；未分类池不参与统计与建议，批量确认不逐笔打扰 |
| 关怀式提醒 | 先总结小额消费规律（笔数、频率、均价、高频商户、深夜占比），再给温和的可选项建议 |
| 实时流水演示 | 通过 SSE 接收模拟银行流水，覆盖 2021 年入学到工作首年的四年消费演变 |
| 桌面桌宠 | 圆形小猪，置顶可拖动，单击展开卡片，滚轮切换形态，位置自动记忆 |
| 拼豆激励 | 每周不超预算即达成 +300 积分，连续达成有加成；四周拼完整张小猪解锁装饰 |
| AI 解读（可选） | 接入阿里云百炼，提供 AI 解读与 AI 猜分类，不配置也能使用全部核心功能 |

## 目录结构

```
Qinghe-LifeFee-Portable/
├── Start.bat              一键启动（推荐）
├── Stop.bat               停止本地服务与桌宠
├── node.exe               内置 Node.js 运行时（约 93 MB）
├── QinghePet.exe          桌面桌宠（C# WinForms）
├── bead-pattern.txt       拼豆图案数据（必须与 QinghePet.exe 同目录）
├── README.txt             面向最终用户的文字版说明
└── website/               网页与模拟流水服务
    ├── index.html         网页入口
    ├── style.css          主样式
    ├── float.css          浮窗样式
    ├── js/                页面逻辑、浮窗、桌宠触发挂件
    │   └── vendor/        第三方库（SheetJS，含 LICENSE）
    ├── simulator/         模拟流水服务 + 百炼 AI 代理（零依赖）
    ├── .env.example       AI Key 配置模板（可选）
    └── README.md          项目原始技术说明
```

## 技术栈

- **前端**：原生 HTML / CSS / JavaScript，无框架、无构建步骤
- **服务端**：Node.js 零依赖 HTTP 服务，SSE 推送实时流水
- **桌宠**：C# / .NET Framework WinForms，本地回环通信（`127.0.0.1:51888`）
- **导出**：SheetJS（`js/vendor/xlsx.full.min.js`，Apache-2.0）

## 可选：启用阿里云百炼 AI

便携包不包含任何 API Key。

1. 把 `website/.env.example` 复制为 `website/.env`；
2. 用记事本打开，把 `DASHSCOPE_API_KEY=` 后面换成自己的百炼 Key；
3. 重新双击 `Start.bat`。

不配置 Key 时，记账、预算、模拟流水、桌宠等核心功能均可正常使用，仅 AI 相关按钮会提示未启用。

## 数据与隐私

- 网页数据保存在浏览器 `localStorage`，不上传。
- 模拟流水由本机生成，不连接任何真实银行。
- 桌宠只监听 `127.0.0.1:51888`，设置保存在 `%LOCALAPPDATA%\QingheFloat\settings.ini`。
- API Key 只在本地服务端读取，不会进入网页。
- 服务只监听本机回环地址，不向互联网开放。

## 常见问题

- **浏览器没自动打开**：手动访问 <http://localhost:3000>（端口被占用时是 3001）。
- **桌宠没出现**：手动双击 `QinghePet.exe`；若被杀毒软件拦截请允许运行。
- **换电脑后网页挂件打不开桌宠**：先手动运行一次 `QinghePet.exe`，它会注册 `qinghefloat://` 协议。
- **端口被占用**：`Start.bat` 会自动切换到 3001，网页内把服务地址改为 `http://localhost:3001` 即可。

---

详细操作说明见 [`README.txt`](README.txt)，页面与模拟流水服务的实现细节见 [`website/README.md`](website/README.md)。
