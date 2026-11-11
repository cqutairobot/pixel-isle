import { BAG_MAX, remember, type BagItem, type SaveData } from '../platform/save';
import type { OutfitId } from './outfits';

/**
 * 大暑的冰沙摊（docs/levels/1-3.md §5）：货品、价格、上限和买东西的规则（纯逻辑）。
 * 价格先按计划定，试玩后再调。大暑的台词在 src/content/dialog/shop.ts。
 */

export type ShopItemId = 'coconut' | 'conch' | 'fabric_blue' | 'fabric_lime' | 'fabric_dusk';

interface ShopItemBase {
  id: ShopItemId;
  /** 货架上的名字 */
  name: string;
  /** 价格（贝壳） */
  price: number;
  /** 图标（贴图集里的帧名） */
  icon: string;
}

/** 背包道具：最多带 BAG_MAX 个，进关时自动使用 */
export interface BagShopItem extends ShopItemBase {
  kind: 'bag';
  bag: BagItem;
}

/** 布料：买一次，解锁一套换色 */
export interface FabricShopItem extends ShopItemBase {
  kind: 'fabric';
  outfit: Exclude<OutfitId, 'default'>;
}

export type ShopItem = BagShopItem | FabricShopItem;

export const SHOP_ITEMS: readonly ShopItem[] = [
  { id: 'coconut', name: '椰子水', price: 20, icon: 'shop/coconut', kind: 'bag', bag: 'coconut' },
  { id: 'conch', name: '护身海螺', price: 15, icon: 'shop/conch', kind: 'bag', bag: 'conch' },
  {
    id: 'fabric_blue',
    name: '布料「海盐蓝」',
    price: 40,
    icon: 'shop/fabric_blue',
    kind: 'fabric',
    outfit: 'blue',
  },
  {
    id: 'fabric_lime',
    name: '布料「青柠绿」',
    price: 60,
    icon: 'shop/fabric_lime',
    kind: 'fabric',
    outfit: 'lime',
  },
  {
    id: 'fabric_dusk',
    name: '布料「晚霞紫」',
    price: 80,
    icon: 'shop/fabric_dusk',
    kind: 'fabric',
    outfit: 'dusk',
  },
];

export function shopItem(id: ShopItemId): ShopItem {
  return SHOP_ITEMS.find((i) => i.id === id)!;
}

/**
 * 买下的结果：ok 买到了；poor 贝壳不够；max 背包里已经有了（到上限）；owned 这块布料已经买过。
 */
export type BuyResult = 'ok' | 'poor' | 'max' | 'owned';

/** 持有数：背包道具是个数，布料是 0 或 1 */
export function ownedCount(save: SaveData, item: ShopItem): number {
  return item.kind === 'bag' ? save.bag[item.bag] : save.outfits.includes(item.outfit) ? 1 : 0;
}

/** 现在买会怎样（不改存档） */
export function buyCheck(save: SaveData, item: ShopItem): BuyResult {
  if (item.kind === 'bag' && save.bag[item.bag] >= BAG_MAX) return 'max';
  if (item.kind === 'fabric' && save.outfits.includes(item.outfit)) return 'owned';
  if (save.shells < item.price) return 'poor';
  return 'ok';
}

/** 买下：扣贝壳，背包道具加一个，布料解锁一套换色（不自动换上） */
export function buy(save: SaveData, id: ShopItemId): BuyResult {
  const item = shopItem(id);
  const result = buyCheck(save, item);
  if (result !== 'ok') return result;
  save.shells -= item.price;
  if (item.kind === 'bag') save.bag[item.bag] += 1;
  else remember(save.outfits, item.outfit);
  return result;
}
