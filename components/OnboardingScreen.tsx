import React, { useState, useEffect, useRef } from 'react';
import { UserPreferences } from '../types';

interface OnboardingScreenProps {
  onComplete: (prefs: UserPreferences) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Expanded Vibe Check Cards
const INTEREST_CARDS = [
  {
    id: 'culture',
    title: 'Arts & Culture',
    description: 'Museums, galleries and historical sites.',
    image: 'https://images.unsplash.com/photo-1551969014-a22c630aa946?q=80&w=600&auto=format&fit=crop',
    tag: 'Art Lover'
  },
  {
    id: 'food',
    title: 'Gourmet Discoveries',
    description: 'Michelin restaurants and street food.',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=600&auto=format&fit=crop',
    tag: 'Foodie'
  },
  {
    id: 'hidden_gems',
    title: 'Hidden Gems',
    description: 'Secret spots that tourists usually miss.',
    image: 'https://images.unsplash.com/photo-1596356453261-0d265ae2520a?q=80&w=600&auto=format&fit=crop',
    tag: 'Explorer'
  },
  {
    id: 'nature',
    title: 'Nature & Parks',
    description: 'City parks, hiking trails, fresh air.',
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=600&auto=format&fit=crop',
    tag: 'Nature Lover'
  },
  {
    id: 'architecture',
    title: 'Urban Design',
    description: 'Skyscrapers, iconic bridges and design.',
    image: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?q=80&w=600&auto=format&fit=crop',
    tag: 'Design Buff'
  },
  {
    id: 'nightlife',
    title: 'Nightlife',
    description: 'Jazz clubs, bars and live music.',
    image: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?q=80&w=600&auto=format&fit=crop',
    tag: 'Party Animal'
  },
  {
    id: 'relaxation',
    title: 'Chill Mode',
    description: 'Spas, cafes and slow walking.',
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=600&auto=format&fit=crop',
    tag: 'Relaxed'
  },
  {
    id: 'shopping',
    title: 'Shopping',
    description: 'Boutiques, vintage shops and malls.',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=600&auto=format&fit=crop',
    tag: 'Shopaholic'
  }
];

const CUISINE_OPTIONS = [
  { id: 'local', label: 'Local/Traditional', icon: '🍲' },
  { id: 'italian', label: 'Italian', icon: '🍝' },
  { id: 'asian', label: 'Asian/Fusion', icon: '🍣' },
  { id: 'mexican', label: 'Mexican', icon: '🌮' },
  { id: 'vegan', label: 'Vegan/Healthy', icon: '🥗' },
  { id: 'steak', label: 'Steak/BBQ', icon: '🥩' },
  { id: 'coffee', label: 'Coffee & Bakeries', icon: '☕' },
  { id: 'seafood', label: 'Seafood', icon: '🦞' },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 4; // 1: Dest, 2: Swipe, 3: Quiz, 4: Logistics
  
  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  // Swipe State
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  
  // Drag State
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{x: number, y: number} | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const [prefs, setPrefs] = useState<UserPreferences>({
    city: 'Chicago, IL',
    dates: '',
    tempo: 'moderate',
    budget: 'standard',
    transport: 'public',
    interests: [],
    cuisines: [],
    explorationStyle: 'balanced'
  });

  // Calendar Logic
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; 
  };

  const handleDateClick = (day: number) => {
    const selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    if (!startDate || (startDate && endDate)) {
      setStartDate(selectedDate);
      setEndDate(null);
    } else {
      if (selectedDate < startDate) {
        setEndDate(startDate);
        setStartDate(selectedDate);
      } else {
        setEndDate(selectedDate);
      }
    }
  };

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  useEffect(() => {
    if (startDate && endDate) {
      const startStr = startDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long' });
      const endStr = endDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
      setPrefs(prev => ({ ...prev, dates: `${startStr} - ${endStr}` }));
    } else {
       setPrefs(prev => ({ ...prev, dates: '' }));
    }
  }, [startDate, endDate]);

  // Swipe Logic
  const handleSwipe = (direction: 'left' | 'right') => {
    setSwipeDirection(direction);
    setDragStart(null);
    setDragCurrent(null);
    
    // Save interest if liked
    if (direction === 'right') {
      const currentCard = INTEREST_CARDS[currentCardIndex];
      setPrefs(prev => ({
        ...prev,
        interests: [...prev.interests, currentCard.tag]
      }));
    }

    // Delay for animation
    setTimeout(() => {
      if (currentCardIndex < INTEREST_CARDS.length - 1) {
        setCurrentCardIndex(prev => prev + 1);
        setSwipeDirection(null);
      } else {
        setStep(3); // Go to Quiz
      }
    }, 300);
  };

