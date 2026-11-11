import type { OutfitId } from '../outfits';
import type { ShopItemId } from '../shop';
import type { Line } from './line';

/**
 * 大暑的冰沙摊（docs/levels/1-3.md §5）：商店画面下方对白条里的台词。
 * 每句不超过两行（对白条一行约 26 个字）。表情：normal、laugh、sweat、joke（讲冷笑话）、awkward（冷场）。
 */

const D = (text: string, face = 'normal'): Line => ({ who: 'daishu', text, face });

export const SHOP_LINES = {
  /** 第一次进店 */
  first: D('欢迎光临——！开张第一天，冰沙、椰子水、布料，随便挑！', 'laugh'),
  /** 以后进店 */
  hello: [
    D('哟，小满！今天要来点什么？', 'laugh'),
    D('来啦来啦～冰沙管够！', 'laugh'),
    D('欢迎光临～贝壳带够了没？', 'normal'),
  ],
  /** 选中商品时的介绍 */
  items: {
    coconut: D('新鲜的椰子水！进关时喝一口，多一颗蓝心，挨打先扣它。'),
    conch: D('护身海螺。掉进坑里、水里的时候，它会吹个大泡泡把你托回来。'),
    fabric_blue: D('「海盐蓝」，像早上的海一样清爽。'),
    fabric_lime: D('「青柠绿」，看着就解暑！'),
    fabric_dusk: D('「晚霞紫」，我最喜欢的颜色……傍晚收摊的时候。'),
  } satisfies Record<ShopItemId, Line>,
  /** 买下以后讲的冷笑话（随机一句），回回接一句 */
  jokes: [
    D('为什么冰沙从来不吵架？因为它们都很"冷静"。哈哈……哈。', 'joke'),
    D('冰块最想当什么？……当"酷"哥。', 'joke'),
    D('今天的冰沙特别好吃，因为我加了一点……"冷"幽默。', 'joke'),
    D('冰沙见了雪人说："好久不见，你怎么瘦了？"', 'joke'),
    D('知道我为什么叫大暑吗？因为我一来，大家就"暑"不过来！', 'joke'),
  ],
  cold: { who: 'huihui', text: '冷、冷……', face: 'worry' } as Line,
  awkward: D('……咳，下一位！', 'awkward'),
  poor: D('贝壳不够哦～攒够了再来，冰沙给你留着。', 'sweat'),
  max: D('背包里已经有一个啦，用完再来。'),
  owned: D('这块布你已经有啦，去"换装"那一栏换上试试！'),
  boughtFabric: D('好眼光！去"换装"那一栏换上看看～', 'laugh'),
  /** 换装栏 */
  outfitHello: D('想换哪一身？选好了按确定。'),
  outfits: {
    default: D('原来的衣服最好看？也对，红帽带最显眼！'),
    blue: D('「海盐蓝」，凉快！'),
    lime: D('「青柠绿」，精神！'),
    dusk: D('「晚霞紫」，好看！'),
  } satisfies Record<OutfitId, Line>,
  locked: D('这身还没有布料呢，在"买东西"那一栏买得到。'),
  wearing: D('已经穿着啦～'),
  worn: D('换好啦！转一圈给我看看～', 'laugh'),
  bye: D('慢走～下次再来！', 'laugh'),
};

export function allShopText(): string[] {
  const lines: Line[] = [
    SHOP_LINES.first,
    ...SHOP_LINES.hello,
    ...Object.values(SHOP_LINES.items),
    ...SHOP_LINES.jokes,
    SHOP_LINES.cold,
    SHOP_LINES.awkward,
    SHOP_LINES.poor,
    SHOP_LINES.max,
    SHOP_LINES.owned,
    SHOP_LINES.boughtFabric,
    SHOP_LINES.outfitHello,
    ...Object.values(SHOP_LINES.outfits),
    SHOP_LINES.locked,
    SHOP_LINES.wearing,
    SHOP_LINES.worn,
    SHOP_LINES.bye,
  ];
  return lines.map((l) => l.text);
}
