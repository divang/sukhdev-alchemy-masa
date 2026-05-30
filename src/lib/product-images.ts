const defaultImages: Record<string, string> = {
  'garam-masala-premium': `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="garamBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#8B4513;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#A0522D;stop-opacity:1" />
        </linearGradient>
        <radialGradient id="garamGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#FFE4B5;stop-opacity:0.3" />
          <stop offset="100%" style="stop-color:#FFE4B5;stop-opacity:0" />
        </radialGradient>
      </defs>
      <rect width="400" height="400" fill="url(#garamBg)"/>
      <circle cx="200" cy="200" r="180" fill="url(#garamGlow)"/>
      <circle cx="200" cy="200" r="120" fill="#6B3410" opacity="0.8"/>
      <g transform="translate(200, 200)">
        <circle cx="0" cy="-80" r="8" fill="#D2691E"/>
        <circle cx="-70" cy="-40" r="10" fill="#CD853F"/>
        <circle cx="-70" cy="40" r="9" fill="#8B4513"/>
        <circle cx="0" cy="80" r="11" fill="#A0522D"/>
        <circle cx="70" cy="40" r="8" fill="#D2691E"/>
        <circle cx="70" cy="-40" r="10" fill="#CD853F"/>
        <circle cx="0" cy="0" r="15" fill="#DEB887"/>
      </g>
      <text x="200" y="340" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#FFE4B5" text-anchor="middle">GARAM MASALA</text>
      <text x="200" y="370" font-family="Arial, sans-serif" font-size="16" fill="#FFE4B5" text-anchor="middle" opacity="0.9">Premium Blend</text>
    </svg>
  `)}`,
  
  'bharwa-masala-premium': `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="bharwaBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#DC143C;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#8B0000;stop-opacity:1" />
        </linearGradient>
        <radialGradient id="bharwaGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#FFD700;stop-opacity:0.4" />
          <stop offset="100%" style="stop-color:#FFD700;stop-opacity:0" />
        </radialGradient>
      </defs>
      <rect width="400" height="400" fill="url(#bharwaBg)"/>
      <circle cx="200" cy="200" r="180" fill="url(#bharwaGlow)"/>
      <ellipse cx="200" cy="180" rx="100" ry="110" fill="#A52A2A" opacity="0.6"/>
      <ellipse cx="200" cy="190" rx="80" ry="90" fill="#8B0000" opacity="0.7"/>
      <g>
        <path d="M 150 150 Q 180 120 200 140 Q 220 120 250 150" stroke="#FFD700" stroke-width="3" fill="none" opacity="0.8"/>
        <path d="M 150 200 Q 180 170 200 190 Q 220 170 250 200" stroke="#FFD700" stroke-width="3" fill="none" opacity="0.8"/>
        <path d="M 150 250 Q 180 220 200 240 Q 220 220 250 250" stroke="#FFD700" stroke-width="3" fill="none" opacity="0.8"/>
      </g>
      <circle cx="180" cy="165" r="6" fill="#FF6347"/>
      <circle cx="220" cy="165" r="6" fill="#FF6347"/>
      <circle cx="200" cy="210" r="7" fill="#FF4500"/>
      <text x="200" y="340" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#FFE4B5" text-anchor="middle">BHARWAN MASALA</text>
      <text x="200" y="370" font-family="Arial, sans-serif" font-size="16" fill="#FFE4B5" text-anchor="middle" opacity="0.9">Premium Quality</text>
    </svg>
  `)}`,
  
  'chat-masala-premium': `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="chatBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#FF8C00;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#FF6347;stop-opacity:1" />
        </linearGradient>
        <radialGradient id="chatGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#FFFF00;stop-opacity:0.5" />
          <stop offset="100%" style="stop-color:#FFFF00;stop-opacity:0" />
        </radialGradient>
      </defs>
      <rect width="400" height="400" fill="url(#chatBg)"/>
      <circle cx="200" cy="200" r="180" fill="url(#chatGlow)"/>
      <g transform="translate(200, 200)">
        <circle cx="0" cy="0" r="100" fill="#D2691E" opacity="0.6"/>
        <circle cx="0" cy="0" r="80" fill="#CD853F" opacity="0.7"/>
        <g transform="rotate(0)">
          <circle cx="0" cy="-60" r="12" fill="#FFD700"/>
          <circle cx="0" cy="-60" r="8" fill="#FFA500"/>
        </g>
        <g transform="rotate(60)">
          <circle cx="0" cy="-60" r="10" fill="#FFFF00"/>
          <circle cx="0" cy="-60" r="6" fill="#FFD700"/>
        </g>
        <g transform="rotate(120)">
          <circle cx="0" cy="-60" r="11" fill="#FF8C00"/>
          <circle cx="0" cy="-60" r="7" fill="#FF6347"/>
        </g>
        <g transform="rotate(180)">
          <circle cx="0" cy="-60" r="13" fill="#FFA500"/>
          <circle cx="0" cy="-60" r="9" fill="#FF4500"/>
        </g>
        <g transform="rotate(240)">
          <circle cx="0" cy="-60" r="10" fill="#FFD700"/>
          <circle cx="0" cy="-60" r="6" fill="#FFA500"/>
        </g>
        <g transform="rotate(300)">
          <circle cx="0" cy="-60" r="12" fill="#FFFF00"/>
          <circle cx="0" cy="-60" r="8" fill="#FFD700"/>
        </g>
        <circle cx="0" cy="0" r="20" fill="#8B4513"/>
        <circle cx="0" cy="0" r="12" fill="#A0522D"/>
      </g>
      <text x="200" y="340" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#FFFFFF" text-anchor="middle">CHAAT MASALA</text>
      <text x="200" y="370" font-family="Arial, sans-serif" font-size="16" fill="#FFFFFF" text-anchor="middle" opacity="0.9">Tangy & Zesty</text>
    </svg>
  `)}`,
  
  'chhole-masala-premium': `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="chholeBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#DAA520;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#B8860B;stop-opacity:1" />
        </linearGradient>
        <radialGradient id="chholeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#FAFAD2;stop-opacity:0.4" />
          <stop offset="100%" style="stop-color:#FAFAD2;stop-opacity:0" />
        </radialGradient>
      </defs>
      <rect width="400" height="400" fill="url(#chholeBg)"/>
      <circle cx="200" cy="200" r="180" fill="url(#chholeGlow)"/>
      <ellipse cx="200" cy="200" rx="110" ry="100" fill="#CD853F" opacity="0.6"/>
      <g transform="translate(200, 200)">
        <circle cx="-40" cy="-40" r="18" fill="#D2691E" opacity="0.8"/>
        <circle cx="40" cy="-40" r="16" fill="#8B4513" opacity="0.8"/>
        <circle cx="-40" cy="20" r="17" fill="#A0522D" opacity="0.8"/>
        <circle cx="40" cy="20" r="19" fill="#CD853F" opacity="0.8"/>
        <circle cx="0" cy="-10" r="20" fill="#DEB887" opacity="0.8"/>
        <circle cx="-20" cy="50" r="15" fill="#D2691E" opacity="0.8"/>
        <circle cx="20" cy="50" r="16" fill="#8B4513" opacity="0.8"/>
      </g>
      <g opacity="0.3">
        <circle cx="140" cy="120" r="8" fill="#8B4513"/>
        <circle cx="260" cy="140" r="7" fill="#A0522D"/>
        <circle cx="170" cy="280" r="9" fill="#CD853F"/>
        <circle cx="240" cy="270" r="8" fill="#D2691E"/>
      </g>
      <text x="200" y="340" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#FFFFFF" text-anchor="middle">CHOLE MASALA</text>
      <text x="200" y="370" font-family="Arial, sans-serif" font-size="16" fill="#FFFFFF" text-anchor="middle" opacity="0.9">Authentic Punjabi</text>
    </svg>
  `)}`,
}

export function getProductImage(productId: string, uploadedImages?: Record<string, string>): string {
  if (uploadedImages && uploadedImages[productId]) {
    return uploadedImages[productId]
  }
  
  return defaultImages[productId] || ''
}
