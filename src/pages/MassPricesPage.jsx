// Actualizar precios de muchos productos a la vez, con vista previa antes de confirmar.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowLeft } from 'lucide-react';
import { db } from '../db/db.js';
import { saveRecord } from '../db/repo.js';
import { nowIso } from '../db/ids.js';
import { useProducts, useCategories, useSuppliers, useSettings, indexById } from '../ui/useData.js';
import { Field, PercentInput, ChoiceGroup, Checkbox, Notice } from '../ui/components.jsx';
import { useToast, useConfirm } from '../ui/feedback.jsx';
import { previewMassUpdate } from '../logic/massPrices.js';
import { formatMoney, formatPercent } from '../logic/money.js';

export default function MassPricesPage() {
  const products = useProducts();
  const categories = useCategories();
  const suppliers = useSuppliers();
  const settings = useSettings();
  const toast = useToast();
  const confirm = useConfirm();

  const [scope, setScope] = useState('todos');
  const [categoryId, setCategoryId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [direction, setDirection] = useState('subir');
  const [pct, setPct] = useState(null);
  const [mode, setMode] = useState('precio');
  const [round, setRound] = useState(true);
  const [excluded, setExcluded] = useState({});
  const [saving, setSaving] = useState(false);

  const supIndex = useMemo(() => indexById(suppliers), [suppliers]);
  const catIndex = useMemo(() => indexById(categories), [categories]);

  if (!products || !categories || !suppliers || !settings) return null;

  const target = products.filter((p) => p.active !== false
    && (scope !== 'categoria' || (categoryId && p.categoryId === categoryId))
    && (scope !== 'proveedor' || (supplierId && p.supplierId === supplierId)));
  const signedPct = (Number(pct) || 0) * (direction === 'bajar' ? -1 : 1);
  const rows = pct ? previewMassUpdate(target, { pct: signedPct, mode, round, settings, suppliersById: supIndex }) : [];
  const chosen = rows.filter((r) => !excluded[r.product.id] && (r.newPrice !== r.oldPrice || r.newCost !== r.oldCost));
  const scopeLabel = scope === 'categoria' ? catIndex.get(categoryId)?.name : scope === 'proveedor' ? supIndex.get(supplierId)?.name : 'todos los productos';
  const reason = `Actualización masiva: ${signedPct > 0 ? '+' : ''}${formatPercent(signedPct)} (${scopeLabel || '—'})${mode === 'proveedor' ? ', aumento del proveedor' : ''}`;

  async function onApply() {
    const ok = await confirm({
      title: `¿Actualizar ${chosen.length} productos?`,
      message: `${reason}. Queda guardado en el historial de precios de cada producto.`,
      confirmText: 'Sí, actualizar',
    });
    if (!ok) return;
    setSaving(true);
    try {
      for (const r of chosen) {
        const current = await db.products.get(r.product.id);
        await saveRecord('products', { ...current, ...r.changes });
        await saveRecord('priceHistory', { productId: r.product.id, date: nowIso(), oldCost: r.oldCost, newCost: r.newCost, oldPrice: r.oldPrice, newPrice: r.newPrice, reason });
      }
      toast(`Se actualizaron ${chosen.length} productos`);
      setPct(null);
      setExcluded({});
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Actualizar precios</h1>
        <Link to="/productos" className="btn btn-texto"><ArrowLeft size={22} aria-hidden="true" /> Productos</Link>
      </div>
      <p className="muted">Subí o bajá un porcentaje a muchos productos juntos. Antes de guardar vas a ver cómo queda cada uno.</p>

      <div className="card">
        <Field label="¿A qué productos?">
          <ChoiceGroup value={scope} onChange={setScope} options={[{ value: 'todos', label: 'Todos' }, { value: 'categoria', label: 'Una categoría' }, { value: 'proveedor', label: 'Un proveedor' }]} />
        </Field>
        {scope === 'categoria' && (
          <Field label="Categoría">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Elegí una</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        {scope === 'proveedor' && (
          <Field label="Proveedor">
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Elegí uno</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="¿Qué cambia?">
          <ChoiceGroup
            value={mode}
            onChange={setMode}
            options={[{ value: 'precio', label: 'Solo el precio de venta' }, { value: 'proveedor', label: 'Aumentó el proveedor: costo y precio' }]}
          />
        </Field>
        {mode === 'proveedor' && <p className="small muted">Sube el costo (o el PVP de las editoriales) y el precio de venta en el mismo porcentaje. Los libros que se vendían al PVP pasan al PVP nuevo.</p>}
        <div className="grid-2">
          <Field label="Subir o bajar">
            <ChoiceGroup value={direction} onChange={setDirection} options={[{ value: 'subir', label: 'Subir' }, { value: 'bajar', label: 'Bajar' }]} />
          </Field>
          <Field label="Porcentaje">
            <PercentInput value={pct} onChange={setPct} placeholder="10" />
          </Field>
        </div>
        <Checkbox checked={round} onChange={setRound}>
          Redondear precios {settings.roundingStep ? `a múltiplos de ${formatMoney(settings.roundingStep)}` : '(no hay redondeo configurado)'}
        </Checkbox>
      </div>

      {!pct ? (
        <Notice type="info">Escribí el porcentaje para ver la vista previa.</Notice>
      ) : rows.length === 0 ? (
        <Notice type="aviso">No hay productos para actualizar con esa elección.</Notice>
      ) : (
        <>
          <h2>Vista previa ({chosen.length} de {rows.length} productos)</h2>
          <p className="small muted">Destildá los productos que no querés cambiar.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cambiar</th><th>Producto</th>
                  {mode === 'proveedor' && <th className="num">Costo</th>}
                  <th className="num">Precio ahora</th><th className="num">Precio nuevo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.product.id} className={excluded[r.product.id] ? 'row-off' : ''}>
                    <td>
                      <input type="checkbox" style={{ width: 24, height: 24 }} aria-label={`Cambiar ${r.product.name}`} checked={!excluded[r.product.id]} onChange={(e) => setExcluded((x) => ({ ...x, [r.product.id]: !e.target.checked }))} />
                    </td>
                    <td>{r.product.name}</td>
                    {mode === 'proveedor' && <td className="num small">{formatMoney(r.oldCost)} → {formatMoney(r.newCost)}</td>}
                    <td className="num">{formatMoney(r.oldPrice)}</td>
                    <td className="num"><strong>{formatMoney(r.newPrice)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sticky-confirm">
            <button type="button" className="btn btn-principal btn-grande btn-ancho" onClick={onApply} disabled={saving || chosen.length === 0}>
              <Check size={24} aria-hidden="true" /> Actualizar {chosen.length} productos
            </button>
          </div>
        </>
      )}
    </>
  );
}
