import React from 'react';
import { GroundingMetadata } from '../types';

interface GroundingChipsProps {
  metadata?: GroundingMetadata;
  showWebSources?: boolean;
}

export const GroundingChips: React.FC<GroundingChipsProps> = ({ metadata, showWebSources = true }) => {
  if (!metadata || !metadata.groundingChunks || metadata.groundingChunks.length === 0) {
    return null;
  }

  // Filter for unique URLs to avoid clutter
  const uniqueSources = new Set<string>();
  const chunks = metadata.groundingChunks.filter(chunk => {
    const uri = chunk.web?.uri || chunk.maps?.uri;
    if (uri && !uniqueSources.has(uri)) {
      uniqueSources.add(uri);
      return true;
    }
    return false;
  });

  // Filter out web sources if disabled
  const displayChunks = showWebSources ? chunks : chunks.filter(c => !!c.maps);

  if (displayChunks.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
        {showWebSources ? "Sources & Locations" : "Locations"}
      </p>
      <div className="flex flex-wrap gap-2">
        {displayChunks.map((chunk, index) => {
          if (chunk.web && showWebSources) {
            return (
              <a
                key={`web-${index}`}
                href={chunk.web.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full hover:bg-blue-100 transition-colors border border-blue-200"
              >
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                   <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                {chunk.web.title || "Web Result"}
              </a>
            );
          }
          if (chunk.maps) {
            return (
              <a
                key={`maps-${index}`}
                href={chunk.maps.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full hover:bg-green-100 transition-colors border border-green-200"
              >
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                {chunk.maps.title || "Google Maps"}
              </a>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};