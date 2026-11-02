// Cálculo de precios y ganancias.
//
// Dos palabras que es fácil confundir:
//   RECARGO (sobre el costo): cuánto le sumamos al costo.
//       costo 8.000 -> venta 16.000 = recargo 100 %
//   MARGEN (sobre el precio de venta): qué parte de lo que cobramos es ganancia.
//       costo 8.000 -> venta 16.000 = margen 50 %

import { cents } from './money.js';

export const PRICING_MODES = {
  MARKUP: 'recargo', // costo + recargo %
  LIST: 'lista', // precio de lista del proveedor (PVP) con descuento
};

/** Costo a partir del PVP y el descuento del proveedor. PVP 10.000 con 40 % = 6.000. */
export function costFromList(listPrice, discountPct) {
  const pvp = Number(listPrice) || 0;
  const d = Number(discountPct) || 0;
  return cents(pvp * (1 - d / 100));
}

/** Suma el IVA al costo cuando el proveedor factura sin IVA. */
export function addVat(cost, vatPct) {
  return cents((Number(cost) || 0) * (1 + (Number(vatPct) || 0) / 100));
}

/**
 * Redondea un precio hacia arriba al múltiplo indicado.
 * roundPrice(16030, 100) = 16100. Con step 0 o vacío no redondea.
 */
export function roundPrice(price, step) {
  const p = Number(price) || 0;
  const s = Number(step) || 0;
  if (s <= 0) return cents(p);
  // Restamos un poquito para que 16000,0000001 no salte a 16100.
  return cents(Math.ceil(p / s - 1e-9) * s);
}

/** Precio sugerido = costo + recargo, redondeado. */
export function suggestedPrice(cost, markupPct, step) {
  const c = Number(cost) || 0;
  const m = Number(markupPct) || 0;
  return roundPrice(c * (1 + m / 100), step);
}

/** Recargo sobre el costo, en %. Devuelve null si no hay costo. */
export function markupPct(cost, price) {
  const c = Number(cost);
  const p = Number(price);
  if (!c || c <= 0 || !Number.isFinite(p)) return null;
  return ((p - c) / c) * 100;
}

/** Margen sobre el precio de venta, en %. Devuelve null si no hay precio. */
export function marginPct(cost, price) {
  const c = Number(cost);
  const p = Number(price);
  if (!p || p <= 0 || !Number.isFinite(c)) return null;
  return ((p - c) / p) * 100;
}

/** Ganancia por unidad, en pesos. */
export function unitProfit(cost, price) {
  return cents((Number(price) || 0) - (Number(cost) || 0));
}

/**
 * ¿Qué recargo usamos para un producto? El más específico gana:
 * 1) el del producto, 2) el del proveedor, 3) el de la categoría, 4) el general.
 * Devuelve { value, source } para poder mostrar de dónde sale.
 */
export function resolveMarkup({ product, supplier, category, settings }) {
  const isSet = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
  if (product && isSet(product.markupPct)) return { value: Number(product.markupPct), source: 'producto' };
  if (supplier && isSet(supplier.defaultMarkup)) return { value: Number(supplier.defaultMarkup), source: `proveedor ${supplier.name}` };
  if (category && isSet(category.defaultMarkup)) return { value: Number(category.defaultMarkup), source: `categoría ${category.name}` };
  return { value: Number(settings?.defaultMarkup ?? 100), source: 'general' };
}

/**
 * Calcula costo y precio sugerido de un producto según su forma de precio.
 * - Recargo: el costo es el que se carga (más IVA si corresponde).
 * - Lista: el costo es PVP menos descuento (más IVA si corresponde) y el
 *   precio sugerido es el PVP (sin redondear: se vende al precio de tapa).
 */
export function computePricing({ product, supplier, category, settings }) {
  const vatPct = supplier?.addVat ? Number(settings?.vatPct ?? 21) : 0;
  const step = Number(settings?.roundingStep ?? 0);

  if (product.pricingMode === PRICING_MODES.LIST) {
    const base = costFromList(product.listPrice, product.supplierDiscount);
    const cost = vatPct ? addVat(base, vatPct) : base;
    return { cost, suggested: cents(product.listPrice || 0), markup: null };
  }

  const base = cents(product.baseCost ?? product.cost ?? 0);
  const cost = vatPct ? addVat(base, vatPct) : base;
  const markup = resolveMarkup({ product, supplier, category, settings });
  return { cost, suggested: suggestedPrice(cost, markup.value, step), markup };
}
