import type { Score } from './sequencer';

/**
 * 第一章的乐曲（docs/levels/1-1.md §7）。记谱法见 sequencer.ts：音名:长度（16 分音符为 1）。
 * 每条音轨按小节写成数组，一小节 16 步。
 */

/** 和弦 → [伴奏和弦, 低音型（根音、五度的切分）, 马林巴琶音] */
const CH: Record<string, [string, string, string]> = {
  C: ['C4+E4+G4', 'C3:3 C3:3 G2:2 C3:4 G2:4', 'C4:2 E4:2 G4:2 C5:2 G4:2 E4:2 C4:2 E4:2'],
  Am: ['A3+C4+E4', 'A2:3 A2:3 E3:2 A2:4 E3:4', 'A4:2 C5:2 E5:2 A5:2 E5:2 C5:2 A4:2 C5:2'],
  F: ['A3+C4+F4', 'F2:3 F2:3 C3:2 F2:4 C3:4', 'F4:2 A4:2 C5:2 F5:2 C5:2 A4:2 F4:2 A4:2'],
  G: ['B3+D4+G4', 'G2:3 G2:3 D3:2 G2:4 D3:4', 'G4:2 B4:2 D5:2 G5:2 D5:2 B4:2 G4:2 B4:2'],
  Em: ['B3+E4+G4', 'E2:3 E2:3 B2:2 E2:4 B2:4', 'E4:2 G4:2 B4:2 E5:2 B4:2 G4:2 E4:2 G4:2'],
  Dm: ['A3+D4+F4', 'D3:3 D3:3 A2:2 D3:4 A2:4', 'D4:2 F4:2 A4:2 D5:2 A4:2 F4:2 D4:2 F4:2'],
  E7: ['G#3+D4+E4', 'E2:3 E2:3 B2:2 E2:4 G#2:4', 'E4:2 G#4:2 B4:2 D5:2 B4:2 G#4:2 E4:2 G#4:2'],
};

/** 反拍的伴奏（"嚓"在每拍的后半拍） */
function skank(a: string, b = a): string {
  const x = CH[a]![0];
  const y = CH[b]![0];
  return `r:2 ${x}:2 r:2 ${x}:2 r:2 ${y}:2 r:2 ${y}:2`;
}

const bars = (n: number, s: string) => Array.from({ length: n }, () => s);

// —— 1-1「晨光沙滩」：C 大调，128 BPM，A A B A'（32 小节）——

const A_PROG = ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm/G', 'C'];
const B_PROG = ['F', 'G', 'Em', 'Am', 'Dm', 'G', 'E7', 'G'];
const PROG = [...A_PROG, ...A_PROG, ...B_PROG, ...A_PROG];

const MEL_A = [
  'G4:2 C5:2 E5:3 G5:3 E5:2 C5:4',
  'A4:2 C5:2 E5:3 A5:3 G5:2 E5:4',
  'F5:3 E5:3 D5:2 C5:2 A4:2 C5:4',
  'D5:3 E5:3 D5:2 B4:4 r:4',
  'G4:2 C5:2 E5:3 G5:3 A5:2 G5:4',
  'E5:2 G5:2 A5:3 C6:3 B5:2 A5:4',
  'F5:3 E5:3 D5:2 G5:3 F5:3 D5:2',
  'C5:6 r:2 G4:2 A4:2 B4:2 r:2',
];
const MEL_A2 = [...MEL_A.slice(0, 7), 'C5:4 G4:2 C5:2 E5:4 G5:4'];
const MEL_B = [
  'A5:6 G5:2 F5:4 C5:4',
  'B5:6 A5:2 G5:4 D5:4',
  'G5:4 E5:4 B4:4 E5:4',
  'A5:6 G5:2 E5:8',
  'F5:4 A5:4 D6:6 C6:2',
  'B5:4 G5:4 D5:6 E5:2',
  'G#5:6 E5:2 B4:4 D5:4',
  'G5:4 F5:4 E5:2 D5:2 B4:2 G4:2',
];
const MEL_A3 = [...MEL_A.slice(0, 6), 'F5:2 A5:2 G5:2 F5:2 E5:2 D5:2 B4:2 D5:2', MEL_A[7]!];

