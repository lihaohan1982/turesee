import { AppraisalRecord } from '../types';

// Mock鉴定结果（后续替换为真实API）
export const appraiseItem = async (base64Image: string, mimeType: string): Promise<Omit<AppraisalRecord, 'id' | 'date' | 'imageUrl'>> => {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 1800));

  return {
    title: '清代青花瓷瓶',
    conclusion: '符合正品特征',
    model: '清代中期青花釉里红梅瓶',
    estimatedValue: '¥45,000 - ¥65,000',
    description: '器型周正，胎质细腻，青花发色纯正，纹饰精细流畅，品相完整。',
    keyPoints: [
      '器型符合清代中期制瓷特征',
      '青花发色纯正，无晕散',
      '胎釉结合紧密，釉面温润',
      '纹饰绘制精细，笔力遒劲',
    ],
  };
};

export const generateResponse = async (prompt: string, imageBase64?: string): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return '我是 TureSee AI 助手，专注于物品真伪鉴定。请上传您想要鉴定的图片，我会为您提供专业分析。';
};
