// Cargar una compra (ingreso de mercadería). Suma al stock y actualiza costos.
// Después de guardar, si cambió algún costo, se ofrece actualizar el precio de venta.

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Trash2, Plus, ArrowLeft } from 'lucide-react';
import { registerPurchase, applyNewPrices, lineCost } from '../db/purchases.js';
import { saveProduct, emptyProduct } from '../db/repo.js';
import { useProducts, useStockMap, useSuppliers, useCategories, useSettings, indexById } from '../ui/useData.js';
import { Field, TextInput, MoneyInput, PercentInput, NumberInput, ChoiceGroup, Checkbox, Notice } from '../ui/components.jsx';
import { useToast } from '../ui/feedback.jsx';
import ProductPicker from '../ui/ProductPicker.jsx';
import { formatMoney } from '../logic/money.js';
import { todayIso } from '../db/ids.js';

function lineFromProduct(product, supplier) {
  return {
    productId: product.id,
    name: product.name,
    pricingMode: product.pricingMode,
    qty: 1,
    invoiceCost: product.baseCost ?? product.cost ?? null,
    listPrice: product.listPrice ?? null,
    supplierDiscount: product.supplierDiscount ?? supplier?.usualDiscount ?? null,
  };
}

/** Formulario corto para crear un producto sin salir de la compra. */
function QuickProduct({ initialName, categories, supplier, onCreated, onCancel }) {
  const [name, setName] = useState(initialName);
  const [categoryId, setCategoryId] = useState('');
  const [mode, setMode] = useState(supplier?.usualDiscount ? 'lista' : 'recargo');
  const [error, setError] = useState('');

  async function create() {
    if (!name.trim()) return setError('Falta el nombre.');
    const product = await saveProduct(
      { ...emptyProduct(), name, categoryId, supplierId: supplier?.id || '', pricingMode: mode, supplierDiscount: mode === 'lista' ? supplier?.usualDiscount ?? null : null },
      { reason: 'Alta desde una compra' },
    );
    onCreated(product);
  }

  return (
    <div className="card" style={{ background: 'var(--color-fondo)' }}>
      <h3>Producto nuevo</h3>
      {error && <Notice type="error">{error}</Notice>}
      <div className="grid-2">
        <Field label="Nombre o título"><TextInput value={name} onChange={setName} autoFocus /></Field>
        <Field label="Categoría">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sin categoría</option>
            {categories.filter((c) => c.active !== false).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="¿Cómo viene el costo?">
        <ChoiceGroup value={mode} onChange={setMode} options={[{ value: 'recargo', label: 'Costo por unidad' }, { value: 'lista', label: 'PVP con descuento' }]} />
      </Field>
      <p className="small muted">El costo se completa en la línea de la compra. Los demás datos (autor, marca...) se pueden completar después en la ficha.</p>
      <div className="row">
        <button type="button" className="btn btn-principal" onClick={create}><Plus size={20} aria-hidden="true" /> Crear y agregar</button>
        <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

export default function PurchaseNewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const products = useProducts();
  const stockMap = useStockMap();
  const suppliers = useSuppliers();
  const categories = useCategories();
  const settings = useSettings();

  const [date, setDate] = useState(todayIso());
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [lines, setLines] = useState([]);
  const [paid, setPaid] = useState(true);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(null); // nombre propuesto para un producto nuevo
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [review, setReview] = useState(null); // { purchaseId, changes, chosen }

  const supIndex = useMemo(() => indexById(suppliers), [suppliers]);
  const prodIndex = useMemo(() => indexById(products), [products]);
  // Primero los productos de este proveedor.
  const order = useMemo(() => new Map((products || []).map((p) => [p.id, p.supplierId === supplierId ? 1 : 0])), [products, supplierId]);

  if (!products || !stockMap || !suppliers || !categories || !settings) return null;
  const supplier = supIndex.get(supplierId);

  const setLine = (i, changes) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...changes } : l)));
  const addProduct = (product) => {
    setError('');
    const idx = lines.findIndex((l) => l.productId === product.id);
    if (idx >= 0) setLine(idx, { qty: lines[idx].qty + 1 });
    else setLines((ls) => [...ls, lineFromProduct(product, supplier)]);
  };
  const costOf = (line) => {
    const product = prodIndex.get(line.productId) || { pricingMode: line.pricingMode };
    return lineCost(line, product, supplier, settings);
  };
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * costOf(l), 0);

  async function onSave() {
    setError('');
    if (!lines.length) return setError('Agregá al menos un producto.');
    if (!paid && !dueDate) return setError('Poné la fecha de vencimiento, o marcala como pagada.');
    setSaving(true);
    try {
      const { purchase, changes } = await registerPurchase({ date, supplierId, lines, paid, dueDate, invoiceNumber, notes });
      toast('Compra guardada. Se sumó al stock.');
      if (changes.length) {
        // Los precios fijados a mano (por ejemplo, el PVP del proveedor) vienen sin tildar.
        setReview({ purchaseId: purchase.id, changes, chosen: Object.fromEntries(changes.map((c) => [c.productId, !c.manual && c.suggested !== c.price])) });
      } else {
        navigate(`/compras/${purchase.id}`);
      }
    } catch (err) {
      setError(err.message || 'No se pudo guardar la compra.');
    } finally {
      setSaving(false);
    }
  }

  async function onApplyPrices() {
    const updates = review.changes.filter((c) => review.chosen[c.productId]).map((c) => ({ productId: c.productId, newPrice: c.suggested }));
    await applyNewPrices(updates);
    if (updates.length) toast(`Se actualizaron ${updates.length} precios`);
    navigate(`/compras/${review.purchaseId}`);
  }

  // ---------- Paso 2: revisar precios ----------
  if (review) {
    return (
      <>
        <h1>Cambiaron algunos costos</h1>
        <p>Con esta compra cambió el costo de {review.changes.length === 1 ? 'un producto' : `${review.changes.length} productos`}. ¿Querés actualizar el precio de venta al sugerido?</p>
        <div className="list">
          {review.changes.map((c) => (
            <div key={c.productId} className="card">
              <div className="list-item-title">{c.name}</div>
              <p className="small">Costo: {formatMoney(c.oldCost)} → <strong>{formatMoney(c.newCost)}</strong>{c.manual && ' · El precio actual está fijado a mano'}</p>
              <Checkbox checked={!!review.chosen[c.productId]} onChange={(v) => setReview((r) => ({ ...r, chosen: { ...r.chosen, [c.productId]: v } }))}>
                Cambiar precio de {formatMoney(c.price)} a {formatMoney(c.suggested)}
              </Checkbox>
            </div>
          ))}
        </div>
        <div className="row" style={{ margin: '1rem 0 2rem' }}>
          <button type="button" className="btn btn-principal btn-grande" onClick={onApplyPrices}><Check size={22} aria-hidden="true" /> Listo</button>
          <button type="button" className="btn btn-grande" onClick={() => navigate(`/compras/${review.purchaseId}`)}>Dejar los precios como están</button>
        </div>
      </>
    );
  }

  // ---------- Paso 1: cargar la compra ----------
  return (
    <>
      <div className="page-header">
        <h1>Cargar compra</h1>
        <Link to="/compras" className="btn btn-texto"><ArrowLeft size={22} aria-hidden="true" /> Volver</Link>
      </div>

      <div className="card">
        <div className="grid-2">
          <Field label="Fecha"><input type="date" value={date} onChange={(e) => setDate(e.target.value || todayIso())} /></Field>
          <Field label="Proveedor" help={supplier?.addVat ? `A los costos se les suma ${settings.vatPct} % de IVA.` : undefined}>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Elegí el proveedor</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Número de factura (opcional)"><TextInput value={invoiceNumber} onChange={setInvoiceNumber} /></Field>
        </div>
        {suppliers.length === 0 && <p className="small">Todavía no hay proveedores. <Link to="/proveedores/nuevo">Crear proveedor</Link></p>}
      </div>

      <ProductPicker
        products={products}
        stockMap={stockMap}
        onPick={addProduct}
        order={order}
        showCost
        placeholder="Buscar producto comprado"
        footer={
          !creating && (
            <button type="button" className="btn btn-chico" style={{ marginTop: '0.5rem' }} onClick={() => setCreating('')}>
              <Plus size={18} aria-hidden="true" /> Crear producto nuevo
            </button>
          )
        }
      />
      {creating !== null && (
        <QuickProduct
          initialName={creating}
          categories={categories}
          supplier={supplier}
          onCancel={() => setCreating(null)}
          onCreated={(p) => {
            setCreating(null);
            setLines((ls) => [...ls, lineFromProduct(p, supplier)]);
          }}
        />
      )}

      <div className="card">
        <h2>Productos comprados</h2>
        {lines.length === 0 && <p className="muted">Buscá cada producto de la factura y tocalo para agregarlo.</p>}
        {lines.map((line, i) => (
          <div key={line.productId} className="cart-line" style={{ alignItems: 'flex-end' }}>
            <div className="cart-line-main" style={{ flexBasis: '100%' }}>
              <div className="list-item-title">{line.name}</div>
            </div>
            <div style={{ width: 110 }}>
              <Field label="Cantidad"><NumberInput value={line.qty} onChange={(v) => setLine(i, { qty: v ?? 0 })} /></Field>
            </div>
            {line.pricingMode === 'lista' ? (
              <>
                <div style={{ flex: '1 1 140px' }}><Field label="PVP"><MoneyInput value={line.listPrice} onChange={(v) => setLine(i, { listPrice: v })} /></Field></div>
                <div style={{ flex: '1 1 110px' }}><Field label="Descuento"><PercentInput value={line.supplierDiscount} onChange={(v) => setLine(i, { supplierDiscount: v })} /></Field></div>
              </>
            ) : (
              <div style={{ flex: '1 1 160px' }}><Field label="Costo por unidad (factura)"><MoneyInput value={line.invoiceCost} onChange={(v) => setLine(i, { invoiceCost: v })} /></Field></div>
            )}
            <div className="field" style={{ minWidth: 130 }}>
              <span className="field-label small">Costo final c/u</span>
              <strong>{formatMoney(costOf(line))}</strong>
            </div>
            <div className="field">
              <button type="button" className="btn btn-chico btn-texto" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 size={18} aria-hidden="true" /> Sacar</button>
            </div>
          </div>
        ))}
        {lines.length > 0 && <div className="totals-row totals-final"><span>Total de la compra</span><span>{formatMoney(total)}</span></div>}
      </div>

      <div className="card">
        <Field label="Pago">
          <ChoiceGroup value={paid ? 'si' : 'no'} onChange={(v) => setPaid(v === 'si')} options={[{ value: 'si', label: 'Pagada' }, { value: 'no', label: 'Se paga después (cuenta corriente)' }]} />
        </Field>
        {!paid && <Field label="Vence el" help="Te avisamos en el Inicio cuando esté por vencer."><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>}
        <Field label="Notas (opcional)"><TextInput value={notes} onChange={setNotes} /></Field>
      </div>

      {error && <Notice type="error">{error}</Notice>}
      <div className="sticky-confirm">
        <button type="button" className="btn btn-principal btn-grande btn-ancho" onClick={onSave} disabled={saving}>
          <Check size={24} aria-hidden="true" /> Guardar compra · {formatMoney(total)}
        </button>
      </div>
    </>
  );
}
