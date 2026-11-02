// Gastos del negocio (packaging, impuestos, comisiones...), por mes.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { db } from '../db/db.js';
import { saveExpense, deleteExpense } from '../db/cash.js';
import { useSettings } from '../ui/useData.js';
import { Field, TextInput, MoneyInput, Checkbox, Notice, EmptyState } from '../ui/components.jsx';
import { useToast, useConfirm } from '../ui/feedback.jsx';
import PeriodPicker, { usePeriod } from '../ui/PeriodPicker.jsx';
import ReportActions from '../ui/ReportActions.jsx';
import PrintHeader from '../ui/PrintHeader.jsx';
import { formatMoney } from '../logic/money.js';
import { todayIso, formatDate } from '../db/ids.js';

const empty = () => ({ date: todayIso(), description: '', amount: null, category: '', fromCash: false });

export default function ExpensesPage() {
  const settings = useSettings();
  const period = usePeriod('mes');
  const all = useLiveQuery(() => db.expenses.toArray(), []);
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState(null); // null = cerrado
  const [error, setError] = useState('');

  if (!settings || !all) return null;
  const { from, to, label } = period.range;
  const list = all.filter((e) => !e.deleted && e.date >= from && e.date <= to).sort((a, b) => b.date.localeCompare(a.date));
  const total = list.reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = [...list.reduce((m, e) => m.set(e.category || 'Otros', (m.get(e.category || 'Otros') || 0) + Number(e.amount)), new Map())].sort((a, b) => b[1] - a[1]);
  const categories = form?.category && !settings.expenseCategories.includes(form.category) ? [...settings.expenseCategories, form.category] : settings.expenseCategories;

  async function onSave(e) {
    e.preventDefault();
    setError('');
    try {
      await saveExpense({ ...form, category: form.category || 'Otros' });
      toast(form.id ? 'Gasto actualizado' : 'Gasto anotado');
      setForm(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function onDelete(exp) {
    if (!(await confirm({ title: '¿Borrar este gasto?', message: `${exp.description}: ${formatMoney(exp.amount)}`, confirmText: 'Borrar', danger: true }))) return;
    await deleteExpense(exp.id);
    setForm(null);
    toast('Gasto borrado');
  }

  const excel = () => ({
    filename: `gastos-${from}-a-${to}.xlsx`,
    sheets: [{
      name: 'Gastos',
      rows: [['Fecha', 'Descripción', 'Categoría', 'Monto', 'Pagado con la caja'], ...list.map((e) => [formatDate(e.date), e.description, e.category, e.amount, e.fromCash ? 'Sí' : 'No']), [], ['', '', 'Total', total]],
      widths: [12, 40, 22, 14, 18],
    }],
  });

  return (
    <>
      <PrintHeader title="Gastos" subtitle={label} />
      <div className="page-header">
        <h1>Gastos</h1>
        {!form && <button type="button" className="btn btn-principal" onClick={() => setForm(empty())}><Plus size={22} aria-hidden="true" /> Anotar gasto</button>}
      </div>
      <p className="muted no-print">Packaging, impuestos, comisiones de cobro… Se restan de la ganancia para calcular la <Link to="/informes/ganancias">ganancia neta</Link>.</p>

      {form && (
        <form className="card no-print" onSubmit={onSave}>
          <h2>{form.id ? 'Editar gasto' : 'Nuevo gasto'}</h2>
          {error && <Notice type="error">{error}</Notice>}
          <div className="grid-2">
            <Field label="Qué fue"><TextInput value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Bolsas de papel" autoFocus /></Field>
            <Field label="Monto"><MoneyInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} /></Field>
            <Field label="Fecha"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Categoría">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Elegí una</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Checkbox checked={form.fromCash} onChange={(v) => setForm({ ...form, fromCash: v })}>Lo pagué con efectivo de la caja</Checkbox>
          <p className="small muted">Las categorías se cambian en <Link to="/configuracion">Configuración</Link>.</p>
          <div className="row">
            <button type="submit" className="btn btn-principal"><Save size={20} aria-hidden="true" /> Guardar</button>
            <button type="button" className="btn" onClick={() => setForm(null)}><X size={20} aria-hidden="true" /> Cancelar</button>
            <span className="spacer" />
            {form.id && <button type="button" className="btn btn-peligro" onClick={() => onDelete(form)}><Trash2 size={20} aria-hidden="true" /> Borrar</button>}
          </div>
        </form>
      )}

      <PeriodPicker period={period} modes={['mes', 'rango']} />
      <ReportActions build={excel} />

      <div className="grid">
        <div className="card"><div className="stat-label">Total de gastos</div><div className="stat-value">{formatMoney(total)}</div><div className="small muted">{list.length} {list.length === 1 ? 'gasto' : 'gastos'}</div></div>
        {byCategory.length > 0 && (
          <div className="card">
            <div className="stat-label">Por categoría</div>
            {byCategory.map(([c, v]) => <div key={c} className="totals-row"><span>{c}</span><span>{formatMoney(v)}</span></div>)}
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState title="No hay gastos en este período">Anotá los gastos para saber cuánto se gana de verdad.</EmptyState>
      ) : (
        <div className="list">
          {list.map((e) => (
            <button type="button" key={e.id} className="list-item picker-item" onClick={() => setForm({ ...e })}>
              <div className="list-item-main">
                <div className="list-item-title">{e.description}</div>
                <div className="list-item-sub">{formatDate(e.date)} · {e.category}{e.fromCash ? ' · con plata de la caja' : ''}</div>
              </div>
              <strong>{formatMoney(e.amount)}</strong>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
