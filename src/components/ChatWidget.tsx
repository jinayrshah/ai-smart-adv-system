import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Minus, Maximize2, Minimize2, RotateCcw, Image as ImageIcon, Loader2, User, Bot, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { generateChatResponse } from '../services/ragService';
import { agricultureService } from '../services/aiService';
import { askAdvisory, askSchemeAdvisory } from '../lib/api/advisory';

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

const CHAT_WIDGET_STORAGE_KEY = 'chat_widget_messages_store';

const defaultGreeting: Message = {
  id: '1',
  role: 'bot',
  content: "Hello! I'm your Smart Agriculture Assistant. How can I help you today? You can ask about crops, diseases, weather, or even upload a photo of a plant for diagnosis.",
  timestamp: new Date()
};

export const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = sessionStorage.getItem(CHAT_WIDGET_STORAGE_KEY) || localStorage.getItem(CHAT_WIDGET_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: any) => ({
            ...m,
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
          }));
        }
      }
    } catch {}
    return [defaultGreeting];
  });

  // Sync messages to storage
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_WIDGET_STORAGE_KEY, JSON.stringify(messages));
      localStorage.setItem(CHAT_WIDGET_STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  const handleClearChat = () => {
    setMessages([defaultGreeting]);
    try {
      sessionStorage.removeItem(CHAT_WIDGET_STORAGE_KEY);
      localStorage.removeItem(CHAT_WIDGET_STORAGE_KEY);
    } catch {}
  };

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

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setIsMinimized(false);
    };
    window.addEventListener('open-general-chat', handleOpen);
    return () => window.removeEventListener('open-general-chat', handleOpen);
  }, []);

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
    if (isLoading || (!text.trim() && !imageFile)) return;

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
        
        if (result.result === "Detection Error") {
          botResponse = `⚠️ **Could Not Diagnose Leaf**\n\n${result.recommendations.join('\n')}\n\n*Tip:* Please take a close-up photo of the affected plant leaf in good daylight and try again, or consult your local KVK.`;
        } else if (result.result === "Low Confidence Detection") {
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
        const isSchemeQuery = /scheme|yojana|pm-?kisan|kcc|kisan credit|subsidy|subsidies|pmfby|fasal bima|soil health card|aif|pkvy|welfare|grant/i.test(text);

        if (isSchemeQuery) {
          try {
            const schemeResp = await askSchemeAdvisory({ query: text, language: 'en' });
            if (schemeResp?.answer) {
              botResponse = schemeResp.answer;
              if (schemeResp.sources && schemeResp.sources.length > 0) {
                botResponse += `\n\n**Official Sources & Portals:**\n` + schemeResp.sources.map(s => `- ${s.title}${s.url ? ` ([Portal](${s.url}))` : ''}`).join('\n');
              }
            }
          } catch (schemeErr) {
            console.warn('Scheme advisory ask failed, falling through to general advisory:', schemeErr);
          }
        }

        if (!botResponse) {
          try {
            let farmId: number | undefined = undefined;
            let crop: string | undefined = undefined;
            try {
              const saved = localStorage.getItem('farmer_onboarding_profile');
              if (saved) {
                const parsed = JSON.parse(saved);
                const fid = Number(parsed?.farm?.id);
                if (Number.isInteger(fid) && fid > 0) farmId = fid;
                const rawCrop = parsed?.crops?.[0]?.crop;
                if (rawCrop && typeof rawCrop === 'string' && rawCrop.trim()) {
                  crop = rawCrop.trim();
                }
              }
            } catch {}

            let askResp;
            try {
              askResp = await askAdvisory({
                query: text,
                farm_id: farmId,
                crop: crop,
                language: 'en',
              });
            } catch (err: any) {
              // If failed with crop-specific validation, retry as general query without crop parameter
              if (crop) {
                askResp = await askAdvisory({
                  query: text,
                  farm_id: farmId,
                  language: 'en',
                });
              } else {
                throw err;
              }
            }

            if (askResp?.response) {
              botResponse = askResp.response;
              if (askResp.sources && askResp.sources.length > 0) {
                botResponse += `\n\n**Sources:**\n` + askResp.sources.map(s => `- ${s.title}${s.page ? ` (p. ${s.page})` : ''}`).join('\n');
              }
            }
          } catch (apiErr) {
            console.warn('FastAPI advisory chat failed, using fallback:', apiErr);
            try {
              const history = messages.slice(-10).map(m => ({ 
                role: m.role === 'bot' ? 'model' : 'user', 
                content: m.content 
              }));
              const fullQuery = location ? `${text} (User location: ${location})` : text;
              botResponse = await generateChatResponse(fullQuery, history);
            } catch (fbErr) {
              console.error('Fallback chat generation error:', fbErr);
              botResponse = "I am currently experiencing high demand. Please try asking again in a moment or consult your local Krishi Vigyan Kendra (KVK).";
            }
          }
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
    <div className={cn(
      "fixed bottom-6 right-6 z-50 flex flex-col items-end transition-all duration-300",
      isMaximized && !isMinimized ? "max-w-[calc(100vw-2rem)]" : "max-w-md"
    )}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              height: isMinimized ? '64px' : (isMaximized ? 'min(760px, 85vh)' : '520px'),
              width: isMinimized ? '340px' : (isMaximized ? 'min(860px, 92vw)' : '380px')
            }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={cn(
              "bg-white border border-[#c3cda7] rounded-3xl shadow-2xl overflow-hidden flex flex-col mb-4 transition-all duration-300",
              isMaximized && !isMinimized ? "shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)]" : "shadow-2xl"
            )}
          >
            {/* Header */}
            <div className="p-4 bg-[#f1efdf] border-b border-[#c3cda7] flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 bg-[#07503f] text-[#e8fe85] rounded-full flex items-center justify-center shadow-xs">
                  <Bot size={17} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-sm text-[#07503f]">Farmer Assistant</h3>
                  <div className="flex items-center space-x-1.5">
                    <div className="w-1.5 h-1.5 bg-[#07503f] rounded-full animate-pulse" />
                    <span className="text-[9px] font-mono text-[#07503f] font-semibold uppercase tracking-wider">Active Agro AI</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                {messages.length > 1 && !isMinimized && (
                  <button 
                    type="button"
                    onClick={handleClearChat}
                    className="p-1.5 text-[#555e4a] hover:text-[#b42318] hover:bg-[#fee4e2] rounded-full transition-colors cursor-pointer"
                    title="Clear conversation"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 text-[#555e4a] hover:text-[#212529] hover:bg-[#e6ecd5] rounded-full transition-colors cursor-pointer"
                  title={isMinimized ? "Expand" : "Minimize"}
                >
                  <Minus size={15} />
                </button>
                {!isMinimized && (
                  <button 
                    type="button"
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="p-1.5 text-[#555e4a] hover:text-[#212529] hover:bg-[#e6ecd5] rounded-full transition-colors cursor-pointer"
                    title={isMaximized ? "Restore size" : "Maximize window"}
                  >
                    {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsMaximized(false);
                  }}
                  className="p-1.5 text-[#555e4a] hover:text-[#212529] hover:bg-[#e6ecd5] rounded-full transition-colors cursor-pointer"
                  title="Close"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin text-xs bg-white">
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
                          msg.role === 'user' ? "bg-[#07503f] text-[#e8fe85]" : "bg-[#e6ecd5] border border-[#c3cda7] text-[#07503f]"
                        )}>
                          {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                        </div>
                        <div className={cn(
                          "p-3 rounded-2xl text-xs shadow-xs",
                          msg.role === 'user' 
                            ? "bg-[#07503f] text-[#f1efdf] rounded-tr-none" 
                            : "bg-[#f1efdf] text-[#212529] border border-[#c3cda7] rounded-tl-none"
                        )}>
                          {msg.image && (
                            <img src={msg.image} alt="Uploaded" className="max-w-full rounded-xl mb-2 border border-[#c3cda7]" referrerPolicy="no-referrer" />
                          )}
                          <div className={cn(
                            "prose prose-xs max-w-none leading-relaxed",
                            msg.role === 'user' ? "prose-invert text-[#f1efdf]" : "text-[#212529]"
                          )}>
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                          <div className={cn(
                            "text-[9px] font-mono mt-1 opacity-75",
                            msg.role === 'user' ? "text-right text-[#e8fe85]" : "text-left text-[#555e4a]"
                          )}>
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {messages.length === 1 && !isLoading && (
                    <div className="pt-1 pl-9 space-y-1.5">
                      <p className="text-[10px] font-mono text-[#555e4a] font-semibold uppercase tracking-wider">Suggested Inquiries:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          "What fertilizer schedule should I follow for wheat?",
                          "How do I apply for PM-KISAN ₹6,000 benefit?",
                          "How to get a Kisan Credit Card (KCC) loan?",
                          "How to treat yellow rust and pest damage?",
                          "What are the best irrigation practices for my soil?"
                        ].map((promptText, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSend(promptText);
                            }}
                            className="text-[11px] bg-[#f1efdf] hover:bg-[#e6ecd5] text-[#07503f] border border-[#c3cda7] rounded-full px-3 py-1 text-left transition-colors cursor-pointer shadow-2xs"
                          >
                            {promptText}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="flex space-x-2">
                        <div className="w-7 h-7 rounded-full bg-[#e6ecd5] border border-[#c3cda7] flex items-center justify-center flex-shrink-0">
                          <Bot size={13} className="text-[#07503f]" />
                        </div>
                        <div className="bg-[#f1efdf] p-3 rounded-2xl rounded-tl-none border border-[#c3cda7] flex items-center space-x-2">
                          <Loader2 size={13} className="animate-spin text-[#07503f]" />
                          <span className="text-xs font-mono text-[#555e4a]">Synthesizing agronomic advice...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-3.5 border-t border-[#c3cda7] bg-[#f1efdf]">
                  {location && (
                    <div className="flex items-center space-x-1.5 mb-2 px-1">
                      <MapPin size={10} className="text-[#07503f]" />
                      <span className="text-[9px] font-mono text-[#555e4a] uppercase tracking-wider font-semibold">Region: {location}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-[#555e4a] hover:text-[#07503f] hover:bg-[#e6ecd5] rounded-full transition-colors cursor-pointer"
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
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSend();
                          }
                        }}
                        placeholder="Ask anything about farming & crops..."
                        className="w-full bg-white border border-[#c3cda7] rounded-full py-2 px-4 text-xs font-mono text-[#212529] placeholder:text-[#555e4a]/60 focus:outline-none focus:border-[#07503f] transition-colors shadow-2xs"
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSend();
                      }}
                      disabled={isLoading || !input.trim()}
                      className="p-2.5 bg-[#07503f] hover:bg-[#064234] text-[#e8fe85] rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer shadow-sm"
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
          "w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 border cursor-pointer",
          isOpen 
            ? "bg-[#07503f] text-[#e8fe85] border-[#07503f] rotate-90" 
            : "bg-[#07503f] text-[#e8fe85] border-[#e8fe85]/40 shadow-lg"
        )}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </motion.button>
    </div>
  );
};
