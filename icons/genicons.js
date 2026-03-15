const { createCanvas } = require('/tmp/canvas-gen/node_modules/canvas');
const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 128];
const iconDir = '/home/user/limitr/icons';

// Three color themes: default (purple), active (gold), gray (inactive)
const themes = {
  // Default purple - the original icon, also used for manifest
  '': { grad: ['#4f46e5', '#7c3aed'], stroke: '#fff' },
  // Gold - active/processing
  '-active': { grad: ['#d97706', '#f59e0b'], stroke: '#fff' },
  // Gray - inactive/disabled
  '-gray': { grad: ['#4b5563', '#6b7280'], stroke: '#9ca3af' },
};

function drawIcon(size, theme) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, theme.grad[0]);
  gradient.addColorStop(1, theme.grad[1]);

  // Rounded rectangle background
  const radius = size * 0.15;
  // Manual roundRect for node-canvas compatibility
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.arcTo(size, 0, size, radius, radius);
  ctx.lineTo(size, size - radius);
  ctx.arcTo(size, size, size - radius, size, radius);
  ctx.lineTo(radius, size);
  ctx.arcTo(0, size, 0, size - radius, radius);
  ctx.lineTo(0, radius);
  ctx.arcTo(0, 0, radius, 0, radius);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw audio waveform / limiter symbol
  ctx.strokeStyle = theme.stroke;
  ctx.lineWidth = Math.max(1.5, size * 0.06);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const margin = size * 0.2;
  const centerY = size / 2;
  const waveHeight = size * 0.25;

  // Input wave (left side, taller)
  ctx.beginPath();
  ctx.moveTo(margin, centerY);
  ctx.lineTo(margin + size * 0.1, centerY - waveHeight);
  ctx.lineTo(margin + size * 0.2, centerY + waveHeight * 0.8);
  ctx.lineTo(margin + size * 0.3, centerY - waveHeight * 0.6);
  ctx.stroke();

  // Limiter line (ceiling)
  ctx.beginPath();
  ctx.setLineDash([size * 0.03, size * 0.03]);
  ctx.moveTo(size * 0.35, centerY - waveHeight * 0.4);
  ctx.lineTo(size * 0.85, centerY - waveHeight * 0.4);
  ctx.stroke();
  ctx.setLineDash([]);

  // Output wave (right side, compressed)
  ctx.beginPath();
  ctx.moveTo(size * 0.55, centerY);
  ctx.lineTo(size * 0.62, centerY - waveHeight * 0.35);
  ctx.lineTo(size * 0.69, centerY + waveHeight * 0.3);
  ctx.lineTo(size * 0.76, centerY - waveHeight * 0.25);
  ctx.stroke();

  return canvas;
}

for (const [suffix, theme] of Object.entries(themes)) {
  for (const size of sizes) {
    const canvas = drawIcon(size, theme);
    const filename = `icon${size}${suffix}.png`;
    const filepath = path.join(iconDir, filename);
    fs.writeFileSync(filepath, canvas.toBuffer('image/png'));
    console.log(`Generated ${filename}`);
  }
}
