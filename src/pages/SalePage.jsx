// Cargar venta (y modo feria, y editar una venta existente), en un solo paso:
// buscar → tocar para agregar → ajustar cantidad → forma de pago → confirmar.

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Trash2, Tent, ArrowLeft, AlertTriangle } from 'lucide-react';
import { db } from '../db/db.js';
import { saveSale, saleItemFromProduct } from '../db/sales.js';
import { useProducts, useStockMap, useSettings, useDevice, useSales } from '../ui/useData.js';
import { Field, TextInput, MoneyInput, NumberInput, ChoiceGroup, Notice } from '../ui/components.jsx';
import { useToast, useConfirm } from '../ui/feedback.jsx';
import ProductPicker from '../ui/ProductPicker.jsx';
import { computeSaleTotals, stockShortages, toLocalDateTime, dayOf, isActiveSale, soldUnitsMap } from '../logic/sales.js';
import { isLowStock } from '../logic/stock.js';
import { formatMoney } from '../logic/money.js';
import { todayIso } from '../db/ids.js';

const FERIA = 'Feria';

function emptySale(mode) {
  return {
    date: '', // vacío = "ahora" al confirmar
    items: [],
    paymentMethod: '',
    channel: mode === 'feria' ? FERIA : '',
    customer: '',
    note: '',
    shipping: { mode: '', amount: null },
    discount: { type: 'monto', value: null },
    mode,
  };
}

