
import React, { useState, useRef, useEffect } from 'react';
import { TripPlan, TripLocation, Message, Activity } from '../types';
import { sendMessageToGemini } from '../services/geminiService';

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
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const lastTranscriptRef = useRef<string>('');

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
      
      const introText = `Next up: ${currentStop.activity}. Ready?`;
      setMessages([{
        id: 'init-' + currentStop.id,
        role: 'model',
        text: introText,
        timestamp: new Date()
      }]);
    }
  }, [currentStop?.id]);

  useEffect(() => {
    const container = document.getElementById('guide-map-bg');
    if (currentStop && currentStop.lat && currentStop.lng && window.L && container) {
      if (!mapInstanceRef.current) {
        const map = window.L.map('guide-map-bg', { 
          zoomControl: false, 
          attributionControl: false,
          fadeAnimation: true,
          zoomAnimation: true
        }).setView([currentStop.lat, currentStop.lng], 11.5);
        
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;
      if (markerRef.current) markerRef.current.remove();
      
      const icon = window.L.divIcon({
          className: 'custom-div-icon',
          html: `<div class="relative w-10 h-10 flex items-center justify-center">
                   <div class="absolute inset-0 bg-indigo-400/40 rounded-full animate-ping"></div>
                   <div class="w-4 h-4 bg-white rounded-full border-4 border-indigo-500 shadow-xl shadow-indigo-500/50"></div>
                 </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
      });

      markerRef.current = window.L.marker([currentStop.lat, currentStop.lng], { icon }).addTo(map);

      if (arrivalState === 'arrived') {
        map.flyTo([currentStop.lat, currentStop.lng], 13.5, { duration: 3 });
      } else {
        map.flyTo([currentStop.lat, currentStop.lng], 11.5, { duration: 2.5 });
      }
    }
  }, [arrivalState, currentStop]);

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
    return () => {
        synthRef.current.cancel();
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }
    }
  }, []);

  const speak = (text: string, speed: number = 1.0) => {
    synthRef.current.cancel();
    setIsPaused(false);
    const utterance = new SpeechSynthesisUtterance(text);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = speed;
    utterance.onstart = () => { setIsSpeaking(true); setIsPaused(false); };
    utterance.onend = () => { 
        setIsSpeaking(false); 
        setIsPaused(false); 
        setCurrentAudioText(null); 
    };
    utteranceRef.current = utterance;
    setCurrentAudioText(text);
    synthRef.current.speak(utterance);
  };

  const stopAudio = () => {
    synthRef.current.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentAudioText(null);
  };

  const togglePause = () => {
    if (isPaused) {
      synthRef.current.resume();
      setIsPaused(false);
    } else {
      synthRef.current.pause();
      setIsPaused(true);
    }
  };

  const handleReplay = () => {
    if (currentAudioText) speak(currentAudioText, playbackSpeed);
  };

  const cycleSpeed = () => {
    const speeds = [1.0, 1.25, 1.5];
    const nextSpeed = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    if (isSpeaking && currentAudioText) {
      speak(currentAudioText, nextSpeed);
    }
  };

  const toggleMic = async () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    
    const SpeechRecognition = (window as unknown as IWindow).SpeechRecognition || (window as unknown as IWindow).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    
    recognition.onstart = () => {
      setIsListening(true);
      lastTranscriptRef.current = '';
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');
      
      // We don't setInputText(transcript) here anymore to keep it hidden as requested
      lastTranscriptRef.current = transcript;
    };

    recognition.onend = () => {
      setIsListening(false);
      const textToSend = lastTranscriptRef.current.trim();
      if (textToSend) {
        handleSend(textToSend, undefined, true);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try { 
      recognition.start(); 
    } catch (e) { 
      setIsListening(false); 
    }
  };

  const handleSend = async (text: string, image?: string, fromAudio: boolean = false) => {
    if (!text && !image) return;
    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      text: text, 
      image: image, 
      isAudio: fromAudio,
      timestamp: new Date() 
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setInputText('');
    setIsListening(false);
    const response = await sendMessageToGemini(messages, userMsg.text, plan, 'GUIDE', undefined, image, userLocation, arrivalState === 'arrived' ? currentStop : undefined);
    const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: response.text, groundingMetadata: response.groundingMetadata, timestamp: new Date() };
    setMessages(prev => [...prev, aiMsg]);
    setLoading(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => handleSend("Analyze this sight.", reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const confirmArrival = () => {
    setArrivalState('arrived');
    if(onStampCollected && currentStop) onStampCollected(currentStop);
    handleSend(`I have arrived at ${currentStop?.activity}.`);
  };

  const goToNextStop = () => {
    if (!currentStop) return;
    const currentIndex = plan.activities.findIndex(a => a.id === currentStop.id);
    if (currentIndex !== -1 && currentIndex < plan.activities.length - 1) {
      setCurrentStop(plan.activities[currentIndex + 1]);
    }
  };

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col relative overflow-hidden font-sans">
      
      <style>{`
        #guide-map-bg {
          filter: invert(100%) hue-rotate(190deg) brightness(0.8) contrast(1.2) saturate(0.8) !important;
        }
        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .animate-mic-pulse {
          animation: pulse-red 2s infinite;
        }
        .voice-wave {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .voice-wave div {
          width: 2px;
          background: currentColor;
          border-radius: 1px;
        }
      `}</style>
      <div id="guide-map-bg" className="absolute inset-0 z-0"></div>
      
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-start">
        <button onClick={onExit} className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/20 transition-all shadow-lg">
          ← Exit
        </button>
        
        {arrivalState === 'arrived' ? (
          <div className="flex items-center gap-3 bg-[#00a68c] px-4 py-2.5 rounded-2xl shadow-xl animate-slide-down border border-[#00c9aa]">
            <div className="w-5 h-5 bg-white/20 rounded flex items-center justify-center">
               <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <p className="text-[8px] font-black text-white/80 uppercase tracking-widest leading-none mb-0.5">Arrived at</p>
              <h3 className="text-[11px] font-bold text-white leading-none truncate max-w-[150px]">{currentStop?.activity}</h3>
            </div>
          </div>
        ) : (
          <div className="text-center bg-white/10 backdrop-blur-xl px-6 py-2 rounded-2xl border border-white/10 shadow-lg">
             <h2 className="font-black text-sm text-white tracking-tight">Wise Guide</h2>
             <div className="flex items-center justify-center gap-1.5 mt-0.5">
               <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
               <span className="text-[9px] uppercase tracking-widest font-black text-white/60">Approaching {currentStop?.activity}</span>
             </div>
          </div>
        )}
        <div className="w-16"></div> 
      </div>

      {/* Arrival Prompt */}
      {arrivalState === 'approaching' && (
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-full max-w-xs px-6 animate-bounce-in">
            <div className="bg-gray-900/60 backdrop-blur-2xl text-white p-8 rounded-[2.5rem] shadow-2xl border border-white/10 text-center">
               <div className="w-16 h-16 bg-[#00a68c] rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl shadow-lg shadow-[#00a68c]/20">
                  📍
               </div>
               <h3 className="font-black text-xl mb-1 tracking-tight">Arrived?</h3>
               <p className="text-[10px] text-white/50 mb-6 uppercase tracking-widest font-black">{currentStop?.activity}</p>
               <button onClick={confirmArrival} className="w-full bg-[#00a68c] text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-[#00a68c]/10 transition-all hover:scale-105 active:scale-95">
                 Yes, I'm Here
               </button>
            </div>
         </div>
      )}

      {/* Chat Messages */}
      <div className={`flex-1 overflow-y-auto pt-32 pb-44 px-6 space-y-4 scrollbar-hide relative z-10 transition-opacity duration-500 ${arrivalState === 'arrived' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-[1.75rem] px-5 py-4 shadow-lg border relative ${
              msg.role === 'user' 
              ? 'bg-[#00a68c] text-white border-[#00c9aa] rounded-tr-none' 
              : 'bg-white/10 backdrop-blur-xl text-white border-white/10 rounded-tl-none'
            }`}>
              {msg.image && <img src={msg.image} className="rounded-xl mb-3 max-h-48 w-full object-cover" />}
              
              {msg.role === 'user' && msg.isAudio ? (
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                       <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                    </div>
                    <div className="voice-wave">
                       {/* Mock Waveform */}
                       {[8, 14, 10, 18, 12, 16, 9, 13, 11, 7].map((h, i) => (
                         <div key={i} style={{ height: `${h}px` }} className="bg-white/40"></div>
                       ))}
                    </div>
                    <span className="text-[10px] font-black opacity-60 uppercase tracking-widest ml-1">Voice</span>
                 </div>
              ) : (
                <p className="text-[13px] leading-relaxed font-bold whitespace-pre-wrap">{msg.text}</p>
              )}
            </div>
            {msg.role === 'model' && (
              <button 
                 onClick={() => speak(msg.text, playbackSpeed)}
                 className={`mt-2 ml-1 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest px-4 py-2 rounded-full border transition-all ${
                   currentAudioText === msg.text ? 'bg-white text-black border-white shadow-xl shadow-white/10' : 'bg-white/5 backdrop-blur-xl text-white/50 border-white/5 hover:bg-white/10 hover:text-white'
                 }`}
              >
                 {currentAudioText === msg.text && isSpeaking && !isPaused ? (
                    <span className="flex items-center gap-1">
                       <span className="w-1 h-1 bg-black rounded-full animate-bounce"></span>
                       <span className="w-1 h-1 bg-black rounded-full animate-bounce [animation-delay:0.2s]"></span>
                       Playing
                    </span>
                 ) : 'Listen narration'}
              </button>
            )}
          </div>
        ))}
        {loading && <div className="ml-2"><span className="text-[9px] font-black text-[#00a68c] tracking-widest uppercase animate-pulse">Wise is thinking...</span></div>}
        <div ref={scrollRef} />
      </div>

      {/* Bottom Controls */}
      <div className={`absolute bottom-0 left-0 right-0 z-20 transition-all duration-700 ${arrivalState === 'arrived' ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
        
        {/* ULTRA COMPACT AUDIO PLAYER BAR */}
        {currentAudioText && (
          <div className="flex justify-center mb-6 animate-slide-up px-6">
             <div className="bg-indigo-600/95 backdrop-blur-3xl rounded-full p-1.5 flex items-center gap-3 border border-white/20 shadow-2xl w-full max-w-xs">
                
                {/* Visual indicator pill */}
                <div className="flex items-center gap-2 pl-3 pr-2 border-r border-white/10 shrink-0">
                   <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                   <p className="text-[9px] font-black text-white uppercase tracking-widest">Wise</p>
                </div>

                <div className="flex items-center gap-2 pr-1 flex-1 justify-end">
                   {/* Speed Toggle */}
                   <button 
                     onClick={cycleSpeed}
                     className="px-2 py-1.5 rounded-full bg-white/10 border border-white/10 text-[10px] font-black text-white hover:bg-white/20 transition-all min-w-[44px]"
                   >
                     {playbackSpeed}x
                   </button>
                   
                   {/* Replay */}
                   <button 
                     onClick={handleReplay}
                     className="p-2 rounded-full bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-all"
                   >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                   </button>

                   {/* Play/Pause */}
                   <button 
                     onClick={togglePause}
                     className="w-10 h-10 rounded-full bg-white text-indigo-600 flex items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-all"
                   >
                     {isPaused ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                     ) : (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                     )}
                   </button>

                   {/* Close */}
                   <button 
                     onClick={stopAudio}
                     className="p-2 rounded-full text-white/40 hover:text-white transition-all ml-1"
                   >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                   </button>
                </div>
             </div>
          </div>
        )}

        <div className="bg-gradient-to-t from-black via-black/80 to-transparent p-6 pb-10">
            <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
               {['History here?', 'Photo tips?', 'Nearby snacks?'].map(chip => (
                 <button key={chip} onClick={() => handleSend(chip)} className="whitespace-nowrap px-4 py-2 bg-white/5 backdrop-blur-xl rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/10 text-white/80 hover:bg-white/10 transition-all shadow-lg">
                   {chip}
                 </button>
               ))}
               <button onClick={goToNextStop} className="whitespace-nowrap px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md">
                 Next Stop →
               </button>
            </div>

            <div className="flex items-center gap-3">
               <button onClick={() => fileInputRef.current?.click()} className="h-12 w-12 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/10 hover:bg-white/20 transition-all">
                  <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
               </button>
               <button 
                  onClick={toggleMic} 
                  className={`h-12 w-12 rounded-2xl flex items-center justify-center border transition-all ${isListening ? 'bg-red-500 border-red-500 shadow-xl animate-mic-pulse' : 'bg-white/10 backdrop-blur-xl border-white/10 hover:bg-white/20 shadow-lg'}`}
               >
                  <svg className={`w-5 h-5 ${isListening ? 'text-white' : 'text-white/60'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
               </button>
               <div className="flex-1 relative">
                 <input 
                    type="text" 
                    className={`w-full bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl px-5 py-3.5 text-[13px] font-bold text-white focus:ring-2 focus:ring-[#00a68c] focus:outline-none placeholder-white/30 transition-all shadow-lg ${isListening ? 'animate-pulse' : ''}`} 
                    placeholder={isListening ? "Recording voice message..." : "Ask Wise..."} 
                    value={isListening ? "" : inputText} 
                    onChange={e => setInputText(e.target.value)} 
                    onKeyPress={e => e.key === 'Enter' && handleSend(inputText)} 
                 />
               </div>
               <button onClick={() => handleSend(inputText)} className="h-12 w-12 bg-[#00a68c] text-white rounded-2xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14m-7-7l7 7-7 7" /></svg>
               </button>
            </div>
        </div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
    </div>
  );
};
