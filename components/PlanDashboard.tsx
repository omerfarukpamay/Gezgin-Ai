
import React, { useState, useEffect, useRef } from 'react';
import { TripPlan, UserPreferences, Activity, BriefingData, UserProfile } from '../types';
import { ChatInterface } from './ChatInterface';
import { sendMessageToGemini } from '../services/geminiService';

declare global {
  interface Window {
    L: any;
  }
}

interface LiveStatus {
  id: string;
  status: 'open' | 'busy' | 'closed' | 'alert';
  message: string;
  details: string;
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
  const [plan, setPlan] = useState<TripPlan>(initialPlan);
  const [activeDay, setActiveDay] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list'); 
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  const [isDraftsOpen, setIsDraftsOpen] = useState(false);
  const [briefingData, setBriefingData] = useState<BriefingData | null>(null);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  const [isCheckingLive, setIsCheckingLive] = useState(false);
  const [liveStatuses, setLiveStatuses] = useState<Record<string, LiveStatus>>({});
  const [activeNotification, setActiveNotification] = useState<{title: string, msg: string} | null>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    setPlan(initialPlan);
    setBriefingData(null); 
    setLiveStatuses({});
  }, [initialPlan.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
        setActiveNotification({ 
          title: "Next Stop Check", 
          msg: "You are 15 mins away from Art Institute. Traffic is light, plan to leave by 11:15 AM." 
        });
    }, 2000);
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
  
  const estimatedDayBudget = filteredActivities.reduce((acc, act) => acc + (act.estimatedCost || 0), 0);
  const stopCount = filteredActivities.length;
  const days = Array.from(new Set(plan.activities.map(a => a.day || 1))).sort();

  useEffect(() => {
    const container = document.getElementById('map-container');
    if (viewMode === 'map' && window.L && container) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      
      const map = window.L.map('map-container', { zoomControl: false }).setView([41.8781, -87.6298], 13);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      const bounds = window.L.latLngBounds([]);
      let hasPoints = false;
      filteredActivities.forEach((act) => {
         if (act.lat && act.lng) {
             hasPoints = true;
             window.L.marker([act.lat, act.lng]).addTo(map).bindPopup(`<b>${act.activity}</b>`);
             bounds.extend([act.lat, act.lng]);
         }
      });
      if (hasPoints) map.fitBounds(bounds, { padding: [50, 50] });
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [viewMode, filteredActivities]);

  const handleLiveCheck = async () => {
    if (isCheckingLive) return;
    setIsCheckingLive(true);
    try {
      const response = await sendMessageToGemini([], "Audit the itinerary status", plan, 'LIVE_CHECK', preferences, undefined, undefined, { day: activeDay } as any);
      const text = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
      const statuses: LiveStatus[] = JSON.parse(text);
      const statusMap: Record<string, LiveStatus> = {};
      statuses.forEach(s => {
        statusMap[s.id] = s;
      });
      setLiveStatuses(statusMap);
      
      const alertCount = statuses.filter(s => s.status === 'closed' || s.status === 'alert').length;
      if (alertCount > 0) {
        setActiveNotification({
          title: "Live Update",
          msg: `We found ${alertCount} items needing attention in today's plan.`
        });
      }
    } catch (e) {
      console.error("Live Check failed:", e);
    } finally {
      setIsCheckingLive(false);
    }
  };

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
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  const removeActivity = (id: string) => {
    const updatedActivities = plan.activities.filter(a => a.id !== id);
    const updatedPlan = { ...plan, activities: updatedActivities };
    setPlan(updatedPlan);
    onUpdatePlan(updatedPlan);
  };

  const openTransit = (activity: Activity) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${activity.lat},${activity.lng}`;
    window.open(url, '_blank');
  };

  return (
    <div className="h-screen bg-gray-100 flex flex-col md:flex-row p-4 gap-4 overflow-hidden relative">
      
      {/* FLOATING NOTIFICATION */}
      {activeNotification && (
        <div className="absolute bottom-6 right-6 z-[100] w-80 animate-slide-up">
           <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-indigo-100 p-4 flex gap-4 relative">
              <button onClick={() => setActiveNotification(null)} className="absolute top-2 right-3 text-gray-400 hover:text-gray-600 transition-colors text-lg">×</button>
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div className="flex-1 pr-2">
                 <h4 className="font-bold text-gray-900 text-sm">{activeNotification.title}</h4>
                 <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">{activeNotification.msg}</p>
                 <button onClick={() => setViewMode('map')} className="text-[11px] font-bold text-indigo-600 mt-2 hover:underline">Open Map →</button>
              </div>
           </div>
        </div>
      )}

      {/* LEFT SIDEBAR (Itinerary) */}
      <div className="w-full md:w-1/3 bg-white rounded-3xl shadow-xl flex flex-col overflow-hidden border border-gray-100 relative">
        
        {/* DRAFTS OVERLAY */}
        {isDraftsOpen && (
          <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-md flex flex-col p-6 animate-fade-in">
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-xl text-gray-900">Your Drafts</h3>
                <button onClick={() => setIsDraftsOpen(false)} className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200">✕</button>
             </div>
             <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                {drafts.length === 0 ? (
                  <p className="text-center text-gray-400 py-10 text-sm font-medium italic">No saved drafts yet.</p>
                ) : drafts.map(draft => (
                  <div key={draft.id} className={`p-4 rounded-2xl border transition-all flex justify-between items-center group cursor-pointer ${plan.id === draft.id ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-100 hover:border-indigo-100'}`} onClick={() => { onLoadDraft(draft); setIsDraftsOpen(false); }}>
                     <div>
                        <h4 className="font-bold text-sm text-gray-800">{draft.destination}</h4>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{draft.activities.length} Stops</p>
                     </div>
                     <div className="flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDeleteDraft(draft.id); }} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* Header */}
        <div className="p-4 bg-white border-b border-gray-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <button onClick={onNewPlan} className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-gray-100 transition-colors" title="New Trip">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
              <button 
                onClick={() => setIsDraftsOpen(true)} 
                className={`p-2 rounded-lg transition-colors relative ${isDraftsOpen ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                title="Drafts Folder"
              >
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                 {drafts.length > 0 && !isDraftsOpen && (
                   <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
                 )}
              </button>
            </div>
            
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>List</button>
              <button onClick={() => setViewMode('map')} className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${viewMode === 'map' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>Map</button>
            </div>

            <button onClick={onOpenProfile} className="w-10 h-10 rounded-full border-2 border-white overflow-hidden shadow-sm">
              <img src={userProfile.avatarUrl} alt="User" className="w-full h-full object-cover" />
            </button>
          </div>

          <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
            {days.map(day => (
              <button key={day} onClick={() => setActiveDay(day)} className={`px-6 py-2 rounded-full text-[10px] font-black tracking-widest uppercase transition-all shrink-0 ${activeDay === day ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400'}`}>Day {day}</button>
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold text-gray-600 px-2 py-2 bg-gray-50/50 rounded-xl">
             <div className="flex items-center gap-1.5"><span className="text-amber-500 text-base">🏃</span><span>{totalDayDistance.toFixed(1)} mi</span></div>
             <div className="h-4 w-px bg-gray-200"></div>
             <div className="flex items-center gap-1.5"><span className="text-amber-500 text-base">💰</span><span>~${estimatedDayBudget}</span></div>
             <div className="h-4 w-px bg-gray-200"></div>
             <div className="flex items-center gap-1.5"><span className="text-rose-500 text-base">🔴</span><span>{stopCount} Stops</span></div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto bg-white p-4 space-y-4 relative z-0">
          <div className="flex justify-end mb-2">
             <button 
                onClick={handleLiveCheck}
                disabled={isCheckingLive}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-tight transition-all ${
                  isCheckingLive 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : Object.keys(liveStatuses).length > 0 
                      ? 'bg-green-50 text-green-600 border border-green-100' 
                      : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                }`}
             >
                <span className={`w-1.5 h-1.5 rounded-full ${isCheckingLive ? 'bg-gray-400 animate-pulse' : 'bg-green-500'}`}></span>
                {isCheckingLive ? 'Checking...' : 'Live Check'}
             </button>
          </div>

          <div className="bg-blue-50/60 border border-blue-100 p-4 rounded-3xl flex gap-3 items-start">
             <div className="text-xl">💡</div>
             <p className="text-[11px] text-blue-800 leading-relaxed font-medium">
               Tuesday might be windy in {plan.destination} (54°F). I recommend a light jacket.
             </p>
          </div>
          
          {viewMode === 'list' ? (
             <div className="relative ml-2 space-y-6 pb-20">
                <div className="absolute left-2.5 top-8 bottom-8 w-0.5 border-l-2 border-dashed border-gray-200"></div>
                
                {filteredActivities.map((item, index) => {
                  const liveStatus = liveStatuses[item.id];
                  let distanceToNext = null;
                  if (index < filteredActivities.length - 1) {
                    const nextItem = filteredActivities[index + 1];
                    if (item.lat && nextItem.lat) distanceToNext = calculateDistance(item.lat, item.lng!, nextItem.lat, nextItem.lng!);
                  }
                  
                  return (
                    <div key={item.id} className="relative pl-10 animate-fade-in">
                      <div className={`absolute left-0 top-10 w-6 h-6 rounded-full border-4 border-white shadow-md z-10 ${
                        liveStatus?.status === 'closed' ? 'bg-red-500' :
                        liveStatus?.status === 'busy' ? 'bg-orange-400' :
                        item.status === 'booked' ? 'bg-green-400' : 'bg-indigo-400'
                      }`}></div>
                      
                      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm flex overflow-hidden min-h-[140px] hover:shadow-md transition-all group">
                        <div className="w-1/3 relative shrink-0 overflow-hidden">
                           <img src={item.imageUrl} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                           <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white text-[9px] font-black px-2 py-0.5 rounded-lg z-10">
                              {item.time}
                           </div>
                        </div>
                        <div className="w-2/3 p-4 flex flex-col">
                           <div className="flex justify-between items-start mb-1">
                              <div className="flex gap-2">
                                 <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider">{item.type}</span>
                                 {liveStatus && (
                                   <span className={`text-[9px] font-black uppercase px-1.5 rounded ${
                                     liveStatus.status === 'open' ? 'text-green-600 bg-green-50' : 
                                     liveStatus.status === 'busy' ? 'text-orange-600 bg-orange-50' : 
                                     'text-red-600 bg-red-50'
                                   }`}>
                                     {liveStatus.status}
                                   </span>
                                 )}
                              </div>
                              <button onClick={() => removeActivity(item.id)} className="text-gray-300 hover:text-red-500 transition-colors">✕</button>
                           </div>
                           <h3 className="font-bold text-sm text-gray-800 line-clamp-2 leading-tight mb-0.5">{item.activity}</h3>
                           <p className="text-[10px] text-gray-400 mb-1">{item.location}</p>
                           
                           {liveStatus && (
                             <p className="text-[9px] font-bold text-indigo-500 italic mb-3">"{liveStatus.message}"</p>
                           )}

                           <div className="mt-auto flex gap-2">
                              {item.bookingUrl && (
                                 <button onClick={() => window.open(item.bookingUrl, '_blank')} className="flex-1 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded-xl border border-blue-100 flex items-center justify-center gap-1 transition-all hover:bg-blue-100">
                                    Book <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" /><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" /></svg>
                                 </button>
                              )}
                              <button onClick={() => openTransit(item)} className="flex-1 py-1.5 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-xl border border-indigo-100 flex items-center justify-center gap-1 transition-all hover:bg-indigo-100">
                                 🗺️ Transit
                              </button>
                           </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
             </div>
          ) : (
            <div className="h-full min-h-[400px] rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-inner relative z-0"><div id="map-container" className="w-full h-full"></div></div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="p-4 bg-white border-t border-gray-50 flex gap-3">
          <button onClick={handleGetBriefing} className="flex-1 py-4 px-6 rounded-2xl font-black text-xs text-orange-700 bg-orange-50 hover:bg-orange-100 transition-all shadow-sm">Briefing</button>
          <button onClick={() => onStartTour(plan)} className="flex-[2] py-4 px-6 rounded-2xl font-black text-xs text-white bg-[#00a68c] hover:bg-[#008f79] transition-all shadow-lg shadow-teal-100">Start Tour</button>
        </div>
      </div>

      {/* RIGHT SIDE (Chat Interface) */}
      <div className="flex-1 h-full">
        <ChatInterface tripPlan={plan} mode="PLANNER" preferences={preferences} onPlanUpdate={(updatedPlan) => { setPlan(updatedPlan); onUpdatePlan(updatedPlan); }} />
      </div>

      {/* BRIEFING MODAL */}
      {isBriefingOpen && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden flex flex-col p-8 border border-gray-100">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Daily Intel</h2>
                <button onClick={() => setIsBriefingOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">✕</button>
             </div>
             {isGeneratingBriefing ? (
                <div className="py-20 text-center space-y-4">
                   <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                   <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Compiling briefing data...</p>
                </div>
             ) : briefingData && (
                <div className="space-y-6">
                   <div className="bg-indigo-50 p-6 rounded-3xl"><p className="text-sm font-medium text-indigo-900 leading-relaxed italic">"{briefingData.summary}"</p></div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-3">
                         <span className="text-3xl">{briefingData.weather.emoji}</span>
                         <div><p className="text-sm font-bold text-gray-900">{briefingData.weather.temp}</p><p className="text-[10px] font-bold text-gray-400 uppercase">{briefingData.weather.condition}</p></div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-3">
                         <span className="text-2xl">🧥</span>
                         <div><p className="text-sm font-bold text-gray-900">{briefingData.dressCode.title}</p><p className="text-[10px] font-bold text-gray-400 uppercase">Dress Code</p></div>
                      </div>
                   </div>
                   <button onClick={() => setIsBriefingOpen(false)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100">Dismiss</button>
                </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};