function bassOf(c: string): string {
  if (c === 'Dm/G') return 'D3:3 D3:3 A2:2 G2:4 D3:4';
  return CH[c]![1];
}
function compOf(c: string): string {
  return c === 'Dm/G' ? skank('Dm', 'G') : skank(c);
}

export const BEACH: Score = {
  id: 'beach',
  title: '1-1「晨光沙滩」',
  bpm: 128,
  bars: 32,
  loop: true,
  gain: 0.9,
  tracks: [
    {
      inst: 'steel',
      vol: 0.55,
      pan: 0.1,
      echo: 0.22,
      notes: [...MEL_A, ...MEL_A2, ...MEL_B, ...MEL_A3],
    },
    { inst: 'tri', vol: 0.5, notes: PROG.map(bassOf), gate: 0.8 },
    { inst: 'pulse25', vol: 0.11, pan: -0.35, notes: PROG.map(compOf), gate: 0.45 },
    {
      inst: 'marimba',
      vol: 0.3,
      pan: 0.35,
      notes: [...bars(16, 'r:16'), ...B_PROG.map((c) => CH[c]![2]), ...bars(8, 'r:16')],
    },
    { inst: 'kick', vol: 0.5, notes: bars(32, 'k:6 k:2 k:8') },
    { inst: 'clap', vol: 0.2, pan: -0.1, notes: bars(32, 'r:4 c:8 c:4') },
    { inst: 'hat', vol: 0.11, pan: 0.25, notes: bars(32, 'h:2 h:2 h:2 h:2 h:2 h:2 h:2 h:2') },
    {
      inst: 'shaker',
      vol: 0.07,
      pan: -0.3,
      notes: [...bars(16, 'r:16'), ...bars(16, 'x x x x x x x x x x x x x x x x')],
    },
  ],
};

// —— 太阳果变奏：主旋律提速 + 十六分音符琶音，8 小节 ——

const ARP: Record<string, string> = {
  C: 'C5:1 E5:1 G5:1 C6:1',
  Am: 'A4:1 C5:1 E5:1 A5:1',
  F: 'F4:1 A4:1 C5:1 F5:1',
  G: 'G4:1 B4:1 D5:1 G5:1',
  Dm: 'D5:1 F5:1 A5:1 D6:1',
};
function arpOf(c: string): string {
  if (c === 'Dm/G') return `${ARP.Dm} ${ARP.Dm} ${ARP.G} ${ARP.G}`;
  const a = ARP[c]!;
  return `${a} ${a} ${a} ${a}`;
}

export const SUN: Score = {
  id: 'sun',
  title: '太阳果！',
  bpm: 152,
  bars: 8,
  loop: true,
  gain: 0.85,
  tracks: [
    { inst: 'pulse25', vol: 0.3, pan: 0.1, notes: MEL_A, echo: 0.15 },
    { inst: 'steel', vol: 0.35, pan: -0.1, notes: MEL_A },
    { inst: 'pulse12', vol: 0.12, pan: 0.4, notes: A_PROG.map(arpOf), gate: 0.6 },
    { inst: 'tri', vol: 0.5, notes: A_PROG.map(bassOf), gate: 0.75 },
    { inst: 'kick', vol: 0.5, notes: bars(8, 'k:4 k:4 k:4 k:4') },
    { inst: 'clap', vol: 0.2, notes: bars(8, 'r:4 c:8 c:4') },
    { inst: 'hat', vol: 0.09, pan: 0.25, notes: bars(8, 'h h h h h h h h h h h h h h h h') },
  ],
};

// —— 标题曲「四时铃」：F 大调，92 BPM，16 小节，铃声为主 ——

