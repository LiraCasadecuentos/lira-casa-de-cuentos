// Asistente de importación de productos desde Excel o CSV.
// Pasos: 1) elegir archivo  2) decir qué es cada columna  3) opciones  4) revisar y confirmar.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Download, Check, RotateCcw } from 'lucide-react';
import { readSpreadsheet, downloadSpreadsheet } from '../ui/excel.js';
import { useProducts, useSuppliers, useCategories, useSettings } from '../ui/useData.js';
import { Field, TextInput, Checkbox, Notice } from '../ui/components.jsx';
import { useToast, useConfirm } from '../ui/feedback.jsx';
import { IMPORT_FIELDS, TEMPLATE_HEADERS, findHeaderRow, guessMapping, pickBestSheet, buildImportPlan, summarizePlan, suppliersInPlan, pricingFromItem } from '../logic/importer.js';
import { normalize } from '../logic/text.js';
import { commitImport } from '../db/importCommit.js';
import { todayIso } from '../db/ids.js';
import { formatMoney, formatPercent } from '../logic/money.js';

async function downloadTemplate() {
  await downloadSpreadsheet('plantilla-productos-lira.xlsx', [
    {
      name: 'Productos',
      rows: [
        TEMPLATE_HEADERS,
        ['El bosque dormido (Colección Lunita)', 'Libros', 'Editorial de Ejemplo', '9871234567', 2, '', 18000, 40, '', 1, 'Ana Pérez', 'Editorial de Ejemplo', 'Álbum ilustrado', '', '', '', '', ''],
        ['Mapa de Argentina para pintar', 'Juegos y mapas', 'Atlantis', '200011', 5, 7294, '', '', '', 2, '', '', '', '', 'Atlantis', '+4 años', 'Mapa para pintar', ''],
      ],
      widths: [38, 16, 22, 14, 10, 14, 12, 11, 15, 13, 20, 20, 16, 18, 14, 16, 20, 20],
    },
    {
      name: 'Cómo completarla',
      rows: [
        ['Cómo completar la plantilla'],
        ['Una fila por producto. Solo el Nombre es obligatorio.'],
        ['Cantidad: cuántas unidades hay (se suma al stock).'],
        ['Libros de editorial: completá PVP y Descuento (ej. 40). El costo se calcula solo.'],
        ['Otros productos: completá Costo unitario. El precio de venta se sugiere con el recargo.'],
        ['Si ponés un Precio de venta, se usa ese en lugar del sugerido.'],
        ['Podés borrar las filas de ejemplo y las columnas que no uses.'],
      ],
      widths: [90],
    },
  ]);
}

