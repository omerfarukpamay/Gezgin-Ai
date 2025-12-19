import React, { useState, useEffect, useRef } from 'react';
import { TripPlan, UserPreferences, PlanInsight, Activity, BriefingData, UserProfile } from '../types';
import { ChatInterface } from './ChatInterface';
import { sendMessageToGemini } from '../services/geminiService';

// Add type definition for Leaflet since it's loaded via CDN
declare global {
  interface Window {
    L: any;
  }
}

interface PlanDashboardProps {
  plan: TripPlan;
  preferences: UserPreferences;
  userProfile: UserProfile;
  onStartTour: (updatedPlan: TripPlan) => void;
  onOpenProfile: () => void;
  onToggleFavorite: (activity: Activity) => void;
  favoriteIds: string[];
  onNewPlan: () => void;
  // Draft features
  drafts: TripPlan[];
  onLoadDraft: (plan: TripPlan) => void;
  onUpdatePlan: (plan: TripPlan) => void;
  onDeleteDraft: (planId: string) => void;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return (R * c).toFixed(1);
};

const getEstimatedCost = (type?: string): number => {
  switch (type) {
    case 'food': return 35;
    case 'culture': return 25;
    case 'nightlife': return 50;
    case 'sport': return 40;
    default: return 0;
  }
};

const getPriceLabel = (type?: string): string => {
   switch (type) {
    case 'nature':
    case 'general': return 'Free';
    case 'food':
    case 'culture': return '$$';
    case 'nightlife':
    case 'shopping': return '$$$';
    default: return 'Free';
  }
};

