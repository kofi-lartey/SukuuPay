import React from 'react';
import { LoaderCircle } from 'lucide-react';

const FeedContainer = ({ children, loading, hasMore, onLoadMore }) => {
  if (loading && !hasMore) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <LoaderCircle className="h-8 w-8 animate-spin text-teal-600" />
        <p className="mt-3 text-[13px] font-semibold text-slate-400">Loading feed...</p>
      </div>
    );
  }

  return (
    <div>
      {children}
      {hasMore && (
        <div className="flex justify-center py-4">
          <button
            onClick={onLoadMore}
            className="rounded-xl bg-teal-600 px-4 py-2 text-white text-[12px] font-bold hover:bg-teal-700"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
};

export default FeedContainer;