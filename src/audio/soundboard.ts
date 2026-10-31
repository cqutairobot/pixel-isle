import { audio } from './engine';
import { JINGLES, SONGS } from './music/scores';
import { SFX, SFX_IDS, type SfxId } from './sfx';
import '../ui/dom/ui.css';

/**
 * 试听板：先是音乐（逐首播放、停止），然后列出所有音效槽位与候选，点击试听、选定，导出选择结果。
 * 打开方式：#soundboard
 */
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
  // —— 音乐 ——
  const music = document.createElement('div');
  music.style.cssText =
    'display:grid;grid-template-columns:repeat(2, 1fr);gap:8px 12px;font-size:24px;line-height:28px;margin-bottom:20px';
  const mh = document.createElement('div');
  mh.textContent = '音乐（第一次点击要等一两秒合成）';
  mh.style.cssText = 'grid-column:1 / -1;color:#86ccff;border-bottom:2px solid #44506e';
  music.appendChild(mh);
  const btnStyle =
    'font:inherit;border:0;padding:4px 8px;cursor:pointer;box-shadow:0 0 0 2px #1a1c2c';
  const songButtons: HTMLButtonElement[] = [];
  const paintSongs = (on: string | null) =>
    songButtons.forEach((b) => {
      const active = b.dataset.id === on;
      b.style.background = active ? '#ffc93c' : '#44506e';
      b.style.color = active ? '#1a1c2c' : '#dfe7f2';
    });
  for (const [id, sc] of Object.entries(SONGS)) {
    const b = document.createElement('button');
    b.dataset.id = id;
    b.textContent = `▶ ${sc.title}`;
    b.style.cssText = btnStyle;
    b.onclick = () => {
      audio.unlock();
      const on = audio.music.player?.playing === id;
      audio.music.play(on ? null : id, 0.4);
      paintSongs(on ? null : id);
    };
    songButtons.push(b);
    music.appendChild(b);
  }
  for (const [id, sc] of Object.entries(JINGLES)) {
    const b = document.createElement('button');
    b.textContent = `♪ ${sc.title}`;
    b.style.cssText = btnStyle + ';background:#2b2f4f;color:#dfe7f2';
    b.onclick = () => {
      audio.unlock();
      audio.music.jingle(id, 'duck');
    };
    music.appendChild(b);
  }
  for (const id of ['sea', 'wind'] as const) {
    const b = document.createElement('button');
    b.textContent = id === 'sea' ? '≈ 环境声：海浪' : '≈ 环境声：风';
    b.style.cssText = btnStyle + ';background:#2b2f4f;color:#dfe7f2';
    b.onclick = () => {
      audio.unlock();
      audio.music.ambience(b.dataset.on ? null : id);
      b.dataset.on = b.dataset.on ? '' : '1';
    };
    music.appendChild(b);
  }
  paintSongs(null);
  root.appendChild(music);

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
  let group = '';
  for (const id of SFX_IDS) {
    if (SFX[id].group !== group) {
      group = SFX[id].group;
      const h = document.createElement('div');
      h.textContent = group;
      h.style.cssText =
        'grid-column:1 / -1;color:#86ccff;margin-top:12px;border-bottom:2px solid #44506e';
      table.appendChild(h);
    }
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
    // 候选不足 3 个时补空格，保持表格对齐
    for (let k = SFX[id].candidates.length; k < 3; k++)
      table.appendChild(document.createElement('div'));
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
  back.href = '#';
  back.onclick = (e) => {
    e.preventDefault();
    history.length > 1 ? history.back() : (location.hash = '');
  };
  back.textContent = '← 返回游戏';
  back.style.cssText = 'display:block;margin-top:16px;color:#86ccff;font-size:24px';
  root.appendChild(back);
}
