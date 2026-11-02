// Compras (ingreso de mercadería).
//
// Cada línea de compra:
//   { productId, name, qty, unitCost }   unitCost = costo final por unidad (con IVA si corresponde)
//   y además, para recordar cómo vino en la factura:
//   { invoiceCost }                       costo como figura en la factura (productos "costo + recargo")
//   { listPrice, supplierDiscount }       PVP y descuento (productos "precio de lista")
//
// Al guardar: suma al stock y actualiza el costo de cada producto.
// Después se ofrece revisar el precio de venta de los productos cuyo costo cambió.

import { db } from './db.js';
import { saveRecord, savePurchase, getSettings } from './repo.js';
import { computePricing } from '../logic/pricing.js';
import { cents } from '../logic/money.js';

/** Costo final de una línea según el producto y el proveedor (suma IVA si corresponde). */
export function lineCost(line, product, supplier, settings) {
  const asProduct = product.pricingMode === 'lista'
    ? { ...product, listPrice: line.listPrice, supplierDiscount: line.supplierDiscount }
    : { ...product, baseCost: line.invoiceCost };
  return computePricing({ product: asProduct, supplier, category: null, settings }).cost;
}

/**
 * Registra la compra, suma al stock y actualiza el costo de los productos.
 * Devuelve { purchase, changes } donde changes son los productos cuyo costo cambió,
 * con el precio actual y el sugerido para que la persona decida.
 */
export async function registerPurchase({ date, supplierId, lines, paid, dueDate, invoiceNumber, notes }) {
  if (!lines.length) throw new Error('La compra no tiene productos.');
  if (lines.some((l) => !(Number(l.qty) > 0))) throw new Error('Hay una línea con cantidad 0.');

  const [settings, supplier] = await Promise.all([getSettings(), supplierId ? db.suppliers.get(supplierId) : null]);
  const items = [];
  const changes = [];

  for (const line of lines) {
    const product = await db.products.get(line.productId);
    const category = product.categoryId ? await db.categories.get(product.categoryId) : null;
    const unitCost = lineCost(line, product, supplier, settings);
    items.push({ productId: product.id, name: product.name, qty: Number(line.qty), unitCost, invoiceCost: line.invoiceCost ?? null, listPrice: line.listPrice ?? null, supplierDiscount: line.supplierDiscount ?? null });

    // Actualizamos los datos de costo del producto con lo que vino en esta compra.
    const updated = product.pricingMode === 'lista'
      ? { ...product, listPrice: line.listPrice, supplierDiscount: line.supplierDiscount }
      : { ...product, baseCost: line.invoiceCost };
    if (!product.supplierId && supplierId) updated.supplierId = supplierId;
    const pricing = computePricing({ product: updated, supplier, category, settings });
    const listChanged = product.pricingMode === 'lista' && Number(line.listPrice) !== Number(product.listPrice);
    if (pricing.cost !== product.cost || listChanged) {
      await saveRecord('products', { ...updated, cost: pricing.cost });
      await saveRecord('priceHistory', {
        productId: product.id,
        date: new Date().toISOString(),
        oldCost: product.cost,
        newCost: pricing.cost,
        oldPrice: product.salePrice,
        newPrice: product.salePrice,
        reason: 'Compra: cambió el costo',
      });
      changes.push({ productId: product.id, name: product.name, oldCost: product.cost, newCost: pricing.cost, price: product.salePrice, suggested: pricing.suggested, manual: !!product.priceIsManual });
    } else if (updated.supplierId !== product.supplierId) {
      await saveRecord('products', updated);
    }
  }

  const purchase = await savePurchase({ date, supplierId, items, paid, dueDate: paid ? null : dueDate || null, invoiceNumber, notes, source: 'manual' });
  return { purchase, changes };
}

/** Aplica los nuevos precios de venta elegidos después de una compra. updates: [{ productId, newPrice }] */
export async function applyNewPrices(updates, reason = 'Compra: precio recalculado') {
  for (const { productId, newPrice } of updates) {
    const product = await db.products.get(productId);
    if (!product || product.salePrice === newPrice) continue;
    await saveRecord('products', { ...product, salePrice: cents(newPrice), priceIsManual: false });
    await saveRecord('priceHistory', {
      productId,
      date: new Date().toISOString(),
      oldCost: product.cost,
      newCost: product.cost,
      oldPrice: product.salePrice,
      newPrice: cents(newPrice),
      reason,
    });
  }
}

/** Marca una compra como pagada o pendiente. */
export async function setPurchasePaid(id, paid) {
  const p = await db.purchases.get(id);
  if (!p) return;
  await saveRecord('purchases', { ...p, paid, paidAt: paid ? new Date().toISOString() : null });
}

/**
 * Anula una compra cargada por error: se borran sus movimientos de stock.
 * El costo de los productos no se vuelve atrás (se puede corregir en la ficha).
 */
export async function voidPurchase(id) {
  const p = await db.purchases.get(id);
  if (!p) return;
  const moves = await db.stockMoves.where('refId').equals(id).toArray();
  for (const m of moves) if (!m.deleted) await saveRecord('stockMoves', { ...m, deleted: true });
  await saveRecord('purchases', { ...p, deleted: true });
}

/** Compras pendientes de pago, vencidas o que vencen en los próximos días. */
export function duePurchases(purchases, today, daysAhead = 7) {
  const limit = new Date(`${today}T12:00:00`);
  limit.setDate(limit.getDate() + daysAhead);
  const limitDay = limit.toISOString().slice(0, 10);
  return purchases
    .filter((p) => !p.deleted && !p.paid && p.dueDate && p.dueDate <= limitDay)
    .map((p) => ({ ...p, overdue: p.dueDate < today }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
