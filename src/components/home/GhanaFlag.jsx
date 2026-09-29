import React from 'react';

const GhanaFlag = ({ className = 'h-4 w-6' }) => (
  <svg
    viewBox="0 0 60 40"
    className={className}
    role="img"
    aria-label="Ghana"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <clipPath id="sukuu-gh-clip">
        <rect width="60" height="40" rx="6" />
      </clipPath>
    </defs>
    <g clipPath="url(#sukuu-gh-clip)">
      <rect width="60" height="40" fill="#CE1126" />
      <rect y="10" width="60" height="20" fill="#FCD116" />
      <rect y="30" width="60" height="10" fill="#006B3F" />
      <path
        d="M30 12.6l2.03 4.11 4.55.66-3.29 3.2.78 4.53L30 22.96l-4.07 2.14.78-4.53-3.29-3.2 4.55-.66L30 12.6z"
        fill="#000000"
      />
    </g>
    <rect width="60" height="40" rx="6" fill="none" stroke="rgba(0,0,0,0.08)" />
  </svg>
);

export default GhanaFlag;
