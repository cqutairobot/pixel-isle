import { describe, expect, it } from 'vitest';
import { gym, GYM_STATIONS } from '../src/content/levels/gym';
import { TILE } from '../src/sim/constants';
import { T_EMPTY } from '../src/sim/grid';
import { joinChunks, parseLevel, standAt } from '../src/sim/level';

describe('关卡解析', () => {
  it('各段行数不一致时报错', () => {
    expect(() => joinChunks(['..\n..', '..'])).toThrow();
  });

  it('未知字符报错并指出位置', () => {
    expect(() => parseLevel({ id: 'x', name: 'x', chunks: ['P.\n#@'] })).toThrow(/第 2 行第 2 列/);
  });

  it('没有出生点时报错', () => {
    expect(() => parseLevel({ id: 'x', name: 'x', chunks: ['..\n##'] })).toThrow(/出生点/);
  });
});

describe('练习场地图', () => {
  const level = parseLevel(gym);

  it('尺寸是 300 × 30', () => {
    expect(level.grid.cols).toBe(300);
    expect(level.grid.rows).toBe(30);
  });

  it('缝隙与台阶都有对应的数字牌', () => {
    const signs = level.markers.filter((m) => m.kind === 'sign').map((m) => m.data?.value);
    expect(signs).toEqual([2, 3, 4, 5, 6, 7, 1, 2, 3, 4, 5]);
  });

  it('站点首尾相接，传送点脚下是地面、身体所在处是空的', () => {
    GYM_STATIONS.forEach((s, i) => {
      if (i > 0) expect(s.from).toBe(GYM_STATIONS[i - 1]!.to + 1);
      const [c, r] = s.stand;
      expect(level.grid.get(c, r), s.name).toBe(T_EMPTY);
      const p = standAt(c, r);
      expect(
        level.grid.solidAt(p.x, p.y + 1, 10, 14) || level.grid.oneWayTopAt(p.x, p.y + 14, 10),
        s.name,
      ).toBe(true);
    });
    expect(GYM_STATIONS.at(-1)!.to).toBe(level.grid.cols - 1);
  });

  it('出生点站在地面上', () => {
    expect(level.grid.solidAt(level.spawn.x, level.spawn.y + 1, 10, 14)).toBe(true);
    expect(level.spawn.y + 14).toBe(26 * TILE);
  });
});
