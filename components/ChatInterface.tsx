
import React, { useState, useRef, useEffect } from 'react';
import { Message, TripPlan, UserPreferences } from '../types';
import { sendMessageToGemini } from '../services/geminiService';
import { GroundingChips } from './GroundingChips';

interface ChatInterfaceProps {
  tripPlan: TripPlan;
  mode: 'PLANNER';
  preferences?: UserPreferences;
  onPlanUpdate?: (plan: TripPlan) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ tripPlan, mode, preferences, onPlanUpdate }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: `Hello! Your plan for ${tripPlan.destination} is ready. Based on your preferences (${preferences?.tempo} tempo), I've created a draft. You can ask to rearrange activities or request new suggestions.`,
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newUserMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // We explicitly ask Gemini if it needs to update the plan in the prompt context
      const response = await sendMessageToGemini(
        messages, 
        `${newUserMessage.text}. IMPORTANT: If this request involves changing the itinerary, also provide the updated TripPlan object in JSON format inside your response text wrapped in \`\`\`json blocks.`, 
        tripPlan,
        mode,
        preferences
      );

      // Check if response contains a JSON plan block
      const jsonMatch = response.text.match(/```json\n([\s\S]*?)\n```/);
      let cleanText = response.text;
      
      if (jsonMatch && onPlanUpdate) {
        try {
          const updatedPlan = JSON.parse(jsonMatch[1]);
          if (updatedPlan && updatedPlan.activities) {
            onPlanUpdate(updatedPlan);
            cleanText = response.text.replace(/```json[\s\S]*?```/, "Itinerary updated!").trim();
          }
        } catch (err) {
          console.error("Failed to parse plan update from Gemini:", err);
        }
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: cleanText,
        groundingMetadata: response.groundingMetadata,
        timestamp: new Date(),
      }]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
        <div>
          <h2 className="font-black text-gray-900 tracking-tight">Plan Assistant</h2>
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Gemini 2.5 • Plan Editor</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-xs text-gray-400">•••</div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div className={`max-w-[85%] rounded-[1.75rem] px-5 py-3 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-none' 
                : 'bg-gray-50 text-gray-800 border border-gray-100 rounded-tl-none'
            }`}>
              <div className="text-[13px] leading-relaxed font-medium">{msg.text}</div>
              {msg.role === 'model' && msg.groundingMetadata && (
                <div className="mt-2 border-t border-gray-200 pt-2">
                   <GroundingChips metadata={msg.groundingMetadata} />
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-1.5 p-3">
             <div className="w-2 h-2 bg-indigo-200 rounded-full animate-bounce"></div>
             <div className="w-2 h-2 bg-indigo-200 rounded-full animate-bounce [animation-delay:0.2s]"></div>
             <div className="w-2 h-2 bg-indigo-200 rounded-full animate-bounce [animation-delay:0.4s]"></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-6 bg-white border-t border-gray-50">
        <form onSubmit={handleSubmit} className="flex gap-3 bg-gray-50 rounded-2xl p-2 border border-gray-100">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ex: Move dinner to 7:30 PM..."
            className="flex-1 bg-transparent px-4 py-3 text-sm font-medium outline-none text-gray-700 placeholder-gray-400"
          />
          <button 
            type="submit" 
            disabled={isLoading || !inputText.trim()} 
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
              !inputText.trim() ? 'bg-gray-200 text-gray-400' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:scale-105 active:scale-95'
            }`}
          >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l7 7m-7-7H3" /></svg>
          </button>
        </form>
      </div>
    </div>
  );
};
