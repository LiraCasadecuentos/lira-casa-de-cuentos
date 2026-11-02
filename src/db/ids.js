// Identificadores únicos y fechas.

import { slugify } from '../logic/text.js';

/** UUID v4. Usa crypto.randomUUID si está, y si no (por ejemplo abriendo por la red local sin https) lo arma a mano. */
export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Id para categorías y proveedores, armado a partir del nombre ("prov-atlantis").
 * Así, si dos dispositivos crean "Atlantis" por separado, al unir los
 * respaldos queda un solo proveedor y no dos.
 */
export function nameId(prefix, name) {
  return `${prefix}-${slugify(name)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

/** Fecha de hoy como "2026-11-02" (hora local). */
export function todayIso() {
  return toDateInput(new Date());
}

/** Date -> "2026-11-02" en hora local (para inputs type=date). */
export function toDateInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-11-02" -> "02/11/2026" */
export function formatDate(iso) {
  if (!iso) return '';
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
