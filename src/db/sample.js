// Datos de ejemplo para probar la app sin cargar nada real.
// Todo lo que se crea acá queda marcado con sample: true para poder borrarlo con un botón.

import { db, SYNC_TABLES } from './db.js';
import { saveSupplier, saveProduct, savePurchase, saveRecord, getSettings } from './repo.js';
import { todayIso } from './ids.js';
import { saveSale, saleItemFromProduct } from './sales.js';
import { toLocalDateTime } from '../logic/sales.js';

export async function hasSampleData() {
  const products = await db.products.toArray();
  return products.some((p) => p.sample && !p.deleted);
}

export async function loadSampleData() {
  const editorial = await saveSupplier({
    name: 'Editorial de Ejemplo',
    legalName: 'Editorial de Ejemplo S.A.',
    cuit: '30-00000000-0',
    phone: '11 5555-0000',
    email: 'ventas@ejemplo.com',
    website: '',
    usualDiscount: 40,
    addVat: false,
    defaultMarkup: null,
    notes: 'Proveedor de prueba. Se borra con "Borrar datos de ejemplo".',
    sample: true,
  });
  const juguetes = await saveSupplier({
    name: 'Juguetería Mayorista de Ejemplo',
    legalName: '',
    cuit: '',
    phone: '',
    email: '',
    website: '',
    usualDiscount: null,
    addVat: true,
    defaultMarkup: 100,
    notes: 'Proveedor de prueba que factura sin IVA.',
    sample: true,
  });

  const books = [
    ['El bosque dormido', 'Ana Pérez', 'Álbum ilustrado', 'Colección Lunita', 18000, 40, 3],
    ['La casita de chocolate', 'Hermanos Grimm', 'Cuentos', 'Clásicos', 15500, 40, 2],
    ['Poemas para mirar la luna', 'María Gómez', 'Poesía', '', 12000, 35, 4],
    ['Mi primer atlas', 'Varios autores', 'Informativo', '', 22000, 35, 1],
    ['Cuentos para antes de dormir', 'Laura Ríos', 'Cuentos', 'Colección Lunita', 14000, 40, 0],
  ];
  const created = [];
  for (const [name, autor, genero, coleccion, pvp, desc, stock] of books) {
    created.push({
      product: await saveProduct(
        {
          name,
          categoryId: 'cat-libros',
          supplierId: editorial.id,
          code: '',
          pricingMode: 'lista',
          listPrice: pvp,
          supplierDiscount: desc,
          salePrice: pvp,
          stockMin: 2,
          trackStock: true,
          ownership: 'propio',
          extras: { autor, genero, editorial: editorial.name, coleccion },
          notes: '',
          active: true,
          sample: true,
        },
        { reason: 'Datos de ejemplo' },
      ),
      stock,
    });
  }

  const games = [
    ['Mapa de Argentina para pintar', 'Mapitas', '+4 años', 'Mapa para pintar', 6500, 5],
    ['Rompecabezas del sistema solar', 'Piezas Felices', '+6 años', 'Rompecabezas', 9000, 2],
    ['Memotest de animales', 'Piezas Felices', '+3 años', 'Juego de mesa', 5000, 1],
  ];
  for (const [name, marca, edad, tipo, cost, stock] of games) {
    created.push({
      product: await saveProduct(
        {
          name,
          categoryId: 'cat-juegos-y-mapas',
          supplierId: juguetes.id,
          code: '',
          pricingMode: 'recargo',
          baseCost: cost,
          markupPct: null,
          salePrice: 0,
          stockMin: 2,
          trackStock: true,
          ownership: 'propio',
          extras: { marca, edad_recomendada: edad, categoria_de_juego: tipo },
          notes: '',
          active: true,
          sample: true,
        },
        { reason: 'Datos de ejemplo' },
      ),
      stock,
    });
  }

  // Una compra de ejemplo por proveedor, para que el stock venga de algún lado.
  for (const supplier of [editorial, juguetes]) {
    const items = created
      .filter((c) => c.product.supplierId === supplier.id && c.stock > 0)
      .map((c) => ({ productId: c.product.id, qty: c.stock, unitCost: c.product.cost }));
    const purchase = await savePurchase({ date: todayIso(), supplierId: supplier.id, items, paid: true, source: 'ejemplo', notes: 'Compra de ejemplo' });
    await markSample('purchases', purchase.id);
  }
  // Los movimientos de stock de esas compras también son de ejemplo.
  const ids = new Set(created.map((c) => c.product.id));
  const moves = await db.stockMoves.toArray();
  for (const m of moves) if (ids.has(m.productId)) await markSample('stockMoves', m.id);
  const history = await db.priceHistory.toArray();
  for (const h of history) if (ids.has(h.productId)) await markSample('priceHistory', h.id);

  // Algunas ventas de ejemplo (hoy y ayer) para ver el inicio y el historial con datos.
  const byName = (n) => created.find((c) => c.product.name === n).product;
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  const sampleSales = [
    { date: toLocalDateTime(yesterday), items: [saleItemFromProduct(byName('El bosque dormido'), 1)], paymentMethod: 'Transferencia', channel: 'Instagram', customer: 'Sofía' },
    { date: toLocalDateTime(now), items: [saleItemFromProduct(byName('Mapa de Argentina para pintar'), 2), saleItemFromProduct(byName('Poemas para mirar la luna'), 1)], paymentMethod: 'Efectivo', channel: 'Feria', mode: 'feria' },
    { date: toLocalDateTime(now), items: [saleItemFromProduct(byName('Rompecabezas del sistema solar'), 1)], paymentMethod: 'Mercado Pago', channel: 'WhatsApp', shipping: { mode: 'envio', amount: 3500 } },
  ];
  for (const s of sampleSales) {
    const saved = await saveSale({ customer: '', note: '', shipping: { mode: '', amount: null }, discount: null, mode: 'normal', ...s });
    await markSample('sales', saved.id);
  }

  await getSettings();
}

async function markSample(table, id) {
  const r = await db[table].get(id);
  if (r && !r.sample) await saveRecord(table, { ...r, sample: true });
}

/** Borra (marca como borrado) todo lo que sea de ejemplo. No toca los datos reales. */
export async function removeSampleData() {
  let count = 0;
  for (const name of SYNC_TABLES) {
    const records = await db[name].toArray();
    for (const r of records) {
      if (r.sample && !r.deleted) {
        await saveRecord(name, { ...r, deleted: true });
        count++;
      }
    }
  }
  return count;
}
