/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, Rocket, BrainCircuit, Loader2, CheckCircle2, MessageSquare } from "lucide-react";
import { db, handleFirestoreError } from "./lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { chatStream } from "./services/geminiService";
import { Message } from "./types";
import ReactMarkdown from "react-markdown";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "model", parts: [{ text: "Hello! Welcome to Roj Tech Assistant. How can I help you today?" }] }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showLeadSuccess, setShowLeadSuccess] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (overrideMsg?: string) => {
    const msgText = overrideMsg || input;
    if (!msgText.trim() || isTyping) return;

    const userMsg: Message = { role: "user", parts: [{ text: msgText }] };
    setMessages((prev) => [...prev, userMsg]);
    if (!overrideMsg) setInput("");
    setIsTyping(true);
// 🔥 Formspree ke jariye direct Gmail par data bhejne ka code
    if (overrideMsg && overrideMsg.includes("Name:")) {
      try {
        const lines = overrideMsg.split("\n");
        const name = lines.find(l => l.startsWith("Name:"))?.replace("Name:", "").trim();
        const contact = lines.find(l => l.startsWith("Contact:"))?.replace("Contact:", "").trim();
        const service = lines.find(l => l.startsWith("Service_Requested:"))?.replace("Service_Requested:", "").trim();
        const reqs = lines.find(l => l.startsWith("Requirements:"))?.replace("Requirements:", "").trim();

        await fetch("https://formspree.io/f/xkoewqld", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            Name: name || "Unknown",
            Contact: contact || "Unknown",
            Service_Requested: service || "N/A",
            Requirements: reqs || "N/A",
          }),
        });
        console.log("Data successfully sent to Formspree!");
        setLeadSubmitted(true);
      } catch (formspreeErr) {
        console.error("Formspree submission error:", formspreeErr);
      }
    }
    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: m.parts
      }));

      const stream = await chatStream(history, msgText, leadSubmitted);
      let modelText = "";
      
      setMessages(prev => [...prev, { role: "model", parts: [{ text: "" }] }]);

      for await (const chunk of stream) {
        const parts = chunk.candidates?.[0]?.content?.parts || [];
        let hasNewText = false;
        for (const part of parts) {
          if ('text' in part && part.text) {
            modelText += part.text;
            hasNewText = true;
          }
        }

        if (hasNewText) {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            return [...prev.slice(0, -1), { ...last, parts: [{ text: modelText }] }];
          });
        }

        if (chunk.functionCalls) {
          const call = chunk.functionCalls.find(c => c.name === "saveLead");
          if (call && call.args) {
            const args = call.args as any;
            try {
              console.log("Saving lead with data:", args);
              
              // 1. Firebase mein save hoga
              await addDoc(collection(db, "leads"), {
                name: args.name || "Unknown",
                email_phone: args.phone || "Unknown",
                service: args.service || "N/A",
                requirement: args.requirements || "N/A",
                timestamp: serverTimestamp(),
              });

              // 2. 🔥 Formspree ke zariye direct aapke Gmail par mail aayega
              try {
                await fetch("https://formspree.io/f/xkoewqld", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    Name: args.name || "Unknown",
                    Contact: args.phone || "Unknown",
                    Service_Requested: args.service || "N/A",
                    Requirements: args.requirements || "N/A",
                  }),
                });
                console.log("Data successfully sent to Formspree!");
              } catch (formspreeErr) {
                console.error("Formspree error:", formspreeErr);
              }

              setShowLeadSuccess(true);
              setLeadSubmitted(true);
              setTimeout(() => setShowLeadSuccess(false), 5000);
            } catch (err) {
              console.error("Firestore error saving lead:", err);
              handleFirestoreError(err, "create", "leads");
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: "model", parts: [{ text: "I'm sorry, I encountered an error. Please try again or contact us directly at +91 8393815941 or +91 9634968459." }] }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-[#fafafa] font-sans text-[#1a1a1a] overflow-hidden">
      {/* App Header */}
      <header className="flex h-12 items-center justify-between border-b border-[#e5e5e5] bg-white px-4 shadow-sm z-10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a1a1a] text-white">
            <Rocket size={15} />
          </div>
          <div>
            <h1 className="text-[13px] font-bold tracking-tight leading-none text-[#1a1a1a]">Roj Tech Assistant</h1>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[9px] font-medium text-[#666]">AI Powered by Roj Tech</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="relative flex flex-1 flex-col overflow-hidden bg-gray-50/50">
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin scrollbar-thumb-gray-200"
        >
          <div className="max-w-xl mx-auto space-y-3.5">
            {messages.map((msg, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                key={i} 
                className={cn("flex flex-col", msg.role === "user" ? "items-end" : "items-start")}
              >
                <div className={cn(
                  "max-w-[88%] rounded-2xl p-3 text-[12.5px] leading-relaxed shadow-sm transition-all",
                  msg.role === "user" 
                    ? "bg-[#1a1a1a] text-white rounded-tr-none" 
                    : "bg-white border border-[#e8e8e8] text-[#1a1a1a] rounded-tl-none"
                )}>
                  <div className="markdown-body prose prose-sm max-w-none text-inherit">
                    <ReactMarkdown>
                      {msg.parts[0].text}
                    </ReactMarkdown>
                  </div>
                </div>
                <span className="mt-1 px-1 text-[8.5px] font-medium text-[#999]">
                  {msg.role === "user" ? "You" : "Roj Tech AI"}
                </span>
              </motion.div>
            ))}
            {isTyping && (
              <div className="flex flex-col items-start">
                <div className="rounded-2xl bg-white border border-[#e8e8e8] p-3 shadow-sm rounded-tl-none">
                  <div className="flex gap-1">
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#1a1a1a]" />
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#1a1a1a] [animation-delay:-0.15s]" />
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#1a1a1a] [animation-delay:-0.3s]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Floating lead generation notice */}
        <AnimatePresence>
            {messages.length > 5 && (
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 15 }}
                    className="absolute bottom-[72px] left-1/2 -translate-x-1/2 z-10 w-full px-4 flex justify-center"
                >
                    <button 
                        onClick={() => handleSend("I want to share my project requirements to get a quote.")}
                        className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[11px] font-bold text-[#1a1a1a] shadow-lg border border-[#e5e5e5] hover:scale-105 active:scale-95 transition-all"
                    >
                        <MessageSquare size={13} />
                        Get a project quote
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
        
        {/* Lead Captured Success Toast */}
        <AnimatePresence>
            {showLeadSuccess && (
                <motion.div 
                    initial={{ opacity: 0, y: -15, x: "-50%" }}
                    animate={{ opacity: 1, y: 0, x: "-50%" }}
                    exit={{ opacity: 0, y: -15, x: "-50%" }}
                    className="fixed top-14 left-1/2 z-50 w-[90%] max-w-[310px] rounded-xl bg-green-50 px-3.5 py-2.5 border border-green-200 shadow-xl flex items-center gap-2.5"
                >
                    <div className="h-6 w-6 rounded-full bg-green-500 text-white flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 size={13} />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-green-900 leading-none">Lead Saved Successfully!</p>
                        <p className="text-[9px] text-green-700 leading-none mt-1">Roj Tech will contact you soon.</p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* Input Bar */}
        <div className="border-t border-[#e5e5e5] bg-white p-2.5 z-10 flex-shrink-0">
          <div className="max-w-xl mx-auto relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Tell me about your project needs..."
              className="w-full rounded-xl border border-[#e5e5e5] bg-[#fafafa] py-2.5 pl-4 pr-11 text-xs font-medium focus:border-[#1a1a1a] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1a1a1a]/5 transition-all placeholder:text-gray-400"
            />
            <button 
              onClick={() => handleSend()}
              disabled={isTyping || !input.trim()}
              className="absolute right-1.5 top-1.5 rounded-lg bg-[#1a1a1a] p-1.5 text-white shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100"
            >
              {isTyping ? <Loader2 className="animate-spin" size={13} /> : <Send size={13} />}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[8.5px] font-medium text-[#999] tracking-tight">
            © 2026 Roj Tech • AI response powered by Gemini
          </p>
        </div>
      </main>
    </div>
  );
}
