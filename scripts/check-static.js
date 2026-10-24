#!/usr/bin/env bun
/** 静态完整性检查：资源引用、模块导入、DOM id、manifest 与 PWA 清单。 */

import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const errors = [];
const warnings = [];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function text(path) {
  return readFile(join(root, path), 'utf8');
}

const html = await text('index.html');
const css = await text('styles.css');
const manifest = JSON.parse(await text('manifest.webmanifest'));
const sw = await text('sw.js');

const required = [
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'sw.js',
  'icon.svg',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png',
  'js/main.js',
  'js/game.js',
  'js/renderer.js',
  'js/levels.js',
  'js/combat.js',
  'js/items.js',
  'js/save.js',
  'js/camera.js',
  'js/audio.js',
  'scripts/build.js',
  'deploy/server.js',
  'deploy/deploy.sh',
  'deploy/soldier-rush.nginx.conf',
  'deploy/soldier-rush.service',
  'deploy/soldier-rush-tunnel.service',
  'README.md',
];
for (const file of required) {
  if (!(await exists(join(root, file)))) errors.push(`缺少文件: ${file}`);
}

const jsFiles = (await readdir(join(root, 'js'))).filter((name) => name.endsWith('.js'));
for (const file of jsFiles) {
  const source = await text(`js/${file}`);
  const importRe = /from\s+['"](\.\/[^'"]+)['"]/g;
  for (const match of source.matchAll(importRe)) {
    const target = resolve(root, 'js', match[1]);
    if (!(await exists(target))) errors.push(`js/${file} 导入了不存在的模块: ${match[1]}`);
  }
}

// HTML 本地资源
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const url = match[1];
  if (/^(https?:|data:|#|mailto:)/.test(url)) continue;
  const path = url.replace(/^\.\//, '').split('?')[0];
  if (path && !(await exists(join(root, path)))) errors.push(`index.html 引用了不存在的资源: ${url}`);
}

// main.js 里通过 id 选择的元素必须在 HTML 中存在
const main = await text('js/main.js');
const idSelectors = new Set();
for (const match of main.matchAll(/\$\('#([A-Za-z0-9_-]+)/g)) idSelectors.add(match[1]);
for (const match of main.matchAll(/querySelectorAll?\('#([A-Za-z0-9_-]+)/g)) idSelectors.add(match[1]);
for (const id of idSelectors) {
  if (!new RegExp(`id="${id}"`).test(html)) errors.push(`main.js 引用了不存在的 DOM id: #${id}`);
}

// manifest
if (!manifest.name || !manifest.short_name) errors.push('manifest 缺少名称');
if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) errors.push('manifest 缺少图标');
for (const icon of manifest.icons || []) {
  const path = String(icon.src || '').replace(/^\.\//, '');
  if (path && !(await exists(join(root, path)))) errors.push(`manifest 图标不存在: ${icon.src}`);
}
if (manifest.display !== 'standalone') warnings.push('manifest display 不是 standalone');
if (manifest.orientation !== 'portrait') warnings.push('manifest orientation 不是 portrait');

// service worker 预缓存清单
const cacheMatch = sw.match(/const PRECACHE = \[([\s\S]*?)\];/);
if (!cacheMatch) {
  errors.push('sw.js 未找到 PRECACHE 列表');
} else {
  for (const match of cacheMatch[1].matchAll(/['"]\.\/([^'"]+)['"]/g)) {
    const path = match[1];
    if (!path.includes('*') && !(await exists(join(root, path)))) {
      errors.push(`sw.js 预缓存了不存在的文件: ${path}`);
    }
  }
}

// CSS 变量与基本括号平衡
const cssOpen = (css.match(/{/g) || []).length;
const cssClose = (css.match(/}/g) || []).length;
if (cssOpen !== cssClose) errors.push(`styles.css 花括号不平衡 (${cssOpen} / ${cssClose})`);
if (!css.includes('@media (max-width:') && !css.includes('@media (min-width:')) {
  warnings.push('styles.css 没有响应式断点');
}

// 禁止把密钥或绝对主机写进前端
for (const file of ['index.html', ...jsFiles.map((name) => `js/${name}`)]) {
  const source = await text(file);
  if (/BEGIN (RSA|OPENSSH|PRIVATE) KEY|api[_-]?token\s*[:=]\s*['"][^'"]+['"]/i.test(source)) {
    errors.push(`${file} 疑似包含密钥`);
  }
}

for (const message of warnings) console.warn(`WARN  ${message}`);
if (errors.length) {
  for (const message of errors) console.error(`ERROR ${message}`);
  console.error(`\n静态检查失败：${errors.length} 个错误`);
  process.exit(1);
}
console.log(`静态检查通过：${required.length} 个必需文件、${jsFiles.length} 个 JS 模块、${idSelectors.size} 个 DOM id。`);
