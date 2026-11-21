import React from 'react';

export default function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-neutral-900/30 backdrop-blur-xs flex flex-col items-center justify-center z-50 transition-opacity">
      <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center max-w-xs text-center border border-neutral-100">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <h3 className="mt-4 font-semibold text-neutral-800">
          {message || 'Processing Operation...'}
        </h3>
        <p className="text-xs text-neutral-400 mt-1">
          RxNexus Security Verification Pipeline
        </p>
      </div>
    </div>
  );
}
