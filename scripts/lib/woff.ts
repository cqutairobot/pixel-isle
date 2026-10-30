import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/**
 * 读 WOFF 1.0 字体里的字符表（cmap）和字宽（hmtx），给缺字检查与排版测试用。
 * 只实现用得到的部分：cmap 格式 4 和 12、head 的 unitsPerEm、hhea + hmtx 的字宽。
 */
export interface FontInfo {
  unitsPerEm: number;
  /** 码位 → 字形编号 */
  cmap: Map<number, number>;
  /** 字形的横向步进（字体单位） */
  advanceOf(glyph: number): number;
}

export function readWoff(path: string): FontInfo {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x774f4646) throw new Error(`${path} 不是 WOFF 1.0 字体`);
  const numTables = buf.readUInt16BE(12);
  const tables = new Map<string, Buffer>();
  for (let i = 0; i < numTables; i++) {
    const e = 44 + i * 20;
    const tag = buf.toString('latin1', e, e + 4);
    const offset = buf.readUInt32BE(e + 4);
    const compLength = buf.readUInt32BE(e + 8);
    const origLength = buf.readUInt32BE(e + 12);
    const raw = buf.subarray(offset, offset + compLength);
    tables.set(tag, compLength < origLength ? inflateSync(raw) : Buffer.from(raw));
  }
  const head = tables.get('head')!;
  const hhea = tables.get('hhea')!;
  const hmtx = tables.get('hmtx')!;
  const unitsPerEm = head.readUInt16BE(18);
  const numberOfHMetrics = hhea.readUInt16BE(34);
  const cmap = parseCmap(tables.get('cmap')!);
  return {
    unitsPerEm,
    cmap,
    advanceOf(glyph: number) {
      const i = Math.min(glyph, numberOfHMetrics - 1);
      return hmtx.readUInt16BE(i * 4);
    },
  };
}

function parseCmap(t: Buffer): Map<number, number> {
  const n = t.readUInt16BE(2);
  let best = -1;
  let bestFormat = 0;
  for (let i = 0; i < n; i++) {
    const pid = t.readUInt16BE(4 + i * 8);
    const eid = t.readUInt16BE(6 + i * 8);
    const off = t.readUInt32BE(8 + i * 8);
    const format = t.readUInt16BE(off);
    if (pid === 3 && eid === 10 && format === 12) {
      best = off;
      bestFormat = 12;
    } else if (pid === 3 && eid === 1 && format === 4 && bestFormat !== 12) {
      best = off;
      bestFormat = 4;
    } else if (pid === 0 && best < 0 && (format === 4 || format === 12)) {
      best = off;
      bestFormat = format;
    }
  }
  if (best < 0) throw new Error('字体里没有可用的 cmap 子表');
  const map = new Map<number, number>();
  if (bestFormat === 12) {
    const groups = t.readUInt32BE(best + 12);
    for (let g = 0; g < groups; g++) {
      const o = best + 16 + g * 12;
      const start = t.readUInt32BE(o);
      const end = t.readUInt32BE(o + 4);
      const gid = t.readUInt32BE(o + 8);
      for (let c = start; c <= end; c++) map.set(c, gid + (c - start));
    }
    return map;
  }
  const segX2 = t.readUInt16BE(best + 6);
  const seg = segX2 / 2;
  const endO = best + 14;
  const startO = endO + segX2 + 2;
  const deltaO = startO + segX2;
  const rangeO = deltaO + segX2;
  for (let s = 0; s < seg; s++) {
    const end = t.readUInt16BE(endO + s * 2);
    const start = t.readUInt16BE(startO + s * 2);
    const delta = t.readInt16BE(deltaO + s * 2);
    const ro = t.readUInt16BE(rangeO + s * 2);
    for (let c = start; c <= end && c !== 0xffff; c++) {
      let gid: number;
      if (ro === 0) gid = (c + delta) & 0xffff;
      else {
        const addr = rangeO + s * 2 + ro + (c - start) * 2;
        gid = t.readUInt16BE(addr);
        if (gid !== 0) gid = (gid + delta) & 0xffff;
      }
      if (gid !== 0) map.set(c, gid);
    }
  }
  return map;
}
