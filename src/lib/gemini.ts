import { AppraisalRecord } from '../types';

const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/responses';
const API_KEY = 'ark-5c02fd95-7502-49ba-8c45-2c0f71c2883f-b815a';
const MODEL = 'doubao-seed-2-0-lite-260215';

export const appraiseItem = async (base64Image: string, mimeType: string): Promise<Omit<AppraisalRecord, 'id' | 'date' | 'imageUrl'>> => {
  try {
    // 确保base64格式正确
    let cleanBase64 = base64Image;
    if (base64Image.includes(',')) {
      cleanBase64 = base64Image.split(',')[1];
    }
    const imageDataUri = `data:${mimeType};base64,${cleanBase64}`;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_image',
                image_url: imageDataUri
              },
              {
                type: 'input_text',
                text: `你是"见真 TureSee"AI鉴真助手，专注于鉴定物品真伪。请分析用户上传的图片，返回JSON格式的鉴定结果。

输出格式要求（严格JSON）：
{
  "title": "物品名称",
  "conclusion": "鉴定结论（真/假/无法确定）",
  "model": "详细型号/年代描述",
  "estimatedValue": "参考价值范围",
  "description": "物品特征描述",
  "keyPoints": ["关键鉴定点1", "关键鉴定点2", ...]
}

注意：
- 如果无法确定，给出"无法确定"结论并说明原因
- estimatedValue可以是"无参考市场价值"或具体金额
- 返回纯JSON，不要任何其他文字`
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // 从 Responses API 的 output 中提取文本
    let content = '';
    if (data.output) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const c of item.content) {
            if (c.type === 'output_text') {
              content = c.text;
              break;
            }
          }
        }
        if (content) break;
      }
    }

    // 尝试解析JSON
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      // 如果不是标准JSON，尝试提取
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        result = JSON.parse(match[0]);
      } else {
        throw new Error('Failed to parse response: ' + content.substring(0, 200));
      }
    }

    return {
      title: result.title || '鉴定物品',
      conclusion: result.conclusion || '无法确定',
      model: result.model || '',
      estimatedValue: result.estimatedValue || '',
      description: result.description || '',
      keyPoints: result.keyPoints || []
    };
  } catch (error) {
    console.error('Appraisal error:', error);
    throw error;
  }
};

export const generateResponse = async (prompt: string, imageBase64?: string): Promise<string> => {
  if (imageBase64) {
    const result = await appraiseItem(imageBase64, 'image/jpeg');
    return `
【${result.title}】

【鉴定结论】
${result.conclusion}

【型号/年代】
${result.model}

${result.description ? `【物品描述】
${result.description}` : ''}

${result.keyPoints.length > 0 ? `【鉴定要点】
${result.keyPoints.map(p => `• ${p}`).join('\n')}` : ''}

${result.estimatedValue ? `【参考价值】
${result.estimatedValue}` : ''}

---
本结果由AI生成，仅供参考。`;
  }

  // 无图片时的对话
  return '请上传要鉴定的图片，我会为您分析。';
};
