/** 同上：在线试玩页里 lil-gui 也从 CDN 以全局变量 `lil` 加载 */
export default (window as unknown as { lil: { GUI: typeof import('lil-gui').default } }).lil.GUI;
