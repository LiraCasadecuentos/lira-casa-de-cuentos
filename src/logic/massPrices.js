// Actualización masiva de precios: subir (o bajar) un porcentaje a muchos productos a la vez.
//
// Dos formas:
//   'precio'     solo cambia el precio de venta.
//   'proveedor'  el proveedor aumentó: sube el costo (o el PVP) y el precio de venta en el mismo %.
//                Si un libro se vendía al PVP, sigue vendiéndose al PVP nuevo.

import { cents } from './money.js';
import { computePricing } from './pricing.js';

/** Redondea al múltiplo: hacia arriba si sube, al más cercano si baja. */
export function roundForChange(value, step, goingUp) {
  const s = Number(step) || 0;
  if (s <= 0) return cents(value);
  return cents((goingUp ? Math.ceil(value / s - 1e-9) : Math.round(value / s)) * s);
}

/**
 * Calcula cómo quedaría cada producto, sin guardar nada.
 * options: { pct, mode, round, settings, suppliersById }
 * Devuelve [{ product, oldPrice, newPrice, oldCost, newCost, changes }]
 *   changes: lo que hay que guardar en el producto.
 */
export function previewMassUpdate(products, { pct, mode = 'precio', round = true, settings, suppliersById = new Map() }) {
  const factor = 1 + (Number(pct) || 0) / 100;
  const up = factor >= 1;
  const step = round ? settings?.roundingStep : 0;
  const newPriceFrom = (price) => roundForChange(price * factor, step, up);

  return products
    .filter((p) => (p.salePrice || 0) > 0 || (mode === 'proveedor' && (p.cost || 0) > 0))
    .map((p) => {
      const oldPrice = p.salePrice || 0;
      const oldCost = p.cost || 0;
      if (mode === 'precio') {
        const newPrice = newPriceFrom(oldPrice);
        return { product: p, oldPrice, newPrice, oldCost, newCost: oldCost, changes: { salePrice: newPrice, priceIsManual: true } };
      }
      // El proveedor aumentó.
      const supplier = suppliersById.get(p.supplierId) || null;
      if (p.pricingMode === 'lista') {
        const oldList = p.listPrice || 0;
        const newList = cents(oldList * factor);
        const updated = { ...p, listPrice: newList };
        const newCost = computePricing({ product: updated, supplier, category: null, settings }).cost;
        const soldAtList = Math.abs(oldPrice - oldList) < 0.01;
        const newPrice = soldAtList ? newList : newPriceFrom(oldPrice);
        return { product: p, oldPrice, newPrice, oldCost, newCost, changes: { listPrice: newList, cost: newCost, salePrice: newPrice } };
      }
      const newBase = cents((p.baseCost ?? oldCost) * factor);
      const updated = { ...p, baseCost: newBase };
      const newCost = computePricing({ product: updated, supplier, category: null, settings }).cost;
      const newPrice = newPriceFrom(oldPrice);
      return { product: p, oldPrice, newPrice, oldCost, newCost, changes: { baseCost: newBase, cost: newCost, salePrice: newPrice } };
    });
}