export default function SalePage({ mode = 'normal' }) {
  const { id } = useParams(); // si hay id, se está editando una venta
  const isEdit = !!id;
  const isFeria = mode === 'feria';
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const products = useProducts();
  const stockMap = useStockMap();
  const settings = useSettings();
  const device = useDevice();
  const sales = useSales();
  const original = useLiveQuery(() => (id ? db.sales.get(id) : null), [id]);

  const [sale, setSale] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Estado inicial: venta vacía (con la última forma de pago) o la venta a editar.
  useEffect(() => {
    if (sale || !device) return;
    if (isEdit) {
      if (original) setSale({ ...original, discount: original.discount || { type: 'monto', value: null }, shipping: original.shipping || { mode: '', amount: null } });
      return;
    }
    const s = emptySale(mode);
    s.paymentMethod = (isFeria ? device.lastFeriaPaymentMethod : device.lastPaymentMethod) || '';
    if (!isFeria) s.channel = device.lastChannel || '';
    setSale(s);
  }, [sale, device, isEdit, original, mode, isFeria]);

  const soldOrder = useMemo(() => (sales ? soldUnitsMap(sales) : new Map()), [sales]);

  if (isEdit && original === null) return <Notice type="error">No encontramos esta venta. <Link to="/ventas">Volver a ventas</Link></Notice>;
  if (!sale || !products || !stockMap || !settings || !sales) return null;

  const set = (changes) => setSale((s) => ({ ...s, ...changes }));
  const totals = computeSaleTotals(sale);
  const shortages = stockShortages(sale.items, stockMap, isEdit ? original?.items : []);
  const shortageOf = (productId) => shortages.find((x) => x.productId === productId);

  const today = todayIso();
  const feriaToday = sales.filter((s) => isActiveSale(s) && s.mode === 'feria' && dayOf(s.date) === today);
  const feriaTotal = feriaToday.reduce((sum, s) => sum + s.totals.total, 0);

  function addProduct(product) {
    setError('');
    setSale((s) => {
      const existing = s.items.find((i) => i.productId === product.id);
      if (existing) return { ...s, items: s.items.map((i) => (i.productId === product.id ? { ...i, qty: i.qty + 1 } : i)) };
      return { ...s, items: [...s.items, saleItemFromProduct(product, 1)] };
    });
  }
  const setQty = (productId, qty) => set({ items: sale.items.map((i) => (i.productId === productId ? { ...i, qty: Math.max(0, qty || 0) } : i)) });
  const removeItem = (productId) => set({ items: sale.items.filter((i) => i.productId !== productId) });

  async function onConfirm() {
    setError('');
    if (!sale.items.length) return setError('Agregá al menos un producto.');
    if (sale.items.some((i) => !(i.qty > 0))) return setError('Hay un producto con cantidad 0. Sacalo o poné una cantidad.');
    if (!sale.paymentMethod) return setError('Elegí la forma de pago.');
    if (shortages.length) {
      const names = shortages.map((s) => `${sale.items.find((i) => i.productId === s.productId)?.name} (hay ${Math.max(0, s.available)}, vendés ${s.wanted})`).join(', ');
      const ok = await confirm({
        title: 'No alcanza el stock',
        message: `Según la app no alcanza el stock de: ${names}. Puede que falte cargar una compra. ¿Guardás la venta igual?`,
        confirmText: 'Sí, guardar igual',
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const toSave = { ...sale, date: sale.date || toLocalDateTime() };
      if (!toSave.discount?.value) toSave.discount = null;
      const saved = await saveSale(toSave);
      if (isEdit) {
        toast('Cambios guardados');
        navigate(`/ventas/${saved.id}`);
        return;
      }
      // Avisamos si algún producto quedó con stock bajo.
      const low = sale.items
        .map((i) => ({ i, p: products.find((p) => p.id === i.productId) }))
        .filter(({ i, p }) => p && isLowStock(p, (stockMap.get(p.id) || 0) - i.qty));
      toast(low.length ? `Venta guardada. Ojo: queda poco de ${low.map(({ p }) => p.name).join(', ')}` : `Venta guardada: ${formatMoney(saved.totals.total)}`);
      const next = emptySale(mode);
      next.paymentMethod = sale.paymentMethod;
      if (!isFeria) next.channel = sale.channel;
      setSale(next);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err.message || 'No se pudo guardar la venta. Probá de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  async function onClear() {
    if (sale.items.length && !(await confirm({ title: '¿Empezar de nuevo?', message: 'Se borra lo que cargaste en esta venta (todavía no se guardó).', confirmText: 'Sí, vaciar', danger: true }))) return;
    const next = emptySale(mode);
    next.paymentMethod = sale.paymentMethod;
    if (!isFeria) next.channel = sale.channel;
    setSale(next);
  }

  const channels = settings.salesChannels.includes(sale.channel) || !sale.channel ? settings.salesChannels : [...settings.salesChannels, sale.channel];
  const payments = settings.paymentMethods.includes(sale.paymentMethod) || !sale.paymentMethod ? settings.paymentMethods : [...settings.paymentMethods, sale.paymentMethod];

  return (
    <>
      <div className="page-header">
        <h1>{isEdit ? 'Editar venta' : isFeria ? 'Modo feria' : 'Cargar venta'}</h1>
        {isEdit ? (
          <Link to={`/ventas/${id}`} className="btn btn-texto"><ArrowLeft size={22} aria-hidden="true" /> Volver</Link>
        ) : isFeria ? (
          <Link to="/vender" className="btn btn-chico">Salir del modo feria</Link>
        ) : (
          <Link to="/feria" className="btn btn-chico"><Tent size={20} aria-hidden="true" /> Modo feria</Link>
        )}
      </div>

      {isFeria && (
        <div className="feria-counter" role="status">
          <span>Hoy en la feria: {feriaToday.length} {feriaToday.length === 1 ? 'venta' : 'ventas'}</span>
          <span>Total: {formatMoney(feriaTotal)}</span>
        </div>
      )}
      {isEdit && <Notice type="info">Los cambios quedan registrados en el historial de la venta.</Notice>}

      <div style={{ marginTop: '1rem' }}>
        <ProductPicker
          products={products}
          stockMap={stockMap}
          onPick={addProduct}
          grid={isFeria}
          order={soldOrder}
          autoFocus={!isFeria && !isEdit}
        />
      </div>

      <div className="card">
        <h2>Productos</h2>
        {sale.items.length === 0 ? (
          <p className="muted">Buscá un producto arriba y tocalo para agregarlo.</p>
        ) : (
          sale.items.map((item) => {
            const short = shortageOf(item.productId);
            return (
              <div key={item.productId} className="cart-line">
                <div className="cart-line-main">
                  <div className="list-item-title">{item.name}</div>
                  <div className="small muted">{formatMoney(item.unitPrice)} c/u</div>
                  {short && (
                    <div className="small texto-error"><AlertTriangle size={16} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> Stock según la app: {Math.max(0, short.available)}</div>
                  )}
                </div>
                <div className="qty">
                  <button type="button" onClick={() => setQty(item.productId, item.qty - 1)} aria-label={`Uno menos de ${item.name}`}>−</button>
                  <NumberInput value={item.qty} onChange={(v) => setQty(item.productId, v)} aria-label={`Cantidad de ${item.name}`} />
                  <button type="button" onClick={() => setQty(item.productId, item.qty + 1)} aria-label={`Uno más de ${item.name}`}>+</button>
                </div>
                <div className="cart-line-total">{formatMoney(item.qty * item.unitPrice)}</div>
                <button type="button" className="btn btn-chico btn-texto" onClick={() => removeItem(item.productId)} aria-label={`Sacar ${item.name}`}>
                  <Trash2 size={18} aria-hidden="true" /> Sacar
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="card">
        <Field label="Forma de pago">
          <ChoiceGroup options={payments.map((p) => ({ value: p, label: p }))} value={sale.paymentMethod} onChange={(v) => set({ paymentMethod: v })} />
        </Field>
        {!isFeria && (
          <Field label="Canal de venta">
            <ChoiceGroup options={channels.map((c) => ({ value: c, label: c }))} value={sale.channel} onChange={(v) => set({ channel: v })} />
          </Field>
        )}

        <details className="more" open={isEdit || undefined}>
          <summary>Más datos (opcional): fecha, cliente, envío, descuento</summary>
          <div className="grid-2" style={{ marginTop: '0.5rem' }}>
            <Field label="Fecha y hora" help="Dejalo vacío para usar ahora. Cambialo para cargar ventas de otros días.">
              <input type="datetime-local" value={sale.date} onChange={(e) => set({ date: e.target.value })} />
            </Field>
            <Field label="Nombre del cliente">
              <TextInput value={sale.customer} onChange={(v) => set({ customer: v })} />
            </Field>
          </div>
          <Field label="Retiro o envío">
            <ChoiceGroup
              options={[{ value: '', label: 'No aplica' }, { value: 'retiro', label: 'Retira' }, { value: 'envio', label: 'Envío' }]}
              value={sale.shipping.mode}
              onChange={(v) => set({ shipping: { ...sale.shipping, mode: v } })}
            />
          </Field>
          {sale.shipping.mode === 'envio' && (
            <Field label="Monto del envío" help="Se cobra aparte y no cuenta como ganancia de los productos.">
              <MoneyInput value={sale.shipping.amount} onChange={(v) => set({ shipping: { ...sale.shipping, amount: v } })} />
            </Field>
          )}
          <div className="grid-2">
            <Field label="Descuento">
              <ChoiceGroup
                options={[{ value: 'monto', label: 'En pesos' }, { value: 'porcentaje', label: 'En %' }]}
                value={sale.discount?.type || 'monto'}
                onChange={(v) => set({ discount: { ...sale.discount, type: v } })}
              />
            </Field>
            <Field label={sale.discount?.type === 'porcentaje' ? 'Porcentaje de descuento' : 'Monto de descuento'}>
              <NumberInput value={sale.discount?.value ?? null} onChange={(v) => set({ discount: { ...sale.discount, value: v } })} />
            </Field>
          </div>
          <Field label="Nota">
            <TextInput value={sale.note} onChange={(v) => set({ note: v })} />
          </Field>
        </details>
      </div>

      <div className="card totals">
        <div className="totals-row"><span>Productos ({totals.units})</span><span>{formatMoney(totals.subtotal)}</span></div>
        {totals.discount > 0 && <div className="totals-row"><span>Descuento</span><span>− {formatMoney(totals.discount)}</span></div>}
        {totals.shipping > 0 && <div className="totals-row muted"><span>Envío (aparte)</span><span>+ {formatMoney(totals.shipping)}</span></div>}
        <div className="totals-row totals-final"><span>Total a cobrar</span><span>{formatMoney(totals.total)}</span></div>
      </div>

      {error && <Notice type="error">{error}</Notice>}

      <div className="sticky-confirm row">
        <button type="button" className="btn btn-principal btn-grande" style={{ flex: '1 1 260px' }} onClick={onConfirm} disabled={saving}>
          <Check size={26} aria-hidden="true" /> {isEdit ? 'Guardar cambios' : `Confirmar venta · ${formatMoney(totals.total)}`}
        </button>
        {!isEdit && sale.items.length > 0 && (
          <button type="button" className="btn btn-grande" onClick={onClear}>Vaciar</button>
        )}
      </div>
    </>
  );
}
