/**
 * 整关总览图：地形、海水、装饰、方块、道具、敌人、NPC、检查点、铃门，再叠上两条回放的轨迹
 * （红点：通关路线；金点：全收集路线）。整关切成三段上下排列，方便在 GitHub 上看。
 * 用法：npm run overview -- [关卡编号，默认 1-1]
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { GLASS_COLORS } from '../src/art/items';
import { skyGradient } from '../src/art/background';
import { drawBackdrop, drawBoulder, drawGate } from '../src/art/cliff';
import { allFrames } from '../src/art/sheets';
import type { RGBAImage } from '../src/art/sprite';
import { buildLevelTileset } from '../src/art/terrain';
import { waterSheet } from '../src/art/water';
import { END_STATES } from '../src/content/cutscenes/endStates';
import { LEVELS } from '../src/content/levels';
import { CHIME_LAYOUT } from '../src/sim/chimes';
import { TILE } from '../src/sim/constants';
import { T_WATER } from '../src/sim/grid';
import { MAT_CLOUD, parseLevel, themeAt } from '../src/sim/level';
import { decodeInputs, resolveHeadless, type Replay } from '../src/sim/replay';
import { cloneTuning, PRESETS } from '../src/sim/tuning';
import { World } from '../src/sim/world';
import { DECO } from '../src/view/levelView';
import { Raster } from './lib/raster';

const id = process.argv[2] ?? '1-1';
const level = parseLevel(LEVELS[id]!);
const g = level.grid;
const W = g.widthPx;
const H = g.heightPx;
const full = new Raster(W, H);
const frames = new Map(allFrames().map((f) => [f.name, f.img]));
const frame = (name: string): RGBAImage => {
  const f = frames.get(name);
  if (!f) throw new Error(`没有帧 ${name}`);
  return f;
};
/** 以 (x, y) 为锚点贴图，ox/oy 是锚点在图里的比例 */
const put = (name: string, x: number, y: number, ox = 0, oy = 1, alpha = 1, flip = false) => {
  const f = frame(name);
  full.blit(f, x - Math.round(f.w * ox), y - Math.round(f.h * oy), { alpha, flip });
};

// 天空
const sky = skyGradient(W, H, [
  ['sky', 0],
  ['cloud', 0.45],
  ['cream', 0.62],
  ['skin2', 1],
]);
full.blit(sky, 0, 0);
// 背墙（回声洞、竖井这种围起来的地方），在装饰后面
for (const e of level.entities)
  if (e.type === 'backdrop') {
    const [c, r, w, h] = e.rect;
    full.blit(drawBackdrop(w, h, e.kind, c * 31 + r), c * TILE, r * TILE);
  }
// 装饰（在瓦片后面）
const world = new World(level, cloneTuning(PRESETS.A.tuning), { autoRun: false }, 384, 216);
const fronts: Array<() => void> = [];
for (const e of level.entities) {
  if (e.type !== 'deco' || e.kind === 'footprints') continue;
  const d = DECO[e.kind];
  if (!d) continue;
  const oy = d.oy ?? 1;
  const x = e.at[0] * TILE + (d.ox !== undefined ? TILE / 2 : 0);
  const draw = () =>
    put(d.frames[0]!, x, (e.at[1] + oy) * TILE + (d.dy ?? 0), d.ox ?? 0, oy, 1, !!e.flip);
  // 前景装饰最后画（半透明），其余的画在瓦片后面
  if (d.front || e.front) fronts.push(draw);
  else draw();
}
for (const t of world.props.trees)
  put(`grove/tree_${Math.min(3, t.coconuts)}_0`, t.x, t.y, 33 / 64, 1);
for (const cp of world.checkpoints)
  put('deco/checkpoint_off', cp.col * TILE + TILE / 2, (cp.row + 1) * TILE, 6 / 22);
