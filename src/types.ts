export interface AppraisalRecord {
  id: string;
  title: string;
  date: string;
  estimatedValue: string;
  description: string;
  imageUrl: string;
  conclusion: string;
  model: string;
  keyPoints: string[];
}

export type ViewState = 'home' | 'history' | 'chat';