export default function ImportPage() {
  const products = useProducts();
  const suppliers = useSuppliers();
  const categories = useCategories();
  const settings = useSettings();
  const toast = useToast();
  const confirm = useConfirm();

  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState([]);
  // suppliers: opciones de cada proveedor del archivo (IVA, fecha y número de factura), por nombre normalizado.
  const [options, setOptions] = useState({ defaultSupplier: '', defaultCategory: '', splitCollection: false, registerPurchase: true, purchaseDate: todayIso(), suppliers: {} });
  const [includeOverrides, setIncludeOverrides] = useState({});
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const rows = sheets?.[sheetIndex]?.rows || [];
  const headers = rows[headerRow] || [];

  const plan = useMemo(() => {
    if (!sheets || !products) return null;
    const built = buildImportPlan({ rows, headerRow, mapping, options, existing: products });
    for (const item of built.items) if (item.key in includeOverrides) item.include = includeOverrides[item.key];
    return built;
  }, [sheets, rows, headerRow, mapping, options, products, includeOverrides]);

  if (!products || !suppliers || !categories || !settings) return null;

  const setOpt = (changes) => setOptions((o) => ({ ...o, ...changes }));
  const findSupplier = (name) => suppliers.find((s) => normalize(s.name) === normalize(name));
  const supplierOpt = (name) => options.suppliers[normalize(name)] || {};
  const setSupplierOpt = (name, changes) =>
    setOptions((o) => ({ ...o, suppliers: { ...o.suppliers, [normalize(name)]: { ...o.suppliers[normalize(name)], ...changes } } }));

  function prepareSheet(allSheets, index) {
    const r = allSheets[index].rows;
    const h = findHeaderRow(r);
    setSheetIndex(index);
    setHeaderRow(h);
    setMapping(guessMapping(r[h] || []));
    setIncludeOverrides({});
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLoadError('');
    setResult(null);
    try {
      const read = await readSpreadsheet(file);
      if (!read.length || read.every((s) => s.rows.length === 0)) throw new Error('El archivo está vacío.');
      setFileName(file.name);
      setSheets(read);
      prepareSheet(read, pickBestSheet(read));
    } catch (err) {
      setLoadError(err.message);
      setSheets(null);
    }
  }

  function reset() {
    setSheets(null);
    setFileName('');
    setResult(null);
    setIncludeOverrides({});
  }

  async function onConfirm() {
    const summary = summarizePlan(plan.items);
    const missingSupplier = options.registerPurchase && plan.items.some((i) => i.include && !i.supplier);
    const ok = await confirm({
      title: '¿Importar estos productos?',
      message: (
        <div>
          <p>Se van a cargar {summary.products} productos ({summary.units} unidades): {summary.newProducts} nuevos y {summary.existingProducts} que ya existían.</p>
          {summary.withErrors > 0 && <p>Las {summary.withErrors} líneas con errores no se van a importar.</p>}
          {options.registerPurchase && <p>Además, queda registrada una compra pagada por cada proveedor, con la fecha que elegiste.</p>}
          {missingSupplier && <p>Las líneas sin proveedor se cargan como stock inicial, sin compra.</p>}
        </div>
      ),
      confirmText: 'Sí, importar',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await commitImport(plan.items, options);
      setResult(res);
      setSheets(null);
      toast('Importación terminada');
    } catch (err) {
      console.error(err);
      toast('Algo falló al importar. No se guardó la última línea. Probá de nuevo.', 'error');
    } finally {
      setBusy(false);
    }
  }

  // ---------- Resultado ----------
  if (result) {
    return (
      <>
        <h1>Importación terminada</h1>
        <Notice type="ok">
          Se crearon {result.created} productos y se actualizaron {result.updated}. En total entraron {result.units} unidades al stock.
          {result.purchases === 1 && ' Quedó registrada la compra.'}
          {result.purchases > 1 && ` Quedaron registradas ${result.purchases} compras.`}
        </Notice>
        {(result.newCategories.length > 0 || result.newSuppliers.length > 0) && (
          <p>
            {result.newSuppliers.length > 0 && <>Proveedores nuevos: {[...new Set(result.newSuppliers)].join(', ')}. </>}
            {result.newCategories.length > 0 && <>Categorías nuevas: {[...new Set(result.newCategories)].join(', ')}.</>}
          </p>
        )}
        <div className="row">
          <Link to="/productos" className="btn btn-principal">Ver productos</Link>
          <button type="button" className="btn" onClick={reset}><Upload size={20} aria-hidden="true" /> Importar otro archivo</button>
        </div>
      </>
    );
  }

  // ---------- Paso 1: elegir archivo ----------
  if (!sheets) {
    return (
      <>
        <h1>Importar productos desde Excel</h1>
        <div className="card">
          <h2>1. Elegí el archivo</h2>
          <p>Puede ser una factura del proveedor o una lista de productos (archivos .xlsx, .xls o .csv). Antes de guardar vas a poder revisar todo.</p>
          {loadError && <Notice type="error">{loadError}</Notice>}
          <label className="btn btn-principal btn-grande">
            <Upload size={24} aria-hidden="true" /> Elegir archivo
            <input type="file" accept=".xlsx,.xls,.csv,.ods" onChange={onFile} style={{ display: 'none' }} />
          </label>
        </div>
        <div className="card">
          <h2>¿Querés cargar muchos productos nuevos?</h2>
          <p>Bajá la plantilla, completala en Excel y después importala acá.</p>
          <button type="button" className="btn" onClick={downloadTemplate}><Download size={22} aria-hidden="true" /> Descargar plantilla de Excel</button>
        </div>
      </>
    );
  }

  // ---------- Pasos 2 a 4 ----------
  const summary = summarizePlan(plan.items);
  const planSuppliers = suppliersInPlan(plan.items);
  const preview = rows.slice(headerRow + 1, headerRow + 4);
  const hasName = mapping.includes('name');

  return (
    <>
      <div className="page-header">
        <h1>Importar: {fileName}</h1>
        <button type="button" className="btn btn-texto" onClick={reset}><RotateCcw size={20} aria-hidden="true" /> Elegir otro archivo</button>
      </div>

      <div className="card">
        <h2>2. ¿Qué es cada columna?</h2>
        <p className="small muted">Ya intentamos adivinarlo por los títulos. Revisalo y corregí lo que haga falta. Las columnas que no sirven, dejalas en "No usar".</p>
        <div className="grid-2">
          {sheets.length > 1 && (
            <Field label="Hoja del archivo">
              <select value={sheetIndex} onChange={(e) => prepareSheet(sheets, Number(e.target.value))}>
                {sheets.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Fila de los títulos" help="La fila donde dice, por ejemplo, Descripción, Cantidad, Precio.">
            <select
              value={headerRow}
              onChange={(e) => {
                const h = Number(e.target.value);
                setHeaderRow(h);
                setMapping(guessMapping(rows[h] || []));
              }}
            >
              {rows.slice(0, 30).map((r, i) => (
                <option key={i} value={i}>Fila {i + 1}: {r.filter((c) => String(c).trim()).slice(0, 4).join(' · ').slice(0, 60)}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Columna del archivo</th><th>Ejemplos</th><th style={{ minWidth: 220 }}>Es…</th></tr>
            </thead>
            <tbody>
              {headers.map((h, col) => (
                <tr key={col}>
                  <td><strong>{String(h || `(columna ${col + 1})`)}</strong></td>
                  <td className="small muted">{preview.map((r) => String(r[col] ?? '')).filter(Boolean).join(' · ').slice(0, 80)}</td>
                  <td>
                    <select value={mapping[col] || 'ignore'} onChange={(e) => setMapping((m) => m.map((v, j) => (j === col ? e.target.value : v)))}>
                      {IMPORT_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!hasName && <Notice type="aviso">Falta decir cuál es la columna del nombre o título.</Notice>}
      </div>

      <div className="card">
        <h2>3. Opciones</h2>
        <div className="grid-2">
          <Field label="Proveedor" help={mapping.includes('supplier') ? 'Se usa para las filas que no tengan proveedor.' : 'Si no existe, se crea.'}>
            <TextInput value={options.defaultSupplier} onChange={(v) => setOpt({ defaultSupplier: v })} suggestions={suppliers.map((s) => s.name)} placeholder="Atlantis" />
          </Field>
          <Field label="Categoría" help={mapping.includes('category') ? 'Se usa para las filas que no tengan categoría.' : 'Si no existe, se crea.'}>
            <TextInput value={options.defaultCategory} onChange={(v) => setOpt({ defaultCategory: v })} suggestions={categories.map((c) => c.name)} placeholder="Libros" />
          </Field>
        </div>
        <Checkbox checked={options.splitCollection} onChange={(v) => setOpt({ splitCollection: v })}>
          Lo que está entre paréntesis en el título es la colección (por ejemplo "El bosque (Colección Lunita)")
        </Checkbox>
        <Checkbox checked={options.registerPurchase} onChange={(v) => setOpt({ registerPurchase: v })}>
          Son facturas: registrar una compra pagada por cada proveedor
        </Checkbox>

        {planSuppliers.map((name) => {
          const existing = findSupplier(name);
          const opt = supplierOpt(name);
          return (
            <div key={name} className="card" style={{ background: 'var(--color-fondo)', marginTop: '1rem' }}>
              <h3>{name} {!existing && <span className="badge badge-acento">Proveedor nuevo</span>}</h3>
              {existing ? (
                <p className="small muted">
                  {existing.addVat ? `Al costo se le suma ${settings.vatPct} % de IVA.` : 'Al costo no se le suma IVA.'} Se cambia en la ficha del proveedor.
                </p>
              ) : (
                <Checkbox checked={!!opt.addVat} onChange={(v) => setSupplierOpt(name, { addVat: v })}>
                  Factura sin IVA y además pagamos el IVA: sumar {settings.vatPct} % al costo
                </Checkbox>
              )}
              {options.registerPurchase && (
                <div className="grid-2">
                  <Field label="Fecha de la factura">
                    <input type="date" value={opt.date || options.purchaseDate} onChange={(e) => setSupplierOpt(name, { date: e.target.value })} />
                  </Field>
                  <Field label="Número de factura (opcional)">
                    <TextInput value={opt.invoiceNumber || ''} onChange={(v) => setSupplierOpt(name, { invoiceNumber: v })} placeholder="0009-00000106" />
                  </Field>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2>4. Revisá antes de importar</h2>
        <p>
          <strong>{summary.products}</strong> productos, <strong>{summary.units}</strong> unidades. {summary.newProducts} nuevos, {summary.existingProducts} ya existían.
          {summary.withErrors > 0 && <span className="badge badge-sin" style={{ marginLeft: 8 }}>{summary.withErrors} con errores (no se importan)</span>}
        </p>
        {plan.skipped.length > 0 && <p className="small muted">Se saltearon {plan.skipped.length} filas de totales.</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Importar</th><th>Nombre</th><th>Código</th><th className="num">Cant.</th><th className="num">Costo / PVP</th><th>Avisos</th></tr>
            </thead>
            <tbody>
              {plan.items.map((item) => {
                const pricing = pricingFromItem(item);
                return (
                  <tr key={item.key} className={item.errors.length ? 'row-error' : !item.include ? 'row-off' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Importar ${item.name}`}
                        style={{ width: 24, height: 24 }}
                        checked={item.include}
                        onChange={(e) => setIncludeOverrides((o) => ({ ...o, [item.key]: e.target.checked }))}
                      />
                    </td>
                    <td>
                      {item.name || <em>(sin nombre)</em>}
                      {item.extras.coleccion && <div className="small muted">Colección: {item.extras.coleccion}</div>}
                      <div className="small muted">Fila {item.sourceRows.join(', ')}</div>
                    </td>
                    <td>{item.code}</td>
                    <td className="num">{item.qty}</td>
                    <td className="num">
                      {pricing.pricingMode === 'lista'
                        ? <>PVP {formatMoney(pricing.listPrice)}<div className="small muted">desc. {formatPercent(pricing.supplierDiscount)}</div></>
                        : item.unitCost ? formatMoney(item.unitCost) : '—'}
                    </td>
                    <td className="small">
                      {item.errors.map((m) => <div key={m} style={{ color: 'var(--color-error)', fontWeight: 700 }}>{m}</div>)}
                      {item.warnings.map((m) => <div key={m}>{m}</div>)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="row" style={{ marginBottom: '2rem' }}>
        <button type="button" className="btn btn-principal btn-grande" onClick={onConfirm} disabled={busy || !hasName || summary.products === 0}>
          <Check size={24} aria-hidden="true" /> {busy ? 'Importando…' : `Importar ${summary.products} productos`}
        </button>
        <button type="button" className="btn btn-grande" onClick={reset}>Cancelar</button>
      </div>
    </>
  );
}
