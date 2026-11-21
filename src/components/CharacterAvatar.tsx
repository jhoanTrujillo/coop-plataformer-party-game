import React from 'react';
import {CHARACTER_PALETTES, CharacterColor} from '../shared/types';

interface CharacterAvatarProps {
  color: CharacterColor;
  size?: number;
  className?: string;
}

/**
 * PEAK-inspired single-color simple-shape humanoid avatar matching the in-game sprite sheet.
 */
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
      {/* Matching-hue compact climber backpack */}
      <rect
        x="12"
        y="31"
        width="10"
        height="16"
        rx="4"
        fill={pal.shoe}
        stroke="#0f172a"
        strokeWidth="3.2"
      />
      {/* Simple rounded legs (same solid skin color) */}
      <line
        x1="27"
        y1="45"
        x2="25"
        y2="56"
        stroke="#0f172a"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <line
        x1="27"
        y1="45"
        x2="25"
        y2="56"
        stroke={pal.body}
        strokeWidth="6.2"
        strokeLinecap="round"
      />
      <line
        x1="37"
        y1="45"
        x2="39"
        y2="56"
        stroke="#0f172a"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <line
        x1="37"
        y1="45"
        x2="39"
        y2="56"
        stroke={pal.body}
        strokeWidth="6.2"
        strokeLinecap="round"
      />
      {/* Simple rounded arms (same solid skin color) */}
      <line
        x1="22"
        y1="36"
        x2="13"
        y2="43"
        stroke="#0f172a"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <line
        x1="22"
        y1="36"
        x2="13"
        y2="43"
        stroke={pal.body}
        strokeWidth="5.4"
        strokeLinecap="round"
      />
      <line
        x1="42"
        y1="36"
        x2="51"
        y2="43"
        stroke="#0f172a"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <line
        x1="42"
        y1="36"
        x2="51"
        y2="43"
        stroke={pal.body}
        strokeWidth="5.4"
        strokeLinecap="round"
      />
      {/* Smooth pill torso (single solid skin color) */}
      <rect
        x="21"
        y="30"
        width="22"
        height="21"
        rx="10"
        fill={pal.body}
        stroke="#0f172a"
        strokeWidth="3.4"
      />
      {/* Smooth round head (exact same solid skin color) */}
      <circle cx="32" cy="21" r="14" fill={pal.body} stroke="#0f172a" strokeWidth="3.4" />
      <ellipse
        cx="27"
        cy="15.5"
        rx="5.5"
        ry="3.2"
        transform="rotate(-22 27 15.5)"
        fill={pal.bodyLight}
        opacity="0.65"
      />
      {/* Big expressive cartoon eyes */}
      <ellipse cx="29" cy="21" rx="3.8" ry="4.5" fill="#ffffff" stroke="#0f172a" strokeWidth="2.2" />
      <ellipse cx="38" cy="21" rx="3.6" ry="4.4" fill="#ffffff" stroke="#0f172a" strokeWidth="2.2" />
      <circle cx="30.2" cy="21" r="1.9" fill="#0f172a" />
      <circle cx="39.2" cy="21" r="1.8" fill="#0f172a" />
      <circle cx="29.4" cy="19.6" r="0.85" fill="#ffffff" />
      <circle cx="38.4" cy="19.6" r="0.85" fill="#ffffff" />
      {/* Simple smile */}
      <path
        d="M31 27.5 Q34 30 37 27.5"
        fill="none"
        stroke="#0f172a"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
};
