
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
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

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
      
      const introText = `Next up: ${currentStop.activity}. It's a ${currentStop.type || 'special stop'} on our journey. Ready to roll?`;
      setMessages([{
        id: 'init-' + currentStop.id,
        role: 'model',
        text: introText,
        timestamp: new Date()
      }]);
    }
  }, [currentStop?.id]);

  // MAP LOGIC - SMOOTH FLYTO
  useEffect(() => {
    const container = document.getElementById('guide-map-bg');
    if (currentStop && currentStop.lat && currentStop.lng && window.L && container) {
      if (!mapInstanceRef.current) {
        // Dark theme map for premium feel
        const map = window.L.map('guide-map-bg', { 
          zoomControl: false, 
          attributionControl: false,
          fadeAnimation: true,
          zoomAnimation: true
        }).setView([currentStop.lat, currentStop.lng], 13);
        
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      // Update Marker
      if (markerRef.current) markerRef.current.remove();
      
      const icon = window.L.divIcon({
          className: 'custom-div-icon',
          html: `<div class="relative w-10 h-10">
                   <div class="absolute inset-0 bg-indigo-500/40 rounded-full animate-ping"></div>
                   <div class="absolute inset-2 bg-indigo-500 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-[10px] font-black text-white">
                     ${getTypeIcon(currentStop.type)}
                   </div>
                 </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
      });

      markerRef.current = window.L.marker([currentStop.lat, currentStop.lng], { icon }).addTo(map);

      // Smooth FlyTo movement
      if (arrivalState === 'arrived') {
        // Detailed zoom on arrival
        map.flyTo([currentStop.lat, currentStop.lng], 18, {
          duration: 3,
          easeLinearity: 0.25
        });
      } else {
        // Wider view for "approaching" phase
        map.flyTo([currentStop.lat, currentStop.lng], 14, {
          duration: 2.5,
          easeLinearity: 0.1
        });
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
    if (currentAudioText) speak(currentAudioText, playbackSpeed);
  };

  const toggleSpeed = () => {
    const newSpeed = playbackSpeed === 1.0 ? 1.5 : 1.0;
    setPlaybackSpeed(newSpeed);
    if (currentAudioText) speak(currentAudioText, newSpeed);
  };

  const stopAudio = () => {
    synthRef.current.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentAudioText(null);
  };

  const toggleMic = async () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as unknown as IWindow).SpeechRecognition || (window as unknown as IWindow).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser.");
      return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
    } catch (err) {
        alert("Microphone access blocked.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).map((result: any) => result[0]).map((result: any) => result.transcript).join('');
      setInputText(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    try { recognition.start(); } catch (e) { setIsListening(false); }
  };

  const handleSend = async (text: string, image?: string) => {
    if (!text && !image) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: text, image: image, timestamp: new Date() };
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
      reader.onloadend = () => handleSend("Look at what I see right now.", reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const confirmArrival = () => {
    setArrivalState('arrived');
    setShowStampAnimation(true);
    if(onStampCollected && currentStop) onStampCollected(currentStop);
    handleSend(`I have arrived at ${currentStop?.activity}. What's the plan here?`);
    setTimeout(() => setShowStampAnimation(false), 3000);
  };

  const goToNextStop = () => {
    if (!currentStop) return;
    const currentIndex = plan.activities.findIndex(a => a.id === currentStop.id);
    if (currentIndex !== -1 && currentIndex < plan.activities.length - 1) {
      const nextStop = plan.activities[currentIndex + 1];
      setCurrentStop(nextStop);
      setUserLocation({ lat: 41.8826, lng: -87.6226, name: "Tracking..." });
    } else {
       handleSend("Journey complete! We've seen it all for today.");
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
    <div className="h-screen bg-gray-950 text-white flex flex-col relative overflow-hidden font-sans">
      
      {/* PERSISTENT MAP BACKGROUND */}
      <div id="guide-map-bg" className="absolute inset-0 z-0"></div>
      
      {/* VIGNETTE OVERLAY FOR READABILITY */}
      <div className="absolute inset-0 z-1 pointer-events-none bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(3,7,18,0.4)_100%)] shadow-[inset_0_0_150px_rgba(0,0,0,0.5)]"></div>

      {/* Stamp Animation */}
      {showStampAnimation && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="relative transform animate-[bounce_1s_ease-out]">
                  <div className="w-64 h-64 rounded-full border-8 border-dashed border-white/80 flex items-center justify-center bg-indigo-600/90 rotate-[-12deg] shadow-[0_0_50px_rgba(79,70,229,0.8)]">
                      <div className="text-center">
                          <p className="text-white font-black text-4xl uppercase tracking-widest">CHECKED IN</p>
                          <p className="text-indigo-200 font-bold text-lg mt-2 px-4 leading-tight">{currentStop?.activity}</p>
                          <div className="mt-4 text-4xl">{getTypeIcon(currentStop?.type)}</div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/90 via-black/40 to-transparent p-6 flex justify-between items-start">
        <button onClick={onExit} className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-full px-5 py-2 text-xs font-bold hover:bg-white/20 transition-all flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Exit
        </button>
        <div className="text-center">
           <h2 className="font-black text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-tight">Wise Guide</h2>
           <div className="flex items-center justify-center gap-2 mt-1">
             <span className="text-[10px] px-3 py-1 bg-indigo-600/80 backdrop-blur-xl rounded-full border border-indigo-400/30 flex items-center gap-1.5 shadow-lg">
                 <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                 <span className="uppercase tracking-widest font-black">
                     LIVE • {currentStop?.activity}
                 </span>
             </span>
           </div>
        </div>
        <div className="w-16"></div> {/* Balance Spacer */}
      </div>

      {/* Arrival Card */}
      {arrivalState === 'approaching' && (
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-full max-w-sm px-6 animate-bounce-in">
            <div className="bg-gray-900/95 backdrop-blur-2xl text-white p-8 rounded-[3rem] shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-white/10 text-center">
               <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 text-4xl shadow-2xl shadow-indigo-600/30 rotate-3">
                  {getTypeIcon(currentStop?.type)}
               </div>
               <h3 className="font-black text-2xl mb-2 tracking-tight">Arrived?</h3>
               <p className="text-sm text-gray-400 mb-8 px-4 leading-relaxed font-medium">I'm tracking your location. Are you at <b>{currentStop?.activity}</b> yet?</p>
               
               <div className="space-y-3">
                 <button onClick={confirmArrival} className="w-full bg-white text-gray-900 py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:scale-105 transition-all">
                   Yes, Check In
                 </button>
                 <button onClick={() => setUserLocation({lat:currentStop?.lat||0,lng:currentStop?.lng||0,name:currentStop?.activity||''})} className="w-full bg-indigo-600/20 text-indigo-400 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-indigo-500/20 hover:bg-indigo-600/30 transition-all">
                   Force GPS Pin
                 </button>
               </div>
            </div>
         </div>
      )}

      {/* Chat Messages */}
      <div className={`flex-1 overflow-y-auto pt-36 pb-52 px-6 space-y-6 scrollbar-hide relative z-10 transition-opacity duration-500 ${arrivalState === 'arrived' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-[2rem] p-6 shadow-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none border border-white/10' : 'bg-gray-900/90 backdrop-blur-xl border border-white/10'}`}>
              {msg.image && <img src={msg.image} className="rounded-2xl mb-4 max-h-60 w-full object-cover border border-white/10" />}
              <p className="text-[14px] leading-relaxed font-semibold whitespace-pre-wrap">{msg.text}</p>
              {msg.role === 'model' && <GroundingChips metadata={msg.groundingMetadata} showWebSources={false} />}
            </div>
            {msg.role === 'model' && (
              <button 
                 onClick={() => speak(msg.text, playbackSpeed)}
                 className={`mt-3 ml-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-full border transition-all ${currentAudioText === msg.text ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/60 backdrop-blur-xl text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'}`}
              >
                 {currentAudioText === msg.text && isSpeaking && !isPaused ? (
                     <div className="flex gap-1 h-3 items-end">
                       <span className="w-1 bg-current h-2 animate-[bounce_0.5s_infinite]"></span>
                       <span className="w-1 bg-current h-3 animate-[bounce_0.7s_infinite]"></span>
                       <span className="w-1 bg-current h-1 animate-[bounce_0.9s_infinite]"></span>
                     </div>
                 ) : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>}
                 {currentAudioText === msg.text ? 'Streaming' : 'Play Audio'}
              </button>
            )}
          </div>
        ))}
        {loading && <div className="text-center"><span className="text-[10px] font-black text-indigo-400 tracking-[0.3em] animate-pulse uppercase bg-gray-900/50 backdrop-blur px-4 py-2 rounded-full border border-indigo-500/20">Wise is analyzing...</span></div>}
        {isListening && <div className="flex justify-center items-center py-4 space-x-2 animate-fade-in"><div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div><span className="text-white text-[10px] font-black tracking-widest uppercase bg-red-600 px-3 py-1 rounded-full">Listening Now</span></div>}
        <div ref={scrollRef} />
      </div>

      {/* Bottom Interface */}
      <div className={`absolute bottom-0 left-0 right-0 z-20 transition-all duration-700 ${arrivalState === 'arrived' ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
        <div className="bg-gradient-to-t from-gray-950 via-gray-950/95 to-transparent p-6 pb-12">
            <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide px-2">
               {['History here?', 'Photo tips?', 'Nearby snacks?'].map(chip => (
                 <button key={chip} onClick={() => handleSend(chip)} className="whitespace-nowrap px-6 py-3 bg-white/10 backdrop-blur-xl rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/20 transition-all">
                   {chip}
                 </button>
               ))}
               <button onClick={goToNextStop} className="whitespace-nowrap px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-xl shadow-indigo-600/20">
                 Next Stop <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
               </button>
            </div>

            <div className="flex items-center gap-4 px-2">
               <button onClick={() => fileInputRef.current?.click()} className="h-16 w-16 bg-white/10 backdrop-blur-2xl rounded-3xl flex items-center justify-center border border-white/20 hover:bg-white/20 transition-all">
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
               </button>
               <button onClick={toggleMic} className={`h-16 w-16 rounded-3xl flex items-center justify-center border transition-all ${isListening ? 'bg-red-500 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]' : 'bg-white/10 backdrop-blur-2xl border-white/20 hover:bg-white/20'}`}><svg className={`w-7 h-7 text-white`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg></button>
               <div className="flex-1 relative">
                 <input type="text" className="w-full bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl px-8 py-5 text-[15px] font-bold text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-white/30 transition-all" placeholder="Ask Wise..." value={inputText} onChange={e => setInputText(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend(inputText)} />
               </div>
               <button onClick={() => handleSend(inputText)} className="h-16 w-16 bg-white text-gray-900 rounded-3xl flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all">
                 <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14m-7-7l7 7-7 7" /></svg>
               </button>
            </div>
        </div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
    </div>
  );
};
