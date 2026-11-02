// Alta y edición de un producto (también muestra stock e historial de precios).

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Save, Trash2, ArrowLeft, Wand2 } from 'lucide-react';
import { db } from '../db/db.js';
import { emptyProduct, saveProduct, softDelete, adjustStock } from '../db/repo.js';
import { formatDate } from '../db/ids.js';
import { useCategories, useSuppliers, useSettings, useStockMap, indexById } from '../ui/useData.js';
import { Field, TextInput, NumberInput, MoneyInput, PercentInput, Checkbox, ChoiceGroup, Notice } from '../ui/components.jsx';
import { useToast, useConfirm } from '../ui/feedback.jsx';
import ProfitInfo from '../ui/ProfitInfo.jsx';
import { computePricing, PRICING_MODES } from '../logic/pricing.js';
import { formatMoney, formatPercent } from '../logic/money.js';

export default function ProductEditPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const categories = useCategories();
  const suppliers = useSuppliers();
  const settings = useSettings();
  const stockMap = useStockMap();
  const stored = useLiveQuery(() => (id ? db.products.get(id) : null), [id]);
  const history = useLiveQuery(
    async () => (id ? (await db.priceHistory.where('productId').equals(id).toArray()).filter((h) => !h.deleted).sort((a, b) => b.date.localeCompare(a.date)) : []),
    [id],
  );

  const [form, setForm] = useState(null);
  const [initialStock, setInitialStock] = useState(0);
  const [counted, setCounted] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew && !form) setForm(emptyProduct());
    if (!isNew && stored && !form) setForm({ ...emptyProduct(), ...stored, extras: { ...(stored.extras || {}) } });
  }, [isNew, stored, form]);

  const catIndex = useMemo(() => indexById(categories), [categories]);
  const supIndex = useMemo(() => indexById(suppliers), [suppliers]);

  if (!isNew && stored === undefined) return null;
  if (!isNew && (stored === null || stored?.deleted)) {
    return (
      <Notice type="error">
        No encontramos este producto. Puede que se haya borrado. <Link to="/productos">Volver a productos</Link>
      </Notice>
    );
  }
  if (!form || !categories || !suppliers || !settings || !stockMap) return null;

  const category = catIndex.get(form.categoryId);
  const supplier = supIndex.get(form.supplierId);
  const pricing = computePricing({ product: form, supplier, category, settings });
  const salePrice = form.priceIsManual ? form.salePrice ?? 0 : pricing.suggested;
  const currentStock = stockMap.get(id) || 0;

  const set = (changes) => setForm((f) => ({ ...f, ...changes }));
  const setExtra = (key, value) => setForm((f) => ({ ...f, extras: { ...f.extras, [key]: value } }));

  function onSupplierChange(supplierId) {
    const s = supIndex.get(supplierId);
    const changes = { supplierId };
    // Si el proveedor tiene un descuento habitual y el producto no tiene uno, lo proponemos.
    if (s?.usualDiscount && (form.supplierDiscount === null || form.supplierDiscount === undefined)) changes.supplierDiscount = s.usualDiscount;
    set(changes);
  }

  async function onSave(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('Falta el nombre del producto.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    try {
      const saved = await saveProduct({ ...form, salePrice }, { initialStock: isNew ? initialStock : 0 });
      toast(isNew ? 'Producto creado' : 'Cambios guardados');
      navigate(isNew ? `/productos/${saved.id}` : '/productos', { replace: isNew });
      if (isNew) setForm(null);
    } catch (err) {
      setError(err.message || 'No se pudo guardar. Probá de nuevo.');
    }
  }

  async function onDelete() {
    const ok = await confirm({
      title: '¿Borrar este producto?',
      message: `Vas a borrar "${form.name}". Las compras ya registradas no se modifican. Si solo querés que no aparezca, podés desactivarlo.`,
      confirmText: 'Sí, borrar',
      danger: true,
    });
    if (!ok) return;
    await softDelete('products', id);
    toast('Producto borrado');
    navigate('/productos');
  }

  async function onAdjust() {
    if (counted === null || counted === currentStock) return;
    const ok = await confirm({
      title: 'Corregir stock',
      message: `El stock va a pasar de ${currentStock} a ${counted}. Queda registrado como ajuste manual.`,
      confirmText: 'Corregir',
    });
    if (!ok) return;
    await adjustStock(id, currentStock, counted);
    setCounted(null);
    toast('Stock corregido');
  }

  const markupPlaceholder = pricing.markup ? `${formatPercent(pricing.markup.value, 2)} (${pricing.markup.source})` : '';

  return (
    <form onSubmit={onSave}>
      <div className="page-header">
        <h1>{isNew ? 'Nuevo producto' : form.name || 'Producto'}</h1>
        <Link to="/productos" className="btn btn-texto no-print"><ArrowLeft size={22} aria-hidden="true" /> Volver</Link>
      </div>

      {error && <Notice type="error">{error}</Notice>}

      <div className="card">
        <h2>Datos</h2>
        <Field label={category?.id === 'cat-libros' ? 'Título' : 'Nombre'}>
          <TextInput value={form.name} onChange={(v) => set({ name: v })} autoFocus={isNew} />
        </Field>
        <div className="grid-2">
          <Field label="Categoría">
            <select value={form.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
              <option value="">Sin categoría</option>
              {categories.filter((c) => c.active !== false || c.id === form.categoryId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Proveedor">
            <select value={form.supplierId} onChange={(e) => onSupplierChange(e.target.value)}>
              <option value="">Sin proveedor</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>
        {category?.fields?.length > 0 && (
          <div className="grid-2">
            {category.fields.map((f) => (
              <Field key={f.key} label={f.label}>
                {f.type === 'number' ? (
                  <NumberInput value={form.extras[f.key] ?? null} onChange={(v) => setExtra(f.key, v)} />
                ) : (
                  <TextInput value={form.extras[f.key] ?? ''} onChange={(v) => setExtra(f.key, v)} suggestions={f.suggestions} />
                )}
              </Field>
            ))}
          </div>
        )}
        <Field label="Código del proveedor (opcional)" help="Por ejemplo el código de la factura o el ISBN. Sirve para reconocer el producto al importar.">
          <TextInput value={form.code} onChange={(v) => set({ code: v })} />
        </Field>
      </div>

      <div className="card">
        <h2>Precio</h2>
        <Field label="¿Cómo se calcula el costo?">
          <ChoiceGroup
            value={form.pricingMode}
            onChange={(v) => set({ pricingMode: v })}
            options={[
              { value: PRICING_MODES.MARKUP, label: 'Costo + recargo' },
              { value: PRICING_MODES.LIST, label: 'Precio de lista (PVP) con descuento' },
            ]}
          />
        </Field>

        {form.pricingMode === PRICING_MODES.LIST ? (
          <>
            <p className="small muted">Para editoriales: indican un precio al público y nos hacen un descuento. Normalmente se vende al PVP.</p>
            <div className="grid-2">
              <Field label="PVP (precio de lista)">
                <MoneyInput value={form.listPrice} onChange={(v) => set({ listPrice: v })} />
              </Field>
              <Field label="Descuento del proveedor">
                <PercentInput value={form.supplierDiscount} onChange={(v) => set({ supplierDiscount: v })} />
              </Field>
            </div>
          </>
        ) : (
          <div className="grid-2">
            <Field label="Costo (lo que pagamos por unidad)">
              <MoneyInput value={form.baseCost ?? null} onChange={(v) => set({ baseCost: v })} />
            </Field>
            <Field label="Recargo sobre el costo" help="Dejalo vacío para usar el de siempre.">
              <PercentInput value={form.markupPct} onChange={(v) => set({ markupPct: v })} placeholder={markupPlaceholder} />
            </Field>
          </div>
        )}

        <p>
          Costo final: <strong>{formatMoney(pricing.cost)}</strong>
          {supplier?.addVat && <span className="muted small"> (incluye {settings.vatPct} % de IVA, porque {supplier.name} factura sin IVA)</span>}
        </p>

        <div className="grid-2">
          <Field
            label="Precio de venta"
            help={form.priceIsManual && salePrice !== pricing.suggested ? `Precio fijado a mano. El sugerido es ${formatMoney(pricing.suggested)}.` : `Precio sugerido${form.pricingMode === PRICING_MODES.MARKUP && settings.roundingStep ? `, redondeado a múltiplos de $ ${settings.roundingStep}` : ''}.`}
          >
            <MoneyInput value={salePrice} onChange={(v) => set({ salePrice: v, priceIsManual: true })} />
          </Field>
          {form.priceIsManual && salePrice !== pricing.suggested && (
            <div className="field" style={{ alignSelf: 'center' }}>
              <button type="button" className="btn" onClick={() => set({ priceIsManual: false })}>
                <Wand2 size={20} aria-hidden="true" /> Usar sugerido ({formatMoney(pricing.suggested)})
              </button>
            </div>
          )}
        </div>

        <ProfitInfo cost={pricing.cost} price={salePrice} />
      </div>

      <div className="card">
        <h2>Stock</h2>
        <div className="grid-2">
          {isNew ? (
            <Field label="Stock inicial" help="Cuántas unidades hay ahora.">
              <NumberInput value={initialStock} onChange={(v) => setInitialStock(v ?? 0)} />
            </Field>
          ) : (
            <div className="field">
              <span className="field-label">Stock actual</span>
              <div className="stat-value">{currentStock}</div>
            </div>
          )}
          <Field label="Stock mínimo" help="Cuando quede esta cantidad o menos, te avisamos.">
            <NumberInput value={form.stockMin} onChange={(v) => set({ stockMin: v ?? 0 })} />
          </Field>
        </div>
        {!isNew && (
          <div className="row">
            <div style={{ flex: '1 1 200px' }}>
              <Field label="¿Contaste y hay otra cantidad?">
                <NumberInput value={counted} onChange={setCounted} placeholder="Cantidad contada" />
              </Field>
            </div>
            <button type="button" className="btn" onClick={onAdjust} disabled={counted === null || counted === currentStock}>Corregir stock</button>
          </div>
        )}
      </div>

      {settings.useConsignment && (
        <div className="card">
          <h2>Propio o en consignación</h2>
          <ChoiceGroup
            value={form.ownership}
            onChange={(v) => set({ ownership: v })}
            options={[
              { value: 'propio', label: 'Propio' },
              { value: 'consignacion', label: 'En consignación' },
            ]}
          />
          {form.ownership === 'consignacion' && (
            <div className="grid-2" style={{ marginTop: '1rem' }}>
              <Field label="Al proveedor le corresponde">
                <ChoiceGroup
                  value={form.consignmentType}
                  onChange={(v) => set({ consignmentType: v })}
                  options={[
                    { value: 'porcentaje', label: 'Un porcentaje' },
                    { value: 'monto', label: 'Un monto fijo' },
                  ]}
                />
              </Field>
              <Field label={form.consignmentType === 'monto' ? 'Monto por unidad vendida' : 'Porcentaje del precio de venta'} help="Opcional. Podés completarlo más adelante.">
                {form.consignmentType === 'monto' ? (
                  <MoneyInput value={form.consignmentValue} onChange={(v) => set({ consignmentValue: v })} />
                ) : (
                  <PercentInput value={form.consignmentValue} onChange={(v) => set({ consignmentValue: v })} />
                )}
              </Field>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2>Otros</h2>
        <Field label="Notas (opcional)">
          <textarea value={form.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        <Checkbox checked={form.active !== false} onChange={(v) => set({ active: v })}>Activo (si lo desactivás, no aparece en las listas)</Checkbox>
        <Checkbox checked={form.trackStock !== false} onChange={(v) => set({ trackStock: v })}>Llevar control de stock</Checkbox>
      </div>

      <div className="row no-print" style={{ marginBottom: '2rem' }}>
        <button type="submit" className="btn btn-principal btn-grande"><Save size={22} aria-hidden="true" /> Guardar</button>
        <Link to="/productos" className="btn btn-grande">Cancelar</Link>
        <span className="spacer" />
        {!isNew && (
          <button type="button" className="btn btn-peligro" onClick={onDelete}><Trash2 size={20} aria-hidden="true" /> Borrar producto</button>
        )}
      </div>

      {!isNew && history?.length > 0 && (
        <div className="card">
          <h2>Historial de precios</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Fecha</th><th className="num">Costo</th><th className="num">Precio</th><th>Motivo</th></tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{formatDate(h.date)}</td>
                    <td className="num">{formatMoney(h.newCost)}</td>
                    <td className="num">{formatMoney(h.newPrice)}</td>
                    <td>{h.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </form>
  );
}
