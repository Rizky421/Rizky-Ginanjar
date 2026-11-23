import React from 'react';
import { Clock } from 'lucide-react';
import type { SesiPenimbangan } from '../types';

interface SesiBadgeProps {
  sesi: SesiPenimbangan;
  keteranganInsidental?: string;
}

export const SesiBadge: React.FC<SesiBadgeProps> = ({
  sesi,
  keteranganInsidental,
}) => {
  if (sesi === 'Sesi Pagi (10.30-11.00)') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200 whitespace-nowrap">
        <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span>Sesi Pagi (10.30-11.00)</span>
      </span>
    );
  }

  if (sesi === 'Sesi Siang (12.30-13.00)') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-orange-50 text-orange-700 border border-orange-200 whitespace-nowrap">
        <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span>Sesi Siang (12.30-13.00)</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap">
      <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span>
        Insidental{keteranganInsidental ? `: ${keteranganInsidental}` : ''}
      </span>
    </span>
  );
};
