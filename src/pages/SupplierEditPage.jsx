// Ficha de proveedor: datos, productos que nos vende e historial de compras.

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Save, ArrowLeft, Trash2 } from 'lucide-react';
import { db } from '../db/db.js';
import { saveSupplier, softDelete } from '../db/repo.js';
import { formatDate } from '../db/ids.js';
import { useProducts, useStockMap, useSettings } from '../ui/useData.js';
import { Field, TextInput, PercentInput, Checkbox, Notice } from '../ui/components.jsx';
import { useToast, useConfirm } from '../ui/feedback.jsx';
import { formatMoney, formatPercent } from '../logic/money.js';
import { StockBadge } from './ProductsPage.jsx';
import { PaymentBadge } from './PurchasesPage.jsx';
import { setPurchasePaid } from '../db/purchases.js';

const EMPTY = { name: '', legalName: '', cuit: '', phone: '', email: '', website: '', usualDiscount: null, addVat: false, defaultMarkup: null, notes: '' };

export default function SupplierEditPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const settings = useSettings();
  const products = useProducts();
  const stockMap = useStockMap();
  const stored = useLiveQuery(() => (id ? db.suppliers.get(id) : null), [id]);
  const purchases = useLiveQuery(
    async () => (id ? (await db.purchases.where('supplierId').equals(id).toArray()).filter((p) => !p.deleted).sort((a, b) => b.date.localeCompare(a.date)) : []),
    [id],
  );
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew && !form) setForm({ ...EMPTY });
    if (!isNew && stored && !form) setForm({ ...EMPTY, ...stored });
  }, [isNew, stored, form]);

  if (!isNew && (stored === null || stored?.deleted)) {
    return <Notice type="error">No encontramos este proveedor. <Link to="/proveedores">Volver a proveedores</Link></Notice>;
  }
  if (!form || !products || !stockMap || !settings) return null;

  const set = (changes) => setForm((f) => ({ ...f, ...changes }));
  const theirProducts = products.filter((p) => p.supplierId === id);
  const pending = (purchases || []).filter((p) => !p.paid);
  const pendingTotal = pending.reduce((s, p) => s + p.total, 0);

  async function onSave(e) {
    e.preventDefault();
    setError('');
    try {
      await saveSupplier(form);
      toast(isNew ? 'Proveedor creado' : 'Cambios guardados');
      navigate('/proveedores');
    } catch (err) {
      setError(err.message);
    }
  }

  async function onDelete() {
    const ok = await confirm({
      title: '¿Borrar este proveedor?',
      message: theirProducts.length
        ? `"${form.name}" tiene ${theirProducts.length} productos. Los productos no se borran: quedan "sin proveedor".`
        : `Vas a borrar "${form.name}".`,
      confirmText: 'Sí, borrar',
      danger: true,
    });
    if (!ok) return;
    await softDelete('suppliers', id);
    toast('Proveedor borrado');
    navigate('/proveedores');
  }

  return (
    <form onSubmit={onSave}>
      <div className="page-header">
        <h1>{isNew ? 'Nuevo proveedor' : form.name}</h1>
        <Link to="/proveedores" className="btn btn-texto"><ArrowLeft size={22} aria-hidden="true" /> Volver</Link>
      </div>
      {error && <Notice type="error">{error}</Notice>}

      <div className="card">
        <h2>Datos</h2>
        <div className="grid-2">
          <Field label="Nombre"><TextInput value={form.name} onChange={(v) => set({ name: v })} placeholder="Calibroscopio" autoFocus={isNew} /></Field>
          <Field label="Razón social (opcional)"><TextInput value={form.legalName} onChange={(v) => set({ legalName: v })} /></Field>
          <Field label="CUIT (opcional)"><TextInput value={form.cuit} onChange={(v) => set({ cuit: v })} inputMode="numeric" placeholder="30-12345678-9" /></Field>
          <Field label="Teléfono"><input type="tel" value={form.phone || ''} onChange={(e) => set({ phone: e.target.value })} /></Field>
          <Field label="Email"><input type="email" value={form.email || ''} onChange={(e) => set({ email: e.target.value })} /></Field>
          <Field label="Sitio web"><input type="url" value={form.website || ''} onChange={(e) => set({ website: e.target.value })} placeholder="https://" /></Field>
        </div>
      </div>

      <div className="card">
        <h2>Precios</h2>
        <div className="grid-2">
          <Field label="Descuento habitual (opcional)" help="El descuento que nos hace sobre el precio de lista (PVP). Se propone al cargar productos de este proveedor.">
            <PercentInput value={form.usualDiscount} onChange={(v) => set({ usualDiscount: v })} />
          </Field>
          <Field label="Recargo para este proveedor (opcional)" help={`Si lo dejás vacío, se usa el de la categoría o el general (${formatPercent(settings.defaultMarkup)}).`}>
            <PercentInput value={form.defaultMarkup} onChange={(v) => set({ defaultMarkup: v })} />
          </Field>
        </div>
        <Checkbox checked={form.addVat} onChange={(v) => set({ addVat: v })}>
          Factura sin IVA: sumar {settings.vatPct} % de IVA al costo
        </Checkbox>
        <Field label="Notas (opcional)">
          <textarea value={form.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>

      <div className="row" style={{ marginBottom: '2rem' }}>
        <button type="submit" className="btn btn-principal btn-grande"><Save size={22} aria-hidden="true" /> Guardar</button>
        <Link to="/proveedores" className="btn btn-grande">Cancelar</Link>
        <span className="spacer" />
        {!isNew && <button type="button" className="btn btn-peligro" onClick={onDelete}><Trash2 size={20} aria-hidden="true" /> Borrar proveedor</button>}
      </div>

      {!isNew && (
        <>
          <div className="card">
            <h2>Productos que nos vende ({theirProducts.length})</h2>
            {theirProducts.length === 0 ? (
              <p className="muted">Todavía no hay productos de este proveedor.</p>
            ) : (
              <div className="list">
                {theirProducts.map((p) => (
                  <Link key={p.id} to={`/productos/${p.id}`} className="list-item">
                    <div className="list-item-main">
                      <div className="list-item-title">{p.name}</div>
                      <div className="list-item-sub">Costo {formatMoney(p.cost)} · Venta {formatMoney(p.salePrice)}</div>
                    </div>
                    <StockBadge product={p} stock={stockMap.get(p.id) || 0} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2>Historial de compras</h2>
            {pendingTotal > 0 && (
              <Notice type="aviso">Cuenta corriente: falta pagar <strong>{formatMoney(pendingTotal)}</strong> en {pending.length} {pending.length === 1 ? 'compra' : 'compras'}.</Notice>
            )}
            {!purchases?.length ? (
              <p className="muted">Todavía no hay compras registradas.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Fecha</th><th>Factura</th><th className="num">Unidades</th><th className="num">Total</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {purchases.map((p) => (
                      <tr key={p.id}>
                        <td><Link to={`/compras/${p.id}`}>{formatDate(p.date)}</Link></td>
                        <td>{p.invoiceNumber || '—'}</td>
                        <td className="num">{p.items.reduce((s, i) => s + Number(i.qty), 0)}</td>
                        <td className="num">{formatMoney(p.total)}</td>
                        <td>
                          <PaymentBadge purchase={p} />
                          {!p.paid && (
                            <button type="button" className="btn btn-chico btn-texto no-print" onClick={async () => { await setPurchasePaid(p.id, true); toast('Marcada como pagada'); }}>
                              Marcar pagada
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </form>
  );
}