const T_PROG: Array<[string, string, string]> = [
  // [垫音和弦, 低音, 琶音]
  ['F3+A3+C4', 'F2:8 C3:8', 'F4:2 A4:2 C5:2 A4:2 F4:2 A4:2 C5:2 A4:2'],
  ['E3+G3+C4', 'E2:8 C3:8', 'E4:2 G4:2 C5:2 G4:2 E4:2 G4:2 C5:2 G4:2'],
  ['D3+F3+A3', 'D2:8 A2:8', 'D4:2 F4:2 A4:2 F4:2 D4:2 F4:2 A4:2 F4:2'],
  ['D3+F3+Bb3', 'Bb1:8 F2:8', 'D4:2 F4:2 Bb4:2 F4:2 D4:2 F4:2 Bb4:2 F4:2'],
  ['F3+A3+C4', 'F2:8 C3:8', 'F4:2 A4:2 C5:2 A4:2 F4:2 A4:2 C5:2 A4:2'],
  ['E3+G3+C4', 'C2:8 G2:8', 'E4:2 G4:2 C5:2 G4:2 E4:2 G4:2 C5:2 G4:2'],
  ['D3+F3+Bb3', 'Bb1:8 F2:8', 'D4:2 F4:2 Bb4:2 F4:2 D4:2 F4:2 Bb4:2 F4:2'],
  ['E3+G3+C4', 'C2:8 G2:8', 'E4:2 G4:2 C5:2 G4:2 E4:2 G4:2 C5:2 G4:2'],
  ['D3+F3+A3', 'D2:8 A2:8', 'D4:2 F4:2 A4:2 F4:2 D4:2 F4:2 A4:2 F4:2'],
  ['D3+F3+Bb3', 'Bb1:8 F2:8', 'D4:2 F4:2 Bb4:2 F4:2 D4:2 F4:2 Bb4:2 F4:2'],
  ['F3+A3+C4', 'F2:8 C3:8', 'F4:2 A4:2 C5:2 A4:2 F4:2 A4:2 C5:2 A4:2'],
  ['E3+G3+C4', 'C2:8 G2:8', 'E4:2 G4:2 C5:2 G4:2 E4:2 G4:2 C5:2 G4:2'],
  ['D3+G3+Bb3', 'G2:8 D3:8', 'D4:2 G4:2 Bb4:2 G4:2 D4:2 G4:2 Bb4:2 G4:2'],
  ['D3+F3+Bb3', 'Bb1:8 F2:8', 'D4:2 F4:2 Bb4:2 F4:2 D4:2 F4:2 Bb4:2 F4:2'],
  ['E3+G3+C4', 'C2:8 G2:8', 'E4:2 G4:2 C5:2 G4:2 E4:2 G4:2 C5:2 G4:2'],
  ['E3+G3+Bb3', 'C2:8 G2:8', 'E4:2 G4:2 Bb4:2 G4:2 E4:2 G4:2 Bb4:2 G4:2'],
];

export const TITLE: Score = {
  id: 'title',
  title: '标题曲「四时铃」',
  bpm: 92,
  bars: 16,
  loop: true,
  gain: 0.9,
  tracks: [
    {
      inst: 'bell',
      vol: 0.62,
      pan: 0.1,
      echo: 0.3,
      notes: [
        'A5:4 C6:4 A5:4 F5:4',
        'G5:6 E5:2 C5:8',
        'F5:4 A5:4 D6:4 C6:4',
        'Bb5:6 A5:2 F5:8',
        'A5:4 C6:4 F6:4 E6:4',
        'D6:4 C6:4 G5:8',
        'Bb5:4 D6:4 C6:4 Bb5:4',
        'A5:4 G5:4 C6:8',
        'D6:8 C6:4 A5:4',
        'Bb5:8 A5:4 F5:4',
        'C6:6 A5:2 F5:8',
        'G5:8 E5:8',
        'G5:4 Bb5:4 D6:4 Bb5:4',
        'D6:6 C6:2 Bb5:8',
        'C6:4 E6:4 G6:4 E6:4',
        'C6:12 r:4',
      ],
    },
    { inst: 'pad', vol: 0.32, pan: -0.2, notes: T_PROG.map(([c]) => `${c}:16`) },
    { inst: 'tri', vol: 0.42, notes: T_PROG.map(([, b]) => b), gate: 0.85 },
    { inst: 'marimba', vol: 0.22, pan: 0.3, notes: T_PROG.map(([, , a]) => a) },
    {
      inst: 'shaker',
      vol: 0.05,
      pan: -0.3,
      notes: [...bars(8, 'r:16'), ...bars(8, 'x:2 x:2 x:2 x:2 x:2 x:2 x:2 x:2')],
    },
  ],
};

// —— 序章「霜夜」：D 小调，72 BPM，8 小节，稀疏的铃声和低音 ——

