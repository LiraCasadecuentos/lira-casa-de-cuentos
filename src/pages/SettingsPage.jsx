// Configuración general, listas editables, datos de ejemplo y borrar todo.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Save, Sparkles, Trash2, Plus, X } from 'lucide-react';
import { useSettings } from '../ui/useData.js';
import { updateSettings } from '../db/repo.js';
import { eraseAllData } from '../db/backup.js';
import { hasSampleData, loadSampleData, removeSampleData } from '../db/sample.js';
import { Field, TextInput, NumberInput, PercentInput, Checkbox, ChoiceGroup, Notice } from '../ui/components.jsx';
import { useToast, useConfirm } from '../ui/feedback.jsx';

const ROUNDING = [
  { value: 0, label: 'Sin redondeo' },
  { value: 10, label: '$ 10' },
  { value: 50, label: '$ 50' },
  { value: 100, label: '$ 100' },
  { value: 500, label: '$ 500' },
];

/** Editor simple de una lista de textos (canales de venta, formas de pago...). */
function ListEditor({ items, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v || items.some((i) => i.toLowerCase() === v.toLowerCase())) return;
    onChange([...items, v]);
    setDraft('');
  };
  return (
    <div>
      <div className="row" style={{ marginBottom: '0.5rem' }}>
        {items.map((item, i) => (
          <span key={i} className="badge" style={{ fontSize: '0.95rem', padding: '0.3rem 0.4rem 0.3rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <input
              aria-label="Nombre"
              value={item}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              style={{ border: 'none', background: 'transparent', font: 'inherit', width: `${Math.max(item.length, 4) + 1}ch`, minHeight: 0, padding: 0 }}
            />
            <button type="button" className="btn btn-chico btn-texto" style={{ minHeight: 32, padding: '0 0.3rem' }} onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Quitar ${item}`}>
              <X size={18} aria-hidden="true" /> Quitar
            </button>
          </span>
        ))}
      </div>
      <div className="row">
        <div style={{ flex: '1 1 200px' }}>
          <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        </div>
        <button type="button" className="btn" onClick={add}><Plus size={20} aria-hidden="true" /> Agregar</button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const settings = useSettings();
  const sample = useLiveQuery(() => hasSampleData(), []);
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);

  if (!form) return null;
  const set = (changes) => setForm((f) => ({ ...f, ...changes }));

  async function onSave(e) {
    e.preventDefault();
    const clean = (list) => list.map((x) => x.trim()).filter(Boolean);
    await updateSettings({
      ...form,
      businessName: form.businessName.trim() || 'Lira. Casa de cuentos',
      defaultMarkup: form.defaultMarkup ?? 100,
      vatPct: form.vatPct ?? 21,
      backupReminderDays: form.backupReminderDays || 7,
      salesChannels: clean(form.salesChannels),
      paymentMethods: clean(form.paymentMethods),
      expenseCategories: clean(form.expenseCategories),
    });
    toast('Configuración guardada');
  }

  async function onSample() {
    if (sample) {
      const ok = await confirm({ title: '¿Borrar los datos de ejemplo?', message: 'Se borran solo los productos, proveedores y compras de ejemplo. Lo que cargaste vos no se toca.', confirmText: 'Sí, borrar', danger: true });
      if (!ok) return;
      const n = await removeSampleData();
      toast(`Se borraron ${n} datos de ejemplo`);
    } else {
      await loadSampleData();
      toast('Se cargaron los datos de ejemplo');
    }
  }

  async function onEraseAll() {
    const first = await confirm({
      title: '¿Borrar TODOS los datos?',
      message: 'Se borran todos los productos, proveedores, compras y ventas de este dispositivo. Antes, hacé un respaldo por las dudas.',
      confirmText: 'Quiero borrar todo',
      danger: true,
    });
    if (!first) return;
    const second = await confirm({
      title: 'Última confirmación',
      message: 'Esto no se puede deshacer (salvo que tengas un respaldo). ¿Seguro que querés borrar todo?',
      confirmText: 'Sí, borrar todo',
      cancelText: 'No, mejor no',
      danger: true,
    });
    if (!second) return;
    await eraseAllData();
    setForm(null);
    toast('Se borraron todos los datos');
  }

  return (
    <>
      <h1>Configuración</h1>
      <form onSubmit={onSave}>
        <div className="card">
          <h2>Negocio</h2>
          <Field label="Nombre del negocio"><TextInput value={form.businessName} onChange={(v) => set({ businessName: v })} /></Field>
        </div>

        <div className="card">
          <h2>Precios</h2>
          <div className="grid-2">
            <Field label="Recargo general sobre el costo" help="Se usa si el producto, su proveedor o su categoría no tienen uno propio. 100 % = el precio es el doble del costo.">
              <PercentInput value={form.defaultMarkup} onChange={(v) => set({ defaultMarkup: v })} />
            </Field>
            <Field label="IVA a sumar" help="Para los proveedores que facturan sin IVA.">
              <PercentInput value={form.vatPct} onChange={(v) => set({ vatPct: v })} />
            </Field>
          </div>
          <Field label="Redondear el precio sugerido hacia arriba a">
            <ChoiceGroup options={ROUNDING} value={Number(form.roundingStep)} onChange={(v) => set({ roundingStep: v })} />
          </Field>
          <p className="small muted">Para cambiar el recargo de una categoría, andá a <Link to="/categorias">Categorías</Link>. El de un proveedor, en su ficha.</p>
        </div>

        <div className="card">
          <h2>Listas</h2>
          <h3>Canales de venta</h3>
          <ListEditor items={form.salesChannels} onChange={(v) => set({ salesChannels: v })} placeholder="Mercado Libre" />
          <h3>Formas de pago</h3>
          <ListEditor items={form.paymentMethods} onChange={(v) => set({ paymentMethods: v })} placeholder="Tarjeta de débito" />
          <h3>Categorías de gastos</h3>
          <ListEditor items={form.expenseCategories} onChange={(v) => set({ expenseCategories: v })} placeholder="Envíos" />
          <p className="small muted" style={{ marginTop: '1rem' }}>Las categorías de productos se editan en <Link to="/categorias">Categorías</Link>.</p>
        </div>

        <div className="card">
          <h2>Otros</h2>
          <Field label="Avisar si no se hizo respaldo en (días)">
            <NumberInput value={form.backupReminderDays} onChange={(v) => set({ backupReminderDays: v })} />
          </Field>
          <Checkbox checked={form.useConsignment} onChange={(v) => set({ useConsignment: v })}>
            Usamos productos en consignación (muestra esas opciones en los productos)
          </Checkbox>
        </div>

        <div className="row" style={{ marginBottom: '2rem' }}>
          <button type="submit" className="btn btn-principal btn-grande"><Save size={22} aria-hidden="true" /> Guardar configuración</button>
        </div>
      </form>

      <div className="card">
        <h2>Datos de ejemplo</h2>
        <p>{sample ? 'Hay datos de ejemplo cargados. Borralos antes de empezar a usar la app en serio.' : 'Cargá algunos productos inventados para probar la app.'}</p>
        <button type="button" className={`btn ${sample ? 'btn-peligro' : ''}`} onClick={onSample}>
          {sample ? <><Trash2 size={20} aria-hidden="true" /> Borrar datos de ejemplo</> : <><Sparkles size={20} aria-hidden="true" /> Cargar datos de ejemplo</>}
        </button>
      </div>

      <div className="card" style={{ borderColor: 'var(--color-error)' }}>
        <h2>Borrar todos los datos</h2>
        <Notice type="aviso">Esto borra todo lo de este dispositivo. Los otros dispositivos y los respaldos ya descargados no se tocan.</Notice>
        <button type="button" className="btn btn-peligro" onClick={onEraseAll}><Trash2 size={20} aria-hidden="true" /> Borrar todos los datos</button>
      </div>
    </>
  );
}
