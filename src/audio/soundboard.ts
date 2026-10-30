import { audio } from './engine';
import { SFX, SFX_IDS, type SfxId } from './sfx';
import '../ui/dom/ui.css';

/** 试听板：列出所有音效槽位与候选，点击试听、选定，导出选择结果。打开方式：?scene=soundboard */
export function mountSoundboard(): void {
  document.body.style.overflow = 'auto';
  const root = document.createElement('div');
  root.id = 'ui-root';
  root.style.cssText =
    'position:static;--px:2px;pointer-events:auto;padding:24px;color:#fff4d6;max-width:900px;margin:0 auto;';
  document.body.appendChild(root);
  const title = document.createElement('h2');
  title.textContent = '试听板 · 点击候选试听，选中的会立即用在练习场';
  title.style.cssText = 'font-size:24px;font-weight:normal;margin:0 0 16px;color:#ffc93c';
  root.appendChild(title);
  const table = document.createElement('div');
  table.style.cssText =
    'display:grid;grid-template-columns:160px repeat(3, 1fr);gap:8px 12px;align-items:center;font-size:24px;line-height:28px';
  root.appendChild(table);
  const buttons: Record<string, HTMLButtonElement[]> = {};
  const paint = (id: SfxId) => {
    buttons[id]!.forEach((b, i) => {
      const on = audio.choices[id] === i;
      b.style.background = on ? '#ffc93c' : '#44506e';
      b.style.color = on ? '#1a1c2c' : '#dfe7f2';
      b.textContent = `${on ? '✔ ' : ''}候选 ${i + 1}`;
    });
  };
  for (const id of SFX_IDS) {
    const label = document.createElement('div');
    label.textContent = SFX[id].label;
    table.appendChild(label);
    buttons[id] = SFX[id].candidates.map((_, i) => {
      const b = document.createElement('button');
      b.style.cssText =
        'font:inherit;border:0;padding:4px 8px;cursor:pointer;box-shadow:0 0 0 2px #1a1c2c';
      b.onclick = () => {
        audio.unlock();
        audio.setChoice(id, i);
        audio.play(id, {}, i);
        paint(id);
      };
      table.appendChild(b);
      return b;
    });
    paint(id);
  }
  const exportBtn = document.createElement('button');
  exportBtn.textContent = '导出选择（复制 JSON）';
  exportBtn.style.cssText =
    'font:inherit;font-size:24px;margin-top:20px;border:0;padding:6px 12px;background:#ff5a4f;color:#fff4d6;cursor:pointer';
  const out = document.createElement('pre');
  out.style.cssText = 'font:inherit;font-size:20px;white-space:pre-wrap';
  exportBtn.onclick = () => {
    const json = JSON.stringify(audio.choices);
    out.textContent = `把这段发给 Claude：${json}`;
    void navigator.clipboard?.writeText(json);
  };
  root.appendChild(exportBtn);
  root.appendChild(out);
  const back = document.createElement('a');
  back.href = './';
  back.textContent = '← 回到练习场';
  back.style.cssText = 'display:block;margin-top:16px;color:#86ccff;font-size:24px';
  root.appendChild(back);
}
