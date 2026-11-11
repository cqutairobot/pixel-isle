/**
 * 用代码"画"关卡地图的小工具：比手写几百列的字符串好读、好改。
 * 先建一张 cols × rows 的空地图（全是 '.'），再一段一段往上画，最后 toChunk() 变成关卡格式。
 */
export class MapBuilder {
  readonly map: string[][];

  constructor(
    readonly cols: number,
    readonly rows: number,
  ) {
    this.map = Array.from({ length: rows }, () => new Array<string>(cols).fill('.'));
  }

  /** 在 (c, r) 放一个字符（出界的忽略） */
  put(c: number, r: number, ch: string): void {
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return;
    this.map[r]![c] = ch;
  }

  /** 填满一个矩形（含两端） */
  fill(c0: number, r0: number, c1: number, r1: number, ch: string): void {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.put(c, r, ch);
  }

  /** 一段横着的平台：第 r 行，从 c0 到 c1 */
  row(r: number, c0: number, c1: number, ch: string): void {
    this.fill(c0, r, c1, r, ch);
  }

  get(c: number, r: number): string {
    return this.map[r]?.[c] ?? '.';
  }

  toChunk(): string {
    return this.map.map((r) => r.join('')).join('\n');
  }
}
