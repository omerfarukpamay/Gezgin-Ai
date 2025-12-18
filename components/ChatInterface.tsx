
import React, { useState, useRef, useEffect } from 'react';
import { Message, TripPlan, UserPreferences } from '../types';
import { sendMessageToGemini } from '../services/geminiService';
import { GroundingChips } from './GroundingChips';

interface ChatInterfaceProps {
  tripPlan: TripPlan;
  mode: 'PLANNER';
  preferences?: UserPreferences;
  // Lifted state props to manage conversation context globally
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  tripPlan, 
  mode, 
  preferences, 
  messages, 
  setMessages 
}) => {
  // Removed internal state for messages to use lifted state from props instead
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
      const response = await sendMessageToGemini(
        messages, 
        newUserMessage.text, 
        tripPlan,
        mode,
        preferences
      );

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text,
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
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
      <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center rounded-t-2xl transition-colors">
        <div>
          <h2 className="font-bold text-gray-800 dark:text-white">Plan Assistant</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Gemini 2.5 • Plan Editor</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900/50 transition-colors">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-none' 
                : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-600 rounded-tl-none'
            }`}>
              <div className="whitespace-pre-wrap text-sm">{msg.text}</div>
              {msg.role === 'model' && <GroundingChips metadata={msg.groundingMetadata} />}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
        {isLoading && <div className="text-xs text-gray-400 p-2">Typing...</div>}
      </div>

      <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl transition-colors">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ex: Move dinner to 7:30 PM..."
            className="flex-1 bg-gray-50 dark:bg-gray-700 dark:text-white border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button type="submit" disabled={isLoading} className="bg-indigo-600 text-white p-2 rounded-xl">
             <svg className="w-5 h-5 transform rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
          </button>
        </form>
      </div>
    </div>
  );
};