  // DRAG HANDLERS
  const handlePointerDown = (e: React.PointerEvent) => {
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragCurrent({ x: e.clientX, y: e.clientY });
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStart) return;
    setDragCurrent({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragStart || !dragCurrent) return;
    const deltaX = dragCurrent.x - dragStart.x;
    const threshold = 100; 

    if (deltaX > threshold) handleSwipe('right');
    else if (deltaX < -threshold) handleSwipe('left');
    else {
      setDragStart(null);
      setDragCurrent(null);
    }
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const getCardStyle = (index: number) => {
    if (index !== currentCardIndex) return {};
    
    if (swipeDirection === 'left') return { transform: 'translateX(-150%) rotate(-20deg)', opacity: 0 };
    if (swipeDirection === 'right') return { transform: 'translateX(150%) rotate(20deg)', opacity: 0 };

    if (dragStart && dragCurrent) {
      const deltaX = dragCurrent.x - dragStart.x;
      const rotation = deltaX * 0.05; 
      return { 
        transform: `translateX(${deltaX}px) rotate(${rotation}deg)`,
        cursor: 'grabbing',
        transition: 'none' 
      };
    }
    return { cursor: 'grab' };
  };

  const toggleCuisine = (id: string) => {
    setPrefs(prev => {
      if (prev.cuisines.includes(id)) return { ...prev, cuisines: prev.cuisines.filter(c => c !== id) };
      return { ...prev, cuisines: [...prev.cuisines, id] };
    });
  };

  const handleNext = () => {
    if (step === 1 && (!startDate || !endDate)) return;
    if (step < TOTAL_STEPS) setStep(step + 1);
    else onComplete(prefs);
  };

  const handleBack = () => {
    if (step === 3) {
      // Going back to Swipe Cards from Deep Dive
      // We must reset the cards and the collected interests so the user can "redo" it.
      setCurrentCardIndex(0);
      setPrefs(prev => ({ ...prev, interests: [] }));
      setStep(2);
    } else {
      setStep(step - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col h-[750px]">
        {/* Progress Bar */}
        <div className="h-2 bg-gray-100 w-full">
          <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}></div>
        </div>

        <div className="p-8 flex-1 flex flex-col overflow-y-auto scrollbar-hide">
          
          {/* STEP 1: DESTINATION & DATES */}
          {step === 1 && (
            <div className="flex-1 animate-fade-in flex flex-col">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Where are we going?</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">Destination</label>
                  <input 
                    type="text" 
                    value={prefs.city} 
                    onChange={e => setPrefs({...prefs, city: e.target.value})}
                    placeholder="Enter city name"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50"
                  />
                </div>
                
                <div className="flex-1 flex flex-col">
                  <label className="block text-sm font-semibold text-gray-600 mb-2">Select Date Range</label>
                  <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    {/* Calendar UI */}
                    <div className="flex justify-between items-center mb-4">
                      <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <div className="font-bold text-gray-800 text-lg">
                        {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                      </div>
                      <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-7 mb-2">
                      {DAYS.map(d => <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {Array(getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth())).fill(null).map((_, i) => (
                        <div key={`blank-${i}`} className="h-9" />
                      ))}
                      {Array.from({ length: getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth()) }, (_, i) => i + 1).map(day => {
                        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                        const isStart = startDate && date.getTime() === startDate.getTime();
                        const isEnd = endDate && date.getTime() === endDate.getTime();
                        const isInRange = startDate && endDate && date > startDate && date < endDate;
                        let classes = "h-9 w-full flex items-center justify-center text-sm rounded-lg transition-all cursor-pointer ";
                        if (isStart || isEnd) classes += "bg-indigo-600 text-white font-bold shadow-md transform scale-105";
                        else if (isInRange) classes += "bg-indigo-50 text-indigo-700 font-medium";
                        else classes += "text-gray-700 hover:bg-gray-100";
                        return <div key={day} onClick={() => handleDateClick(day)} className={classes}>{day}</div>;
                      })}
                    </div>
                  </div>
                  <div className="mt-3 text-center h-5">
                    {startDate && endDate ? (
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                         {startDate.toLocaleDateString('en-US', {day:'numeric', month:'short'})} - {endDate.toLocaleDateString('en-US', {day:'numeric', month:'short'})}
                      </span>
                    ) : <span className="text-xs text-gray-400">Select Start and End dates</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: EXPANDED VIBE CHECK (SWIPE CARDS) */}
          {step === 2 && (
            <div className="flex-1 flex flex-col animate-fade-in relative touch-none">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Travel Vibe?</h2>
              <p className="text-gray-500 text-sm mb-6">Swipe right (like) or left (pass). Card {currentCardIndex + 1}/{INTEREST_CARDS.length}</p>
              
              <div className="flex-1 relative flex justify-center items-center perspective-1000">
                  {INTEREST_CARDS.map((card, index) => {
                    if (index < currentCardIndex) return null;
                    if (index > currentCardIndex + 1) return null;

                    const isCurrent = index === currentCardIndex;
                    let wrapperClass = `absolute w-full h-[360px] bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 ${isCurrent ? 'z-20' : 'z-10'}`;

                    if (!isCurrent) {
                      return (
                        <div key={card.id} className={`${wrapperClass} scale-95 translate-y-4 opacity-50 transition-all duration-300`}>
                           <img src={card.image} className="w-full h-3/5 object-cover" alt={card.title} draggable={false} />
                           <div className="p-6">
                              <h3 className="text-xl font-bold text-gray-800">{card.title}</h3>
                              <p className="text-sm text-gray-500 mt-2">{card.description}</p>
                           </div>
                        </div>
                      )
                    }

                    return (
                      <div 
                        key={card.id}
                        ref={cardRef}
                        className={`${wrapperClass} transition-transform duration-300 ease-out`}
                        style={getCardStyle(index)}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                      >
                         <div className="relative h-3/5 w-full">
                           <img src={card.image} className="w-full h-full object-cover pointer-events-none" alt={card.title} />
                           {dragStart && dragCurrent && (dragCurrent.x - dragStart.x) > 50 && (
                             <div className="absolute top-4 left-4 bg-green-500 text-white px-4 py-1 rounded-lg font-bold transform -rotate-12 border-2 border-white shadow-lg">YES</div>
                           )}
                           {dragStart && dragCurrent && (dragCurrent.x - dragStart.x) < -50 && (
                             <div className="absolute top-4 right-4 bg-red-500 text-white px-4 py-1 rounded-lg font-bold transform rotate-12 border-2 border-white shadow-lg">NO</div>
                           )}
                         </div>
                         <div className="p-6">
                            <h3 className="text-xl font-bold text-gray-800">{card.title}</h3>
                            <p className="text-sm text-gray-500 mt-2">{card.description}</p>
                            <div className="mt-4 flex gap-2">
                               <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-medium">#{card.tag}</span>
                            </div>
                         </div>
                      </div>
                    );
                  })}
              </div>

              {currentCardIndex < INTEREST_CARDS.length && (
                <div className="flex justify-center gap-6 mt-6">
                   <button 
                     onClick={() => handleSwipe('left')}
                     className="w-14 h-14 rounded-full bg-white border border-gray-200 text-red-500 shadow-lg flex items-center justify-center hover:bg-red-50 hover:scale-110 transition-all"
                   >
                     <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                   </button>
                   <button 
                     onClick={() => handleSwipe('right')}
                     className="w-14 h-14 rounded-full bg-white border border-gray-200 text-green-500 shadow-lg flex items-center justify-center hover:bg-green-50 hover:scale-110 transition-all"
                   >
                     <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                   </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: DEEP DIVE (CUISINE & STYLE) - NEW STEP */}
          {step === 3 && (
            <div className="flex-1 animate-fade-in flex flex-col">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Deep Dive</h2>
              <p className="text-gray-500 text-sm mb-6">Help Wise tailor the taste & feel.</p>

              <div className="space-y-6">
                 {/* Cuisines */}
                 <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-3">Cuisines you love</label>
                    <div className="grid grid-cols-2 gap-3">
                       {CUISINE_OPTIONS.map(c => (
                         <button
                           key={c.id}
                           onClick={() => toggleCuisine(c.id)}
                           className={`p-3 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all ${prefs.cuisines.includes(c.id) ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                         >
                            <span>{c.icon}</span>
                            {c.label}
                         </button>
                       ))}
                    </div>
                 </div>

                 {/* Exploration Style */}
                 <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-3">Exploration Style</label>
                    <div className="bg-white border border-gray-200 rounded-xl p-1 flex">
                        <button 
                           onClick={() => setPrefs({...prefs, explorationStyle: 'tourist'})}
                           className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${prefs.explorationStyle === 'tourist' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                           Must-Sees
                        </button>
                        <button 
                           onClick={() => setPrefs({...prefs, explorationStyle: 'balanced'})}
                           className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${prefs.explorationStyle === 'balanced' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                           Balanced
                        </button>
                        <button 
                           onClick={() => setPrefs({...prefs, explorationStyle: 'hidden_gem'})}
                           className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${prefs.explorationStyle === 'hidden_gem' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                           Hidden Gems
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 text-center">
                       {prefs.explorationStyle === 'tourist' && "We'll focus on famous landmarks and iconic spots."}
                       {prefs.explorationStyle === 'balanced' && "A healthy mix of famous sights and local secrets."}
                       {prefs.explorationStyle === 'hidden_gem' && "We'll skip the crowds and find unique local spots."}
                    </p>
                 </div>
              </div>
            </div>
          )}

          {/* STEP 4: LOGISTICS (TEMPO, BUDGET, TRANSPORT) */}
          {step === 4 && (
            <div className="flex-1 animate-fade-in space-y-6">
               <h2 className="text-2xl font-bold text-gray-800">Final Logistics</h2>
               
               {/* Tempo */}
               <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Tempo</label>
                <div className="grid grid-cols-3 gap-2">
                  {['relaxed', 'moderate', 'fast'].map(t => (
                    <button
                      key={t}
                      onClick={() => setPrefs({...prefs, tempo: t as any})}
                      className={`p-2 rounded-lg border text-sm capitalize transition-colors ${prefs.tempo === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    >
                      {t === 'relaxed' ? 'Relaxed' : t === 'moderate' ? 'Moderate' : 'Fast'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Budget */}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Budget</label>
                <div className="grid grid-cols-3 gap-2">
                  {['budget', 'standard', 'luxury'].map(b => (
                    <button
                      key={b}
                      onClick={() => setPrefs({...prefs, budget: b as any})}
                      className={`p-2 rounded-lg border text-sm capitalize transition-colors ${prefs.budget === b ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    >
                      {b === 'budget' ? 'Budget' : b === 'standard' ? 'Standard' : 'Luxury'}
                    </button>
                  ))}
                </div>
              </div>

               {/* Transport */}
               <div>
                   <label className="block text-sm font-semibold text-gray-600 mb-2">Transport Preference</label>
                   <div className="space-y-3">
                       <button
                          onClick={() => setPrefs({...prefs, transport: 'public'})}
                          className={`w-full p-3 rounded-xl border flex items-center gap-4 transition-all ${prefs.transport === 'public' ? 'bg-indigo-50 border-indigo-600 ring-1 ring-indigo-600' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                        >
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-lg">🚇</div>
                          <div className="text-left flex-1">
                            <div className="font-bold text-gray-800 text-sm">Public Transit & Walking</div>
                          </div>
                       </button>

                       <button
                          onClick={() => setPrefs({...prefs, transport: 'rideshare'})}
                          className={`w-full p-3 rounded-xl border flex items-center gap-4 transition-all ${prefs.transport === 'rideshare' ? 'bg-indigo-50 border-indigo-600 ring-1 ring-indigo-600' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                        >
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-lg">🚖</div>
                          <div className="text-left flex-1">
                            <div className="font-bold text-gray-800 text-sm">Uber / Lyft</div>
                          </div>
                       </button>

                       <button
                          onClick={() => setPrefs({...prefs, transport: 'private'})}
                          className={`w-full p-3 rounded-xl border flex items-center gap-4 transition-all ${prefs.transport === 'private' ? 'bg-indigo-50 border-indigo-600 ring-1 ring-indigo-600' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                        >
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-lg">🚗</div>
                          <div className="text-left flex-1">
                            <div className="font-bold text-gray-800 text-sm">Private Car</div>
                          </div>
                       </button>
                   </div>
               </div>
            </div>
          )}

          <div className="mt-8 flex justify-end pt-4 border-t border-gray-100">
             {step !== 2 && step > 1 && (
                <button 
                  onClick={handleBack}
                  className="px-6 py-3 text-gray-600 font-semibold hover:bg-gray-100 rounded-xl transition-colors mr-2"
                >
                  Back
                </button>
             )}
             {/* Hide Next button in Step 2 unless finished */}
             {(step !== 2 || currentCardIndex >= INTEREST_CARDS.length) && (
               <button 
                  onClick={handleNext}
                  disabled={step === 1 && (!startDate || !endDate)}
                  className={`px-6 py-3 rounded-xl font-semibold transition-colors shadow-lg flex items-center ${
                    step === 1 && (!startDate || !endDate) 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                  }`}
               >
                 {step === TOTAL_STEPS ? 'Create Plan' : 'Continue'}
                 {step < TOTAL_STEPS && <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
               </button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
