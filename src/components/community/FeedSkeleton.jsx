import React from 'react';
import { LoaderCircle } from 'lucide-react';

const FeedSkeleton = ({ count = 5 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-slate-200 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-3 w-24 rounded bg-slate-200 animate-pulse" />
            <div className="h-2.5 w-16 rounded bg-slate-200 animate-pulse" />
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-3 w-full rounded bg-slate-200 animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-slate-200 animate-pulse" />
        </div>
      </div>
    ))}
  </div>
);

export default FeedSkeleton;