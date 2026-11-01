import type { ColorName } from '../art/palette';

/** 说话人：名字、名字条颜色、头像、说话音的音高（打字时的小音效按它变调） */
export interface Speaker {
  name: string;
  color: ColorName;
  /** 头像框里的底色 */
  bg: ColorName;
  /** 头像帧名前缀（portrait/<id>_<表情>）；旁白没有头像 */
  portrait: string | null;
  voice: number;
}

export const SPEAKERS: Record<string, Speaker> = {
  xiaoman: { name: '小满', color: 'red1', bg: 'sky', portrait: 'xiaoman', voice: 1.3 },
  huihui: { name: '回回', color: 'ochre', bg: 'cream', portrait: 'huihui', voice: 1.75 },
  haishen: { name: '海婶', color: 'sea', bg: 'sand3', portrait: 'haishen', voice: 0.95 },
  adou: { name: '阿豆', color: 'leaf1', bg: 'leaf3', portrait: 'adou', voice: 1.55 },
  bailu: { name: '白露', color: 'teal', bg: 'cloud', portrait: 'bailu', voice: 1.12 },
  grandpa: { name: '钟爷爷', color: 'bark', bg: 'sand3', portrait: 'grandpa', voice: 0.78 },
  shuangjiang: { name: '霜降', color: 'violet', bg: 'mist', portrait: 'shuangjiang', voice: 0.62 },
  daishu: { name: '大暑', color: 'orange', bg: 'sand3', portrait: 'daishu', voice: 0.85 },
  narrator: { name: '', color: 'night', bg: 'night', portrait: null, voice: 1 },
};

export function speakerNames(): string[] {
  return Object.values(SPEAKERS).map((s) => s.name);
}
