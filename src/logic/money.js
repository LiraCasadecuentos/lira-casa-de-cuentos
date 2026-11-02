// Dinero en pesos argentinos. Guardamos números comunes (con centavos) y
// redondeamos siempre a 2 decimales para evitar errores de la computadora
// del tipo 0,1 + 0,2 = 0,30000000000000004.

const formatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Redondea a centavos. */
export function cents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Formatea como "$ 12.500,00". */
export function formatMoney(value) {
  // Intl usa un espacio especial (no separable); lo dejamos porque evita que
  // el "$" quede en una línea y el número en otra.
  return formatter.format(cents(value));
}

/** Formatea un porcentaje: 35 -> "35 %", 12.5 -> "12,5 %". */
export function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  const text = n.toLocaleString('es-AR', { maximumFractionDigits: decimals });
  return `${text} %`;
}

/**
 * Convierte lo que escribe una persona (o lo que viene de un Excel) en número.
 * Acepta "12.500,50", "12500.50", "$ 7.294", "7294", 35, "35 %".
 * Devuelve null si no se puede entender.
 */
export function parseNumber(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  let s = String(input).trim();
  if (s === '') return null;
  s = s.replace(/[$%\s]/g, '').replace(/ARS/gi, '');
  if (s === '' || s === '-') return null;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // El último separador es el decimal: "12.500,50" o "12,500.50".
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    // "12,5" es decimal. "12,500" (exactamente 3 cifras) lo tomamos como miles.
    const parts = s.split(',');
    s = parts.length === 2 && parts[1].length !== 3 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (hasDot) {
    // "7.294" o "1.250.000" son miles en Argentina; "7.5" es decimal.
    const parts = s.split('.');
    const looksLikeThousands = parts.length > 2 || (parts.length === 2 && parts[1].length === 3);
    if (looksLikeThousands) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
