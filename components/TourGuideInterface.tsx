
import React, { useState, useRef, useEffect } from 'react';
import { TripPlan, TripLocation, Message, Activity } from '../types';
import { sendMessageToGemini } from '../services/geminiService';
import { GroundingChips } from './GroundingChips';

// Polyfill for Speech Recognition types
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

interface TourGuideInterfaceProps {
  plan: TripPlan;
  onExit: () => void;
  onStampCollected?: (activity: Activity) => void;
}

export const TourGuideInterface: React.FC<TourGuideInterfaceProps> = ({ plan, onExit, onStampCollected }) => {
  const getNextStop = (): Activity | undefined => {
    return plan.activities.find(a => a.status !== 'completed');
  };

  const [currentStop, setCurrentStop] = useState<Activity | undefined>(getNextStop());
  const [messages, setMessages] = useState<Message[]>([]);
  const [arrivalState, setArrivalState] = useState<'approaching' | 'arrived'>('approaching');
  
  // Gamification State
  const [showStampAnimation, setShowStampAnimation] = useState(false);

  // Audio State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0); 
  const [currentAudioText, setCurrentAudioText] = useState<string | null>(null);
  
  // Voice Selection State
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const loadVoices = () => {
      const voices = synthRef.current.getVoices();
      const englishVoices = voices.filter(v => v.lang.startsWith('en'));
      const bestVoice = englishVoices.find(v => v.name.includes('Google') || v.name.includes('Premium'));
      if (bestVoice) setSelectedVoice(bestVoice);
      else if (englishVoices.length > 0) setSelectedVoice(englishVoices[0]);
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  useEffect(() => {
    if (currentStop) {
      setArrivalState('approaching');
      setLoading(false);
      setIsListening(false);
      stopAudio();
      
      const introText = `Heading to ${currentStop.activity}. Ready for some ${currentStop.type || 'adventure'}?`;
      setMessages([{
        id: 'init-' + currentStop.id,
        role: 'model',
        text: introText,
        timestamp: new Date()
      }]);
    }
  }, [currentStop?.id]);

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [userLocation, setUserLocation] = useState<TripLocation>({
    lat: 41.8826, lng: -87.6226, name: "City Center"
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => synthRef.current.cancel();
  }, []);

  // --- AUDIO LOGIC ---

  const speak = (text: string, speed: number = 1.0) => {
    // 1. Cancel existing
    synthRef.current.cancel();
    setIsPaused(false);
    
    // 2. Setup new utterance
    const utterance = new SpeechSynthesisUtterance(text);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = speed;
    
    utterance.onstart = () => { setIsSpeaking(true); setIsPaused(false); };
    utterance.onend = () => { setIsSpeaking(false); setIsPaused(false); setCurrentAudioText(null); };
    utterance.onerror = () => { setIsSpeaking(false); setIsPaused(false); };

    utteranceRef.current = utterance;
    setCurrentAudioText(text);
    synthRef.current.speak(utterance);
  };

  const togglePlayPause = () => {
    if (isPaused) {
      synthRef.current.resume();
      setIsPaused(false);
      setIsSpeaking(true);
    } else {
      synthRef.current.pause();
      setIsPaused(true);
      setIsSpeaking(false);
    }
  };

  const replay = () => {
    if (currentAudioText) {
      speak(currentAudioText, playbackSpeed);
    }
  };

  const toggleSpeed = () => {
    const newSpeed = playbackSpeed === 1.0 ? 1.5 : 1.0;
    setPlaybackSpeed(newSpeed);
    // WebSpeech API requires restart to change speed
    if (currentAudioText) {
      speak(currentAudioText, newSpeed);
    }
  };

  const stopAudio = () => {
    synthRef.current.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentAudioText(null);
  };

  // --- MIC LOGIC (FIXED) ---

  const toggleMic = async () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as unknown as IWindow).SpeechRecognition || (window as unknown as IWindow).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser. Try Chrome or Safari.");
      return;
    }

    // Explicitly request microphone permission first to avoid 'not-allowed' error
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the stream immediately, we only needed the permission
        stream.getTracks().forEach(track => track.stop());
    } catch (err) {
        console.error("Microphone permission denied:", err);
        alert("Microphone access blocked. Please enable permissions in your browser settings.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');
      setInputText(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (event.error === 'not-allowed') {
          alert("Microphone access blocked. Please check your browser settings.");
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try {
        recognition.start();
    } catch (e) {
        console.error("Failed to start recognition:", e);
        setIsListening(false);
    }
  };

  // --- CHAT LOGIC ---

  const handleSend = async (text: string, image?: string) => {
    if (!text && !image) return;
    
    // Do NOT stop audio automatically if user just types, 
    // but if they send, we might want to stop the previous answer.
    // stopAudio(); 

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      image: image,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setInputText('');
    setIsListening(false);

    const response = await sendMessageToGemini(
      messages, userMsg.text, plan, 'GUIDE', undefined, image, userLocation,
      arrivalState === 'arrived' ? currentStop : undefined
    );

    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: response.text,
      groundingMetadata: response.groundingMetadata,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, aiMsg]);
    setLoading(false);
    
    // Note: We do NOT auto-speak anymore based on new request. 
    // User must hit "Listen".
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleSend("Analyze this image given my current location.", reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const confirmArrival = () => {
    setArrivalState('arrived');
    setShowStampAnimation(true);
    if(onStampCollected && currentStop) {
        onStampCollected(currentStop);
    }
    handleSend(`I have arrived at ${currentStop?.activity}. Start the tour!`);
    setTimeout(() => setShowStampAnimation(false), 4000);
  };

  const goToNextStop = () => {
    if (!currentStop) return;
    const currentIndex = plan.activities.findIndex(a => a.id === currentStop.id);
    if (currentIndex !== -1 && currentIndex < plan.activities.length - 1) {
      const nextStop = plan.activities[currentIndex + 1];
      setCurrentStop(nextStop);
      setUserLocation({ lat: 41.8826, lng: -87.6226, name: "Moving..." });
    } else {
       handleSend("That was the last stop! We are done for the day.");
    }
  };

  const getTypeIcon = (type?: string) => {
      switch(type) {
          case 'culture': return '🎭';
          case 'food': return '🍔';
          case 'nature': return '🌳';
          case 'nightlife': return '🍸';
          default: return '📍';
      }
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col relative overflow-hidden font-sans">
      
      {/* Background */}
      <div className={`absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] transition-colors duration-1000 pointer-events-none ${arrivalState === 'arrived' ? 'from-emerald-800/60 via-gray-900' : 'from-indigo-900/40 via-gray-900'} to-gray-900`}></div>

      {/* Stamp Animation */}
      {showStampAnimation && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="relative transform animate-[bounce_1s_ease-out]">
                  <div className="w-64 h-64 rounded-full border-8 border-dashed border-red-500 flex items-center justify-center bg-amber-100 rotate-[-12deg] shadow-2xl">
                      <div className="text-center">
                          <p className="text-red-600 font-black text-3xl uppercase tracking-widest opacity-80">VISITED</p>
                          <p className="text-red-800 font-bold text-lg mt-2">{currentStop?.activity}</p>
                          <p className="text-red-500 text-xs mt-1">{new Date().toLocaleDateString()}</p>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4 flex justify-between items-start">
        <button onClick={onExit} className="bg-white/10 backdrop-blur rounded-full px-3 py-1 text-xs hover:bg-white/20 transition">← Plan</button>
        <div className="text-center">
           <h2 className="font-bold text-lg drop-shadow-md">Wise Guide</h2>
           <div className="flex items-center justify-center gap-2 mt-1">
             <span className="text-xs px-2 py-0.5 bg-gray-800 rounded-full border border-gray-600 flex items-center gap-1">
                 <span>{getTypeIcon(currentStop?.type)}</span>
                 <span className="uppercase tracking-wide text-[10px]">
                     {currentStop?.type ? `${currentStop.type} Mode` : 'Explorer Mode'}
                 </span>
             </span>
           </div>
        </div>
        {arrivalState === 'approaching' && (
           <button onClick={() => setUserLocation({lat:0,lng:0,name:currentStop?.activity||''})} className="bg-blue-600/50 backdrop-blur rounded-full px-3 py-1 text-[10px]">Simulate GPS</button>
        )}
      </div>

      {/* AUDIO CONTROL BAR (Visible only when text is selected/playing) */}
      {(currentAudioText || isSpeaking) && (
          <div className="absolute top-20 left-0 right-0 z-40 flex justify-center animate-slide-down">
             <div className="bg-gray-800/95 backdrop-blur-md px-4 py-2 rounded-full flex gap-4 items-center shadow-2xl border border-indigo-500/30">
                
                {/* Status Indicator */}
                <div className="flex space-x-1 h-3 items-end w-4">
                    {isSpeaking && !isPaused && (
                       <>
                        <div className="w-1 bg-green-400 animate-[bounce_1s_infinite] h-2"></div>
                        <div className="w-1 bg-green-400 animate-[bounce_1.2s_infinite] h-3"></div>
                       </>
                    )}
                    {(isPaused || !isSpeaking) && (
                       <div className="w-1 bg-gray-500 h-1"></div>
                    )}
                </div>

                <div className="h-4 w-px bg-gray-600"></div>

                {/* Replay */}
                <button onClick={replay} className="text-gray-300 hover:text-white" title="Replay">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>

                {/* Play/Pause */}
                <button onClick={togglePlayPause} className="text-white hover:text-indigo-400 transition transform hover:scale-110">
                  {isPaused || !isSpeaking ? (
                    <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  ) : (
                    <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                  )}
                </button>

                {/* Speed Toggle */}
                <button 
                   onClick={toggleSpeed} 
                   className="text-xs font-mono font-bold bg-gray-700 px-2 py-1 rounded border border-gray-600 hover:bg-gray-600 transition min-w-[3rem]"
                >
                   {playbackSpeed}x
                </button>

                {/* Close */}
                <button onClick={stopAudio} className="text-gray-500 hover:text-white ml-2">✕</button>
             </div>
          </div>
      )}

      {/* Arrival Card */}
      {arrivalState === 'approaching' && userLocation.name === currentStop?.activity && (
         <div className="absolute top-40 left-4 right-4 z-30 animate-bounce-in">
            <div className="bg-white text-gray-900 p-6 rounded-3xl shadow-2xl border-2 border-indigo-500 text-center">
               <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl">📍</div>
               <h3 className="font-bold text-xl mb-1">You've Arrived!</h3>
               <p className="text-sm text-gray-600 mb-4">Check in to {currentStop?.activity}.</p>
               <button onClick={confirmArrival} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200">
                 Check In & Start Tour
               </button>
            </div>
         </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto pt-36 pb-48 px-4 space-y-6 scrollbar-hide relative z-10">
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 shadow-xl ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-gray-800/90 border border-gray-700'}`}>
              {msg.image && <img src={msg.image} className="rounded-lg mb-2 max-h-60 w-full object-cover" />}
              <p className="text-sm whitespace-pre-wrap text-white">{msg.text}</p>
              {msg.role === 'model' && <GroundingChips metadata={msg.groundingMetadata} showWebSources={false} />}
            </div>
            
            {/* Listen Button (Only for Model) */}
            {msg.role === 'model' && (
              <button 
                 onClick={() => speak(msg.text, playbackSpeed)}
                 className={`mt-2 ml-1 flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                    currentAudioText === msg.text 
                    ? 'bg-indigo-600 text-white border-indigo-500 ring-2 ring-indigo-400/30' 
                    : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700 hover:text-white'
                 }`}
              >
                 {currentAudioText === msg.text && isSpeaking && !isPaused ? (
                     // Equalizer Icon
                     <div className="flex gap-0.5 h-3 items-end">
                       <span className="w-0.5 bg-white h-2 animate-[bounce_0.5s_infinite]"></span>
                       <span className="w-0.5 bg-white h-3 animate-[bounce_0.7s_infinite]"></span>
                       <span className="w-0.5 bg-white h-1 animate-[bounce_0.9s_infinite]"></span>
                     </div>
                 ) : (
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                 )}
                 {currentAudioText === msg.text ? 'Listening...' : 'Listen'}
              </button>
            )}
          </div>
        ))}
        {loading && <div className="text-center text-gray-400 text-xs animate-pulse">Wise is thinking...</div>}
        
        {isListening && (
           <div className="flex justify-center items-center py-4 space-x-1">
              <div className="w-1 h-3 bg-red-500 rounded-full animate-pulse" style={{ animationDuration: '0.5s' }}></div>
              <div className="w-1 h-5 bg-red-500 rounded-full animate-pulse" style={{ animationDuration: '0.3s' }}></div>
              <div className="w-1 h-3 bg-red-500 rounded-full animate-pulse" style={{ animationDuration: '0.5s' }}></div>
              <span className="text-red-400 text-xs ml-2">Listening...</span>
           </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gray-900/95 border-t border-gray-800 p-6 pb-8 backdrop-blur-lg">
        {arrivalState === 'arrived' ? (
          <>
            <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
               {['History?', 'Photo Spot?', 'Food nearby?'].map(chip => (
                 <button key={chip} onClick={() => handleSend(chip)} className="whitespace-nowrap px-4 py-2 bg-gray-800 rounded-full text-xs font-semibold border border-gray-700 hover:bg-indigo-900/50">
                   {chip}
                 </button>
               ))}
               <button onClick={goToNextStop} className="whitespace-nowrap px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-semibold">
                 Complete & Next →
               </button>
            </div>

            <div className="flex items-center gap-3">
               <button onClick={() => fileInputRef.current?.click()} className="h-12 w-12 bg-gray-800 rounded-full flex items-center justify-center border border-gray-700 hover:bg-gray-700 transition-colors">
                  <svg className="w-6 h-6 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
               </button>
               
               <button 
                  onClick={toggleMic} 
                  className={`h-12 w-12 rounded-full flex items-center justify-center border transition-all ${isListening ? 'bg-red-500 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}
               >
                  <svg className={`w-6 h-6 ${isListening ? 'text-white' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
               </button>

               <input 
                  type="text" 
                  className="flex-1 bg-gray-800 border-none rounded-full px-5 py-3 text-white focus:ring-2 focus:ring-indigo-500 placeholder-gray-500" 
                  placeholder="Talk or type..." 
                  value={inputText} 
                  onChange={e => setInputText(e.target.value)} 
                  onKeyPress={e => e.key === 'Enter' && handleSend(inputText)}
               />
               <button onClick={() => handleSend(inputText)} className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
               </button>
            </div>
          </>
        ) : (
          <div className="text-center text-gray-500 text-sm py-4">Wise waiting for arrival at {currentStop?.activity}.</div>
        )}
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
      </div>
    </div>
  );
};
