import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('src/sim 是纯逻辑', () => {
  it('不引用 Phaser，也不碰 DOM', () => {
    for (const f of files(join(__dirname, '../src/sim'))) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/from ['"]phaser['"]/);
      expect(src, f).not.toMatch(/\b(window|document)\./);
    }
  });
});
