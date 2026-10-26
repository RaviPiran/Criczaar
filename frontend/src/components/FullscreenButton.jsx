import React from 'react';
import { useFullscreen } from '../utils/fullscreen';

export default function FullscreenButton({
  showLabel = false,
  className = '',
  targetElement = null,
  size = 'md', // 'sm' | 'md' | 'lg'
}) {
  const { isFullscreen, toggle } = useFullscreen();

  const handleClick = () => {
    toggle(targetElement);
  };

  return (
    <button
      onClick={handleClick}
      type="button"
      title={isFullscreen ? 'Exit Full Screen (Press ESC or F)' : 'Enter Full Screen (Press F) — Hides Google tabs & address bar like YouTube'}
      className={`relative inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-200 active:scale-95 group ${
        isFullscreen
          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-lg shadow-amber-500/20'
          : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 hover:border-amber-400/40'
      } ${
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : size === 'lg' ? 'px-5 py-3 text-sm' : 'px-3 py-2 text-xs'
      } ${className}`}>

      {/* YouTube-style 4-corner SVG icon */}
      {isFullscreen ? (
        // Exit Fullscreen (collapse corners)
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-shrink-0 transition-transform group-hover:scale-110">
          <path d="M8 3v3a2 2 0 0 1-2 2H3" />
          <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
          <path d="M3 16h3a2 2 0 0 1 2 2v3" />
          <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        </svg>
      ) : (
        // Enter Fullscreen (expand corners)
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-shrink-0 transition-transform group-hover:scale-110">
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      )}

      {showLabel && (
        <span className="font-mono text-xs font-bold tracking-wider uppercase">
          {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
        </span>
      )}
    </button>
  );
}

