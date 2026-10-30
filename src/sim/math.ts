export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

/** 让 v 朝 target 移动最多 delta */
export function approach(v: number, target: number, delta: number): number {
  return v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
}

export interface SpringRef {
  v: number;
}

/** 临界阻尼平滑（Unity SmoothDamp 的同款近似），smoothTime 约等于到位时间。 */
export function smoothDamp(
  current: number,
  target: number,
  ref: SpringRef,
  smoothTime: number,
  dt: number,
): number {
  const st = Math.max(0.0001, smoothTime);
  const omega = 2 / st;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (ref.v + omega * change) * dt;
  ref.v = (ref.v - omega * temp) * exp;
  let out = target + (change + temp) * exp;
  // 防止越过目标
  if (target - current > 0 === out > target) {
    out = target;
    ref.v = 0;
  }
  return out;
}
