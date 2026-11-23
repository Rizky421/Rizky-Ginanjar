import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { StatusPilah } from '../types';

interface StatusLabelProps {
  status: StatusPilah;
  prefix?: string;
}

export const StatusLabel: React.FC<StatusLabelProps> = ({ status, prefix }) => {
  if (status === 'Terpilah Sempurna') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#059669] whitespace-nowrap">
        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>
          {prefix ? `${prefix}: ` : ''}
          {status}
        </span>
      </span>
    );
  }

  if (status === 'Tercampur Ringan') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D97706] whitespace-nowrap">
        <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>
          {prefix ? `${prefix}: ` : ''}
          {status}
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B91C1C] whitespace-nowrap">
      <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>
        {prefix ? `${prefix}: ` : ''}
        {status}
      </span>
    </span>
  );
};
