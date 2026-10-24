#!/usr/bin/env bun
/** 生成可部署的静态目录 dist/：只包含游戏运行所需的文件，并注入构建版本号。 */

import { copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const dist = join(root, 'dist');
const version = process.env.BUILD_VERSION || Date.now().toString(36);

const SITE_FILES = [
  'index.html',
  'styles.css',
  'icon.svg',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png',
  'manifest.webmanifest',
  'sw.js',
];
const JS_MODULES = ['main', 'game', 'renderer', 'levels', 'combat', 'items', 'save', 'camera', 'audio'];
const VERSIONED = ['styles.css', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'js/main.js'];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const name of SITE_FILES) {
  await copyFile(join(root, name), join(dist, name));
}
await cp(join(root, 'js'), join(dist, 'js'), { recursive: true });
await copyFile(join(root, 'deploy/server.js'), join(dist, 'server.js'));

// ES 模块内部的相对 import 也要带版本串，否则 SW 预缓存的是带版本 URL，
// 页面却去请求不带版本的模块，离线时会缓存未命中。
for (const name of JS_MODULES) {
  let js = await readFile(join(dist, 'js', `${name}.js`), 'utf8');
  for (const dep of JS_MODULES) {
    js = js.replaceAll(`'./${dep}.js'`, `'./${dep}.js?v=${version}'`);
    js = js.replaceAll(`"./${dep}.js"`, `"./${dep}.js?v=${version}"`);
  }
  await writeFile(join(dist, 'js', `${name}.js`), js);
}

// HTML 里的入口资源带版本查询串；HTML 本身由源站设为 no-cache，因此每次发布都会拉新资源。
let html = await readFile(join(dist, 'index.html'), 'utf8');
for (const asset of VERSIONED) {
  html = html.replaceAll(`./${asset}"`, `./${asset}?v=${version}"`);
}
await writeFile(join(dist, 'index.html'), html);

// Service Worker：换缓存名，并把预缓存 URL 对齐到 HTML 里的版本查询串，避免离线缓存命中不到。
let sw = await readFile(join(dist, 'sw.js'), 'utf8');
sw = sw.replace(/const VERSION = '[^']+';/, `const VERSION = 'soldier-rush-${version}';`);
for (const asset of [...VERSIONED, ...JS_MODULES.map((name) => `js/${name}.js`)]) {
  sw = sw.replaceAll(`'./${asset}'`, `'./${asset}?v=${version}'`);
}
await writeFile(join(dist, 'sw.js'), sw);

console.log(`构建完成：dist/（版本 ${version}，${SITE_FILES.length + 1} 个文件 + js/ 目录）`);