const goal = level.markers.find((m) => m.kind === 'goal');
if (goal) put('deco/gate_0', goal.col * TILE + TILE / 2, (goal.row + 1) * TILE, 0.5);
if (world.chimes) {
  const ch = world.chimes;
  put('deco/chime_frame', ch.x0, ch.y0, 0, 0);
  CHIME_LAYOUT.forEach((r, i) => put(`deco/chime_${i}`, ch.x0 + r.x + r.w / 2, ch.y0 + 4, 0.5, 0));
}
// 瓦片
const ts = buildLevelTileset(g, level.material, level.practice ? 'gym' : 'island');
for (let r = 0; r < g.rows; r++)
  for (let c = 0; c < g.cols; c++) {
    const t = ts.data[r]![c]!;
    if (t >= 0) full.blit(ts.tiles[t]!, c * TILE, r * TILE);
  }
// NPC、敌人、方块、道具、出生点
const NPC: Record<string, string> = {
  haishen: 'npc/haishen_idle_0',
  adou: 'npc/adou_idle_0',
  bailu: 'npc/bailu_idle_0',
  daishu: 'npc/daishu_idle_0',
  guyu: 'npc/guyu_idle_0',
  guyu_gate: 'npc/guyu_idle_0',
};
for (const n of world.npcs) if (NPC[n.id]) put(NPC[n.id]!, n.x, n.y, 0.5, 1, 1, n.facing < 0);
for (const e of world.enemies) {
  if (e.kind === 'swallow') continue;
  if (e.kind === 'gull') put('enemy/gull_0', e.body.centerX, e.body.centerY, 0.5, 0.5, 1, true);
  else if (e.kind === 'urchinHang') put('enemy/urchin_hang', e.body.centerX, e.body.y - 2, 0.5, 0);
  else if (e.kind === 'urchin') put('enemy/urchin_0', e.body.centerX, e.body.bottom, 0.5, 1);
  else
    put(
      e.kind === 'blueClaw' ? 'enemy/blue_walk_0' : 'enemy/crab_walk_0',
      e.body.centerX,
      e.body.bottom,
      0.5,
      1,
      1,
      true,
    );
}
for (const b of world.blocks.list) {
  if (b.kind === 'rock') continue;
  const name =
    b.kind === 'brick'
      ? 'block/brick'
      : b.kind === 'multi'
        ? 'block/multi_0'
        : b.kind === 'hidden'
          ? 'block/used'
          : 'block/bell_0';
  put(name, b.col * TILE, b.row * TILE, 0, 0, b.kind === 'hidden' ? 0.35 : 1);
}
for (const it of world.items.list) {
  const name =
    it.kind === 'glass'
      ? `item/glass_${GLASS_COLORS[it.glass] ?? 'aqua'}_0`
      : it.kind === 'shell'
        ? 'item/shell_0'
        : it.kind === 'bigShell'
          ? 'item/bigShell_0'
          : it.kind === 'sun'
            ? 'item/sun_0'
            : 'item/mango';
  put(name, it.body.centerX, it.body.bottom + 1, 0.5, 1);
}
put('hero/idle_0', level.spawn.x + 5, level.spawn.y + 14, 0.5, 1);
// 第 3 关：裂岩（连在一起的一整块画成一块大石头）、冻住的石门、冰晶、回声铃、咩铃、崖燕（画在触发线右边 6 格）
const rockCells = new Set(
  world.blocks.list.filter((b) => b.kind === 'rock').map((b) => `${b.col},${b.row}`),
);
const seen = new Set<string>();
for (const key of rockCells) {
  if (seen.has(key)) continue;
  const stack = [key];
  seen.add(key);
  let [c0, r0, c1, r1] = [Infinity, Infinity, -Infinity, -Infinity];
  while (stack.length) {
    const [c, r] = stack.pop()!.split(',').map(Number) as [number, number];
    [c0, r0, c1, r1] = [Math.min(c0, c), Math.min(r0, r), Math.max(c1, c), Math.max(r1, r)];
    for (const n of [`${c + 1},${r}`, `${c - 1},${r}`, `${c},${r + 1}`, `${c},${r - 1}`])
      if (rockCells.has(n) && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
  }
  full.blit(drawBoulder(c1 - c0 + 1, r1 - r0 + 1, (c0 * 7 + r0) % 5), c0 * TILE, r0 * TILE);
}
for (const gate of world.gates) {
  const cs = gate.cells.map(([c]) => c);
  const rs = gate.cells.map(([, r]) => r);
  const c0 = Math.min(...cs);
  const r0 = Math.min(...rs);
  full.blit(
    drawGate(Math.max(...cs) - c0 + 1, Math.max(...rs) - r0 + 1, !gate.open),
    c0 * TILE,
    r0 * TILE,
  );
}
if (world.crystal) {
  const r = world.crystal.rect;
  put('cliff/crystal_0', r.x + r.w / 2, r.y + r.h, 0.5, 1);
}
if (world.bell) put('cliff/bell_0', world.bell.x, world.bell.y, 0.5, 1);
if (world.goat) {
  const gb = world.goat.body;
  put('goat/idle_0', gb.centerX, gb.bottom, 0.5, 1, 1, world.goat.facing < 0);
}
for (const f of world.flocks)
  f.ids.forEach((_, i) =>
    put('enemy/swallow_0', f.rect.x + 6 * TILE + i * 20, f.ys[i]!, 0.5, 0, 1, f.from > 0),
  );
// 海水（半透明，盖在最上面）；椰林里的小溪偏绿
for (let r = 0; r < g.rows; r++)
  for (let c = 0; c < g.cols; c++) {
    if (g.get(c, r) !== T_WATER) continue;
    const surface = g.get(c, r - 1) !== T_WATER;
    const pre =
      level.material[r * g.cols + c] === MAT_CLOUD
        ? 'cloud_'
        : themeAt(level, c) === 'grove'
          ? 'stream_'
          : '';
    full.blit(waterSheet.frames[`${pre}${surface ? 'surface_0' : 'body'}`]!, c * TILE, r * TILE, {
      alpha: 0.85,
    });
  }
for (const f of fronts) f();
// 回放轨迹
const traces: Array<[string, 'red2' | 'gold']> = [
  [`tests/replays/${id}-any.json`, 'red2'],
  [`tests/replays/${id}-full.json`, 'gold'],
];
for (const [file, color] of traces) {
  let replay: Replay;
  try {
    replay = JSON.parse(readFileSync(file, 'utf8')) as Replay;
  } catch {
    continue;
  }
  const w = new World(
    parseLevel(LEVELS[id]!),
    cloneTuning(PRESETS.A.tuning),
    { autoRun: false },
    384,
    216,
  );
  let i = 0;
  for (const f of decodeInputs(replay.frames)) {
    if (w.waiting) resolveHeadless(w, END_STATES);
    w.step(f);
    if (i++ % 2 === 0 && w.respawnTimer === 0)
      full.fill(color, Math.round(w.player.body.centerX), w.player.body.bottom - 1, 1, 1);
  }
}

// 切成三段上下排列
const parts = 3;
const segW = Math.ceil(g.cols / parts) * TILE;
const gap = 8;
const out = new Raster(segW, parts * H + (parts - 1) * gap);
out.fill('ink');
for (let k = 0; k < parts; k++) {
  const img: RGBAImage = { w: W, h: H, data: full.data };
  const strip = new Raster(segW, H);
  strip.blit(img, -k * segW, 0);
  out.blit({ w: segW, h: H, data: strip.data }, 0, k * (H + gap));
}
mkdirSync('docs/levels/img', { recursive: true });
const path = `docs/levels/img/${id}.png`;
out.save(path, 1);
console.log(`${path}：${segW}×${out.h}`);