export const PlanDashboard: React.FC<PlanDashboardProps> = ({ 
  plan: initialPlan, 
  preferences, 
  userProfile,
  onStartTour, 
  onOpenProfile,
  onToggleFavorite,
  favoriteIds,
  onNewPlan,
  drafts,
  onLoadDraft,
  onUpdatePlan,
  onDeleteDraft
}) => {
  const [plan, setPlan] = useState<TripPlan>({ ...initialPlan, status: 'confirmed' });
  const [insights, setInsights] = useState<PlanInsight[]>([]);
  const [activeDay, setActiveDay] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list'); 
  const [isCheckingLive, setIsCheckingLive] = useState(false);
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  const [briefingData, setBriefingData] = useState<BriefingData | null>(null);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  const [isDraftsOpen, setIsDraftsOpen] = useState(false);
  const [activeNotification, setActiveNotification] = useState<{title: string, msg: string, type: 'info' | 'alert'} | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    setPlan({ ...initialPlan, status: 'confirmed' });
  }, [initialPlan.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
       if (plan.id === initialPlan.id && JSON.stringify(plan) !== JSON.stringify(initialPlan)) {
           onUpdatePlan(plan);
       }
    }, 1000);
    return () => clearTimeout(timer);
  }, [plan, initialPlan, onUpdatePlan]);

  useEffect(() => {
    setInsights([{ id: '1', type: 'weather', message: '📅 Tuesday might be windy in Chicago (54°F). Jacket recommended.' }]);
    const timer = setTimeout(() => {
        setActiveNotification({ title: "Smart Reminder", msg: "Next stop Art Institute is 15 mins away. Traffic is clear.", type: 'info' });
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const filteredActivities = plan.activities.filter(a => (a.day || 1) === activeDay);
  
  let totalDayDistance = 0;
  for (let i = 0; i < filteredActivities.length - 1; i++) {
     const curr = filteredActivities[i];
     const next = filteredActivities[i+1];
     if (curr.lat && curr.lng && next.lat && next.lng) {
        totalDayDistance += parseFloat(calculateDistance(curr.lat, curr.lng, next.lat, next.lng));
     }
  }
  
  const estimatedDayBudget = filteredActivities.reduce((acc, act) => acc + getEstimatedCost(act.type), 0);
  const stopCount = filteredActivities.length;
  const days = Array.from(new Set(plan.activities.map(a => a.day || 1))).sort();

  useEffect(() => {
    if (viewMode === 'map' && window.L && document.getElementById('map-container')) {
      if (mapRef.current) mapRef.current.remove();
      const map = window.L.map('map-container').setView([41.8781, -87.6298], 13);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      const bounds = window.L.latLngBounds([]);
      let hasPoints = false;
      filteredActivities.forEach((act, index) => {
         if (act.lat && act.lng) {
             hasPoints = true;
             window.L.marker([act.lat, act.lng]).addTo(map).bindPopup(`<b>${act.activity}</b>`);
             bounds.extend([act.lat, act.lng]);
         }
      });
      if (hasPoints) map.fitBounds(bounds, { padding: [50, 50] });
      mapRef.current = map;
      return () => { if(mapRef.current) mapRef.current.remove(); }
    }
  }, [viewMode, filteredActivities]);

  const handleGetBriefing = async () => {
    setIsBriefingOpen(true);
    if (briefingData) return; 
    setIsGeneratingBriefing(true);
    try {
      const response = await sendMessageToGemini([], "Generate ultra-brief daily prep", plan, 'BRIEFING', preferences);
      let text = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
      setBriefingData(JSON.parse(text));
    } catch (e) {
      console.error(e);
      setBriefingData({
          headline: "Trip Brief",
          summary: "Itinerary is ready for deployment.",
          weather: { temp: "--", condition: "Fair", emoji: "🌤", advice: "Check local forecast before leaving." },
          dressCode: { title: "Comfortable", description: "Dress for a day of exploration." },
          packing: ["Phone", "ID", "Power Bank"],
          transport: "Walking is recommended for these distances.",
          culturalTip: "Be polite and enjoy the local vibe.",
          safetyTip: "Stay aware of your surroundings."
      });
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  const handleLiveCheck = () => {
    setIsCheckingLive(true);
    setTimeout(() => {
      setInsights(prev => [{ id: Date.now().toString(), type: 'transport', message: '🚦 Traffic Update: Michigan Ave is clear.' }, ...prev]);
      setIsCheckingLive(false);
    }, 2000);
  };

  const getFallbackImage = (type?: string) => {
    switch(type) {
      case 'food': return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=200';
      case 'culture': return 'https://images.unsplash.com/photo-1551969014-a22c630aa946?q=80&w=200';
      case 'nature': return 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=200';
      case 'nightlife': return 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?q=80&w=200';
      default: return 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=200';
    }
  };

  return (
    <div className="h-[100dvh] bg-gray-100 dark:bg-gray-900 flex flex-col md:flex-row p-4 gap-4 overflow-hidden transition-colors relative">
      
      {/* NOTIFICATION */}
      {activeNotification && (
        <div className="absolute bottom-6 right-6 z-[60] max-w-sm animate-slide-up">
           <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-l-4 border-indigo-500 p-4 flex items-start gap-3">
              <div className="flex-1">
                 <h4 className="font-bold text-gray-900 dark:text-white text-sm">{activeNotification.title}</h4>
                 <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{activeNotification.msg}</p>
              </div>
              <button onClick={() => setActiveNotification(null)} className="text-gray-400">✕</button>
           </div>
        </div>
      )}

      {/* DRAFTS MODAL */}
      {isDraftsOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[70vh] border border-gray-200 dark:border-gray-700">
               <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                  <h3 className="font-bold dark:text-white">Drafts</h3>
                  <button onClick={() => setIsDraftsOpen(false)} className="dark:text-white">✕</button>
               </div>
               <div className="overflow-y-auto p-4 space-y-3">
                   {drafts.map(draft => (
                     <button key={draft.id} onClick={() => { onLoadDraft(draft); setIsDraftsOpen(false); }} className="w-full text-left p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <h4 className="font-bold text-sm dark:text-white">{draft.destination}</h4>
                        <p className="text-[10px] text-gray-500">{draft.activities.length} activities</p>
                     </button>
                   ))}
               </div>
           </div>
        </div>
      )}

      {/* RE-DESIGNED BRIEFING MODAL (Simplified) */}
      {isBriefingOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-scale-up border border-indigo-100 dark:border-indigo-900/30">
            
            {/* Header */}
            <div className="p-5 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center">
              <div>
                 <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">{briefingData?.headline || "Trip Intel"}</h2>
                 <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Action Report</p>
              </div>
              <button onClick={() => setIsBriefingOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full dark:text-white">✕</button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto space-y-5">
               {isGeneratingBriefing ? (
                 <div className="h-40 flex flex-col items-center justify-center space-y-3">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs text-gray-500 font-medium">Downloading daily brief...</p>
                 </div>
               ) : briefingData ? (
                 <div className="space-y-4">
                    
                    {/* 1. Quick Vibe Summary */}
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border-l-4 border-indigo-500">
                        <p className="text-sm text-indigo-900 dark:text-indigo-200 leading-snug font-medium italic">
                          "{briefingData.summary}"
                        </p>
                    </div>

                    {/* 2. Weather & Tips Row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-2xl flex items-center gap-3">
                           <div className="text-3xl">{briefingData.weather.emoji}</div>
                           <div className="leading-tight">
                              <div className="text-sm font-black dark:text-white">{briefingData.weather.temp}</div>
                              <div className="text-[10px] text-gray-500 font-bold uppercase">{briefingData.weather.condition}</div>
                           </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-2xl flex items-center gap-3">
                           <div className="text-2xl">👔</div>
                           <div className="leading-tight">
                              <div className="text-sm font-black dark:text-white">{briefingData.dressCode.title}</div>
                              <div className="text-[10px] text-gray-400 font-medium truncate">{briefingData.dressCode.description.substring(0, 15)}...</div>
                           </div>
                        </div>
                    </div>

                    {/* 3. Single Insight Lines */}
                    <div className="space-y-2">
                       <div className="flex items-center gap-2 text-xs">
                          <span className="shrink-0 text-base">🚦</span>
                          <span className="text-gray-600 dark:text-gray-300">{briefingData.transport}</span>
                       </div>
                       <div className="flex items-center gap-2 text-xs">
                          <span className="shrink-0 text-base">🛡️</span>
                          <span className="text-gray-600 dark:text-gray-300">{briefingData.safetyTip}</span>
                       </div>
                    </div>

                    {/* 4. Deploy Gear (Checklist) */}
                    <div className="bg-gray-900 dark:bg-black rounded-2xl p-4 shadow-xl">
                        <h3 className="text-white text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                           <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                           Deploy Gear
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                           {briefingData.packing.map((item, idx) => (
                             <label key={idx} className="flex items-center gap-3 p-2 bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors group">
                                <input type="checkbox" className="w-4 h-4 rounded border-white/20 bg-transparent text-indigo-500 focus:ring-0" />
                                <span className="text-xs text-gray-300 group-hover:text-white font-medium">{item}</span>
                             </label>
                           ))}
                        </div>
                    </div>

                 </div>
               ) : null}
            </div>
            
            <div className="p-4 border-t border-gray-50 dark:border-gray-700">
               <button onClick={() => setIsBriefingOpen(false)} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none">
                  Got it!
               </button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT: Itinerary */}
      <div className="w-full md:w-1/3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden transition-colors">
        
        {/* COMPACT Header */}
        <div className="bg-white dark:bg-gray-800 z-10 shadow-sm border-b dark:border-gray-700">
          <div className="p-3">
            <div className="flex items-center gap-3 mb-3">
                <div className="flex gap-1">
                  <button onClick={onNewPlan} className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-indigo-100 transition-colors" title="New"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></button>
                  <button onClick={() => setIsDraftsOpen(true)} className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-amber-100 transition-colors relative"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg></button>
                </div>
                <div className="flex-1 min-w-0">
                     <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">{plan.destination}</h1>
                     <div className="flex items-center gap-2 mt-0.5">
                         <div className="text-[10px] text-gray-500 font-bold uppercase">{stopCount} stops • {totalDayDistance.toFixed(1)} mi</div>
                     </div>
                </div>
                 <button onClick={onOpenProfile} className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-700 overflow-hidden shadow-sm"><img src={userProfile.avatarUrl} alt="P" className="w-full h-full object-cover"/></button>
            </div>
            <div className="flex justify-between items-center gap-2">
                <div className="flex gap-1 overflow-x-auto scrollbar-hide flex-1">
                     {days.map(day => (
                        <button key={day} onClick={() => setActiveDay(day)} className={`px-4 py-1.5 rounded-full text-[11px] font-black transition-all ${activeDay === day ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-50 dark:bg-gray-700 text-gray-500'}`}>Day {day}</button>
                     ))}
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 shrink-0">
                    <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-white shadow' : 'text-gray-400'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
                    <button onClick={() => setViewMode('map')} className={`p-1.5 rounded-md ${viewMode === 'map' ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-white shadow' : 'text-gray-400'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg></button>
                </div>
            </div>
          </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900/50 transition-colors relative">
          <div className="absolute top-4 right-4 z-[400]"><button onClick={handleLiveCheck} className="bg-white/90 dark:bg-gray-800/90 shadow rounded-full px-3 py-1 text-[10px] font-bold text-indigo-600 flex items-center gap-1">Check Live</button></div>
          {insights.map(i => <div key={i.id} className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl text-xs text-blue-900 dark:text-blue-100 border border-blue-100">{i.message}</div>)}
          
          {viewMode === 'list' && (
             <div className="relative border-l-2 border-dashed border-gray-300 dark:border-gray-700 ml-3 space-y-8 py-2">
              {filteredActivities.map((item, index) => {
                let distanceToNext = null;
                if (index < filteredActivities.length - 1) {
                  const nextItem = filteredActivities[index + 1];
                  if (item.lat && nextItem.lat) distanceToNext = calculateDistance(item.lat, item.lng!, nextItem.lat, nextItem.lng!);
                }
                return (
                <div key={item.id} className="relative pl-6">
                  <div className={`absolute -left-[9px] top-8 w-4 h-4 rounded-full border-2 ${item.status === 'booked' ? 'bg-green-500 border-green-200' : 'bg-white border-indigo-400'}`}></div>
                  {distanceToNext && <div className="absolute -left-[35px] top-[calc(100%+16px)] w-20 z-10 flex justify-center"><div className="bg-white dark:bg-gray-800 border px-2 py-0.5 rounded-full text-[9px] font-bold text-gray-400 shadow-sm">{distanceToNext} mi</div></div>}
                  <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border dark:border-gray-700 shadow-sm flex h-32">
                        <div className="w-1/3 relative"><img src={item.imageUrl || getFallbackImage(item.type)} className="absolute inset-0 w-full h-full object-cover" /><div className="absolute top-2 left-2 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">{item.time}</div></div>
                        <div className="w-2/3 p-3 flex flex-col justify-between">
                             <div>
                                 <div className="flex gap-1.5 mb-1">
                                     <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600">{item.type || 'Activity'}</span>
                                     <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-gray-50 dark:bg-gray-700 text-gray-500">{item.priceLevel || getPriceLabel(item.type)}</span>
                                 </div>
                                 <h3 className="font-bold text-xs dark:text-gray-200 line-clamp-1">{item.activity}</h3>
                                 <p className="text-[10px] text-gray-500 truncate">{item.location}</p>
                             </div>
                             <div className="flex gap-1.5">
                                 {item.bookingUrl && <a href={item.bookingUrl} target="_blank" className="flex-1 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 text-[9px] font-bold text-center rounded-lg">Book ↗</a>}
                                 <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.location || item.activity)}`} target="_blank" className="flex-1 py-1 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[9px] font-bold text-center rounded-lg">Maps</a>
                             </div>
                        </div>
                  </div>
                </div>
              )})}
            </div>
          )}

          {viewMode === 'map' && <div className="h-full rounded-2xl overflow-hidden border dark:border-gray-700"><div id="map-container" className="w-full h-full"></div></div>}
        </div>

        <div className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800 flex gap-2">
          <button onClick={handleGetBriefing} className="flex-1 py-4 rounded-xl font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600">Daily Intel</button>
          <button onClick={() => onStartTour(plan)} className="flex-[2] py-4 rounded-xl font-bold bg-indigo-600 text-white shadow-lg">Start Wise Mode</button>
        </div>
      </div>

      {/* RIGHT: Chat */}
      <div className="w-full md:w-2/3 h-full">
        <ChatInterface tripPlan={plan} mode="PLANNER" preferences={preferences} />
      </div>
    </div>
  );
};