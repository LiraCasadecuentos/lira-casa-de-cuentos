// Cálculos de una venta: subtotal, descuento, envío, total y ganancia.
//
// El envío se muestra aparte: se cobra, pero NO es ganancia de los productos.
// La venta guarda el costo y el precio de cada producto al momento de vender,
// así los cambios de precio posteriores no alteran los informes.

import { cents } from './money.js';

export const SALE_STATUS = { OK: 'confirmada', VOID: 'anulada' };

/** ¿La venta cuenta (para stock, caja e informes)? */
export function isActiveSale(sale) {
  return !!sale && !sale.deleted && sale.status !== SALE_STATUS.VOID;
}

/**
 * Descuento de la venta en pesos.
 * discount: { type: 'monto' | 'porcentaje', value }  (o null)
 * Nunca puede ser más que el subtotal.
 */
export function discountAmount(subtotal, discount) {
  if (!discount || !Number(discount.value)) return 0;
  const v = Math.max(0, Number(discount.value));
  const amount = discount.type === 'porcentaje' ? (subtotal * Math.min(v, 100)) / 100 : v;
  return cents(Math.min(amount, subtotal));
}

/**
 * Reglas de descuento automáticas (por ejemplo "llevando más de 3, 10 %").
 * Por ahora no hay reglas: se deja el lugar preparado para sumarlas más adelante.
 * Devuelve un descuento sugerido o null.
 */
// eslint-disable-next-line no-unused-vars
export function suggestedDiscount(items, rules = []) {
  return null;
}

/**
 * Totales de una venta.
 * items: [{ qty, unitPrice, unitCost }]
 * shipping: { mode: 'retiro' | 'envio' | '', amount }
 */
export function computeSaleTotals({ items, discount = null, shipping = null }) {
  const subtotal = cents(items.reduce((s, i) => s + Number(i.qty) * Number(i.unitPrice || 0), 0));
  const costTotal = cents(items.reduce((s, i) => s + Number(i.qty) * Number(i.unitCost || 0), 0));
  const discountValue = discountAmount(subtotal, discount);
  const shippingAmount = shipping?.mode === 'envio' ? cents(Math.max(0, Number(shipping.amount) || 0)) : 0;
  const productsTotal = cents(subtotal - discountValue);
  return {
    subtotal,
    discount: discountValue,
    productsTotal, // lo que se cobra por los productos
    shipping: shippingAmount, // aparte: no es ganancia
    total: cents(productsTotal + shippingAmount), // lo que paga el cliente
    costTotal,
    profit: cents(productsTotal - costTotal), // ganancia bruta de la venta
    units: items.reduce((s, i) => s + Number(i.qty), 0),
  };
}

/** Unidades vendidas por producto (solo ventas que cuentan). Map productId -> unidades. */
export function soldUnitsMap(sales) {
  const map = new Map();
  for (const sale of sales) {
    if (!isActiveSale(sale)) continue;
    for (const item of sale.items || []) {
      map.set(item.productId, (map.get(item.productId) || 0) + Number(item.qty));
    }
  }
  return map;
}

/**
 * Productos que se piden por encima del stock disponible (para avisar, sin bloquear).
 * stockMap ya descuenta las ventas guardadas. Si se está editando una venta,
 * se pasan sus unidades originales para no contarlas dos veces.
 */
export function stockShortages(items, stockMap, originalItems = []) {
  const original = new Map();
  for (const i of originalItems) original.set(i.productId, (original.get(i.productId) || 0) + Number(i.qty));
  const wanted = new Map();
  for (const i of items) {
    if (i.trackStock === false) continue;
    wanted.set(i.productId, (wanted.get(i.productId) || 0) + Number(i.qty));
  }
  const out = [];
  for (const [productId, qty] of wanted) {
    const available = (stockMap.get(productId) || 0) + (original.get(productId) || 0);
    if (qty > available) out.push({ productId, wanted: qty, available });
  }
  return out;
}

/** "2026-11-02T15:30" para inputs datetime-local, en hora local. */
export function toLocalDateTime(date = new Date()) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Día ("2026-11-02") de una fecha guardada como "2026-11-02T15:30". */
export function dayOf(dateTime) {
  return String(dateTime || '').slice(0, 10);
}

/** Lunes de la semana de un día dado, como "2026-11-02". */
export function weekStart(day) {
  const d = new Date(`${day}T12:00:00`);
  const diff = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - diff);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Resumen de ventas de un período: cantidad, total cobrado, envíos y ganancia. */
export function summarizeSales(sales, fromDay, toDay) {
  let count = 0;
  let total = 0;
  let productsTotal = 0;
  let shipping = 0;
  let profit = 0;
  for (const s of sales) {
    if (!isActiveSale(s)) continue;
    const day = dayOf(s.date);
    if (day < fromDay || day > toDay) continue;
    count++;
    total += s.totals.total;
    productsTotal += s.totals.productsTotal;
    shipping += s.totals.shipping;
    profit += s.totals.profit;
  }
  return { count, total: cents(total), productsTotal: cents(productsTotal), shipping: cents(shipping), profit: cents(profit) };
}
