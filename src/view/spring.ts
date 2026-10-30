/** 阻尼弹簧，用于挤压拉伸等"回弹"动效。value 围绕 target 振荡并衰减。 */
export class Spring {
  value: number;
  velocity = 0;

  constructor(
    public target = 1,
    public stiffness = 700,
    public damping = 22,
  ) {
    this.value = target;
  }

  /** 立刻设成某个值（例如落地瞬间压扁），之后自动弹回 target */
  set(v: number, velocity = 0): void {
    this.value = v;
    this.velocity = velocity;
  }

  update(dt: number): number {
    // 半隐式欧拉，分步积分保证大 dt 下也稳定
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
      this.velocity += a * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
}
