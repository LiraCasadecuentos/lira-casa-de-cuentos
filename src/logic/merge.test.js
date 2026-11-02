import { describe, it, expect } from 'vitest';
import { mergeRecords, mergeBackup, validateBackup } from './merge.js';

const rec = (id, updatedAt, extra = {}) => ({ id, createdAt: '2026-10-01T10:00:00.000Z', updatedAt, ...extra });

describe('unión de respaldos', () => {
  it('agrega lo que no existe', () => {
    const r = mergeRecords([rec('a', '2026-11-01T10:00:00Z')], [rec('b', '2026-11-01T11:00:00Z')]);
    expect(r.added).toBe(1);
    expect(r.records.map((x) => x.id)).toEqual(['b']);
  });

  it('si un registro cambió en los dos lados, se queda el más reciente', () => {
    const local = [rec('p', '2026-11-01T10:00:00Z', { salePrice: 100 })];
    const newer = [rec('p', '2026-11-02T10:00:00Z', { salePrice: 200 })];
    const older = [rec('p', '2026-10-30T10:00:00Z', { salePrice: 50 })];
    expect(mergeRecords(local, newer).records).toEqual(newer);
    expect(mergeRecords(local, newer).updated).toBe(1);
    expect(mergeRecords(local, older).records).toEqual([]);
    expect(mergeRecords(local, older).unchanged).toBe(1);
  });

  it('importar dos veces el mismo respaldo no duplica nada', () => {
    const local = [rec('venta-1', '2026-11-01T10:00:00Z')];
    const incoming = [rec('venta-1', '2026-11-01T10:00:00Z'), rec('venta-2', '2026-11-01T12:00:00Z')];
    const first = mergeRecords(local, incoming);
    expect(first.added).toBe(1);
    const second = mergeRecords([...local, ...first.records], incoming);
    expect(second.added).toBe(0);
    expect(second.updated).toBe(0);
  });

  it('nunca pisa ventas de otro dispositivo: ventas con id distinto conviven', () => {
    const tablet = [rec('venta-t', '2026-11-01T10:00:00Z', { total: 1000 })];
    const celu = [rec('venta-c', '2026-11-01T10:00:00Z', { total: 2000 })];
    const r = mergeRecords(tablet, celu);
    expect([...tablet, ...r.records].map((v) => v.total)).toEqual([1000, 2000]);
  });

  it('un borrado más reciente viaja en el respaldo', () => {
    const local = [rec('p', '2026-11-01T10:00:00Z')];
    const incoming = [rec('p', '2026-11-02T10:00:00Z', { deleted: true })];
    expect(mergeRecords(local, incoming).records[0].deleted).toBe(true);
  });

  it('ignora registros sin id', () => {
    expect(mergeRecords([], [{ name: 'x' }, null]).added).toBe(0);
  });

  it('une todas las tablas', () => {
    const r = mergeBackup({ products: [rec('a', '2026-11-01T10:00:00Z')] }, { products: [rec('b', '2026-11-01T10:00:00Z')], sales: [rec('v', '2026-11-01T10:00:00Z')] }, ['products', 'sales', 'expenses']);
    expect(r.products.added).toBe(1);
    expect(r.sales.added).toBe(1);
    expect(r.expenses.added).toBe(0);
  });
});

describe('validar respaldo', () => {
  it('rechaza archivos que no son de la app', () => {
    expect(validateBackup(null, 'lira')).toBeTruthy();
    expect(validateBackup({ app: 'otra', tables: {} }, 'lira')).toBeTruthy();
    expect(validateBackup({ app: 'lira' }, 'lira')).toBeTruthy();
    expect(validateBackup({ app: 'lira', tables: {} }, 'lira')).toBeNull();
  });
});
