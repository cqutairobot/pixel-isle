/** sim 每一步产生的事件，表现层（粒子、震动、音效、UI）据此做反馈。坐标为游戏像素。 */
export type SimEvent =
  | { type: 'jump'; x: number; y: number; run: number }
  | { type: 'land'; x: number; y: number; vy: number; fall: number; hard: boolean }
  | { type: 'skid'; x: number; y: number; dir: number }
  | { type: 'bonk'; x: number; y: number }
  | { type: 'wallBump'; x: number; y: number; dir: number }
  | { type: 'drop'; x: number; y: number }
  | { type: 'leaveGround'; x: number; y: number }
  | { type: 'fellOut'; x: number; y: number }
  | { type: 'respawn'; x: number; y: number }
  | { type: 'cornerCorrect'; dx: number }
  | { type: 'ledgeAssist'; dy: number };

export type SimEventType = SimEvent['type'];
