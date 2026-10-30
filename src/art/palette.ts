/**
 * 第一章调色板 v1：32 色，明暗阶梯带色相偏移（暗部偏蓝紫、亮部偏暖）。
 * 所有美术只能使用这里的颜色。见 PLAN.md §8。
 */
export const PALETTE = {
  ink: '#1a1c2c',
  night: '#2b2f4f',
  slate: '#44506e',
  stone: '#6b7a99',
  mist: '#a3b2cc',
  cloud: '#dfe7f2',
  white: '#ffffff',
  cream: '#fff4d6',
  sand3: '#f6dca0',
  sand2: '#e3b46e',
  sand1: '#b9824a',
  bark: '#7c4f35',
  skin2: '#ffd3b0',
  skin1: '#f0a888',
  blush: '#f27d8f',
  red2: '#ff5a4f',
  red1: '#c7354a',
  wine: '#7d2347',
  orange: '#ff9a3c',
  gold: '#ffc93c',
  straw: '#e8a33a',
  ochre: '#a8682c',
  leaf3: '#b6e35f',
  leaf2: '#5fbf4a',
  leaf1: '#2e8a4f',
  pine: '#1d5948',
  sky: '#86ccff',
  teal: '#2fb0b8',
  sea: '#2272a8',
  deep: '#24427a',
  frost: '#9fb8ff',
  violet: '#5d4aa8',
} as const;

export type ColorName = keyof typeof PALETTE;

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function colorInt(name: ColorName): number {
  return parseInt(PALETTE[name].slice(1), 16);
}
