import React from 'react';

interface BHPLogoProps {
  className?: string;
  iconOnly?: boolean;
}

export default function BHPLogo({ className = '', iconOnly = false }: BHPLogoProps) {
  // Determine if it should be rendered in the large auth-gate format
  const isLarge = className.includes('h-16') || className.includes('text-lg') || className.includes('h-12');

  return (
    <div className={`flex flex-col select-none ${isLarge ? 'items-center text-center' : 'items-start text-left'}`}>
      <img
        src="https://static.bangkokhospital.com/uploads/2025/08/pattaya.svg"
        alt="Bangkok Hospital Pattaya Logo"
        className={`${className || 'h-9'} w-auto object-contain filter drop-shadow-xs`}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
