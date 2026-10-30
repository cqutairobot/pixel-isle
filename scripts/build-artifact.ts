/**
 * 生成在线试玩页（claude.ai Artifact）要发布的文件，输出到 dist-artifact/page/：
 * - index.html：不含 <!doctype>/<html>/<head>/<body>（发布时会自动套上外壳）；
 *   CSS 内联，界面字体转成 data: URI；Phaser 与 lil-gui 从 jsDelivr 加载（版本与 package.json 一致）
 * - assets/*.js：本作自己的代码
 * - licenses/：字体许可证
 * 用法：npm run build:artifact
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const src = 'dist-artifact';
const out = join(src, 'page');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  dependencies: Record<string, string>;
};
const version = (name: string) => pkg.dependencies[name]!.replace(/^[\^~]/, '');

const html = readFileSync(join(src, 'index.html'), 'utf8');
const script = html.match(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"/)?.[1];
const cssFile = html.match(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"/)?.[1];
if (!script || !cssFile) throw new Error('dist-artifact/index.html 里找不到入口脚本或样式表');

let css = readFileSync(join(src, cssFile), 'utf8');
css = css.replace(
  /url\(\.\/([^)]+\.woff2)\)format\("woff2"\)(,url\([^)]+\)format\("woff"\))?/g,
  (_m, file: string) => {
    const b64 = readFileSync(join(src, 'assets', file)).toString('base64');
    return `url(data:font/woff2;base64,${b64})format("woff2")`;
  },
);
if (/url\(\.\//.test(css)) throw new Error('样式表里还有相对路径资源，试玩页加载不到');

const page = `<title>四时铃</title>
<style>
/* 单一深色外观：画面四周是深色信箱区 */
:root { --bg: #1a1c2c; --fg: #dfe7f2; color-scheme: dark; }
html, body { height: 100%; margin: 0; overflow: hidden; background: var(--bg); color: var(--fg); }
#game { position: fixed; inset: 0; }
#game canvas { display: block; }
${css}
</style>
<div id="game"></div>
<div id="ui"></div>
<script src="https://cdn.jsdelivr.net/npm/phaser@${version('phaser')}/dist/phaser.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/lil-gui@${version('lil-gui')}/dist/lil-gui.umd.min.js"></script>
<script type="module" src="${script}"></script>
`;
writeFileSync(join(out, 'index.html'), page);

const files: Record<string, string> = {};
for (const f of readdirSync(join(src, 'assets'))) {
  if (!f.endsWith('.js')) continue;
  copyFileSync(join(src, 'assets', f), join(out, 'assets', f));
  files[`assets/${f}`] = join(out, 'assets', f);
}
if (existsSync(join(src, 'licenses'))) {
  mkdirSync(join(out, 'licenses'), { recursive: true });
  for (const f of readdirSync(join(src, 'licenses'))) {
    copyFileSync(join(src, 'licenses', f), join(out, 'licenses', f));
    files[`licenses/${f}`] = join(out, 'licenses', f);
  }
}
console.log(`页面：${join(out, 'index.html')}（${(page.length / 1024).toFixed(0)} KB）`);
console.log('随页面发布的文件：');
console.log(JSON.stringify(files, null, 2));
