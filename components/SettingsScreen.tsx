import React, { useState } from 'react';

interface SettingsScreenProps {
  onBack: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack, isDarkMode, onToggleDarkMode }) => {
  const [notifications, setNotifications] = useState(true);
  const [locationAccess, setLocationAccess] = useState(true);

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button 
      onClick={onChange}
      className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${checked ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${checked ? 'translate-x-6' : 'translate-x-0'}`}></div>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-300">
       {/* Header */}
       <div className="bg-white dark:bg-gray-800 px-4 py-4 shadow-sm flex items-center sticky top-0 z-10 border-b border-gray-100 dark:border-gray-700">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors mr-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* General Settings */}
        <section>
           <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-2">General</h2>
           <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                 <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Language</span>
                 <select className="bg-gray-50 dark:bg-gray-700 dark:text-white border border-gray-200 dark:border-gray-600 rounded-lg text-xs px-2 py-1 outline-none">
                    <option>English</option>
                    <option>Türkçe</option>
                 </select>
              </div>
              <div className="p-4 flex items-center justify-between">
                 <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Currency</span>
                 <select className="bg-gray-50 dark:bg-gray-700 dark:text-white border border-gray-200 dark:border-gray-600 rounded-lg text-xs px-2 py-1 outline-none">
                    <option>USD ($)</option>
                    <option>EUR (€)</option>
                    <option>TRY (₺)</option>
                 </select>
              </div>
           </div>
        </section>

        {/* Notifications */}
        <section>
           <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-2">Notifications</h2>
           <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
              <div className="p-4 flex items-center justify-between">
                 <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Push Notifications</div>
                    <div className="text-xs text-gray-400">Tour suggestions and updates</div>
                 </div>
                 <Toggle checked={notifications} onChange={() => setNotifications(!notifications)} />
              </div>
           </div>
        </section>

        {/* Privacy */}
        <section>
           <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-2">Privacy</h2>
           <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
              <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
                 <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Location Access</div>
                    <div className="text-xs text-gray-400">GPS usage for Wise</div>
                 </div>
                 <Toggle checked={locationAccess} onChange={() => setLocationAccess(!locationAccess)} />
              </div>
              <button className="w-full p-4 text-left text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                 Data Policy
              </button>
           </div>
        </section>

        {/* Appearance */}
        <section>
           <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-2">Appearance</h2>
           <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
              <div className="p-4 flex items-center justify-between">
                 <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Dark Mode</div>
                    <div className="text-xs text-gray-400">Reduces eye strain</div>
                 </div>
                 <Toggle checked={isDarkMode} onChange={onToggleDarkMode} />
              </div>
           </div>
        </section>

         <div className="pt-4 text-center">
            <p className="text-xs text-gray-400">GezginAI v1.0.0 (Beta)</p>
         </div>

      </div>
    </div>
  );
};