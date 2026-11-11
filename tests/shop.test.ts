import { describe, expect, it } from 'vitest';
import { hasOutfit, outfitOf, OUTFITS, wear } from '../src/content/outfits';
import { buy, buyCheck, ownedCount, SHOP_ITEMS, shopItem } from '../src/content/shop';
import { emptySave, loadSave, writeSave, type KV } from '../src/platform/save';

/** 大暑的冰沙摊：买东西、买不起、到上限、布料不重复买、换装（docs/levels/1-3.md §5） */

function rich(shells: number) {
  const s = emptySave();
  s.shells = shells;
  return s;
}

describe('冰沙摊', () => {
  it('货架：椰子水 20、护身海螺 15、三块布料 40 / 60 / 80', () => {
    expect(SHOP_ITEMS.map((i) => [i.id, i.price])).toEqual([
      ['coconut', 20],
      ['conch', 15],
      ['fabric_blue', 40],
      ['fabric_lime', 60],
      ['fabric_dusk', 80],
    ]);
  });

  it('买椰子水：扣 20 个贝壳，背包里多一瓶；再买就到上限，不扣贝壳', () => {
    const s = rich(50);
    expect(buy(s, 'coconut')).toBe('ok');
    expect(s.shells).toBe(30);
    expect(s.bag.coconut).toBe(1);
    expect(ownedCount(s, shopItem('coconut'))).toBe(1);
    expect(buy(s, 'coconut')).toBe('max');
    expect(s.shells).toBe(30);
    expect(s.bag.coconut).toBe(1);
  });

  it('贝壳不够：买不起，什么都不变；刚好够就能买', () => {
    const s = rich(14);
    expect(buyCheck(s, shopItem('conch'))).toBe('poor');
    expect(buy(s, 'conch')).toBe('poor');
    expect(s.shells).toBe(14);
    expect(s.bag.conch).toBe(0);
    s.shells = 15;
    expect(buy(s, 'conch')).toBe('ok');
    expect(s.shells).toBe(0);
  });

  it('布料：买下解锁一套换色（不自动换上），同一块不能买两次', () => {
    const s = rich(100);
    expect(buy(s, 'fabric_blue')).toBe('ok');
    expect(s.shells).toBe(60);
    expect(s.outfits).toEqual(['blue']);
    expect(s.outfit).toBe('default');
    expect(buy(s, 'fabric_blue')).toBe('owned');
    expect(s.shells).toBe(60);
    // 到上限、已买过的判断先于贝壳够不够
    s.shells = 0;
    expect(buyCheck(s, shopItem('fabric_blue'))).toBe('owned');
  });

  it('换装：原色一直能穿；没买过的布料穿不上；买过的能穿，存档读回来还在', () => {
    const s = rich(200);
    expect(wear(s, 'lime')).toBe(false);
    expect(s.outfit).toBe('default');
    buy(s, 'fabric_lime');
    expect(hasOutfit(s, 'lime')).toBe(true);
    expect(wear(s, 'lime')).toBe(true);
    expect(wear(s, 'nope')).toBe(false);
    expect(s.outfit).toBe('lime');
    const map = new Map<string, string>();
    const kv: KV = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
      removeItem: (k) => void map.delete(k),
    };
    writeSave(s, kv);
    const back = loadSave(kv);
    expect(back.outfit).toBe('lime');
    expect(back.outfits).toEqual(['lime']);
    expect(wear(back, 'default')).toBe(true);
  });

  it('服装表：原色加三套换色，各有自己的精灵表；不认识的编号当作原色', () => {
    expect(OUTFITS.map((o) => [o.id, o.sheet])).toEqual([
      ['default', 'hero'],
      ['blue', 'hero_blue'],
      ['lime', 'hero_lime'],
      ['dusk', 'hero_dusk'],
    ]);
    expect(outfitOf('???').id).toBe('default');
    // 每套布料都对应一套服装
    for (const item of SHOP_ITEMS)
      if (item.kind === 'fabric') expect(outfitOf(item.outfit).id).toBe(item.outfit);
  });
});
