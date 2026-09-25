/**
 * The chapter's journey as one illustration: a walled city on the heights,
 * the road winding down through pale hills and red rock, and the palms of
 * Jericho below in the warm haze. Original, hand-built SVG in the game's
 * palette; decorative only (the page says the same in words).
 */
export function JourneyArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 200"
      className={className}
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="ja-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3d9a8" />
          <stop offset="0.7" stopColor="#f7e6c4" />
          <stop offset="1" stopColor="#efd8ae" />
        </linearGradient>
        <radialGradient id="ja-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="0.55" stopColor="#f2c25a" />
          <stop offset="1" stopColor="#f2c25a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ja-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7e6c4" stopOpacity="0" />
          <stop offset="1" stopColor="#f7e6c4" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <rect width="480" height="200" fill="url(#ja-sky)" />
      <circle cx="372" cy="58" r="44" fill="url(#ja-sun)" />
      <circle cx="372" cy="58" r="18" fill="#fbe3a0" />
      {/* Far hills in the haze, then the rolling wilderness. */}
      <path d="M0 110 Q 70 84 140 100 T 290 92 T 480 98 V200 H0 Z" fill="#dcc193" />
      <path d="M0 126 Q 90 104 170 120 T 330 110 T 480 118 V200 H0 Z" fill="#cda876" />
      {/* Red rock of the descent. */}
      <path d="M190 150 Q 250 124 318 140 T 420 150 V200 H190 Z" fill="#b8603f" />
      <path d="M205 160 Q 260 142 322 154 T 430 160" stroke="#8a3f2a" strokeWidth="2" fill="none" />
      <path d="M0 146 Q 110 128 210 146 T 480 150 V200 H0 Z" fill="#b38a57" />
      {/* Jerusalem on the heights: walls, towers, flat-roofed houses. */}
      <g fill="#ecdcb6" stroke="#6b4a2c" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M26 104 V82 H40 V76 H50 V82 H96 V72 H106 V82 H128 V104 Z" />
        <rect x="46" y="64" width="16" height="18" />
        <rect x="66" y="58" width="20" height="24" />
        <rect x="90" y="66" width="14" height="16" />
        <rect x="110" y="70" width="12" height="12" />
      </g>
      <g fill="#6b4a2c">
        <rect x="72" y="92" width="7" height="12" rx="3.5" />
        <rect x="52" y="70" width="3" height="4" />
        <rect x="74" y="64" width="3" height="4" />
        <rect x="95" y="71" width="3" height="4" />
      </g>
      {/* The road, winding down to the east. */}
      <path
        d="M78 106 C 120 120, 150 118, 180 132 S 250 160, 300 158 S 380 170, 430 176"
        stroke="#f4e6c6"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M78 106 C 120 120, 150 118, 180 132 S 250 160, 300 158 S 380 170, 430 176"
        stroke="#9c7a4c"
        strokeWidth="1"
        strokeDasharray="2 7"
        fill="none"
      />
      {/* Jericho: palms and green below. */}
      <path d="M380 200 Q 400 168 440 172 T 480 166 V200 Z" fill="#6f9a3e" />
      <g stroke="#5a4028" strokeWidth="2.4" strokeLinecap="round">
        <path d="M410 186 Q 412 168 409 154" />
        <path d="M436 188 Q 440 170 438 150" />
        <path d="M458 190 Q 460 176 462 164" />
      </g>
      <g fill="#4f8a38">
        <path d="M409 154 q -14 -4 -22 6 q 12 -2 22 -6 q -6 -12 -18 -12 q 10 4 18 12 q 4 -12 16 -14 q -12 2 -16 14 q 14 -2 20 8 q -8 -8 -20 -8z" />
        <path d="M438 150 q -14 -4 -22 6 q 12 -2 22 -6 q -6 -12 -18 -12 q 10 4 18 12 q 4 -12 16 -14 q -12 2 -16 14 q 14 -2 20 8 q -8 -8 -20 -8z" />
        <path d="M462 164 q -12 -4 -19 5 q 10 -2 19 -5 q -5 -10 -15 -10 q 9 3 15 10 q 3 -10 13 -12 q -10 2 -13 12 q 12 -2 17 7 q -7 -7 -17 -7z" />
      </g>
      {/* A small traveller with a satchel, partway down. */}
      <g transform="translate(236 146)">
        <ellipse cx="0" cy="12" rx="6" ry="1.6" fill="#6b4a2c" opacity="0.35" />
        <path
          d="M-4 11 L-3 -1 Q 0 -4 3 -1 L4 11 Z"
          fill="#3f6f8f"
          stroke="#2a170b"
          strokeWidth="0.8"
        />
        <circle cx="0" cy="-5" r="3" fill="#a8734a" stroke="#2a170b" strokeWidth="0.8" />
        <path d="M-3.2 -6 Q 0 -10 3.2 -6 Z" fill="#e8dcc0" />
        <rect x="-6" y="3" width="3.6" height="4" rx="1" fill="#8f6a40" />
      </g>
      {/* Birds. */}
      <g stroke="#6b4a2c" strokeWidth="1.4" fill="none" strokeLinecap="round">
        <path d="M300 40 q 4 -4 8 0 q 4 -4 8 0" />
        <path d="M322 30 q 3 -3 6 0 q 3 -3 6 0" />
      </g>
      <rect width="480" height="200" fill="url(#ja-haze)" opacity="0.35" />
    </svg>
  );
}
