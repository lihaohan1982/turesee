import React, { useState, useEffect, useRef } from 'react';
import { Menu, Settings, Search, ChevronLeft, Image as ImageIcon, Send, Plus, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'motion/react';
import { AppraisalRecord, ViewState } from './types';
import { appraiseItem } from './lib/gemini';
import { cn } from '@/lib/utils';

const INITIAL_HISTORY: AppraisalRecord[] = [
  {
    id: '1',
    title: '劳力士 潜航者型 16610',
    date: '2023年10月26日',
    estimatedValue: '¥85,000 - ¥95,000',
    description: '品相极佳，含原装盒证。',
    imageUrl: 'https://picsum.photos/seed/rolex/200/200',
    conclusion: '符合正品特征',
    model: '劳力士 潜航者型',
    keyPoints: ['表盘刻度对齐', '机芯刻度清晰']
  },
  {
    id: '2',
    title: '爱马仕 Birkin 30 (黑色)',
    date: '2023年10月25日',
    estimatedValue: '¥160,000 - ¥180,000',
    description: '五金有轻微磨损。',
    imageUrl: 'https://picsum.photos/seed/birkin/200/200',
    conclusion: '符合正品特征',
    model: '爱马仕 Birkin 30',
    keyPoints: ['缝线均匀', '皮质纹理自然']
  },
  {
    id: '3',
    title: '1959 Gibson Les Paul Standard',
    date: '2023年10月24日',
    estimatedValue: '¥1,800,000 - ¥2,200,000',
    description: '罕见成色，极具收藏价值。',
    imageUrl: 'https://picsum.photos/seed/gibson/200/200',
    conclusion: '符合正品特征',
    model: 'Gibson Les Paul',
    keyPoints: ['木材纹理真实', '配件原装']
  }
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  appraisal?: AppraisalRecord;
}

export default function App() {
  const [view, setView] = useState<ViewState>('home');
  const [history, setHistory] = useState<AppraisalRecord[]>(INITIAL_HISTORY);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [inputText, setInputText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    if (view !== 'chat') setView('chat');

    // Simple auto-reply for now
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '我是见真 TureSee AI 助手。请上传您想要鉴定的物品图片，我会为您提供专业的鉴定服务。'
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 600);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setView('chat');

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: '请帮我见真一下这件宝贝',
        imageUrl: base64
      };
      setMessages(prev => [...prev, userMessage]);

      try {
        const result = await appraiseItem(base64, file.type);
        const newRecord: AppraisalRecord = {
          id: Date.now().toString(),
          title: result.title,
          date: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
          estimatedValue: result.estimatedValue,
          description: result.description,
          imageUrl: base64,
          conclusion: result.conclusion,
          model: result.model,
          keyPoints: result.keyPoints
        };
        setHistory(prev => [newRecord, ...prev]);
        
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '鉴定完成，以下是详细报告：',
          appraisal: newRecord
        };
        setMessages(prev => [...prev, aiMessage]);
      } catch (error) {
        console.error(error);
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '抱歉，鉴定过程中出现了错误，请稍后再试。'
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const startNewChat = () => {
    setMessages([]);
    setView('home');
  };

  const viewRecord = (record: AppraisalRecord) => {
    const recordMessage: Message = {
      id: record.id,
      role: 'assistant',
      content: '这是之前的鉴定记录：',
      appraisal: record
    };
    setMessages([recordMessage]);
    setView('chat');
  };

  return (
    <div className="flex flex-col h-screen bg-[#FDFDFD] text-[#1A1A1A] font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 border-r-0">
              <div className="flex flex-col h-full bg-white">
                <div className="p-6 flex flex-col gap-8">
                  <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold tracking-tight">TureSee</h1>
                  </div>
                  
                  <Button 
                    onClick={startNewChat}
                    className="w-full bg-black text-white hover:bg-black/90 rounded-2xl py-6 text-lg font-medium"
                  >
                    <Plus className="mr-2 w-5 h-5" /> 新对话
                  </Button>

                  <div className="flex flex-col gap-4">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">最近对话</h3>
                    <div className="flex flex-col gap-2">
                      {history.slice(0, 5).map(record => (
                        <Button
                          key={record.id}
                          variant="ghost"
                          className="justify-start text-base font-medium h-auto py-3 px-0 hover:bg-transparent hover:text-black/70"
                          onClick={() => {
                            viewRecord(record);
                          }}
                        >
                          {record.title}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-auto p-6 border-t border-gray-100 flex items-center justify-between">
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Settings className="w-6 h-6 text-gray-500" />
                  </Button>
                  <span className="text-xs text-gray-400 font-mono">v1.0.2</span>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          
          {view === 'history' ? (
            <h2 className="text-xl font-bold">历史记录</h2>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">TureSee</h1>
              <Badge variant="secondary" className="bg-gray-100 text-gray-500 font-normal text-[10px] px-2 py-0">多模态 · 视觉</Badge>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {view === 'history' ? (
            <Button variant="ghost" size="icon" className="rounded-full">
              <Search className="w-6 h-6" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setView('history')}>
                <History className="w-6 h-6" />
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Settings className="w-6 h-6" />
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-full flex flex-col items-center justify-center p-8 text-center gap-6"
            >
              <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mb-4">
                <svg viewBox="0 0 24 24" className="w-10 h-10 text-white fill-current">
                  <path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">和 TureSee 开始对话</h2>
                <p className="text-gray-400">上传图片或直接输入文字</p>
              </div>
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <ScrollArea className="h-full">
                <div className="p-4 flex flex-col gap-6">
                  {history.map((record) => (
                    <div 
                      key={record.id} 
                      className="flex gap-4 cursor-pointer group"
                      onClick={() => viewRecord(record)}
                    >
                      <div className="w-24 h-24 rounded-xl overflow-hidden border border-gray-100 flex-shrink-0">
                        <img src={record.imageUrl} alt={record.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1 flex flex-col justify-center gap-1">
                        <h3 className="text-lg font-bold group-hover:text-black/70 transition-colors">{record.title}</h3>
                        <p className="text-sm text-gray-400">{record.date}</p>
                        <p className="text-sm font-medium mt-1">
                          预估价值：<span className="font-bold">{record.estimatedValue}</span>。{record.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </motion.div>
          )}

          {view === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col"
            >
              <ScrollArea className="flex-1">
                <div className="p-4 flex flex-col gap-6 max-w-2xl mx-auto">
                  {messages.map((msg) => (
                    <div key={msg.id} className={cn(
                      "flex flex-col gap-4",
                      msg.role === 'user' ? "items-end" : "items-start"
                    )}>
                      <div className={cn(
                        "p-4 rounded-3xl max-w-[90%]",
                        msg.role === 'user' ? "bg-black text-white" : "bg-[#F3F3F3] text-black"
                      )}>
                        {msg.imageUrl && (
                          <div className="w-32 h-32 rounded-xl overflow-hidden mb-3 border border-gray-200">
                            <img src={msg.imageUrl} alt="Uploaded" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        )}
                        <p className="text-lg">{msg.content}</p>
                      </div>

                      {msg.appraisal && (
                        <Card className="rounded-3xl border border-gray-200 shadow-none w-full">
                          <CardContent className="p-6 space-y-4">
                            <h3 className="text-2xl font-bold">鉴定详情</h3>
                            <Separator className="bg-black h-[1.5px]" />
                            <div className="space-y-3 text-lg">
                              <p><span className="font-bold">鉴定结论：</span>{msg.appraisal.conclusion}</p>
                              <p><span className="font-bold">型号：</span>{msg.appraisal.model}</p>
                              <p>
                                <span className="font-bold">关键点检查：</span>
                                {msg.appraisal.keyPoints.join('，')}
                              </p>
                              <p><span className="font-bold">预估价值：</span>{msg.appraisal.estimatedValue}</p>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ))}

                  {isAnalyzing && (
                    <div className="flex flex-col gap-4 items-start animate-pulse">
                      <div className="bg-[#F3F3F3] p-4 rounded-3xl w-full">
                        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-white border-t border-gray-100">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleImageUpload}
          />
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full bg-black text-white hover:bg-black/90 w-12 h-12 flex-shrink-0"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="w-6 h-6" />
          </Button>
          
          <div className="flex-1 relative">
            <Input 
              placeholder="输入文字..." 
              className="rounded-full bg-[#F3F3F3] border-none h-12 px-6 text-lg focus-visible:ring-1 focus-visible:ring-black/10"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage();
                }
              }}
            />
          </div>

          <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
              "rounded-full w-12 h-12 flex-shrink-0 transition-colors",
              inputText.trim() ? "bg-black text-white" : "bg-gray-100 text-gray-300"
            )}
            disabled={!inputText.trim()}
            onClick={handleSendMessage}
          >
            <Send className="w-6 h-6" />
          </Button>
        </div>
      </footer>
    </div>
  );
}

