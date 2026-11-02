import { describe, it, expect } from 'vitest';
import { computeStockMap, stockOf, isLowStock, adjustmentFor } from './stock.js';
import { mergeRecords } from './merge.js';

const move = (id, productId, qty, extra = {}) => ({ id, productId, qty, createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z', ...extra });

describe('cálculo de stock', () => {
  it('suma compras y resta ventas', () => {
    const moves = [move('1', 'mapa', 5), move('2', 'mapa', -2), move('3', 'libro', 3), move('4', 'mapa', 10)];
    const map = computeStockMap(moves);
    expect(map.get('mapa')).toBe(13);
    expect(map.get('libro')).toBe(3);
  });

  it('una venta anulada devuelve el stock', () => {
    const moves = [move('1', 'mapa', 5), move('2', 'mapa', -2), move('3', 'mapa', 2, { type: 'anulacion' })];
    expect(stockOf('mapa', moves)).toBe(5);
  });

  it('ignora movimientos borrados', () => {
    const moves = [move('1', 'mapa', 5), move('2', 'mapa', -2, { deleted: true })];
    expect(stockOf('mapa', moves)).toBe(5);
  });

  it('dos dispositivos venden por separado y al unir el stock da bien', () => {
    const base = [move('compra', 'mapa', 10)];
    const tablet = [...base, move('venta-tablet-1', 'mapa', -2), move('venta-tablet-2', 'mapa', -1)];
    const celu = [...base, move('venta-celu-1', 'mapa', -4)];
    const merged = mergeRecords(tablet, celu);
    const all = [...tablet, ...merged.records];
    expect(stockOf('mapa', all)).toBe(3);
  });

  it('ajuste: para pasar de 5 a 3 hay que restar 2', () => {
    expect(adjustmentFor(5, 3)).toBe(-2);
    expect(adjustmentFor(1, 4)).toBe(3);
  });
});

describe('stock bajo', () => {
  it('avisa cuando queda el mínimo o menos', () => {
    expect(isLowStock({ stockMin: 2 }, 2)).toBe(true);
    expect(isLowStock({ stockMin: 2 }, 3)).toBe(false);
  });
  it('sin mínimo, avisa solo cuando no hay stock', () => {
    expect(isLowStock({ stockMin: 0 }, 0)).toBe(true);
    expect(isLowStock({ stockMin: 0 }, 1)).toBe(false);
  });
  it('los productos sin control de stock nunca avisan', () => {
    expect(isLowStock({ stockMin: 5, trackStock: false }, 0)).toBe(false);
  });
});