export const NIGHT: Score = {
  id: 'night',
  title: '序章「霜夜」',
  bpm: 72,
  bars: 8,
  loop: true,
  gain: 0.9,
  tracks: [
    {
      inst: 'bell',
      vol: 0.55,
      pan: 0.15,
      echo: 0.45,
      notes: [
        'D5:8 r:4 F5:4',
        'E5:8 D5:4 r:4',
        'Bb4:8 r:4 D5:4',
        'C#5:12 r:4',
        'A5:8 G5:4 F5:4',
        'E5:8 D5:4 F5:4',
        'G5:4 F5:4 E5:4 C#5:4',
        'D5:16',
      ],
    },
    {
      inst: 'pad',
      vol: 0.38,
      pan: -0.15,
      notes: [
        'D3+F3+A3:16',
        'D3+F3+Bb3:16',
        'D3+G3+Bb3:16',
        'C#3+E3+A3:16',
        'D3+F3+A3:16',
        'D3+F3+Bb3:16',
        'D3+G3+Bb3:8 C#3+E3+A3:8',
        'D3+F3+A3:16',
      ],
    },
    {
      inst: 'tri',
      vol: 0.4,
      notes: ['D2:16', 'Bb1:16', 'G1:16', 'A1:16', 'D2:16', 'Bb1:16', 'G1:8 A1:8', 'D2:16'],
    },
    // 钟楼里的钟摆声
    { inst: 'hat', vol: 0.045, pan: 0.4, notes: bars(8, 'h:4 h:4 h:4 h:4') },
  ],
};

// —— 乐句（不循环）——

export const JINGLES: Record<string, Score> = {
  clear: {
    id: 'clear',
    title: '乐句：过关',
    bpm: 120,
    bars: 1.5,
    loop: false,
    gain: 0.95,
    tracks: [
      { inst: 'steel', vol: 0.6, echo: 0.2, notes: 'C5:2 E5:2 G5:2 C6:4 B5:2 C6:2 D6:2 E6:8' },
      { inst: 'pulse25', vol: 0.16, pan: -0.3, notes: 'r:4 E5:2 G5:4 G5:2 A5:2 B5:2 C6:8' },
      { inst: 'tri', vol: 0.5, notes: 'C3:4 G2:4 C3:2 E3:2 F3:4 G3:2 C3:6' },
      { inst: 'snare', vol: 0.25, notes: 'r:8 s:1 s:1 s:1 s:1 r:12' },
      { inst: 'kick', vol: 0.5, notes: 'k:4 r:4 k:4 r:4 k:8' },
      { inst: 'bell', vol: 0.35, pan: 0.3, notes: 'r:16 C6+E6+G6:8' },
    ],
  },
  death: {
    id: 'death',
    title: '乐句：倒下',
    bpm: 120,
    bars: 10 / 16,
    loop: false,
    gain: 0.9,
    tracks: [
      { inst: 'pulse50', vol: 0.28, notes: 'E5:2 D#5:2 D5:2 C#5:4' },
      { inst: 'tri', vol: 0.5, notes: 'A3:2 G#3:2 G3:2 F#3:4' },
    ],
  },
  checkpoint: {
    id: 'checkpoint',
    title: '乐句：检查点',
    bpm: 120,
    bars: 0.5,
    loop: false,
    gain: 0.85,
    tracks: [
      { inst: 'bell', vol: 0.5, echo: 0.25, notes: 'C6:2 E6:2 G6:4' },
      { inst: 'marimba', vol: 0.35, pan: 0.2, notes: 'C5:2 E5:2 G5:4' },
    ],
  },
  glass: {
    id: 'glass',
    title: '乐句：海玻璃',
    bpm: 120,
    bars: 0.75,
    loop: false,
    gain: 0.85,
    tracks: [
      { inst: 'bell', vol: 0.45, echo: 0.3, notes: 'C6:1 E6:1 G6:1 C7:1 E7:2 r:1 G6:1 C7:4' },
      { inst: 'marimba', vol: 0.3, pan: -0.2, notes: 'C5:1 E5:1 G5:1 C6:1 r:8' },
      { inst: 'pad', vol: 0.2, notes: 'C4+E4+G4:12' },
    ],
  },
};

export const SONGS: Record<string, Score> = {
  title: TITLE,
  beach: BEACH,
  sun: SUN,
  night: NIGHT,
};
