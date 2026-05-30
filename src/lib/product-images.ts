const defaultImages: Record<string, string> = {
  'garam-masala-premium': `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="garamBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#3D2817;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#5C3D2E;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#4A2F1F;stop-opacity:1" />
        </linearGradient>
        <radialGradient id="garamHighlight" cx="40%" cy="30%" r="60%">
          <stop offset="0%" style="stop-color:#8B5A3C;stop-opacity:0.6" />
          <stop offset="100%" style="stop-color:#3D2817;stop-opacity:0" />
        </radialGradient>
        <filter id="spiceShadow">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
          <feOffset dx="1" dy="1" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.4"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="400" height="400" fill="url(#garamBg)"/>
      <ellipse cx="200" cy="200" rx="180" ry="185" fill="url(#garamHighlight)"/>
      <g filter="url(#spiceShadow)">
        <ellipse cx="150" cy="140" rx="6" ry="18" fill="#6B4423" opacity="0.9" transform="rotate(-25 150 140)"/>
        <ellipse cx="250" cy="160" rx="5" ry="16" fill="#7A5230" opacity="0.9" transform="rotate(35 250 160)"/>
        <ellipse cx="180" cy="190" rx="7" ry="20" fill="#5C3D2E" opacity="0.9" transform="rotate(-40 180 190)"/>
        <ellipse cx="220" cy="200" rx="6" ry="17" fill="#6B4423" opacity="0.9" transform="rotate(15 220 200)"/>
        <ellipse cx="190" cy="240" rx="5" ry="15" fill="#8B5A3C" opacity="0.9" transform="rotate(-50 190 240)"/>
        <ellipse cx="230" cy="250" rx="7" ry="19" fill="#5C3D2E" opacity="0.9" transform="rotate(40 230 250)"/>
        <circle cx="200" cy="170" r="10" fill="#9B6B47"/>
        <circle cx="205" cy="168" r="6" fill="#7A5230"/>
        <circle cx="165" cy="215" r="8" fill="#8B5A3C"/>
        <circle cx="168" cy="213" r="5" fill="#6B4423"/>
        <circle cx="240" cy="220" r="9" fill="#7A5230"/>
        <circle cx="242" cy="218" r="5" fill="#5C3D2E"/>
        <path d="M 145,175 Q 150,180 155,175 Q 160,170 165,175" stroke="#D4A574" stroke-width="2" fill="none" opacity="0.7"/>
        <path d="M 235,195 Q 240,200 245,195 Q 250,190 255,195" stroke="#D4A574" stroke-width="2" fill="none" opacity="0.7"/>
        <ellipse cx="210" cy="225" rx="4" ry="3" fill="#C8A882" opacity="0.8"/>
        <ellipse cx="175" cy="180" rx="3" ry="4" fill="#B89968" opacity="0.8"/>
        <ellipse cx="225" cy="180" rx="5" ry="3" fill="#C8A882" opacity="0.8"/>
        <rect x="195" y="205" width="3" height="12" fill="#8B4513" opacity="0.7" transform="rotate(20 196.5 211)"/>
        <rect x="215" y="240" width="2" height="10" fill="#8B4513" opacity="0.7" transform="rotate(-15 216 245)"/>
      </g>
      <g opacity="0.15">
        <circle cx="120" cy="120" r="3" fill="#D4A574"/>
        <circle cx="280" cy="140" r="2" fill="#D4A574"/>
        <circle cx="140" cy="280" r="3" fill="#C8A882"/>
        <circle cx="270" cy="270" r="2" fill="#B89968"/>
      </g>
      <text x="200" y="345" font-family="Georgia, serif" font-size="28" font-weight="bold" fill="#D4A574" text-anchor="middle" letter-spacing="1">GARAM MASALA</text>
      <text x="200" y="375" font-family="Arial, sans-serif" font-size="15" fill="#B89968" text-anchor="middle" opacity="0.95">Premium Blend</text>
    </svg>
  `)}`,
  
  'bharwa-masala-premium': `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="bharwaBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#8B3A0E;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#A0522D;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#6B2C10;stop-opacity:1" />
        </linearGradient>
        <radialGradient id="bharwaGlow" cx="30%" cy="35%" r="65%">
          <stop offset="0%" style="stop-color:#D2691E;stop-opacity:0.5" />
          <stop offset="100%" style="stop-color:#8B3A0E;stop-opacity:0" />
        </radialGradient>
        <filter id="bharwaTexture">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="2"/>
          <feColorMatrix type="saturate" values="0.3"/>
          <feBlend mode="multiply" in2="SourceGraphic"/>
        </filter>
      </defs>
      <rect width="400" height="400" fill="url(#bharwaBg)"/>
      <ellipse cx="200" cy="200" rx="180" ry="185" fill="url(#bharwaGlow)"/>
      <g opacity="0.3" filter="url(#bharwaTexture)">
        <circle cx="200" cy="200" r="140" fill="#A0522D"/>
      </g>
      <g>
        <ellipse cx="160" cy="160" rx="5" ry="4" fill="#CD5C5C" opacity="0.9"/>
        <ellipse cx="240" cy="170" rx="6" ry="5" fill="#B8503E" opacity="0.9"/>
        <ellipse cx="190" cy="190" rx="4" ry="3" fill="#DC7663" opacity="0.9"/>
        <ellipse cx="220" cy="185" rx="5" ry="4" fill="#C85A47" opacity="0.9"/>
        <ellipse cx="175" cy="220" rx="6" ry="5" fill="#B8503E" opacity="0.9"/>
        <ellipse cx="235" cy="215" rx="5" ry="4" fill="#CD5C5C" opacity="0.9"/>
        <ellipse cx="200" cy="240" rx="4" ry="3" fill="#DC7663" opacity="0.9"/>
        <circle cx="150" cy="195" r="3" fill="#E8A87C" opacity="0.85"/>
        <circle cx="250" cy="205" r="3" fill="#D4A574" opacity="0.85"/>
        <circle cx="210" cy="170" r="2" fill="#E8A87C" opacity="0.85"/>
        <circle cx="180" cy="250" r="3" fill="#C8A882" opacity="0.85"/>
        <path d="M 160,145 Q 165,150 170,145" stroke="#8B4513" stroke-width="1.5" fill="none" opacity="0.6"/>
        <path d="M 230,160 Q 235,165 240,160" stroke="#8B4513" stroke-width="1.5" fill="none" opacity="0.6"/>
        <ellipse cx="195" cy="205" rx="8" ry="6" fill="#A0522D" opacity="0.7"/>
        <ellipse cx="198" cy="203" rx="5" ry="4" fill="#8B4513" opacity="0.8"/>
        <rect x="145" y="175" width="2" height="8" fill="#D2691E" opacity="0.6" transform="rotate(25 146 179)"/>
        <rect x="252" y="195" width="2" height="7" fill="#CD853F" opacity="0.6" transform="rotate(-20 253 198.5)"/>
        <circle cx="165" cy="235" r="3" fill="#DEB887" opacity="0.7"/>
        <circle cx="225" cy="245" r="3" fill="#D2B48C" opacity="0.7"/>
      </g>
      <g opacity="0.12">
        <circle cx="130" cy="130" r="4" fill="#E8A87C"/>
        <circle cx="270" cy="150" r="3" fill="#D4A574"/>
        <circle cx="140" cy="270" r="4" fill="#C8A882"/>
        <circle cx="260" cy="260" r="3" fill="#DEB887"/>
      </g>
      <text x="200" y="345" font-family="Georgia, serif" font-size="26" font-weight="bold" fill="#E8A87C" text-anchor="middle" letter-spacing="1">BHARWA MASALA</text>
      <text x="200" y="375" font-family="Arial, sans-serif" font-size="15" fill="#D4A574" text-anchor="middle" opacity="0.95">Premium Blend</text>
    </svg>
  `)}`,
  
  'chat-masala-premium': `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="chatBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#4A1F0B;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#6B2C10;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#3D1808;stop-opacity:1" />
        </linearGradient>
        <radialGradient id="chatGlow" cx="35%" cy="30%" r="60%">
          <stop offset="0%" style="stop-color:#8B4513;stop-opacity:0.6" />
          <stop offset="100%" style="stop-color:#3D1808;stop-opacity:0" />
        </radialGradient>
        <filter id="chatGrain">
          <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="5"/>
          <feColorMatrix type="saturate" values="0.2"/>
          <feBlend mode="overlay" in2="SourceGraphic"/>
        </filter>
      </defs>
      <rect width="400" height="400" fill="url(#chatBg)"/>
      <ellipse cx="200" cy="200" rx="180" ry="185" fill="url(#chatGlow)"/>
      <g opacity="0.25" filter="url(#chatGrain)">
        <circle cx="200" cy="200" r="145" fill="#6B2C10"/>
      </g>
      <g>
        <circle cx="145" cy="155" r="4" fill="#2D1810" opacity="0.95"/>
        <circle cx="255" cy="165" r="5" fill="#3A1F12" opacity="0.95"/>
        <circle cx="175" cy="180" r="3" fill="#2D1810" opacity="0.95"/>
        <circle cx="230" cy="175" r="4" fill="#4A2515" opacity="0.95"/>
        <circle cx="160" cy="210" r="5" fill="#3A1F12" opacity="0.95"/>
        <circle cx="245" cy="205" r="4" fill="#2D1810" opacity="0.95"/>
        <circle cx="200" cy="230" r="3" fill="#4A2515" opacity="0.95"/>
        <circle cx="180" cy="250" r="4" fill="#2D1810" opacity="0.95"/>
        <circle cx="220" cy="245" r="5" fill="#3A1F12" opacity="0.95"/>
        <ellipse cx="195" cy="165" rx="3" ry="4" fill="#5C3D2E" opacity="0.8"/>
        <ellipse cx="215" cy="190" rx="4" ry="3" fill="#6B4423" opacity="0.8"/>
        <ellipse cx="185" cy="200" rx="3" ry="5" fill="#7A5230" opacity="0.8"/>
        <ellipse cx="225" cy="220" rx="5" ry="3" fill="#5C3D2E" opacity="0.8"/>
        <circle cx="155" cy="185" r="2" fill="#8B5A3C" opacity="0.7"/>
        <circle cx="240" cy="180" r="2" fill="#9B6B47" opacity="0.7"/>
        <circle cx="170" cy="235" r="3" fill="#7A5230" opacity="0.7"/>
        <circle cx="235" cy="230" r="2" fill="#8B5A3C" opacity="0.7"/>
        <path d="M 142,140 L 145,150 L 148,140" stroke="#5C3D2E" stroke-width="1" fill="none" opacity="0.5"/>
        <path d="M 252,155 L 255,165 L 258,155" stroke="#6B4423" stroke-width="1" fill="none" opacity="0.5"/>
        <ellipse cx="205" cy="210" rx="6" ry="5" fill="#4A2515" opacity="0.75"/>
        <ellipse cx="207" cy="208" rx="4" ry="3" fill="#3A1F12" opacity="0.85"/>
      </g>
      <g opacity="0.15">
        <circle cx="125" cy="125" r="3" fill="#7A5230"/>
        <circle cx="275" cy="140" r="2" fill="#8B5A3C"/>
        <circle cx="135" cy="275" r="3" fill="#6B4423"/>
        <circle cx="265" cy="270" r="2" fill="#7A5230"/>
      </g>
      <text x="200" y="345" font-family="Georgia, serif" font-size="28" font-weight="bold" fill="#B89968" text-anchor="middle" letter-spacing="1">CHAAT MASALA</text>
      <text x="200" y="375" font-family="Arial, sans-serif" font-size="15" fill="#9B8262" text-anchor="middle" opacity="0.95">Tangy & Zesty</text>
    </svg>
  `)}`,
  
  'chhole-masala-premium': `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="chholeBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#5C2E10;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#7A3F1A;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#4A2512;stop-opacity:1" />
        </linearGradient>
        <radialGradient id="chholeGlow" cx="40%" cy="35%" r="65%">
          <stop offset="0%" style="stop-color:#9B5B2F;stop-opacity:0.5" />
          <stop offset="100%" style="stop-color:#5C2E10;stop-opacity:0" />
        </radialGradient>
        <filter id="chholeSpeckle">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" seed="10"/>
          <feColorMatrix type="saturate" values="0.4"/>
          <feBlend mode="soft-light" in2="SourceGraphic"/>
        </filter>
      </defs>
      <rect width="400" height="400" fill="url(#chholeBg)"/>
      <ellipse cx="200" cy="200" rx="180" ry="185" fill="url(#chholeGlow)"/>
      <g opacity="0.2" filter="url(#chholeSpeckle)">
        <circle cx="200" cy="200" r="150" fill="#7A3F1A"/>
      </g>
      <g>
        <ellipse cx="165" cy="150" rx="7" ry="9" fill="#6B3410" opacity="0.9"/>
        <ellipse cx="235" cy="160" rx="8" ry="10" fill="#7A4520" opacity="0.9"/>
        <ellipse cx="180" cy="185" rx="6" ry="8" fill="#5C2E10" opacity="0.9"/>
        <ellipse cx="225" cy="180" rx="9" ry="11" fill="#8B5230" opacity="0.9"/>
        <ellipse cx="155" cy="210" rx="7" ry="9" fill="#6B3410" opacity="0.9"/>
        <ellipse cx="245" cy="205" rx="8" ry="10" fill="#7A4520" opacity="0.9"/>
        <ellipse cx="190" cy="235" rx="9" ry="11" fill="#8B5230" opacity="0.9"/>
        <ellipse cx="215" cy="230" rx="7" ry="9" fill="#6B3410" opacity="0.9"/>
        <ellipse cx="170" cy="260" rx="8" ry="10" fill="#7A4520" opacity="0.9"/>
        <circle cx="200" cy="165" r="4" fill="#A0654F" opacity="0.85"/>
        <circle cx="150" cy="195" r="3" fill="#9B5B3F" opacity="0.85"/>
        <circle cx="250" cy="190" r="4" fill="#A0654F" opacity="0.85"/>
        <circle cx="205" cy="215" r="3" fill="#8B5230" opacity="0.85"/>
        <circle cx="175" cy="240" r="4" fill="#A0654F" opacity="0.85"/>
        <circle cx="230" cy="245" r="3" fill="#9B5B3F" opacity="0.85"/>
        <path d="M 162,135 Q 165,140 168,135" stroke="#9B6B47" stroke-width="1.5" fill="none" opacity="0.5"/>
        <path d="M 232,150 Q 235,155 238,150" stroke="#9B6B47" stroke-width="1.5" fill="none" opacity="0.5"/>
        <ellipse cx="195" cy="200" rx="5" ry="4" fill="#C8A882" opacity="0.6"/>
        <ellipse cx="210" cy="195" rx="4" ry="3" fill="#B89968" opacity="0.6"/>
      </g>
      <g opacity="0.15">
        <circle cx="130" cy="135" r="4" fill="#A0654F"/>
        <circle cx="270" cy="155" r="3" fill="#9B6B47"/>
        <circle cx="145" cy="275" r="4" fill="#8B5230"/>
        <circle cx="265" cy="265" r="3" fill="#A0654F"/>
      </g>
      <text x="200" y="345" font-family="Georgia, serif" font-size="28" font-weight="bold" fill="#C8A882" text-anchor="middle" letter-spacing="1">CHOLE MASALA</text>
      <text x="200" y="375" font-family="Arial, sans-serif" font-size="15" fill="#B89968" text-anchor="middle" opacity="0.95">Authentic Punjabi</text>
    </svg>
  `)}`,
}

export function getProductImage(productId: string, uploadedImages?: Record<string, string>): string {
  if (uploadedImages && uploadedImages[productId]) {
    return uploadedImages[productId]
  }
  
  return defaultImages[productId] || ''
}
