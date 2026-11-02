// Gráficos simples hechos a mano (sin librerías): barras verticales, línea y barras horizontales.
// Usan los colores del tema, así cambian solos si cambia la identidad visual.

import { formatMoney } from '../logic/money.js';

const short = (n) => {
  const v = Math.abs(n);
  if (v >= 1e6) return `$ ${(n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`;
  if (v >= 1e3) return `$ ${Math.round(n / 1e3).toLocaleString('es-AR')} mil`;
  return `$ ${Math.round(n).toLocaleString('es-AR')}`;
};

/**
 * Barras verticales (o línea) en el tiempo.
 * data: [{ label, value }]
 */
export function TimeChart({ data, type = 'bar', title, format = short }) {
  // Tamaño "lógico" chico: al estirarse al ancho de la pantalla, las letras quedan legibles también en el celular.
  const W = 420;
  const H = 200;
  const pad = { top: 14, right: 8, bottom: 30, left: 66 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const step = innerW / Math.max(1, data.length);
  const y = (v) => pad.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  // Si hay muchas barras, mostramos solo algunas etiquetas.
  const every = Math.ceil(data.length / 7);

  return (
    <figure className="chart" style={{ margin: '0 0 1rem' }}>
      {title && <figcaption className="stat-label">{title}</figcaption>}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title || 'Gráfico'} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="var(--color-borde)" strokeWidth="1" />
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" fontSize="13" fill="var(--color-texto-suave)">{format(t)}</text>
          </g>
        ))}
        {type === 'bar' &&
          data.map((d, i) => {
            const bw = Math.max(2, step * 0.7);
            return (
              <rect key={i} x={pad.left + i * step + (step - bw) / 2} y={y(d.value)} width={bw} height={Math.max(0, pad.top + innerH - y(d.value))} rx="3" fill="var(--color-principal)">
                <title>{`${d.label}: ${formatMoney(d.value)}`}</title>
              </rect>
            );
          })}
        {type === 'line' && (
          <>
            <polyline
              fill="none"
              stroke="var(--color-principal)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              points={data.map((d, i) => `${pad.left + i * step + step / 2},${y(d.value)}`).join(' ')}
            />
            {data.map((d, i) => (
              <circle key={i} cx={pad.left + i * step + step / 2} cy={y(d.value)} r="3.5" fill="var(--color-acento)">
                <title>{`${d.label}: ${formatMoney(d.value)}`}</title>
              </circle>
            ))}
          </>
        )}
        {data.map((d, i) =>
          i % every === 0 ? (
            <text key={i} x={pad.left + i * step + step / 2} y={H - 12} textAnchor="middle" fontSize="13" fill="var(--color-texto-suave)">{d.label}</text>
          ) : null,
        )}
      </svg>
    </figure>
  );
}

/**
 * Barras horizontales para comparar (canales, formas de pago, productos).
 * data: [{ label, value, detail? }]
 */
export function HBars({ data, format = formatMoney }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="hbars chart">
      {data.map((d) => (
        <div key={d.label} className="hbar">
          <div className="hbar-head">
            <span className="hbar-label">{d.label}</span>
            <span className="hbar-value">{format(d.value)}</span>
          </div>
          <div className="hbar-track"><div className="hbar-fill" style={{ width: `${Math.max(1, (d.value / max) * 100)}%` }} /></div>
          {d.detail && <div className="small muted">{d.detail}</div>}
        </div>
      ))}
    </div>
  );
}
