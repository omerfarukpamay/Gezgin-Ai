import React, { useState, useEffect, useRef } from 'react';
import { TripPlan, UserPreferences, PlanInsight, Activity, BriefingData, UserProfile, Message } from '../types';
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
  // Lifted Messages
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
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
  const d = R * c; 
  return d.toFixed(1);
};

const getEstimatedCost = (type?: string): number => {
  switch (type) {
    case 'food': return 35;
    case 'culture': return 25;
    case 'nightlife': return 50;
    case 'shopping': return 0;
    case 'nature': return 0;
    case 'sport': return 40;
    default: return 0;
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
  onDeleteDraft,
  messages,
  setMessages
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
  const markerLayerRef = useRef<any>(null);

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
    let mockInsights: PlanInsight[] = [
       {
        id: '1',
        type: 'weather',
        message: '📅 Tuesday might be windy in Chicago (54°F). I recommend a light jacket.',
      }
    ];
    setInsights(mockInsights);
    const timer = setTimeout(() => {
        setActiveNotification({
            title: "Next Stop Check",
            msg: "You are 15 mins away from Art Institute. Traffic is light, plan to leave by 11:15 AM.",
            type: 'info'
        });
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
    if (viewMode === 'map' && window.L) {
      const container = document.getElementById('map-container');
      if (!container || (container as any)._leaflet_id) return;
      const map = window.L.map(container).setView([41.8781, -87.6298], 13);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      const markerGroup = window.L.featureGroup().addTo(map);
      mapRef.current = map;
      markerLayerRef.current = markerGroup;
      return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerLayerRef.current = null; } };
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === 'map' && mapRef.current && markerLayerRef.current && window.L) {
      const markerGroup = markerLayerRef.current;
      markerGroup.clearLayers();
      const bounds = window.L.latLngBounds([]);
      let hasPoints = false;
      filteredActivities.forEach((act, index) => {
         if (act.lat && act.lng) {
             hasPoints = true;
             const marker = window.L.marker([act.lat, act.lng]).addTo(markerGroup).bindPopup(`<b>${index + 1}. ${act.activity}</b>`);
             if (index === 0) marker.openPopup();
             bounds.extend([act.lat, act.lng]);
         }
      });
      if (hasPoints) mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [filteredActivities, viewMode]);

  const dismissInsight = (id: string) => setInsights(prev => prev.filter(i => i.id !== id));
  const handleDeleteActivity = (id: string) => setPlan(prev => ({ ...prev, activities: prev.activities.filter(act => act.id !== id) }));

  const handleGetBriefing = async () => {
    setIsBriefingOpen(true);
    if (briefingData) return; 
    setIsGeneratingBriefing(true);
    try {
      const response = await sendMessageToGemini([], "Generate daily prep briefing", plan, 'BRIEFING', preferences);
      let text = response.text;
      if (text.includes('```')) text = text.replace(/```json/g, '').replace(/```/g, '');
      const parsedData = JSON.parse(text) as BriefingData;
      setBriefingData(parsedData);
    } catch (e) {
      setBriefingData({
          headline: "Briefing Unavailable",
          summary: "Could not retrieve intelligence.",
          weather: { temp: "--", condition: "Unknown", emoji: "🤔", advice: "Check local weather app." },
          dressCode: { title: "Casual", description: "Dress comfortably." },
          packing: ["Phone", "Wallet"], transport: "Check maps.", culturalTip: "Be polite.", safetyTip: "Stay aware."
      });
    } finally { setIsGeneratingBriefing(false); }
  };

  const handleLiveCheck = () => {
    setIsCheckingLive(true);
    setTimeout(() => {
      setInsights(prev => [{ id: Date.now().toString(), type: 'transport', message: '🚦 Live Update: Heavy traffic reported on Michigan Ave.' }, ...prev]);
      setIsCheckingLive(false);
    }, 2500);
  };

  const getFallbackImage = (type?: string) => {
    switch(type) {
      case 'food': return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=200';
      case 'culture': return 'https://images.unsplash.com/photo-1551969014-a22c630aa946?q=80&w=200';
      default: return 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=200';
    }
  };

  const getTransportEmoji = (mode: string, distance: number) => {
      if (distance < 0.3) return '🚶';
      switch(mode) {
          case 'public': return '🚌';
          case 'rideshare': return '🚖';
          case 'private': return '🚗';
          default: return '🚶';
      }
  };

  return (
    <div className="h-[100dvh] bg-gray-100 dark:bg-gray-900 flex flex-col md:flex-row p-4 gap-4 overflow-hidden transition-colors duration-300 relative">
      
      {activeNotification && (
        <div className="absolute bottom-6 right-6 z-[60] max-w-sm animate-slide-up">
           <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-l-4 border-indigo-500 p-4 flex items-start gap-3">
              <div className="bg-indigo-100 dark:bg-indigo-900/50 p-2 rounded-full text-indigo-600 dark:text-indigo-400 font-bold">!</div>
              <div className="flex-1">
                 <h4 className="font-bold text-gray-900 dark:text-white text-sm">{activeNotification.title}</h4>
                 <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{activeNotification.msg}</p>
                 <button className="text-[10px] font-bold text-indigo-600 mt-1 uppercase">Open Map →</button>
              </div>
              <button onClick={() => setActiveNotification(null)} className="text-gray-400 hover:text-gray-600">✕</button>
           </div>
        </div>
      )}

      {/* LEFT: Itinerary View */}
      <div className="w-full md:w-1/3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden transition-colors">
        
        {/* REFINED HEADER - Match Screenshot */}
        <div className="bg-white dark:bg-gray-800 p-4 pb-0 space-y-4">
            {/* Top Row: Navigation | View Toggle | Profile */}
            <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button onClick={onNewPlan} className="w-10 h-10 rounded-full bg-gray-50/80 dark:bg-gray-800 text-gray-500 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm" title="New">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button onClick={() => setIsDraftsOpen(true)} className="w-10 h-10 rounded-full bg-gray-50/80 dark:bg-gray-800 text-gray-500 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 relative shadow-sm transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    {drafts.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                        {drafts.length}
                      </span>
                    )}
                  </button>
                </div>

                <div className="bg-gray-100 dark:bg-gray-900 rounded-full p-1 flex w-44 relative">
                    <button onClick={() => setViewMode('list')} className={`flex-1 py-1.5 text-[10px] font-black uppercase z-10 transition-colors ${viewMode === 'list' ? 'text-indigo-600' : 'text-gray-400'}`}>List View</button>
                    <button onClick={() => setViewMode('map')} className={`flex-1 py-1.5 text-[10px] font-black uppercase z-10 transition-colors ${viewMode === 'map' ? 'text-indigo-600' : 'text-gray-400'}`}>Map View</button>
                    <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-gray-700 rounded-full shadow-sm transition-transform duration-300 ${viewMode === 'list' ? 'translate-x-0' : 'translate-x-[calc(100%)]'}`}></div>
                </div>

                <button onClick={onOpenProfile} className="w-10 h-10 rounded-full overflow-hidden border-2 border-white dark:border-gray-800 shadow-sm transition-transform hover:scale-105">
                    <img src={userProfile.avatarUrl} alt="Profile" className="w-full h-full object-cover"/>
                </button>
            </div>

            {/* Day Selector Row */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
                 {days.map(day => (
                    <button key={day} onClick={() => setActiveDay(day)} className={`px-5 py-2 rounded-full text-[10px] font-black whitespace-nowrap uppercase tracking-widest transition-all ${activeDay === day ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-700 text-gray-400'}`}>Day {day}</button>
                 ))}
            </div>

            {/* Unified Stats Bar */}
            <div className="flex items-center bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-3">
                <div className="flex-1 flex justify-around items-center px-2">
                    <div className="flex items-center gap-1.5">
                        <span className="text-sm">🏃</span>
                        <span className="text-xs font-black dark:text-white tracking-tight">{totalDayDistance} mi</span>
                    </div>
                    <div className="w-px h-3 bg-gray-200 dark:bg-gray-700"></div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-sm">💰</span>
                        <span className="text-xs font-black dark:text-white tracking-tight">~${estimatedDayBudget} <span className="text-[8px] opacity-40 uppercase">est.</span></span>
                    </div>
                    <div className="w-px h-3 bg-gray-200 dark:bg-gray-700"></div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-sm">📍</span>
                        <span className="text-xs font-black dark:text-white tracking-tight">{stopCount} Stops</span>
                    </div>
                </div>
                <button 
                  onClick={handleLiveCheck} 
                  disabled={isCheckingLive}
                  className="bg-white/80 dark:bg-gray-800 border border-indigo-100 dark:border-indigo-900 rounded-full px-3 py-1 text-[9px] font-black text-indigo-600 flex items-center gap-1.5 hover:scale-105 transition-transform shrink-0"
                >
                    <span className={`w-1.5 h-1.5 rounded-full ${isCheckingLive ? 'bg-gray-400 animate-spin' : 'bg-green-500 animate-pulse'}`}></span>
                    Live Check
                </button>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900/50 relative">
          {insights.map(insight => (
            <div key={insight.id} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 p-3 rounded-xl flex items-start gap-3 shadow-sm">
              <span className="text-lg">💡</span>
              <p className="text-xs text-blue-900 dark:text-blue-100 leading-relaxed font-medium flex-1">{insight.message}</p>
              <button onClick={() => dismissInsight(insight.id)} className="text-blue-300">✕</button>
            </div>
          ))}

          {viewMode === 'list' && (
             <div className="relative border-l-2 border-dashed border-gray-200 dark:border-gray-800 ml-4 space-y-8 py-2">
              {filteredActivities.map((item, index) => {
                let distanceToNext = null;
                if (index < filteredActivities.length - 1) {
                  const nextItem = filteredActivities[index + 1];
                  if (item.lat && item.lng && nextItem.lat && nextItem.lng) {
                     distanceToNext = calculateDistance(item.lat, item.lng, nextItem.lat, nextItem.lng);
                  }
                }

                return (
                <div key={item.id} className="relative pl-6 group">
                  <div className={`absolute -left-[9px] top-8 w-4 h-4 rounded-full border-2 ${item.status === 'booked' ? 'bg-green-500 border-green-200' : 'bg-white border-indigo-400 dark:bg-gray-800'}`}></div>
                  
                  {distanceToNext && (
                    <div className="absolute -left-[42px] top-[calc(100%+20px)] -translate-y-1/2 w-20 z-10 flex justify-center pointer-events-none">
                        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded-full text-[9px] font-black text-gray-500 dark:text-gray-400 shadow-sm flex items-center gap-1.5">
                           <span>{getTransportEmoji(preferences.transport, parseFloat(distanceToNext))}</span>
                           <span>{distanceToNext} mi</span>
                        </div>
                    </div>
                  )}

                  <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:translate-x-1 transition-all group/card">
                    <div className="flex flex-row min-h-[9rem]">
                        <div className="w-[110px] shrink-0 relative">
                            <img src={item.imageUrl || getFallbackImage(item.type)} alt={item.activity} className="absolute inset-0 w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-700" />
                            <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-md text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">{item.time}</div>
                        </div>
                        <div className="flex-1 p-3 pb-4 flex flex-col justify-between">
                             <div className="flex justify-between items-start gap-2">
                                 <div>
                                     <div className="flex gap-2 items-center mb-1">
                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${item.type === 'food' ? 'text-orange-600 bg-orange-50 border-orange-100' : 'text-purple-600 bg-purple-50 border-purple-100'}`}>{item.type || 'NATURE'}</span>
                                        <span className="text-[8px] font-black text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{item.priceLevel || 'Free'}</span>
                                     </div>
                                     <h3 className="font-bold text-xs dark:text-gray-100 leading-tight group-hover/card:text-indigo-600 transition-colors line-clamp-2">{item.activity}</h3>
                                     <p className="text-[10px] text-gray-400 mt-1 line-clamp-1">{item.location}</p>
                                 </div>
                                 <button onClick={() => handleDeleteActivity(item.id)} className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover/card:opacity-100">✕</button>
                             </div>
                             <div className="flex gap-2 items-center mt-3">
                                 {item.bookingUrl && <a href={item.bookingUrl} target="_blank" className="flex-1 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 text-[9px] font-black uppercase text-center flex items-center justify-center gap-1">Book ↗</a>}
                                 <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.location || item.activity)}`} target="_blank" className="flex-1 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 text-[9px] font-black uppercase text-center flex items-center justify-center gap-1">Transit 🚌</a>
                             </div>
                        </div>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}
          {viewMode === 'map' && <div id="map-container" className="h-[400px] w-full rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-700"></div>}
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex gap-3">
          <button onClick={handleGetBriefing} className="flex-1 py-4 rounded-xl font-black text-[10px] uppercase bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors tracking-widest">Trip Briefing</button>
          <button onClick={() => onStartTour(plan)} className="flex-[2] py-4 rounded-xl font-black text-[10px] uppercase bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all tracking-widest">Start Wise Mode</button>
        </div>
      </div>

      <div className="w-full md:w-2/3 h-full">
        <ChatInterface tripPlan={plan} mode="PLANNER" preferences={preferences} messages={messages} setMessages={setMessages} />
      </div>

      {isDraftsOpen && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[70vh] border border-gray-200 dark:border-gray-700 overflow-hidden">
               <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                  <h3 className="font-bold text-lg dark:text-white">Draft Plans</h3>
                  <button onClick={() => setIsDraftsOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full dark:text-white">✕</button>
               </div>
               <div className="overflow-y-auto p-4 space-y-3">
                   {drafts.length === 0 ? (
                       <p className="text-center text-gray-500 py-4">No drafts found.</p>
                   ) : (
                       drafts.map(draft => (
                         <div key={draft.id} className={`w-full rounded-xl border flex overflow-hidden ${draft.id === plan.id ? 'bg-indigo-50 border-indigo-500 dark:bg-indigo-900/30' : 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600'}`}>
                           <button onClick={() => { onLoadDraft(draft); setIsDraftsOpen(false); }} className="flex-1 text-left p-4">
                              <h4 className="font-bold text-gray-800 dark:text-white">{draft.destination}</h4>
                           </button>
                           <button onClick={(e) => { e.stopPropagation(); onDeleteDraft(draft.id); }} className="px-4 text-gray-400 hover:text-red-500">✕</button>
                         </div>
                       ))
                   )}
               </div>
           </div>
        </div>
      )}

      {isBriefingOpen && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-black dark:text-white">{briefingData?.headline || "Loading..."}</h2>
              <button onClick={() => setIsBriefingOpen(false)} className="text-gray-600 dark:text-white">✕</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-gray-50 dark:bg-gray-900/50">
               {isGeneratingBriefing ? <div className="text-center py-20 text-gray-500">Scanning itinerary...</div> : briefingData && (
                 <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border-l-4 border-indigo-500">
                        <p className="text-sm text-gray-600 dark:text-gray-300 italic">"{briefingData.summary}"</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm">Dress Code</h3>
                            <p className="text-xs text-gray-500">{briefingData.dressCode.description}</p>
                        </div>
                    </div>
                 </div>
               )}
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 text-center">
               <button onClick={() => setIsBriefingOpen(false)} className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold">
                  Acknowledge & Close
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
