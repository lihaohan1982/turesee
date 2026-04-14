import React, { useState, useRef, useEffect } from 'react';
import { Menu, Settings, Image as ImageIcon, Send, Plus, History, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'motion/react';
import { AppraisalRecord, ViewState } from './types';
import { appraiseItem } from './lib/gemini';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrls?: string[];
  appraisal?: AppraisalRecord;
}

export default function App() {
  const [view, setView] = useState<ViewState>('home');
  const [history, setHistory] = useState<AppraisalRecord[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 页面加载时恢复未完成的鉴定状态
  useEffect(() => {
    const savedState = sessionStorage.getItem('turesee_pending');
    if (savedState) {
      try {
        const { images, messageId } = JSON.parse(savedState);
        if (images && images.length > 0) {
          // 检查消息是否已经存在，避免重复
          setMessages(prev => {
            const existingMessage = prev.find(m => m.id === messageId);
            if (existingMessage) {
              // 消息已存在，清除状态并返回原数组
              sessionStorage.removeItem('turesee_pending');
              return prev;
            }
            
            // 添加用户消息并继续鉴定
            setPendingImages(images);
            setView('chat');
            
            const userMessage: Message = {
              id: messageId,
              role: 'user',
              content: `请帮我见真一下这件宝贝（共${images.length}张图片）`,
              imageUrls: images
            };
            
            // 继续鉴定
            setTimeout(() => resumeAppraisal(images), 0);
            
            // 清除保存的状态
            sessionStorage.removeItem('turesee_pending');
            
            return [...prev, userMessage];
          });
        }
      } catch (e) {
        sessionStorage.removeItem('turesee_pending');
      }
    }
  }, []);

  // 恢复鉴定流程
  const resumeAppraisal = async (images: string[]) => {
    setIsAnalyzing(true);
    try {
      const result = await appraiseItem(images[0], 'image/jpeg');
      const newRecord: AppraisalRecord = {
        id: Date.now().toString(),
        title: result.title,
        date: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
        estimatedValue: result.estimatedValue,
        description: result.description,
        imageUrl: images[0],
        conclusion: result.conclusion,
        model: result.model,
        keyPoints: result.keyPoints
      };
      setHistory(prev => [newRecord, ...prev].slice(0, 6));

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

  // 压缩图片 - 限制尺寸和质量，避免内存溢出
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // 计算压缩后的尺寸（最大 800px）
          let { width, height } = img;
          const maxSize = 800;
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height / width) * maxSize;
              width = maxSize;
            } else {
              width = (width / height) * maxSize;
              height = maxSize;
            }
          }
          
          // 绘制压缩后的图片
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, width, height);
          
          // 输出为 base64（质量 0.7）
          const compressed = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressed);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 上传图片 - 只添加到待鉴定区域，不直接鉴定
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 最多4张
    const currentCount = pendingImages.length;
    const remainingSlots = 4 - currentCount;
    if (remainingSlots <= 0) return;

    const filesToAdd = files.slice(0, remainingSlots);

    // 读取并压缩图片
    const newImages = await Promise.all(
      filesToAdd.map(file => compressImage(file))
    );

    setPendingImages(prev => [...prev, ...newImages].slice(0, 4));
    setView('chat');

    // 清空文件输入，以便下次选择相同文件
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 移除待鉴定图片
  const removePendingImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  };

  // 发送消息/发起鉴定
  const handleSend = async () => {
    const hasImages = pendingImages.length > 0;
    const hasText = inputText.trim();

    // 如果既没图片也没文字，不发送
    if (!hasImages && !hasText) return;

    // 如果有图片，发起鉴定
    if (hasImages) {
      setIsAnalyzing(true);

      // 添加用户消息
      const msgId = Date.now().toString();
      const userMessage: Message = {
        id: msgId,
        role: 'user',
        content: hasText ? inputText : `请帮我见真一下这件宝贝（共${pendingImages.length}张图片）`,
        imageUrls: pendingImages
      };
      setMessages(prev => [...prev, userMessage]);

      const submittedImages = [...pendingImages];
      
      // 保存状态到sessionStorage，防止页面刷新丢失
      sessionStorage.setItem('turesee_pending', JSON.stringify({
        images: submittedImages,
        messageId: msgId
      }));
      
      setPendingImages([]);
      setInputText('');

      try {
        // 调用鉴定API
        const result = await appraiseItem(submittedImages[0], 'image/jpeg');
        const newRecord: AppraisalRecord = {
          id: Date.now().toString(),
          title: result.title,
          date: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
          estimatedValue: result.estimatedValue,
          description: result.description,
          imageUrl: submittedImages[0],
          conclusion: result.conclusion,
          model: result.model,
          keyPoints: result.keyPoints
        };
        // 添加新记录，最多保留6条
        setHistory(prev => [newRecord, ...prev].slice(0, 6));
        
        // 鉴定完成，清除保存的状态
        sessionStorage.removeItem('turesee_pending');

        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '鉴定完成，以下是详细报告：',
          appraisal: newRecord
        };
        setMessages(prev => [...prev, aiMessage]);
      } catch (error) {
        console.error(error);
        // 错误时也要清除保存的状态
        sessionStorage.removeItem('turesee_pending');
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '抱歉，鉴定过程中出现了错误，请稍后再试。'
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsAnalyzing(false);
      }
    } else if (hasText) {
      // 只有文字，发普通消息
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: inputText
      };
      setMessages(prev => [...prev, userMessage]);
      setInputText('');

      // 自动回复
      setTimeout(() => {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '我是见真 TureSee AI 助手。请上传您想要鉴定的物品图片，我会为您提供专业的鉴定服务。'
        };
        setMessages(prev => [...prev, aiMessage]);
      }, 600);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setPendingImages([]);
    setView('home');
    sessionStorage.removeItem('turesee_pending');
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

  // 判断发送按钮是否可用
  const canSend = pendingImages.length > 0 || inputText.trim().length > 0;

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
                      {history.slice(0, 6).map(record => (
                        <Button
                          key={record.id}
                          variant="ghost"
                          className="justify-start text-base font-medium h-auto py-3 px-0 hover:bg-transparent hover:text-black/70"
                          onClick={() => viewRecord(record)}
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
                  <span className="text-xs text-gray-400 font-mono">v1.0.6</span>
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
              <History className="w-6 h-6" />
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
                <p className="text-gray-400">上传图片，点击发送开始鉴定</p>
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
              <ScrollArea className="flex-1 h-[calc(100vh-140px)] overflow-y-auto">
                <div className="p-4 flex flex-col gap-6 max-w-2xl mx-auto min-h-full">
                  {messages.map((msg) => (
                    <div key={msg.id} className={cn(
                      "flex flex-col gap-4",
                      msg.role === 'user' ? "items-end" : "items-start"
                    )}>
                      <div className={cn(
                        "p-4 rounded-3xl max-w-[90%]",
                        msg.role === 'user' ? "bg-black text-white" : "bg-[#F3F3F3] text-black"
                      )}>
                        {msg.imageUrls && msg.imageUrls.length > 0 && (
                          <div className="flex gap-2 flex-wrap mb-3">
                            {msg.imageUrls.map((url, i) => (
                              <div key={i} className="w-20 h-20 rounded-lg overflow-hidden border border-gray-600">
                                <img src={url} alt="Uploaded" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                            ))}
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
        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          {/* 图片预览区域 */}
          {pendingImages.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {pendingImages.map((img, index) => (
                <div key={index} className="relative w-16 h-16">
                  <img
                    src={img}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg border border-gray-200"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    onClick={() => removePendingImage(index)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center hover:bg-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {/* 添加更多图片的占位框 */}
              {pendingImages.length < 4 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
                >
                  <Plus className="w-6 h-6" />
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              multiple
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
                placeholder={pendingImages.length > 0 ? "添加鉴定说明（可选）..." : "输入文字..."}
                className="rounded-full bg-[#F3F3F3] border-none h-12 px-6 text-lg focus-visible:ring-1 focus-visible:ring-black/10"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSend();
                  }
                }}
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full w-12 h-12 flex-shrink-0 transition-colors",
                canSend ? "bg-black text-white" : "bg-gray-100 text-gray-300"
              )}
              disabled={!canSend}
              onClick={handleSend}
            >
              <Send className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
