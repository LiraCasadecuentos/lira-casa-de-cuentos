// El stock NO se guarda como un número suelto: se calcula sumando los
// movimientos (stock inicial, compras y ajustes) y restando las ventas.
// Así, si dos dispositivos venden por separado y después se unen los
// respaldos, el stock da bien solo.

export const MOVE_TYPES = {
  INITIAL: 'inicial',
  PURCHASE: 'compra',
  SALE: 'venta',
  VOID: 'anulacion',
  ADJUST: 'ajuste',
};

/**
 * Devuelve un Map productId -> stock actual.
 * Suma los movimientos (stock inicial, compras, ajustes) y resta lo vendido.
 * Las ventas restan directamente desde la venta guardada: si una venta se
 * edita o se anula (en este u otro dispositivo), el stock se corrige solo.
 * Ignora movimientos borrados y ventas anuladas o borradas.
 */
export function computeStockMap(moves, sales = []) {
  const map = new Map();
  for (const m of moves) {
    if (m.deleted) continue;
    map.set(m.productId, (map.get(m.productId) || 0) + (Number(m.qty) || 0));
  }
  for (const sale of sales) {
    if (!sale || sale.deleted || sale.status === 'anulada') continue;
    for (const item of sale.items || []) {
      map.set(item.productId, (map.get(item.productId) || 0) - (Number(item.qty) || 0));
    }
  }
  return map;
}

/** Stock de un solo producto. */
export function stockOf(productId, moves, sales = []) {
  return computeStockMap(moves, sales).get(productId) || 0;
}

/** ¿Está por debajo (o igual) del mínimo? Solo si el producto lleva stock y tiene mínimo. */
export function isLowStock(product, stock) {
  if (product.trackStock === false) return false;
  const min = Number(product.stockMin);
  if (!Number.isFinite(min) || min <= 0) return stock <= 0;
  return stock <= min;
}

/**
 * Para llevar el stock a un número contado a mano, ¿cuánto hay que sumar o restar?
 * adjustmentFor(5, 3) = -2
 */
export function adjustmentFor(currentStock, countedStock) {
  return Number(countedStock) - Number(currentStock);
}
