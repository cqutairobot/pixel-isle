import { compose, grid, type PixelGrid, type Sheet } from './sprite';

/** 3×5 像素数字，用在牌子上 */
const DIGITS: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '..#', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
};

// 牌子：木桩 + 奶油色牌面（16×16，底边中心为原点）
const SIGN = grid(`
  ................
  ...oooooooooo...
  ...occcccccco...
  ...occcccccco...
  ...occcccccco...
  ...occcccccco...
  ...occcccccco...
  ...occcccccco...
  ...oHHHHHHHHo...
  ...oooooooooo...
  ......obbo......
  ......obbo......
  ......obbo......
  ......obbo......
  .....obbbbo.....
  .....oooooo.....
`);

function signWith(glyph: string[]): PixelGrid {
  const g = glyph.map((r) => r.replaceAll('#', 'k'));
  return compose(16, 16, [
    [SIGN, 0, 0],
    [g, 6, 3],
  ]);
}

const ARROW_LEFT = ['..k..', '.k...', 'kkkkk', '.k...', '..k..'];

const frames: Record<string, PixelGrid> = {};
for (const [d, glyph] of Object.entries(DIGITS)) frames[`sign_${d}`] = signWith(glyph);
frames.arrow_left = compose(16, 16, [
  [SIGN, 0, 0],
  [ARROW_LEFT, 5, 3],
]);

export const propSheet: Sheet = {
  key: 'prop',
  w: 16,
  h: 16,
  keys: { o: 'ink', c: 'cream', H: 'sand2', b: 'bark', k: 'night' },
  frames,
};
