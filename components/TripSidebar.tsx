import React from 'react';
import { TripPlan } from '../types';

interface TripSidebarProps {
  plan: TripPlan;
}

export const TripSidebar: React.FC<TripSidebarProps> = ({ plan }) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 h-full overflow-y-auto">
      <div className="mb-6">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Mevcut Plan</h3>
        <h1 className="text-2xl font-bold text-gray-800">{plan.destination}</h1>
        <p className="text-teal-600 font-medium">{plan.dates}</p>
      </div>

      <div className="space-y-6 relative">
        <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-100"></div>
        
        {plan.activities.map((item, idx) => (
          <div key={idx} className="relative flex items-start pl-8 group">
            <div className="absolute left-1.5 top-1.5 w-3 h-3 bg-teal-100 border-2 border-teal-500 rounded-full z-10 group-hover:bg-teal-500 transition-colors"></div>
            <div>
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 mb-1">
                {item.time}
              </span>
              <h4 className="font-semibold text-gray-800 text-sm">{item.activity}</h4>
              <p className="text-xs text-gray-500 flex items-center mt-1">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {item.location || "Konum detayları bekleniyor"}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-yellow-50 rounded-xl border border-yellow-100">
        <h4 className="text-yellow-800 font-semibold text-sm mb-2 flex items-center">
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Beta Sürüm Notu
        </h4>
        <p className="text-xs text-yellow-700 leading-relaxed">
          Bu uygulama Gemini 2.5 Flash modelini kullanmaktadır. Maliyet açısından optimize edilmiştir. Gerçek zamanlı veriler Google Search ve Maps üzerinden sağlanır.
        </p>
      </div>
    </div>
  );
};