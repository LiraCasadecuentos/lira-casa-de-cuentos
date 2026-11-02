// Cálculos de los informes. Todo es "puro": recibe listas y devuelve números,
// así se puede probar fácil y la pantalla solo se ocupa de mostrar.

import { cents } from './money.js';
import { isActiveSale, dayOf, weekStart } from './sales.js';
import { isLowStock } from './stock.js';

// ---------- Fechas ----------

const pad = (n) => String(n).padStart(2, '0');
const toDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (day) => new Date(`${day}T12:00:00`);

export function addDays(day, n) {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return toDay(d);
}

export function daysBetween(from, to) {
  return Math.round((parseDay(to) - parseDay(from)) / 86400000);
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fmt = (day) => day.split('-').reverse().join('/');

/**
 * Rango de fechas de un período.
 * mode: 'dia' | 'semana' | 'mes' | 'rango'.  ref: un día dentro del período.
 * Devuelve { from, to, label }.
 */
export function periodRange(mode, ref, customFrom, customTo) {
  if (mode === 'dia') return { from: ref, to: ref, label: fmt(ref) };
  if (mode === 'semana') {
    const from = weekStart(ref);
    const to = addDays(from, 6);
    return { from, to, label: `Semana del ${fmt(from)} al ${fmt(to)}` };
  }
  if (mode === 'mes') {
    const [y, m] = ref.split('-').map(Number);
    const from = `${y}-${pad(m)}-01`;
    const to = toDay(new Date(y, m, 0, 12));
    return { from, to, label: `${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${y}` };
  }
  const from = customFrom || ref;
  const to = customTo && customTo >= from ? customTo : from;
  return { from, to, label: `Del ${fmt(from)} al ${fmt(to)}` };
}

/** Mueve el día de referencia un período hacia atrás (-1) o adelante (+1). */
export function shiftPeriod(mode, ref, delta) {
  if (mode === 'semana') return addDays(ref, 7 * delta);
  if (mode === 'mes') {
    const [y, m] = ref.split('-').map(Number);
    return toDay(new Date(y, m - 1 + delta, 1, 12));
  }
  return addDays(ref, delta);
}

// ---------- Ventas ----------

export function salesInRange(sales, from, to) {
  return sales.filter((s) => isActiveSale(s) && dayOf(s.date) >= from && dayOf(s.date) <= to);
}

/**
 * Ventas agrupadas por día (o por mes si el rango es largo), incluyendo los días sin ventas.
 * Devuelve [{ key, label, count, total, profit }].
 */
export function salesOverTime(sales, from, to) {
  const byMonth = daysBetween(from, to) > 62;
  const buckets = new Map();
  if (byMonth) {
    let d = `${from.slice(0, 7)}-01`;
    while (d.slice(0, 7) <= to.slice(0, 7)) {
      const [y, m] = d.split('-').map(Number);
      buckets.set(d.slice(0, 7), { key: d.slice(0, 7), label: `${MONTHS[m - 1].slice(0, 3)} ${String(y).slice(2)}`, count: 0, total: 0, profit: 0 });
      d = toDay(new Date(y, m, 1, 12));
    }
  } else {
    for (let d = from; d <= to; d = addDays(d, 1)) buckets.set(d, { key: d, label: `${d.slice(8)}/${d.slice(5, 7)}`, count: 0, total: 0, profit: 0 });
  }
  for (const s of salesInRange(sales, from, to)) {
    const b = buckets.get(byMonth ? dayOf(s.date).slice(0, 7) : dayOf(s.date));
    if (!b) continue;
    b.count++;
    b.total = cents(b.total + s.totals.total);
    b.profit = cents(b.profit + s.totals.profit);
  }
  return { byMonth, rows: [...buckets.values()] };
}

/** Agrupa ventas por un campo (canal o forma de pago). Devuelve filas ordenadas por total. */
export function salesGroupedBy(sales, from, to, field, emptyLabel = 'Sin dato') {
  const map = new Map();
  for (const s of salesInRange(sales, from, to)) {
    const key = s[field] || emptyLabel;
    const row = map.get(key) || { key, count: 0, total: 0, productsTotal: 0, profit: 0 };
    row.count++;
    row.total = cents(row.total + s.totals.total);
    row.productsTotal = cents(row.productsTotal + s.totals.productsTotal);
    row.profit = cents(row.profit + s.totals.profit);
    map.set(key, row);
  }
  const rows = [...map.values()].sort((a, b) => b.total - a.total);
  const grand = rows.reduce((s, r) => s + r.total, 0);
  return rows.map((r) => ({ ...r, share: grand ? (r.total / grand) * 100 : 0, average: r.count ? cents(r.total / r.count) : 0 }));
}

/**
 * Lo más vendido. El descuento de cada venta se reparte entre sus productos
 * en proporción a lo que pesa cada uno, así la ganancia por producto es real.
 * Devuelve [{ productId, name, qty, revenue, cost, profit }].
 */
export function productRanking(sales, from, to) {
  const map = new Map();
  for (const s of salesInRange(sales, from, to)) {
    const factor = s.totals.subtotal ? s.totals.productsTotal / s.totals.subtotal : 1;
    for (const i of s.items) {
      const row = map.get(i.productId) || { productId: i.productId, name: i.name, qty: 0, revenue: 0, cost: 0, profit: 0 };
      const revenue = i.qty * i.unitPrice * factor;
      const cost = i.qty * i.unitCost;
      row.qty += i.qty;
      row.revenue = cents(row.revenue + revenue);
      row.cost = cents(row.cost + cost);
      row.profit = cents(row.revenue - row.cost);
      map.set(i.productId, row);
    }
  }
  return [...map.values()];
}

/** Fecha de la última venta (día) de cada producto. */
export function lastSaleDay(sales) {
  const map = new Map();
  for (const s of sales) {
    if (!isActiveSale(s)) continue;
    const day = dayOf(s.date);
    for (const i of s.items) if (!map.has(i.productId) || map.get(i.productId) < day) map.set(i.productId, day);
  }
  return map;
}

/**
 * Lo que no se vende: productos con stock que no tuvieron ventas en los últimos `days` días.
 * Devuelve [{ product, stock, lastSale, costValue, saleValue }], primero los de más plata parada.
 */
export function unsoldProducts(products, sales, stockMap, days, today) {
  const since = addDays(today, -days + 1);
  const last = lastSaleDay(sales);
  return products
    .filter((p) => p.active !== false && p.trackStock !== false)
    .map((p) => ({ product: p, stock: stockMap.get(p.id) || 0, lastSale: last.get(p.id) || null }))
    .filter((r) => r.stock > 0 && (!r.lastSale || r.lastSale < since))
    .map((r) => ({ ...r, costValue: cents(r.stock * (r.product.cost || 0)), saleValue: cents(r.stock * (r.product.salePrice || 0)) }))
    .sort((a, b) => b.costValue - a.costValue);
}

// ---------- Ganancias ----------

/**
 * Ganancia bruta = lo cobrado por productos − costo de esos productos.
 * Ganancia neta = ganancia bruta − gastos registrados.
 * El envío se informa aparte y no entra en ninguna de las dos.
 */
export function profitReport(sales, expenses, from, to) {
  const inRange = salesInRange(sales, from, to);
  const sold = cents(inRange.reduce((s, x) => s + x.totals.productsTotal, 0));
  const cost = cents(inRange.reduce((s, x) => s + x.totals.costTotal, 0));
  const shipping = cents(inRange.reduce((s, x) => s + x.totals.shipping, 0));
  const discounts = cents(inRange.reduce((s, x) => s + x.totals.discount, 0));
  const exp = expenses.filter((e) => !e.deleted && e.date >= from && e.date <= to);
  const byCategory = new Map();
  for (const e of exp) byCategory.set(e.category || 'Otros', cents((byCategory.get(e.category || 'Otros') || 0) + Number(e.amount)));
  const expensesTotal = cents(exp.reduce((s, e) => s + Number(e.amount), 0));
  const gross = cents(sold - cost);
  return {
    count: inRange.length,
    sold,
    cost,
    gross,
    expenses: expensesTotal,
    expensesByCategory: [...byCategory.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    net: cents(gross - expensesTotal),
    shipping,
    discounts,
  };
}

// ---------- Stock ----------

/** Stock disponible con su valor a costo y a precio de venta. */
export function stockReport(products, stockMap) {
  const rows = products
    .filter((p) => p.active !== false && p.trackStock !== false)
    .map((p) => {
      const stock = stockMap.get(p.id) || 0;
      return { product: p, stock, costValue: cents(Math.max(0, stock) * (p.cost || 0)), saleValue: cents(Math.max(0, stock) * (p.salePrice || 0)) };
    });
  return {
    rows,
    units: rows.reduce((s, r) => s + Math.max(0, r.stock), 0),
    costValue: cents(rows.reduce((s, r) => s + r.costValue, 0)),
    saleValue: cents(rows.reduce((s, r) => s + r.saleValue, 0)),
  };
}

/**
 * Lista para reponer, agrupada por proveedor.
 * Sugerido = lo que falta para tener el doble del mínimo (al menos 1).
 */
export function restockList(products, stockMap, suppliersById) {
  const groups = new Map();
  for (const p of products) {
    if (p.active === false) continue;
    const stock = stockMap.get(p.id) || 0;
    if (!isLowStock(p, stock)) continue;
    const min = Number(p.stockMin) || 0;
    const suggested = Math.max(1, min * 2 - Math.max(0, stock));
    const supplierName = suppliersById.get(p.supplierId)?.name || 'Sin proveedor';
    const g = groups.get(supplierName) || { supplier: supplierName, rows: [] };
    g.rows.push({ product: p, stock, min, suggested });
    groups.set(supplierName, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, rows: g.rows.sort((a, b) => a.product.name.localeCompare(b.product.name, 'es')) }))
    .sort((a, b) => a.supplier.localeCompare(b.supplier, 'es'));
}
