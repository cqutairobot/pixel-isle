/** 创伤值屏幕震动：偏移 = 最大偏移 × 创伤值²，只平移不旋转。见 PLAN.md §6.6 */
export class Shake {
  trauma = 0;
  /** 设置里的强度：0 关、0.5 弱、1 标准 */
  intensity = 1;
  maxOffset = 6;
  decay = 1.6;
  private time = 0;
  x = 0;
  y = 0;

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt: number): void {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - this.decay * dt);
    const amt = this.maxOffset * this.intensity * this.trauma * this.trauma;
    this.x = amt * noise(this.time * 22, 1);
    this.y = amt * noise(this.time * 22, 2);
  }
}

function noise(t: number, seed: number): number {
  return (
    Math.sin(t * 1.7 + seed * 13.1) * 0.5 +
    Math.sin(t * 2.9 + seed * 7.3) * 0.3 +
    Math.sin(t * 5.3 + seed * 3.7) * 0.2
  );
}
