import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Minus, Maximize2, Image as ImageIcon, Loader2, User, Bot, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { generateChatResponse } from '../services/ragService';
import { agricultureService } from '../services/aiService';
import { askAdvisory } from '../lib/api/advisory';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
  image?: string;
}

export const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'bot',
      content: "Hello! I'm your Smart Agriculture Assistant. How can I help you today? You can ask about crops, diseases, weather, or even upload a photo of a plant for diagnosis.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get user location on mount
  useEffect(() => {
    const controller = new AbortController();
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${position.coords.latitude}&lon=${position.coords.longitude}&appid=${import.meta.env.VITE_WEATHER_API_KEY}`, {
              signal: controller.signal
            });
            const data = await res.json();
            if (data.name) setLocation(data.name);
          } catch (e: any) {
            if (e.name !== 'AbortError') {
              console.error("Error getting location name", e);
            }
          }
        },
        (err) => {
          if (import.meta.env.DEV) {
            console.warn("Geolocation denied", err);
          }
        }
      );
    }

    return () => controller.abort();
  }, []);

  const handleSend = async (text: string = input, imageFile?: File) => {
    if (!text.trim() && !imageFile) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
      image: imageFile ? URL.createObjectURL(imageFile) : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let botResponse = "";
      
      if (imageFile) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read image file"));
          reader.readAsDataURL(imageFile);
        });
        const base64Image = await base64Promise;
        const result = await agricultureService.detectDisease(base64Image);
        
        if (result.result === "Low Confidence Detection") {
          botResponse = `I've analyzed the image, but I'm not very certain about the results. 
          
**Observation:** ${result.result}
**Confidence:** ${(result.confidence * 100).toFixed(1)}%

**Suggestions:**
${result.recommendations.map(r => `- ${r}`).join('\n')}`;
        } else {
          botResponse = `I've analyzed the image. 
          
**Detection:** ${result.result}
**Confidence:** ${(result.confidence * 100).toFixed(1)}%

**Details & Recommendations:**
${result.recommendations.join('\n')}`;
        }
      } else {
        try {
          const askResp = await askAdvisory({
            query: text,
            language: 'en',
          });
          botResponse = askResp.response;
          if (askResp.sources && askResp.sources.length > 0) {
            botResponse += `\n\n**Sources:**\n` + askResp.sources.map(s => `- ${s.title}${s.page ? ` (p. ${s.page})` : ''}`).join('\n');
          }
        } catch (apiErr) {
          console.warn('FastAPI advisory chat failed, using fallback:', apiErr);
          const history = messages.slice(-10).map(m => ({ 
            role: m.role === 'bot' ? 'model' : 'user', 
            content: m.content 
          }));
          const fullQuery = location ? `${text} (User location: ${location})` : text;
          botResponse = await generateChatResponse(fullQuery, history);
        }
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: botResponse || "I'm sorry, I encountered an error while processing your request.",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error: any) {
      console.error("Chat error:", error);
      
      let errorMessage = "Sorry, I'm having trouble connecting to the server. Please try again later.";
      
      if (error.message?.includes("RESOURCE_EXHAUSTED")) {
        errorMessage = "I'm receiving too many requests right now. Please wait a moment and try again.";
      } else if (error.message?.includes("max tokens limit")) {
        errorMessage = "The response was too long for me to process. Could you try asking a more specific question?";
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: errorMessage,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSend("Analyzing this plant image...", file);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              height: isMinimized ? '64px' : '520px',
              width: '380px'
            }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-[#111827] border border-stone-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col mb-4"
          >
            {/* Header */}
            <div className="p-4 bg-[#07503f]/30 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 bg-[#07503f] text-[#e8fe85] border border-[#e8fe85]/30 rounded-full flex items-center justify-center shadow">
                  <Bot size={17} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-sm text-stone-100">Farmer Assistant</h3>
                  <div className="flex items-center space-x-1.5">
                    <div className="w-1.5 h-1.5 bg-[#e8fe85] rounded-full animate-pulse" />
                    <span className="text-[9px] font-mono text-[#e8fe85] uppercase tracking-wider">Active Agro AI</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-full transition-colors cursor-pointer"
                >
                  {isMinimized ? <Maximize2 size={15} /> : <Minus size={15} />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-full transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-stone-800 text-xs">
                  {messages.map((msg) => (
                    <div 
                      key={msg.id}
                      className={cn(
                        "flex w-full",
                        msg.role === 'user' ? "justify-end" : "justify-start"
                      )}
                    >
                      <div className={cn(
                        "max-w-[85%] flex space-x-2",
                        msg.role === 'user' ? "flex-row-reverse space-x-reverse" : "flex-row"
                      )}>
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                          msg.role === 'user' ? "bg-[#07503f] text-[#e8fe85]" : "bg-stone-900 border border-stone-800 text-stone-400"
                        )}>
                          {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                        </div>
                        <div className={cn(
                          "p-3 rounded-2xl text-xs",
                          msg.role === 'user' 
                            ? "bg-[#07503f] text-[#f1efdf] border border-[#e8fe85]/20 rounded-tr-none shadow" 
                            : "bg-stone-900 text-stone-200 border border-stone-800 rounded-tl-none"
                        )}>
                          {msg.image && (
                            <img src={msg.image} alt="Uploaded" className="max-w-full rounded-xl mb-2 border border-stone-700" referrerPolicy="no-referrer" />
                          )}
                          <div className="prose prose-invert prose-xs max-w-none text-stone-200 leading-relaxed">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                          <div className={cn(
                            "text-[9px] font-mono mt-1 opacity-60",
                            msg.role === 'user' ? "text-right text-[#e8fe85]/80" : "text-left text-stone-400"
                          )}>
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="flex space-x-2">
                        <div className="w-7 h-7 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center flex-shrink-0">
                          <Bot size={13} className="text-stone-400" />
                        </div>
                        <div className="bg-stone-900 p-3 rounded-2xl rounded-tl-none border border-stone-800 flex items-center space-x-2">
                          <Loader2 size={13} className="animate-spin text-[#e8fe85]" />
                          <span className="text-xs font-mono text-stone-400">Synthesizing agronomic advice...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-3.5 border-t border-stone-800 bg-[#0b0f19]">
                  {location && (
                    <div className="flex items-center space-x-1.5 mb-2 px-1">
                      <MapPin size={10} className="text-[#e8fe85]" />
                      <span className="text-[9px] font-mono text-stone-400 uppercase tracking-wider">Region: {location}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-stone-400 hover:text-[#e8fe85] hover:bg-stone-800 rounded-full transition-colors cursor-pointer"
                      title="Upload plant image"
                    >
                      <ImageIcon size={18} />
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload} 
                      className="hidden" 
                      accept="image/*"
                    />
                    <div className="flex-1 relative">
                      <input 
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask anything about farming & crops..."
                        className="w-full bg-stone-900 border border-stone-800 rounded-full py-2 px-4 text-xs font-mono text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-[#e8fe85] transition-colors"
                      />
                    </div>
                    <button 
                      onClick={() => handleSend()}
                      disabled={isLoading || !input.trim()}
                      className="p-2.5 bg-[#07503f] hover:bg-[#0c6b54] text-[#e8fe85] border border-[#e8fe85]/30 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer shadow"
                    >
                      <Send size={15} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 border cursor-pointer",
          isOpen 
            ? "bg-stone-900 text-stone-200 border-stone-700 rotate-90" 
            : "bg-[#07503f] text-[#e8fe85] border-[#e8fe85]/30 shadow-[#07503f]/50"
        )}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </motion.button>
    </div>
  );
};
