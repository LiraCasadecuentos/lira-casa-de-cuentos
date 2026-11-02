// Guarda en la base lo que se revisó en el asistente de importación.

import { db } from './db.js';
import { findOrCreateByName, saveProduct, savePurchase, addStockMove, emptyProduct, getSettings } from './repo.js';
import { pricingFromItem, placePublisherOrBrand } from '../logic/importer.js';
import { normalize } from '../logic/text.js';
import { MOVE_TYPES } from '../logic/stock.js';
import { computePricing } from '../logic/pricing.js';

/**
 * @param items    líneas de la vista previa (solo se usan las marcadas "include" y sin errores)
 * @param options  { registerPurchase, purchaseDate, suppliers }
 *   suppliers: opciones por proveedor (clave: nombre normalizado) → { addVat, date, invoiceNumber }
 * @returns resumen { created, updated, units, purchases }
 */
export async function commitImport(items, options) {
  const toImport = items.filter((i) => i.include && i.errors.length === 0);
  const settings = await getSettings();
  const result = { created: 0, updated: 0, units: 0, purchases: 0, newCategories: [], newSuppliers: [] };
  const purchaseItemsBySupplier = new Map();
  const supplierOptions = (name) => options.suppliers?.[normalize(name)] || {};

  for (const item of toImport) {
    const knownCats = new Set((await db.categories.toArray()).map((c) => c.id));
    const knownSups = new Set((await db.suppliers.toArray()).filter((s) => !s.deleted).map((s) => s.id));
    const category = item.category ? await findOrCreateByName('categories', item.category) : null;
    const supplier = item.supplier ? await findOrCreateByName('suppliers', item.supplier, { addVat: !!supplierOptions(item.supplier).addVat }) : null;
    if (category && !knownCats.has(category.id)) result.newCategories.push(category.name);
    if (supplier && !knownSups.has(supplier.id)) result.newSuppliers.push(supplier.name);

    const pricing = pricingFromItem(item);
    let product;
    if (item.matchId) {
      // Ya existía: actualizamos costo (y PVP si vino) sin tocar el resto.
      const existing = await db.products.get(item.matchId);
      const updatedData = { ...existing, ...pricing, supplierId: existing.supplierId || supplier?.id || '' };
      const newCost = computePricing({ product: updatedData, supplier, category, settings }).cost;
      const costChanged = newCost !== existing.cost;
      // Se mantiene el precio de venta actual; la ficha del producto muestra el nuevo sugerido.
      product = await saveProduct(
        { ...updatedData, salePrice: existing.salePrice },
        { reason: costChanged ? 'Importación: cambió el costo' : 'Importación' },
      );
      result.updated++;
    } else {
      const extras = placePublisherOrBrand({ ...item.extras }, item.publisherOrBrand, category?.fields);
      // Si es un libro y el código tiene forma de ISBN, lo guardamos también como ISBN.
      if (category?.id === 'cat-libros' && item.code && /^(\d{9}[\dXx]|\d{13})$/.test(item.code) && !extras.isbn) {
        extras.isbn = item.code;
      }
      product = await saveProduct(
        {
          ...emptyProduct(),
          ...pricing,
          name: item.name,
          code: item.code,
          categoryId: category?.id || '',
          supplierId: supplier?.id || '',
          salePrice: item.salePrice || 0,
          priceIsManual: !!item.salePrice,
          stockMin: item.stockMin ?? 1,
          extras,
          notes: item.notes || '',
        },
        { reason: 'Importación desde Excel' },
      );
      result.created++;
    }

    const qty = Number(item.qty) || 0;
    result.units += qty;
    if (qty > 0) {
      if (options.registerPurchase && supplier) {
        const list = purchaseItemsBySupplier.get(supplier.id) || [];
        list.push({ productId: product.id, qty, unitCost: product.cost });
        purchaseItemsBySupplier.set(supplier.id, list);
      } else {
        await addStockMove({ productId: product.id, qty, type: MOVE_TYPES.INITIAL, note: 'Importación desde Excel', date: options.purchaseDate });
      }
    }
  }

  // Una compra por proveedor (normalmente el archivo es una sola factura).
  for (const [supplierId, purchaseItems] of purchaseItemsBySupplier) {
    const supplier = await db.suppliers.get(supplierId);
    const opts = supplierOptions(supplier?.name || '');
    await savePurchase({
      date: opts.date || options.purchaseDate,
      supplierId,
      items: purchaseItems,
      paid: true,
      invoiceNumber: opts.invoiceNumber || '',
      notes: 'Cargada desde Excel',
      source: 'importacion',
    });
    result.purchases++;
  }
  return result;
}
