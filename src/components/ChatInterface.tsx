import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Mic, SendHorizonal, User, Bot, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateResponse } from '@/lib/gemini';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  image?: string;
}

const TureSeeLogo = ({ className }: { className?: string }) => (
  <div className={cn("relative flex items-center justify-center bg-black rounded-full", className)}>
    <svg viewBox="0 0 100 100" className="w-3/5 h-3/5 text-white fill-none stroke-current stroke-[8]">
      <path d="M30 35h40M50 35v40M70 35c0 10-5 20-20 20" className="stroke-white" />
    </svg>
  </div>
);

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      image: selectedImage || undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    const response = await generateResponse(input || "请分析这张图片", userMessage.image);
    
    const botMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'bot',
      content: response || "抱歉，我无法生成回复。",
    };

    setMessages((prev) => [...prev, botMessage]);
    setIsLoading(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans text-black">
      {/* Header */}
      <header className="flex items-center justify-center h-14 border-b border-gray-100 px-4 shrink-0">
        <h1 className="text-lg font-medium tracking-tight">见真 TureSee</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {messages.length === 0 ? (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
            >
              <TureSeeLogo className="w-24 h-24 mb-6 shadow-xl" />
              <h2 className="text-3xl font-bold tracking-tighter mb-2">见真，AI鉴真</h2>
              <p className="text-gray-400 text-sm max-w-xs">
                上传图片或输入信息，让我为您识别真伪
              </p>
            </motion.div>
          ) : (
            <ScrollArea className="h-full px-4 py-6" viewportRef={scrollRef}>
              <div className="max-w-2xl mx-auto space-y-6">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex w-full gap-3",
                      msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      msg.role === 'user' ? "bg-gray-100" : "bg-black"
                    )}>
                      {msg.role === 'user' ? <User size={16} className="text-gray-600" /> : <TureSeeLogo className="w-full h-full" />}
                    </div>
                    <div className={cn(
                      "flex flex-col gap-2 max-w-[80%]",
                      msg.role === 'user' ? "items-end" : "items-start"
                    )}>
                      {msg.image && (
                        <img 
                          src={msg.image} 
                          alt="Uploaded" 
                          className="rounded-2xl max-w-full h-auto border border-gray-100 shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      {msg.content && (
                        <div className={cn(
                          "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                          msg.role === 'user' 
                            ? "bg-gray-100 text-black rounded-tr-none" 
                            : "bg-white border border-gray-100 text-black rounded-tl-none shadow-sm"
                        )}>
                          {msg.content}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-3"
                  >
                    <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                      <TureSeeLogo className="w-full h-full" />
                    </div>
                    <div className="bg-gray-50 px-4 py-2.5 rounded-2xl rounded-tl-none flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin text-gray-400" />
                      <span className="text-xs text-gray-400">正在鉴真...</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </ScrollArea>
          )}
        </AnimatePresence>
      </main>

      {/* Input Area */}
      <footer className="p-4 border-t border-gray-100 bg-white shrink-0">
        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          {selectedImage && (
            <div className="relative inline-block w-20 h-20">
              <img 
                src={selectedImage} 
                alt="Preview" 
                className="w-full h-full object-cover rounded-lg border border-gray-200"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 bg-black text-white rounded-full p-1 shadow-lg hover:bg-gray-800 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-gray-100 shrink-0"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera size={24} />
            </Button>
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
              className="rounded-full hover:bg-gray-100 shrink-0"
            >
              <Mic size={24} />
            </Button>
            <div className="flex-1 relative">
              <Input
                placeholder="向 见真 提问..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="rounded-full bg-gray-100 border-none px-6 py-6 focus-visible:ring-1 focus-visible:ring-gray-200"
              />
            </div>
            <Button
              size="icon"
              className={cn(
                "rounded-full shrink-0 transition-all duration-300",
                (input.trim() || selectedImage) ? "bg-black text-white scale-110" : "bg-gray-100 text-gray-400"
              )}
              onClick={handleSend}
              disabled={isLoading || (!input.trim() && !selectedImage)}
            >
              <SendHorizonal size={20} />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
