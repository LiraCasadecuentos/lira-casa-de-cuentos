import { describe, it, expect } from 'vitest';
import { findHeaderRow, guessMapping, buildImportPlan, summarizePlan, parseDiscount, splitCollection, pricingFromItem, pickBestSheet, suppliersInPlan, placePublisherOrBrand } from './importer.js';

// Parecido a una factura de Atlantis: encabezado de la empresa arriba, componentes sin precio
// y el mismo mapa en dos líneas.
const atlantis = [
  ['ATLANTIS S.R.L.', '', '', ''],
  ['Factura B 0001-00001234', '', '', ''],
  ['', '', '', ''],
  ['Código', 'Descripción', 'Cantidad', 'Precio Unitario'],
  ['200011', 'Mapa Dinosaurios de Argentina', 4, 7294],
  ['', 'Lámina', 4, ''],
  ['', 'Caja', 4, ''],
  ['200015', 'Mapa Planisferio', 6, '7.294,00'],
  ['200011', 'Mapa Dinosaurios de Argentina', 2, 7294],
  ['', 'Total', '', 80234],
];

// Parecido a una factura de Calibroscopio: ISBN, título con colección, PVP y descuento.
const calibroscopio = [
  ['Código', 'Título', 'Cant.', 'PVP', 'Dto.', 'P. Unit.'],
  ['9871234567', 'El bosque dormido (Colección Lunita)', 2, 18000, 0.4, 10800],
  ['9879876543', 'Poemas para mirar la luna', 1, '12.000', '35%', '7.800'],
  ['', '', '', '', '', ''],
];

describe('encuentra la fila de títulos', () => {
  it('saltea el encabezado de la factura', () => {
    expect(findHeaderRow(atlantis)).toBe(3);
    expect(findHeaderRow(calibroscopio)).toBe(0);
  });
});

describe('adivina las columnas', () => {
  it('factura de Atlantis', () => {
    expect(guessMapping(atlantis[3])).toEqual(['code', 'name', 'qty', 'unitCost']);
  });
  it('factura de Calibroscopio', () => {
    expect(guessMapping(calibroscopio[0])).toEqual(['code', 'name', 'qty', 'listPrice', 'discount', 'unitCost']);
  });
  it('no asigna dos columnas al mismo campo', () => {
    const m = guessMapping(['Precio', 'Precio unitario', 'Nombre']);
    expect(m.filter((k) => k === 'unitCost').length).toBe(1);
  });
});

describe('vista previa de Atlantis', () => {
  const plan = buildImportPlan({ rows: atlantis, headerRow: 3, mapping: guessMapping(atlantis[3]), options: { defaultSupplier: 'Atlantis' } });
  const included = plan.items.filter((i) => i.include);

  it('suma las dos líneas del mismo código en un producto', () => {
    const dino = included.find((i) => i.code === '200011');
    expect(dino.qty).toBe(6);
    expect(dino.sourceRows).toEqual([5, 9]);
  });

  it('los componentes sin precio no se cargan', () => {
    const comps = plan.items.filter((i) => i.looksLikeComponent);
    expect(comps.map((c) => c.name)).toEqual(['Lámina', 'Caja']);
    expect(comps.every((c) => !c.include)).toBe(true);
  });

  it('saltea la fila de total', () => {
    expect(plan.skipped.length).toBe(1);
  });

  it('el resumen cuenta productos y unidades', () => {
    expect(summarizePlan(plan.items)).toMatchObject({ products: 2, units: 12, newProducts: 2 });
  });

  it('usa costo + recargo', () => {
    const p = pricingFromItem(included.find((i) => i.code === '200015'));
    expect(p).toMatchObject({ pricingMode: 'recargo', baseCost: 7294 });
  });

  it('reconoce productos que ya existen por el código', () => {
    const again = buildImportPlan({
      rows: atlantis,
      headerRow: 3,
      mapping: guessMapping(atlantis[3]),
      existing: [{ id: 'x', name: 'Dinos', code: '200011' }],
    });
    expect(again.items.find((i) => i.code === '200011').matchId).toBe('x');
  });
});

describe('vista previa de Calibroscopio', () => {
  const plan = buildImportPlan({ rows: calibroscopio, headerRow: 0, mapping: guessMapping(calibroscopio[0]), options: { splitCollection: true } });

  it('separa la colección del título', () => {
    expect(plan.items[0].name).toBe('El bosque dormido');
    expect(plan.items[0].extras.coleccion).toBe('Colección Lunita');
  });

  it('usa precio de lista con descuento', () => {
    expect(pricingFromItem(plan.items[0])).toMatchObject({ pricingMode: 'lista', listPrice: 18000, supplierDiscount: 40 });
    expect(pricingFromItem(plan.items[1])).toMatchObject({ listPrice: 12000, supplierDiscount: 35 });
  });

  it('si falta el descuento lo deduce del costo', () => {
    expect(pricingFromItem({ listPrice: 10000, discount: null, unitCost: 6500 }).supplierDiscount).toBe(35);
  });
});

