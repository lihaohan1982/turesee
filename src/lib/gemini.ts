import { AppraisalRecord } from '../types';

const API_URL = 'https://api.newcoin.tech/v1/chat/completions';
const MODEL = 'doubao-seed-1-8-251228';

export const appraiseItem = async (base64Image: string, mimeType: string): Promise<Omit<AppraisalRecord, 'id' | 'date' | 'imageUrl'>> => {
  try {
    // 确保base64格式正确（可能已包含或未包含data URI前缀）
    let cleanBase64 = base64Image;
    if (base64Image.includes(',')) {
      cleanBase64 = base64Image.split(',')[1];
    }
    
    const imageDataUri = `data:${mimeType};base64,${cleanBase64}`;
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_API_KEY || 'sk-P8OXuQgYiv5u5hHCsV30Ls3HySxWJ7OpqCWTr1skz7Rk29Sm'}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `你是"见真 TureSee"AI鉴真助手，专注于鉴定物品真伪。请分析用户上传的图片，返回JSON格式的鉴定结果。

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
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '请鉴定这张图片中的物品，给出专业的鉴定意见。'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageDataUri
                }
              }
            ]
          }
        ],
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    
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
        throw new Error('Failed to parse response: ' + content.substring(0, 100));
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

${result.description ? `【物品描述】\n${result.description}` : ''}

${result.keyPoints.length > 0 ? `【鉴定要点】\n${result.keyPoints.map(p => `• ${p}`).join('\n')}` : ''}

${result.estimatedValue ? `【参考价值】\n${result.estimatedValue}` : ''}

---
本结果由AI生成，仅供参考。`;
  }

  // 无图片时的对话
  return '请上传要鉴定的图片，我会为您分析。';
};
