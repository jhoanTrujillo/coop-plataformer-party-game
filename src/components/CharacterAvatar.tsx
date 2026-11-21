import React from 'react';
import {CHARACTER_PALETTES, CharacterColor} from '../shared/types';

interface CharacterAvatarProps {
  color: CharacterColor;
  size?: number;
  className?: string;
}

export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  color,
  size = 44,
  className = '',
}) => {
  const pal = CHARACTER_PALETTES[color] ?? CHARACTER_PALETTES.sakura;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-label={pal.label}
    >
      {/* Shoes */}
      <ellipse cx="22" cy="53" rx="10" ry="6" fill={pal.shoe} stroke="#0f172a" strokeWidth="3.2" />
      <ellipse cx="42" cy="53" rx="10" ry="6" fill={pal.shoe} stroke="#0f172a" strokeWidth="3.2" />
      {/* Arms */}
      <ellipse cx="11" cy="36" rx="7" ry="5.5" fill={pal.body} stroke="#0f172a" strokeWidth="3.2" />
      <ellipse cx="53" cy="36" rx="7" ry="5.5" fill={pal.body} stroke="#0f172a" strokeWidth="3.2" />
      {/* Body */}
      <circle cx="32" cy="35" r="21" fill={pal.body} stroke="#0f172a" strokeWidth="3.5" />
      <circle cx="26" cy="29" r="9.5" fill={pal.bodyLight} />
      {/* Adventure Cap */}
      <path
        d="M11 26 C13 9, 51 9, 53 26 Z"
        fill={pal.cap}
        stroke="#0f172a"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <ellipse cx="42" cy="25" rx="13" ry="4.5" fill={pal.cap} stroke="#0f172a" strokeWidth="3.2" />
      <line x1="14" y1="24.5" x2="47" y2="24.5" stroke={pal.trim} strokeWidth="4" strokeLinecap="round" />
      {/* Cheeks */}
      <ellipse cx="22" cy="40" rx="4.5" ry="2.6" fill={pal.cheek} opacity="0.85" />
      <ellipse cx="45" cy="40" rx="4.5" ry="2.6" fill={pal.cheek} opacity="0.85" />
      {/* Sparkling Eyes */}
      <ellipse cx="28" cy="34" rx="3" ry="5.5" fill="#0f172a" />
      <ellipse cx="39" cy="34" rx="3" ry="5.5" fill="#0f172a" />
      <circle cx="27" cy="31.5" r="1.6" fill="#ffffff" />
      <circle cx="38" cy="31.5" r="1.6" fill="#ffffff" />
      {/* Happy Smile */}
      <path d="M31 41 Q33.5 44 36 41" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
};
