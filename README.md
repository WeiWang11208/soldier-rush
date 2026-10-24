# 小兵冲冲冲 · Soldier Rush

一款为手机浏览器设计的 **H5 合兵冲锋小游戏**：拖动转向、穿过倍数门、合兵成军，一路打到最终 BOSS。纯 Canvas 绘制，没有外部图片/字体依赖，离线也能玩。

- 线上地址：<https://game.20020103.xyz/>
- 代码仓库：<https://github.com/WeiWang11208/soldier-rush>

## 玩法

- **左右拖动**屏幕控制队伍横向移动；桌面端也支持 `A / D`、`← / →`。
- 冲过 **绿色门（+N / ×N）** 增加兵力，避开 **红色门（-N / ÷N）**。
- 敌军挡路时，只有 **人数严格多于对方** 才能获胜；也可以从侧面绕过去。
- 锯轮、木桶等障碍会按比例减员；护盾 / 冲刺期间免疫。
- 每关尽头是 BOSS。BOSS 血量、伤害都按进场兵力缩放，保留的人越多，星级越高：
  - ★★★ 保留 ≥ 65%
  - ★★ 保留 ≥ 35%
  - ★ 成功击破
- 通关获得金币，可购买道具、升级永久训练。进度自动保存在 `localStorage`。

## 内容

- **10 个关卡**，10 套程序化主题：青草平原、黄沙峡谷、极寒雪原、霓虹街区、熔岩深渊、星海轨道、机械工厂、幽影墓地、云端天梯、终焉王座。
- **7 种道具**：空投增援、能量护盾、磁力拾取、闪电冲锋、无人机、双倍金币、复活兵符。出征最多携带 2 个。
- **3 条永久升级线**：开局兵力、金币收益、道具持续时间。
- **倍数门**：`+N` / `-N` / `×N` / `÷N`，2 或 3 条路线。
- **动态事件**：敌军小队、锯轮/木桶、金币带、补给箱、BOSS 弹幕与激光。
- PWA：可添加到主屏幕，Service Worker 离线缓存；断网重载后仍可进入并开局。

## 本地运行

需要 [Bun](https://bun.sh/)（>= 1.1）。

```bash
bun install        # 没有第三方依赖，可跳过
bun run dev        # http://127.0.0.1:4173/
bun test           # 单元测试 + 平衡测试
bun run check      # 测试 + 静态完整性检查
bun run build      # 生成 dist/ 部署产物
```

调试模式（暴露 `window.__SR`，便于自动化测试）：

```text
http://127.0.0.1:4173/?debug=1
```

常用调试接口：

```js
__SR.start(1);          // 直接开始第 1 关
__SR.setCount(9999);    // 修改兵力
__SR.setSpeed(6);       // 加速
__SR.skipCountdown();   // 跳过倒计时
__SR.toBoss();          // 传送到 BOSS 前
__SR.finish(true);      // 直接结算
__SR.state();           // 当前界面/存档/画布状态
```

## 项目结构

```text
index.html              页面骨架、主页 / 关卡 / 准备 / 商店 / 弹窗
styles.css              移动端 UI、HUD、安全区适配
js/
  main.js               界面编排、导航、商店、结算、PWA 注册
  game.js               游戏循环、碰撞、道具、BOSS 战、输入
  renderer.js           Canvas 伪 3D 渲染、主题背景、士兵/敌人/特效
  levels.js             10 关数据、主题、金币展开
  combat.js             门运算、敌军、BOSS 模型、星级、奖励
  items.js              道具与永久升级、购买/装备/消耗
  save.js               存档清洗、读写、结算、解锁
  camera.js             透视投影与车道
  audio.js              WebAudio 合成音效
scripts/
  serve.js              本地开发静态服务器
  build.js              生成 dist/ 部署产物
  check-static.js       资源/模块/DOM/清单静态检查
tests/                  Bun 单元测试与关卡平衡测试
deploy/
  server.js             Debian 生产静态服务器（Bun）
  soldier-rush.service  本机源站 systemd 单元
  soldier-rush-tunnel.service  反向 SSH 隧道 systemd 单元
  soldier-rush.nginx.conf      personal-agent-server 反代配置
  deploy.sh             一键发布脚本
```

## 部署

生产链路（源站在 Debian 本机，不再由搬瓦工静态托管）：

```text
访客
  -> Cloudflare  game.20020103.xyz（A 记录 65.49.206.226，已代理）
  -> personal-agent-server nginx :443（通配符证书）
  -> 127.0.0.1:3473（反向 SSH 隧道）
  -> Debian 127.0.0.1:3472（Bun 静态服务，systemd）
  -> /opt/soldier-rush/current
```

本机发布目录：

```text
/opt/soldier-rush/
  bin/bun
  releases/20261025123456/   # 只包含 index.html、js/、server.js 等运行文件
  current -> releases/20261025123456
```

一键发布（会跑测试/静态检查、构建、切换软链、重启服务、更新并重载 nginx、回源校验）：

```bash
HOST=personal-agent-server bash deploy/deploy.sh
```

运维命令：

```bash
systemctl status soldier-rush.service soldier-rush-tunnel.service
curl -fsS http://127.0.0.1:3472/healthz
journalctl -u soldier-rush -n 50 --no-pager
```

域名与证书：`game.20020103.xyz` 由 Cloudflare 代理到 `65.49.206.226`；`personal-agent-server` 的 nginx 使用
`*.20020103.xyz` 通配符证书终止 TLS。域名所在 zone 默认 SSL 模式是 Flexible，因此通过一条**仅匹配
`game.20020103.xyz`** 的 Cloudflare Configuration Rule 把该主机的回源 SSL 设为 `strict`，既避免
“Flexible + 源站 80 跳 443”造成的自跳转循环，也不改动同 zone 的其它站点。

另有一条同样只匹配 `game.20020103.xyz` 的 Cloudflare Compression Rule，关闭该主机的响应压缩。Service Worker
预缓存的是 `fetch` 已解码的响应体；若缓存响应仍带 `content-encoding`，离线返回时浏览器会二次解压，导致 CSS/JS
失效。预缓存只接受未压缩响应，压缩回归时安装会失败并保留上一版缓存，不会把坏资源写进离线缓存。

旧静态目录 `/opt/soldier-rush`（在 `personal-agent-server` 上）保留作回滚，但 nginx 已不再从它读取文件。

## 设计与实现说明

- 无外部素材：所有场景、士兵、BOSS、粒子均由 Canvas 2D 绘制；音效由 WebAudio 振荡器实时合成。
- 伪 3D：`z` 轴通过 `perspective(d) = CAM_DEPTH / (CAM_DEPTH + d)` 投影到屏幕，门、敌人、金币共用同一套坐标。
- 数值与渲染分离：`levels / combat / save / items / camera` 均为纯模块，可在 Bun 中直接测试。
- 性能：DPR 上限 2；只渲染玩家前方 70 个单位内的实体；方阵最多绘制 34 人，HUD 以 10Hz 更新。
- 可访问性：按钮均有可读文本/`aria-label`，尊重 `prefers-reduced-motion`；不支持 WebAudio 时静默降级。

## 验证

```text
bun test       48 pass / 0 fail
bun run check  静态检查通过
```

浏览器自测覆盖：手机视口 390×844、主页 → 关卡 → 准备 → 商店 → 开战 → 暂停 → BOSS → 结算 → 解锁下一关、道具购买/装备/使用、刷新后存档恢复、Service Worker 断网重载后仍可开局。

## License

MIT
