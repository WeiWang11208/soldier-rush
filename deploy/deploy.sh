#!/usr/bin/env bash
# 发布小兵冲冲冲到本机 Debian：/opt/soldier-rush/releases/<时间戳>
# 公网链路：Cloudflare -> personal-agent-server nginx -> 反向 SSH 隧道 -> 本机 Bun
# 用法：HOST=personal-agent-server bash deploy/deploy.sh
set -euo pipefail

HOST="${HOST:-personal-agent-server}"
APP_DIR="${APP_DIR:-/opt/soldier-rush}"
TUNNEL_PORT="${TUNNEL_PORT:-3473}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date -u +%Y%m%d%H%M%S)"
RELEASE="$APP_DIR/releases/$STAMP"

cd "$ROOT"

echo "==> 运行测试、静态检查并构建 dist/"
bun test
bun run scripts/check-static.js
BUILD_VERSION="$STAMP" bun run build

echo "==> 发布到本机 $RELEASE"
sudo -n install -d -m 755 "$APP_DIR/releases" "$APP_DIR/bin"
sudo -n install -d -m 755 "$RELEASE"
sudo -n rsync -a --delete dist/ "$RELEASE/"
sudo -n chown -R root:root "$RELEASE"
sudo -n chmod -R u=rwX,go=rX "$RELEASE"

if [ ! -x "$APP_DIR/bin/bun" ]; then
  echo "==> 安装 Bun 运行时到 $APP_DIR/bin/bun"
  sudo -n install -m 755 "$(command -v bun)" "$APP_DIR/bin/bun"
fi

echo "==> 切换 current 软链"
sudo -n ln -sfn "$RELEASE" "$APP_DIR/current"

echo "==> 安装并重启 systemd 服务"
sudo -n install -m 644 deploy/soldier-rush.service /etc/systemd/system/soldier-rush.service
sudo -n install -m 644 deploy/soldier-rush-tunnel.service /etc/systemd/system/soldier-rush-tunnel.service
sudo -n systemctl daemon-reload
sudo -n systemctl enable soldier-rush.service soldier-rush-tunnel.service >/dev/null
sudo -n systemctl restart soldier-rush.service
for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 http://127.0.0.1:3472/healthz >/dev/null 2>&1; then
    break
  fi
  sleep 0.4
done
curl -fsS --max-time 2 http://127.0.0.1:3472/healthz >/dev/null
echo "    本机源站健康检查通过：http://127.0.0.1:3472/healthz"
sudo -n systemctl restart soldier-rush-tunnel.service

echo "==> 更新 $HOST 的 nginx 站点配置（仅 game.20020103.xyz）"
BACKUP="/etc/nginx/conf.d/soldier-rush.conf.bak-$STAMP"
ssh "$HOST" "if [ -f /etc/nginx/conf.d/soldier-rush.conf ]; then cp -a /etc/nginx/conf.d/soldier-rush.conf '$BACKUP'; fi"
scp -q deploy/soldier-rush.nginx.conf "$HOST:/etc/nginx/conf.d/soldier-rush.conf"
if ! ssh "$HOST" "nginx -t"; then
  echo "nginx 配置校验失败，恢复上一版配置" >&2
  ssh "$HOST" "if [ -f '$BACKUP' ]; then cp -a '$BACKUP' /etc/nginx/conf.d/soldier-rush.conf; else rm -f /etc/nginx/conf.d/soldier-rush.conf; fi"
  ssh "$HOST" "nginx -t"
  exit 1
fi
ssh "$HOST" "systemctl reload nginx"

sleep 1
echo "==> 验证公网入口"
ORIGIN_CODE="$(ssh "$HOST" "curl -ksS -o /dev/null -w '%{http_code}' --resolve game.20020103.xyz:443:127.0.0.1 https://game.20020103.xyz/")"
PUBLIC_CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 https://game.20020103.xyz/)"
echo "    server 回源 HTTPS：$ORIGIN_CODE"
echo "    公网 HTTPS：$PUBLIC_CODE"

if [ "$ORIGIN_CODE" != "200" ]; then
  echo "回源失败，查看隧道与 nginx 日志：" >&2
  ssh "$HOST" "tail -20 /var/log/nginx/soldier-rush.error.log 2>/dev/null || true" >&2
  sudo -n systemctl --no-pager --full status soldier-rush-tunnel.service >&2 || true
  exit 1
fi

if [ "$PUBLIC_CODE" != "200" ]; then
  echo "公网入口返回 $PUBLIC_CODE（检查 Cloudflare 的 SSL 模式/配置规则）" >&2
  exit 1
fi

echo "==> 完成：https://game.20020103.xyz/"
echo "    发布目录：$RELEASE"
echo "    本机源站：http://127.0.0.1:3472/"
echo "    隧道入口：$HOST:127.0.0.1:$TUNNEL_PORT"
