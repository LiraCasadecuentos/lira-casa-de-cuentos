// Genera los íconos provisorios de la app (una casita de chocolate sobre fondo crema).
// Cuando esté el logo definitivo, reemplazá los archivos de la carpeta "public"
// (icono-192.png, icono-512.png, apple-touch-icon.png e icono.svg) por los nuevos.
// Uso: npm run iconos

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CREMA = [251, 245, 234];
const CHOCOLATE = [91, 58, 41];
const GLASEADO = [217, 138, 138];

/** Dibuja la casita en coordenadas de 0 a 1. */
function colorAt(x, y) {
  // Techo (triángulo) con borde de glaseado.
  const roofTop = 0.2;
  const roofBottom = 0.48;
  if (y >= roofTop && y <= roofBottom) {
    const half = ((y - roofTop) / (roofBottom - roofTop)) * 0.36;
    if (Math.abs(x - 0.5) <= half) return y > roofBottom - 0.05 ? GLASEADO : CHOCOLATE;
  }
  // Paredes.
  if (y > roofBottom && y <= 0.8 && x >= 0.24 && x <= 0.76) {
    // Puerta.
    if (x >= 0.44 && x <= 0.56 && y >= 0.62) return CREMA;
    // Ventana.
    if (x >= 0.3 && x <= 0.39 && y >= 0.54 && y <= 0.63) return GLASEADO;
    if (x >= 0.61 && x <= 0.7 && y >= 0.54 && y <= 0.63) return GLASEADO;
    return CHOCOLATE;
  }
  return CREMA;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const ss = 3; // suavizado: 3x3 muestras por pixel
  for (let py = 0; py < size; py++) {
    raw[py * (size * 3 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = colorAt((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size);
          acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
        }
      }
      const o = py * (size * 3 + 1) + 1 + px * 3;
      raw[o] = Math.round(acc[0] / (ss * ss));
      raw[o + 1] = Math.round(acc[1] / (ss * ss));
      raw[o + 2] = Math.round(acc[2] / (ss * ss));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#fbf5ea"/>
  <polygon points="50,20 86,48 14,48" fill="#5b3a29"/>
  <rect x="17" y="43" width="66" height="5" fill="#d98a8a"/>
  <rect x="24" y="48" width="52" height="32" fill="#5b3a29"/>
  <rect x="44" y="62" width="12" height="18" fill="#fbf5ea"/>
  <rect x="30" y="54" width="9" height="9" fill="#d98a8a"/>
  <rect x="61" y="54" width="9" height="9" fill="#d98a8a"/>
</svg>
`;

mkdirSync('public', { recursive: true });
writeFileSync('public/icono-192.png', png(192));
writeFileSync('public/icono-512.png', png(512));
writeFileSync('public/apple-touch-icon.png', png(180));
writeFileSync('public/icono.svg', svg);
console.log('Íconos creados en la carpeta public');