describe('errores', () => {
  it('marca cantidades que no son números y líneas sin nombre', () => {
    const rows = [['Nombre', 'Cantidad', 'Costo'], ['Libro', 'dos', 100], ['', 3, 100]];
    const plan = buildImportPlan({ rows, headerRow: 0, mapping: guessMapping(rows[0]) });
    expect(plan.items[0].errors[0]).toMatch(/no es un número/);
    expect(plan.items[1].errors).toContain('Falta el nombre');
    expect(summarizePlan(plan.items)).toMatchObject({ products: 0, withErrors: 2 });
  });
});

describe('planilla con varias hojas', () => {
  const leeme = { name: 'Leeme', rows: [['Lira: stock inicial'], ['Esta planilla sale de las facturas.'], ['Total: 88']] };
  const productos = {
    name: 'Productos',
    rows: [
      ['Código proveedor / ISBN', 'Producto (según factura)', 'Categoría', 'Proveedor', 'Editorial o marca', 'Stock inicial', 'PVP editorial', 'Descuento del proveedor', 'Costo unitario', 'Precio de venta', 'Recargo sobre el costo', 'Margen sobre el precio de venta', 'Stock mínimo', 'Para revisar'],
      ['200017', 'MAPA DINOSAURIOS DE ARGENTINA', 'Juegos y mapas', 'Atlantis', 'Atlantis', 5, '', '', 7294.2, 16000, 1.19, 0.54, '', ''],
      ['200019', 'MAPA GLOBO TERRAQUEO', 'Juegos y mapas', 'Atlantis', 'Atlantis', 1, '', '', 9290, '', '', '', '', ''],
      ['9873967726', 'PATO, LA MUERTE Y EL TULIPAN, EL (COEDICIO', 'Libros', 'Calibroscopio', 'Calibroscopio', 2, 19000, 0.4, 11400, 19000, 0.67, 0.4, '', 'Título cortado'],
      ['', '', '', '', '', 'Total unidades', 8, '', '', '', '', '', '', ''],
      ['', '', '', '', '', 'Valor del stock a costo', 789200, '', '', '', '', '', '', ''],
    ],
  };
  const compras = { name: 'Compras', rows: [['Factura', 'Fecha', 'Proveedor', 'Código', 'Descripción', 'Cantidad', 'Importe']] };

  it('elige la hoja de productos y no la de instrucciones', () => {
    expect(pickBestSheet([leeme, productos, compras])).toBe(1);
  });

  it('asigna bien las columnas, sin confundir recargo y margen con costo y precio', () => {
    const m = guessMapping(productos.rows[0]);
    expect(m).toEqual(['code', 'name', 'category', 'supplier', 'publisherOrBrand', 'qty', 'listPrice', 'discount', 'unitCost', 'salePrice', 'ignore', 'ignore', 'stockMin', 'notes']);
  });

  it('saltea los totales y respeta el precio de venta del Excel', () => {
    const plan = buildImportPlan({ rows: productos.rows, headerRow: 0, mapping: guessMapping(productos.rows[0]) });
    expect(plan.skipped.length).toBe(2);
    expect(plan.items.map((i) => i.salePrice)).toEqual([16000, null, 19000]);
    expect(plan.items[2].notes).toBe('Título cortado');
    expect(suppliersInPlan(plan.items)).toEqual(['Atlantis', 'Calibroscopio']);
  });

  it('"Editorial o marca" va a editorial en libros y a marca en juegos', () => {
    expect(placePublisherOrBrand({}, 'Calibroscopio', [{ key: 'autor' }, { key: 'editorial' }])).toEqual({ editorial: 'Calibroscopio' });
    expect(placePublisherOrBrand({}, 'Atlantis', [{ key: 'marca' }])).toEqual({ marca: 'Atlantis' });
  });
});

describe('ayudas', () => {
  it('descuento como 0,35 o 35 %', () => {
    expect(parseDiscount(0.35)).toBe(35);
    expect(parseDiscount('40 %')).toBe(40);
    expect(parseDiscount('')).toBeNull();
  });
  it('título sin paréntesis queda igual', () => {
    expect(splitCollection('Mi primer atlas')).toEqual({ name: 'Mi primer atlas', collection: '' });
  });
});
