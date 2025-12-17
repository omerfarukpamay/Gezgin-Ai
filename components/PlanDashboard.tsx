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

// Haversine formula to calculate distance between two points
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  const d = R * c; // Distance in miles
  return d.toFixed(1);
};

// Helper to estimate cost based on activity type
const getEstimatedCost = (type?: string): number => {
  switch (type) {
    case 'food': return 35; // Average meal
    case 'culture': return 25; // Museum ticket
    case 'nightlife': return 50; // Drinks/Cover
    case 'shopping': return 0; // Spending is variable, base is 0
    case 'nature': return 0; // Parks usually free
    case 'sport': return 40; // Tickets
    default: return 0;
  }
};

// Helper to get Price Label
const getPriceLabel = (type?: string): string => {
   switch (type) {
    case 'nature': return 'Free';
    case 'general': return 'Free';
    case 'food': return '$$';
    case 'culture': return '$$';
    case 'nightlife': return '$$$';
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
  
  // Briefing State
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  const [briefingData, setBriefingData] = useState<BriefingData | null>(null);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);

  // Drafts Modal State
  const [isDraftsOpen, setIsDraftsOpen] = useState(false);

  // Smart Notification State
  const [activeNotification, setActiveNotification] = useState<{title: string, msg: string, type: 'info' | 'alert'} | null>(null);

  // Map Refs
  const mapRef = useRef<any>(null);

  useEffect(() => {
    // When prop plan changes (e.g. loading a draft), update local state
    setPlan({ ...initialPlan, status: 'confirmed' });
  }, [initialPlan.id]); // Use ID to detect different plan loaded

  // Sync changes up to App
  useEffect(() => {
    const timer = setTimeout(() => {
       if (plan.id === initialPlan.id && JSON.stringify(plan) !== JSON.stringify(initialPlan)) {
           onUpdatePlan(plan);
       }
    }, 1000); // Debounce updates
    return () => clearTimeout(timer);
  }, [plan, initialPlan, onUpdatePlan]);


  // Initial setup based on transport mode & Mock Notification
  useEffect(() => {
    let mockInsights: PlanInsight[] = [
       {
        id: '1',
        type: 'weather',
        message: '📅 Tuesday might be windy in Chicago (54°F). I recommend a light jacket.',
      }
    ];
    setInsights(mockInsights);

    // Simulate a Smart Reminder appearing after a delay
    const timer = setTimeout(() => {
        setActiveNotification({
            title: "Next Stop Check",
            msg: "You are 15 mins away from Art Institute. Traffic is light, plan to leave by 11:15 AM.",
            type: 'info'
        });
    }, 4000); // Shows after 4 seconds

    return () => clearTimeout(timer);
  }, []);

  // Filter activities by day
  const filteredActivities = plan.activities.filter(a => (a.day || 1) === activeDay);
  
  // Calculate Day Stats
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

  // Get unique days
  const days = Array.from(new Set(plan.activities.map(a => a.day || 1))).sort();

  // Initialize Map when viewMode changes to 'map'
  useEffect(() => {
    if (viewMode === 'map' && window.L && document.getElementById('map-container')) {
      if (mapRef.current) {
         mapRef.current.remove(); // Clean up existing map
      }

      // Default to Chicago center if no points
      const map = window.L.map('map-container').setView([41.8781, -87.6298], 13);
      
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      const bounds = window.L.latLngBounds([]);
      let hasPoints = false;

      filteredActivities.forEach((act, index) => {
         if (act.lat && act.lng) {
             hasPoints = true;
             const marker = window.L.marker([act.lat, act.lng])
               .addTo(map)
               .bindPopup(`<b>${index + 1}. ${act.activity}</b><br>${act.time}`);
             
             // Open popup for the first one by default
             if (index === 0) marker.openPopup();
             
             bounds.extend([act.lat, act.lng]);
         }
      });

      if (hasPoints) {
         map.fitBounds(bounds, { padding: [50, 50] });
      }

      mapRef.current = map;

      return () => {
        if(mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
        }
      }
    }
  }, [viewMode, filteredActivities]);

  const dismissInsight = (id: string) => {
    setInsights(prev => prev.filter(i => i.id !== id));
  };

  const handleDeleteActivity = (id: string) => {
    setPlan(prev => ({
      ...prev,
      activities: prev.activities.filter(act => act.id !== id)
    }));
  };

  const handleGetBriefing = async () => {
    setIsBriefingOpen(true);
    if (briefingData) return; 

    setIsGeneratingBriefing(true);
    try {
      const response = await sendMessageToGemini(
        [], "Generate daily prep briefing", plan, 'BRIEFING', preferences
      );
      const parsedData = JSON.parse(response.text) as BriefingData;
      setBriefingData(parsedData);
    } catch (e) {
      console.error(e);
      // Fallback if parsing fails
      setBriefingData({
          headline: "Briefing Unavailable",
          weather: { temp: "--", condition: "Unknown", emoji: "🤔", advice: "Check local weather app." },
          dressCode: { title: "Casual", description: "Dress comfortably." },
          packing: ["Phone", "Wallet"],
          transport: "Check maps."
      });
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  // Simulates a real-time check
  const handleLiveCheck = () => {
    setIsCheckingLive(true);
    setTimeout(() => {
      setInsights(prev => [
        {
          id: Date.now().toString(),
          type: 'transport',
          message: '🚦 Live Update: Heavy traffic reported on Michigan Ave. Added 15 mins buffer.',
        },
        ...prev
      ]);
      setIsCheckingLive(false);
    }, 2500);
  };

  // Helper to get fallback images if none provided
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
    <div className="h-[100dvh] bg-gray-100 dark:bg-gray-900 flex flex-col md:flex-row p-4 gap-4 overflow-hidden transition-colors duration-300 relative">
      
      {/* SMART NOTIFICATION TOAST */}
      {activeNotification && (
        <div className="absolute bottom-6 right-6 z-[60] max-w-sm animate-slide-up">
           <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-l-4 border-indigo-500 p-4 flex items-start gap-3">
              <div className="bg-indigo-100 dark:bg-indigo-900/50 p-2 rounded-full text-indigo-600 dark:text-indigo-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div className="flex-1">
                 <h4 className="font-bold text-gray-900 dark:text-white text-sm">{activeNotification.title}</h4>
                 <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">{activeNotification.msg}</p>
                 <button className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 dark:hover:text-indigo-300">Open Map →</button>
              </div>
              <button onClick={() => setActiveNotification(null)} className="text-gray-400 hover:text-gray-600">✕</button>
           </div>
        </div>
      )}

      {/* DRAFTS MODAL */}
      {isDraftsOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[70vh] animate-scale-up border border-gray-200 dark:border-gray-700">
               <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                  <h3 className="font-bold text-lg dark:text-white">Draft Plans</h3>
                  <button onClick={() => setIsDraftsOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full dark:text-white">✕</button>
               </div>
               <div className="overflow-y-auto p-4 space-y-3">
                   {drafts.length === 0 ? (
                       <p className="text-center text-gray-500 py-4">No drafts found.</p>
                   ) : (
                       drafts.map(draft => (
                         <div key={draft.id} className={`w-full rounded-xl border flex overflow-hidden transition-all ${
                             draft.id === plan.id 
                             ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500 dark:bg-indigo-900/30 dark:border-indigo-400' 
                             : 'bg-gray-50 border-gray-200 hover:bg-white hover:shadow-md dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600'
                         }`}>
                           <button 
                             onClick={() => {
                                 onLoadDraft(draft);
                                 setIsDraftsOpen(false);
                             }}
                             className="flex-1 text-left p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                           >
                              <div className="flex justify-between items-center">
                                  <div>
                                      <h4 className="font-bold text-gray-800 dark:text-white">{draft.destination || "Untitled Plan"}</h4>
                                      <p className="text-xs text-gray-500 dark:text-gray-300 mt-0.5">{draft.dates || "No dates"}</p>
                                      <div className="flex gap-2 mt-2">
                                         <span className="text-[10px] bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400">
                                             {draft.activities.length} Activities
                                         </span>
                                         <span className="text-[10px] text-gray-400 dark:text-gray-500 py-0.5">
                                             Created {new Date(draft.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                         </span>
                                      </div>
                                  </div>
                                  {draft.id === plan.id && (
                                      <span className="text-indigo-600 dark:text-indigo-400 font-bold text-xs bg-indigo-100 dark:bg-indigo-900 px-2 py-1 rounded-full">Active</span>
                                  )}
                              </div>
                           </button>
                           
                           {/* Delete Button */}
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               onDeleteDraft(draft.id);
                             }}
                             className="px-4 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border-l border-gray-200 dark:border-gray-600 transition-colors"
                             title="Delete Plan"
                           >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                           </button>
                         </div>
                       ))
                   )}
               </div>
           </div>
        </div>
      )}

      {/* BRIEFING MODAL */}
      {isBriefingOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-white dark:bg-gray-800 p-6 pb-2 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <div>
                 <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                    {briefingData?.headline || "Loading Briefing..."}
                 </h2>
                 <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">Daily Intelligence</p>
              </div>
              <button onClick={() => setIsBriefingOpen(false)} className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-full p-2 transition-colors text-gray-600 dark:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 bg-gray-50 dark:bg-gray-900/50">
               {isGeneratingBriefing ? (
                 <div className="flex flex-col items-center justify-center h-64 space-y-4">
                    <div className="relative">
                        <div className="w-12 h-12 border-4 border-indigo-200 rounded-full animate-ping absolute"></div>
                        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin relative z-10"></div>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium animate-pulse">Scanning itinerary & satellites...</p>
                 </div>
               ) : briefingData ? (
                 <div className="space-y-4">
                    
                    {/* 1. Weather Hero Card */}
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/20 relative overflow-hidden">
                       <div className="relative z-10 flex justify-between items-center">
                          <div>
                             <p className="text-blue-100 text-xs font-bold uppercase mb-1">Forecast</p>
                             <div className="text-3xl font-bold">{briefingData.weather.temp}</div>
                             <div className="text-sm font-medium opacity-90">{briefingData.weather.condition}</div>
                             <div className="mt-3 text-xs bg-white/20 backdrop-blur rounded-lg px-2 py-1 inline-block">
                                💡 {briefingData.weather.advice}
                             </div>
                          </div>
                          <div className="text-6xl">{briefingData.weather.emoji}</div>
                       </div>
                       {/* Deco Circle */}
                       <div className="absolute -right-4 -bottom-10 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* 2. Dress Code */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mb-3 text-lg">👔</div>
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{briefingData.dressCode.title}</h3>
                            <p className="text-xs text-gray-500 leading-relaxed">{briefingData.dressCode.description}</p>
                        </div>

                        {/* 3. Transport */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-3 text-lg">🚦</div>
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1">Logistics</h3>
                            <p className="text-xs text-gray-500 leading-relaxed">{briefingData.transport}</p>
                        </div>
                    </div>

                    {/* 4. Packing List */}
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                           <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">🎒</div>
                           <h3 className="font-bold text-gray-900 dark:text-white text-sm">Pack Essentials</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                           {briefingData.packing.map((item, idx) => (
                             <span key={idx} className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold border border-gray-200 dark:border-gray-600">
                                {item}
                             </span>
                           ))}
                        </div>
                    </div>

                 </div>
               ) : null}
            </div>
          </div>
        </div>
      )}

      {/* LEFT: Itinerary View */}
      <div className="w-full md:w-1/3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden transition-colors">
        
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 z-10 shadow-sm transition-colors">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-start gap-2">
                
                {/* Back / New Plan Button */}
                <button 
                  onClick={onNewPlan}
                  className="mt-1 p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
                  title="Create New Plan"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>

                {/* Drafts Button */}
                <button 
                  onClick={() => setIsDraftsOpen(true)}
                  className="mt-1 p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-amber-100 hover:text-amber-600 transition-colors relative"
                  title="Open Draft Plans"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{drafts.length}</span>
                </button>

                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{plan.destination}</h1>
                  <p className="font-medium text-indigo-600 dark:text-indigo-400 text-xs">
                     ✨ {preferences.interests.length} Vibe Matches
                  </p>
                </div>
              </div>
              <button onClick={onOpenProfile} className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 border-2 border-white dark:border-gray-700 overflow-hidden hover:opacity-80">
                <img src={userProfile.avatarUrl} alt="Profile" className="w-full h-full object-cover"/>
              </button>
            </div>

            {/* DAY SELECTOR */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
              {days.map(day => (
                <button 
                  key={day}
                  onClick={() => setActiveDay(day)}
                  className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                    activeDay === day 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  Day {day}
                </button>
              ))}
            </div>

            {/* DAY STATS SUMMARY BAR */}
            <div className="mb-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700 flex justify-between items-center text-xs">
               <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  <span className="text-base">👣</span>
                  <div className="flex flex-col leading-none">
                     <span className="font-bold">{totalDayDistance.toFixed(1)} mi</span>
                     <span className="text-[9px] opacity-70">Distance</span>
                  </div>
               </div>
               <div className="w-px h-6 bg-gray-200 dark:bg-gray-600"></div>
               <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  <span className="text-base">💸</span>
                  <div className="flex flex-col leading-none">
                     <span className="font-bold">~${estimatedDayBudget}</span>
                     <span className="text-[9px] opacity-70">Est. Budget</span>
                  </div>
               </div>
               <div className="w-px h-6 bg-gray-200 dark:bg-gray-600"></div>
               <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  <span className="text-base">🚩</span>
                  <div className="flex flex-col leading-none">
                     <span className="font-bold">{stopCount}</span>
                     <span className="text-[9px] opacity-70">Stops</span>
                  </div>
               </div>
            </div>

            {/* View Toggles */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
               <button 
                 onClick={() => setViewMode('list')}
                 className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow text-indigo-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
               >
                 List View
               </button>
               <button 
                 onClick={() => setViewMode('map')}
                 className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'map' ? 'bg-white dark:bg-gray-600 shadow text-indigo-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
               >
                 Map View
               </button>
            </div>
          </div>
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900/50 transition-colors relative">
          
          {/* Live Check Button (Overlay) */}
          <div className="absolute top-4 right-4 z-[400]">
             <button 
               onClick={handleLiveCheck}
               disabled={isCheckingLive}
               className="bg-white/80 dark:bg-gray-800/80 backdrop-blur shadow-lg border border-indigo-100 dark:border-indigo-900 rounded-full px-3 py-1 text-xs font-bold text-indigo-600 flex items-center gap-1 hover:scale-105 transition-transform"
             >
                {isCheckingLive ? (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                )}
                Live Check
             </button>
          </div>

          {/* Insights */}
          {insights.map(insight => (
            <div key={insight.id} className="animate-fade-in bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-xl p-3 relative flex items-start gap-3 shadow-sm">
              <span className="mt-0.5 text-lg">💡</span>
              <div className="flex-1">
                <p className="text-sm text-blue-900 dark:text-blue-100">{insight.message}</p>
              </div>
              <button onClick={() => dismissInsight(insight.id)} className="text-blue-300 hover:text-blue-500">✕</button>
            </div>
          ))}

          {/* LIST VIEW (VISUAL RICH CARDS) */}
          {viewMode === 'list' && (
             <div className="relative border-l-2 border-dashed border-gray-300 dark:border-gray-700 ml-3 space-y-8 py-2">
              {filteredActivities.length > 0 ? filteredActivities.map((item, index) => {
                // Calculate distance to next item
                let distanceToNext = null;
                if (index < filteredActivities.length - 1) {
                  const nextItem = filteredActivities[index + 1];
                  if (item.lat && item.lng && nextItem.lat && nextItem.lng) {
                     distanceToNext = calculateDistance(item.lat, item.lng, nextItem.lat, nextItem.lng);
                  }
                }

                return (
                <div key={item.id} className="relative pl-6 group">
                  {/* Timeline Dot */}
                  <div className={`absolute -left-[9px] top-8 w-4 h-4 rounded-full border-2 transition-colors z-20 ${item.status === 'booked' ? 'bg-green-500 border-green-200 shadow-[0_0_0_4px_rgba(34,197,94,0.2)]' : 'bg-white border-indigo-400 shadow-[0_0_0_4px_rgba(99,102,241,0.1)]'}`}></div>
                  
                  {/* Distance Marker Between Dots - NOW PERFECTLY CENTERED IN THE GAP */}
                  {distanceToNext && (
                     <div className="absolute -left-[42px] top-[calc(100%+16px)] -translate-y-1/2 w-20 z-10 flex justify-center pointer-events-none">
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-2 py-0.5 rounded-full text-[10px] font-bold text-gray-500 dark:text-gray-400 shadow-sm flex items-center gap-1.5 transition-transform hover:scale-110">
                           <span className="text-[10px] opacity-70">{preferences.transport === 'private' || preferences.transport === 'rideshare' ? '🚗' : '🚶'}</span>
                           <span>{distanceToNext} mi</span>
                        </div>
                     </div>
                  )}

                  {/* Rich Card */}
                  <div className={`bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border ${item.locked ? 'border-gray-200 dark:border-gray-700' : 'border-gray-100 dark:border-gray-700'} shadow-sm hover:shadow-lg transition-all duration-300`}>
                    
                    {/* Increased min-height to accommodate buttons properly */}
                    <div className="flex flex-row min-h-[10rem]">
                        {/* Image Section */}
                        <div className="w-1/3 relative min-h-full">
                            <img 
                                src={item.imageUrl || getFallbackImage(item.type)} 
                                alt={item.activity} 
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded">
                                {item.time}
                            </div>
                            {/* PRICE TAG BADGE */}
                            <div className={`absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm backdrop-blur-md ${
                                getPriceLabel(item.type) === 'Free' 
                                ? 'bg-green-500/90 text-white' 
                                : 'bg-white/90 text-gray-800 border border-gray-200'
                            }`}>
                                {getPriceLabel(item.type)}
                            </div>
                        </div>

                        {/* Content Section - Added padding bottom (pb-3) to lift buttons */}
                        <div className="w-2/3 p-3 pb-5 flex flex-col justify-between relative">
                             {/* Delete Button (Hover) */}
                             <button 
                                onClick={() => handleDeleteActivity(item.id)}
                                className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors p-1"
                                title="Remove from plan"
                             >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                             </button>

                             <div>
                                 {/* Type Badge */}
                                 <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border mb-1 inline-block
                                    ${item.type === 'food' ? 'text-orange-600 bg-orange-50 border-orange-100' : 
                                      item.type === 'culture' ? 'text-purple-600 bg-purple-50 border-purple-100' :
                                      item.type === 'nature' ? 'text-green-600 bg-green-50 border-green-100' :
                                      'text-gray-600 bg-gray-50 border-gray-100'
                                    }`}>
                                    {item.type || 'General'}
                                 </span>
                                 <h3 className="font-bold text-sm dark:text-gray-200 leading-tight line-clamp-2">{item.activity}</h3>
                                 <p className="text-xs text-gray-500 mt-1 line-clamp-1">{item.location}</p>
                             </div>
                             
                             {/* ACTIONS: Transport & Booking */}
                             <div className="flex gap-2 items-center mt-2">
                                 {/* 1. Booking (Optional) */}
                                 {item.bookingUrl && (
                                     <a href={item.bookingUrl} target="_blank" rel="noopener noreferrer" className="flex-1 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold text-center hover:bg-indigo-100 transition-colors">
                                        Book ↗
                                     </a>
                                 )}

                                 {/* 2. Transport (Dynamic based on prefs) */}
                                 {preferences.transport === 'public' && (
                                     <a 
                                       href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.location || item.activity)}&travelmode=transit`} 
                                       target="_blank" 
                                       rel="noopener noreferrer" 
                                       className="flex-1 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-blue-100 transition-colors"
                                     >
                                        <span>🚌</span> Transit
                                     </a>
                                 )}

                                 {preferences.transport === 'rideshare' && (
                                     <a 
                                       href={`https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent(item.location || item.activity)}`} 
                                       target="_blank" 
                                       rel="noopener noreferrer" 
                                       className="flex-1 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                     >
                                        <span>🚖</span> Uber
                                     </a>
                                 )}

                                 {preferences.transport === 'private' && (
                                     <a 
                                       href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.location || item.activity)}&travelmode=driving`} 
                                       target="_blank" 
                                       rel="noopener noreferrer" 
                                       className="flex-1 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-indigo-100 transition-colors"
                                     >
                                        <span>🚗</span> Navigate
                                     </a>
                                 )}
                             </div>
                        </div>
                    </div>
                  </div>
                </div>
              )}) : (
                 <div className="text-center py-10 text-gray-400 text-sm">
                   No activities planned for Day {activeDay}.
                 </div>
              )}
            </div>
          )}

          {/* MAP VIEW (Leaflet) */}
          {viewMode === 'map' && (
            <div className="h-full w-full min-h-[400px] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 relative bg-gray-100">
               <div id="map-container" className="w-full h-full z-0"></div>
               
               <div className="absolute bottom-4 left-4 right-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur p-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600 z-[400]">
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-2">Route for Day {activeDay}</p>
                  <div className="flex items-center justify-between text-xs">
                     <span>Start: {filteredActivities[0]?.activity || 'N/A'}</span>
                     <span>➔</span>
                     <span>End: {filteredActivities[filteredActivities.length - 1]?.activity || 'N/A'}</span>
                  </div>
               </div>
            </div>
          )}

        </div>

        {/* Buttons */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex gap-2">
          <button onClick={handleGetBriefing} className="flex-1 py-4 rounded-xl font-bold bg-orange-100 text-orange-700">Trip Briefing</button>
          <button onClick={() => onStartTour(plan)} className="flex-[2] py-4 rounded-xl font-bold bg-gradient-to-r from-green-600 to-teal-600 text-white">Start Wise Mode</button>
        </div>
      </div>

      {/* RIGHT: Plan Assistant Chat */}
      <div className="w-full md:w-2/3 h-full">
        <ChatInterface tripPlan={plan} mode="PLANNER" preferences={preferences} />
      </div>
    </div>
  );
};