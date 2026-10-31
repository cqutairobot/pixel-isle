/**
 * 一句对白。文字标签：{color=gold}…{/color}、{wave}…{/wave}、{shake}…{/shake}、{pause=毫秒}。
 */
export interface Line {
  /** 说话人编号（src/content/speakers.ts）；'narrator' 是旁白（居中、没有头像） */
  who: string;
  text: string;
  /** 头像表情（不写就是普通） */
  face?: string;
}
