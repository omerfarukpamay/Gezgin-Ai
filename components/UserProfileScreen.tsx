import React, { useState } from 'react';
import { UserProfile, PastTrip, FavoritePlace } from '../types';

interface UserProfileScreenProps {
  user: UserProfile;
  pastTrips: PastTrip[];
  favoritePlaces: FavoritePlace[];
  onBack: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export const UserProfileScreen: React.FC<UserProfileScreenProps> = ({ 
  user, 
  pastTrips, 
  favoritePlaces,
  onBack, 
  onOpenSettings, 
  onLogout 
}) => {
  const [showPassport, setShowPassport] = useState(false);

  // Passport Modal View
  if (showPassport) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col relative overflow-hidden animate-fade-in">
         {/* Decorative Background */}
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-gray-900 to-gray-900 pointer-events-none"></div>
         
         <div className="relative z-10 p-6 flex items-center justify-between bg-white/5 backdrop-blur-md border-b border-white/10">
            <button onClick={() => setShowPassport(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-xl font-bold tracking-widest uppercase text-indigo-400">Digital Passport</h2>
            <div className="w-9"></div> {/* Spacer for balance */}
         </div>

         <div className="flex-1 overflow-y-auto p-6 relative z-10">
            <div className="grid grid-cols-2 gap-4">
              {user.stamps && user.stamps.length > 0 ? user.stamps.map((stamp) => (
                  <div key={stamp.id} className="aspect-square bg-white rounded-xl p-1 shadow-lg transform hover:scale-105 transition-all duration-300">
                      <div className="w-full h-full border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-orange-50 relative overflow-hidden group">
                          {/* Stamp Ink Effect */}
                          <div className="text-5xl mb-2 filter drop-shadow-md transform group-hover:rotate-12 transition-transform">{stamp.icon}</div>
                          <div className="text-center z-10">
                              <p className="text-[10px] font-black text-red-800/40 uppercase tracking-widest rotate-[-5deg]">VISITED</p>
                              <p className="text-xs font-bold text-gray-800 leading-tight mt-1">{stamp.placeName}</p>
                              <p className="text-[9px] text-gray-500 mt-0.5">{new Date(stamp.date).toLocaleDateString()}</p>
                          </div>
                      </div>
                  </div>
              )) : (
                  <div className="col-span-2 flex flex-col items-center justify-center py-20 opacity-50">
                      <div className="text-6xl mb-4">🗺️</div>
                      <p>No stamps yet. Start a tour to collect them!</p>
                  </div>
              )}
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      
      {/* Header / Cover */}
      <div className="bg-white dark:bg-gray-800 pb-8 rounded-b-[2.5rem] shadow-sm relative overflow-hidden transition-colors">
        {/* Background Pattern */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
        
        {/* Nav Bar */}
        <div className="relative px-4 py-4 flex justify-between items-center text-white z-10">
          <button onClick={onBack} className="p-2 bg-white/20 backdrop-blur rounded-full hover:bg-white/30 transition">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="font-bold text-lg drop-shadow-sm">Profile</h1>
          <button onClick={onOpenSettings} className="p-2 bg-white/20 backdrop-blur rounded-full hover:bg-white/30 transition">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>

        {/* Profile Info */}
        <div className="flex flex-col items-center mt-4 px-6 relative z-10">
           <div className="relative">
             <img src={user.avatarUrl} alt="User" className="w-28 h-28 rounded-full border-4 border-white dark:border-gray-800 shadow-lg object-cover bg-gray-200" />
             <div className="absolute bottom-1 right-1 bg-green-500 w-5 h-5 rounded-full border-2 border-white dark:border-gray-800"></div>
           </div>
           <h2 className="mt-4 text-2xl font-bold text-gray-800 dark:text-white">{user.name}</h2>
           <p className="text-gray-500 dark:text-gray-400 text-sm">Member since {user.memberSince}</p>

           {/* Stats Grid */}
           <div className="flex w-full justify-between mt-8 px-4 divide-x divide-gray-100 dark:divide-gray-700">
              <div className="flex-1 text-center">
                 <p className="text-lg font-bold text-gray-800 dark:text-white">{user.stats.tripsPlanned}</p>
                 <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mt-1">Trips</p>
              </div>
              <div className="flex-1 text-center">
                 <p className="text-lg font-bold text-gray-800 dark:text-white">{user.stats.placesVisited}</p>
                 <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mt-1">Visited</p>
              </div>
              <div className="flex-1 text-center">
                 <p className="text-lg font-bold text-gray-800 dark:text-white">{user.stats.photosTaken}</p>
                 <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mt-1">Photos</p>
              </div>
           </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 space-y-4 -mt-2">
         
         {/* Passport Card Preview (Hero Card) */}
         <button onClick={() => setShowPassport(true)} className="w-full bg-gradient-to-r from-orange-400 to-pink-500 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden group transform hover:scale-[1.02] transition-transform">
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-white/10 skew-x-12 transform translate-x-10 group-hover:translate-x-0 transition-transform duration-500"></div>
            <div className="flex justify-between items-center relative z-10">
               <div className="text-left">
                  <p className="text-xs font-bold opacity-80 uppercase mb-1">Traveler ID</p>
                  <h3 className="text-xl font-bold">My Passport</h3>
                  <p className="text-sm opacity-90 mt-1">{user.stamps.length} Stamps Collected</p>
               </div>
               <div className="text-4xl filter drop-shadow-md">✈️</div>
            </div>
         </button>

         {/* Menu Items */}
         <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
            <MenuItem 
              icon="💖" 
              label="Favorites" 
              subLabel={`${favoritePlaces.length} places saved`} 
              onClick={() => {}} 
            />
            <MenuItem 
              icon="📅" 
              label="Past Trips" 
              subLabel={`${pastTrips.length} adventures`} 
              onClick={() => {}} 
            />
            <MenuItem 
              icon="💳" 
              label="Payment Methods" 
              subLabel="Manage cards" 
              onClick={() => {}} 
            />
         </div>

         <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
            <MenuItem 
              icon="❓" 
              label="Help & Support" 
              onClick={() => {}} 
            />
            <button onClick={onLogout} className="w-full text-left p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
               <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center text-lg">🚪</div>
               <span className="font-semibold text-red-500">Log Out</span>
            </button>
         </div>

      </div>
    </div>
  );
};

// Helper Component for Menu Items
const MenuItem = ({ icon, label, subLabel, onClick }: { icon: string, label: string, subLabel?: string, onClick: () => void }) => (
  <button onClick={onClick} className="w-full text-left p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0 group">
     <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">{icon}</div>
     <div className="flex-1">
        <h4 className="font-semibold text-gray-800 dark:text-gray-200">{label}</h4>
        {subLabel && <p className="text-xs text-gray-500 dark:text-gray-400">{subLabel}</p>}
     </div>
     <svg className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
  </button>
);