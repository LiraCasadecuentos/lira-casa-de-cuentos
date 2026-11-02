import { describe, it, expect } from 'vitest';
import { costFromList, addVat, roundPrice, suggestedPrice, markupPct, marginPct, resolveMarkup, computePricing, unitProfit } from './pricing.js';
import { parseNumber, formatMoney, cents } from './money.js';

describe('recargo y margen', () => {
  it('costo 8.000 y venta 16.000: recargo 100 % y margen 50 %', () => {
    expect(markupPct(8000, 16000)).toBe(100);
    expect(marginPct(8000, 16000)).toBe(50);
    expect(unitProfit(8000, 16000)).toBe(8000);
  });

  it('mapas de Atlantis: costo 7.294 y venta 16.000 es más de 100 % de recargo', () => {
    expect(markupPct(7294, 16000)).toBeCloseTo(119.36, 2);
    expect(marginPct(7294, 16000)).toBeCloseTo(54.41, 2);
  });

  it('sin costo o sin precio no inventa porcentajes', () => {
    expect(markupPct(0, 1000)).toBeNull();
    expect(marginPct(1000, 0)).toBeNull();
  });
});

describe('precio de lista con descuento (editoriales)', () => {
  it('PVP 10.000 con 40 % de descuento cuesta 6.000', () => {
    expect(costFromList(10000, 40)).toBe(6000);
  });
  it('PVP 18.500 con 35 % cuesta 12.025', () => {
    expect(costFromList(18500, 35)).toBe(12025);
  });
  it('el precio sugerido es el PVP, sin redondear', () => {
    const r = computePricing({
      product: { pricingMode: 'lista', listPrice: 18550, supplierDiscount: 40 },
      supplier: null,
      category: null,
      settings: { roundingStep: 100, defaultMarkup: 100 },
    });
    expect(r.cost).toBe(11130);
    expect(r.suggested).toBe(18550);
  });
});

describe('redondeo', () => {
  it('redondea hacia arriba al múltiplo elegido', () => {
    expect(roundPrice(16030, 100)).toBe(16100);
    expect(roundPrice(16000, 100)).toBe(16000);
    expect(roundPrice(16001, 50)).toBe(16050);
    expect(roundPrice(1234.56, 0)).toBe(1234.56);
  });
  it('precio sugerido = costo + recargo, redondeado', () => {
    expect(suggestedPrice(7294, 100, 100)).toBe(14600);
    expect(suggestedPrice(8000, 100, 100)).toBe(16000);
  });
});

describe('IVA', () => {
  it('suma 21 % al costo cuando el proveedor factura sin IVA', () => {
    expect(addVat(7294, 21)).toBe(8825.74);
    const r = computePricing({
      product: { pricingMode: 'recargo', baseCost: 7294, markupPct: null },
      supplier: { name: 'Atlantis', addVat: true, defaultMarkup: 80 },
      category: null,
      settings: { vatPct: 21, roundingStep: 100, defaultMarkup: 100 },
    });
    expect(r.cost).toBe(8825.74);
    expect(r.suggested).toBe(15900); // 8825,74 * 1,8 = 15886,33 -> 15900
  });
});

describe('qué recargo se usa', () => {
  const settings = { defaultMarkup: 100 };
  it('el del producto le gana a todos', () => {
    expect(resolveMarkup({ product: { markupPct: 50 }, supplier: { defaultMarkup: 80 }, category: { defaultMarkup: 70 }, settings }).value).toBe(50);
  });
  it('después el del proveedor, después el de la categoría, después el general', () => {
    expect(resolveMarkup({ product: {}, supplier: { name: 'A', defaultMarkup: 80 }, category: { name: 'C', defaultMarkup: 70 }, settings }).value).toBe(80);
    expect(resolveMarkup({ product: {}, supplier: { name: 'A', defaultMarkup: null }, category: { name: 'C', defaultMarkup: 70 }, settings }).value).toBe(70);
    expect(resolveMarkup({ product: {}, supplier: null, category: null, settings })).toEqual({ value: 100, source: 'general' });
  });
  it('un recargo de 0 % también cuenta como elegido', () => {
    expect(resolveMarkup({ product: { markupPct: 0 }, supplier: null, category: null, settings }).value).toBe(0);
  });
});

describe('números y dinero', () => {
  it('entiende cómo escribimos los números en Argentina', () => {
    expect(parseNumber('12.500,50')).toBe(12500.5);
    expect(parseNumber('$ 7.294')).toBe(7294);
    expect(parseNumber('7294')).toBe(7294);
    expect(parseNumber('12,5')).toBe(12.5);
    expect(parseNumber('1.250.000')).toBe(1250000);
    expect(parseNumber('35 %')).toBe(35);
    expect(parseNumber(16000)).toBe(16000);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('hola')).toBeNull();
  });
  it('formatea como $ 12.500,00', () => {
    expect(formatMoney(12500).replace(/\s/g, ' ')).toBe('$ 12.500,00');
  });
  it('no arrastra errores de decimales', () => {
    expect(cents(0.1 + 0.2)).toBe(0.3);
  });
});
