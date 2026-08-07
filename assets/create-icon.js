const fs = require('fs');
const path = require('path');

function createSimpleIcon() {
  const svgContent = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
    <rect width="256" height="256" fill="#2563eb" rx="32"/>
    <circle cx="128" cy="90" r="25" fill="white"/>
    <path d="M103 115 L153 115 L153 140 Q153 155 138 155 L118 155 Q103 155 103 140 Z" fill="white"/>
    <rect x="120" y="155" width="16" height="30" fill="white"/>
    <rect x="100" y="180" width="56" height="8" rx="4" fill="white"/>
    <path d="M70 200 Q70 190 80 190 L176 190 Q186 190 186 200 L186 220 Q186 230 176 230 L80 230 Q70 230 70 220 Z" fill="white"/>
    <text x="128" y="215" text-anchor="middle" fill="#2563eb" font-family="Arial, sans-serif" font-size="14" font-weight="bold">TXT</text>
  </svg>`;
  
  return svgContent;
}

const iconSvg = createSimpleIcon();
fs.writeFileSync(path.join(__dirname, 'icon.svg'), iconSvg);
console.log('Icon SVG created at assets/icon.svg');
console.log('Note: You may want to convert this SVG to PNG/ICO format for better compatibility.');
console.log('For production, consider using a proper icon generation tool or design software.');