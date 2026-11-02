// Crear o editar una categoría y sus campos extra.

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Save, ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { db } from '../db/db.js';
import { saveCategory } from '../db/repo.js';
import { Field, TextInput, PercentInput, Checkbox, Notice } from '../ui/components.jsx';
import { useToast, useConfirm } from '../ui/feedback.jsx';
import { useSettings } from '../ui/useData.js';
import { slugify } from '../logic/text.js';
import { formatPercent } from '../logic/money.js';

export default function CategoryEditPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const settings = useSettings();
  const stored = useLiveQuery(() => (id ? db.categories.get(id) : null), [id]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew && !form) setForm({ name: '', active: true, defaultMarkup: null, fields: [] });
    if (!isNew && stored && !form) setForm({ ...stored, fields: (stored.fields || []).map((f) => ({ ...f, suggestionsText: (f.suggestions || []).join(', ') })) });
  }, [isNew, stored, form]);

  if (!form || !settings) return null;

  const set = (changes) => setForm((f) => ({ ...f, ...changes }));
  const setFieldAt = (i, changes) => setForm((f) => ({ ...f, fields: f.fields.map((x, j) => (j === i ? { ...x, ...changes } : x)) }));
  const move = (i, delta) =>
    setForm((f) => {
      const fields = [...f.fields];
      const j = i + delta;
      if (j < 0 || j >= fields.length) return f;
      [fields[i], fields[j]] = [fields[j], fields[i]];
      return { ...f, fields };
    });

  async function removeField(i) {
    const ok = await confirm({
      title: '¿Quitar este dato?',
      message: `Se deja de mostrar "${form.fields[i].label || 'este dato'}" en los productos. Lo que ya estaba cargado no se pierde: si lo volvés a agregar con el mismo nombre, reaparece.`,
      confirmText: 'Quitar',
      danger: true,
    });
    if (ok) setForm((f) => ({ ...f, fields: f.fields.filter((_, j) => j !== i) }));
  }

  async function onSave(e) {
    e.preventDefault();
    setError('');
    const fields = form.fields
      .filter((f) => f.label.trim())
      .map(({ suggestionsText, ...f }) => ({
        ...f,
        label: f.label.trim(),
        // La clave interna se arma una sola vez, así renombrar el dato no pierde lo cargado.
        key: f.key || slugify(f.label),
        suggestions: (suggestionsText || '').split(',').map((s) => s.trim()).filter(Boolean),
      }));
    try {
      await saveCategory({ ...form, fields });
      toast(isNew ? 'Categoría creada' : 'Cambios guardados');
      navigate('/categorias');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={onSave}>
      <div className="page-header">
        <h1>{isNew ? 'Nueva categoría' : form.name}</h1>
        <Link to="/categorias" className="btn btn-texto"><ArrowLeft size={22} aria-hidden="true" /> Volver</Link>
      </div>
      {error && <Notice type="error">{error}</Notice>}

      <div className="card">
        <Field label="Nombre">
          <TextInput value={form.name} onChange={(v) => set({ name: v })} placeholder="Papelería" autoFocus={isNew} />
        </Field>
        <Field label="Recargo para esta categoría (opcional)" help={`Si lo dejás vacío se usa el general (${formatPercent(settings.defaultMarkup)}). El recargo de un proveedor tiene prioridad sobre este.`}>
          <PercentInput value={form.defaultMarkup} onChange={(v) => set({ defaultMarkup: v })} />
        </Field>
        <Checkbox checked={form.active !== false} onChange={(v) => set({ active: v })}>
          Activa (si la desactivás, no se ofrece al cargar productos nuevos)
        </Checkbox>
      </div>

      <div className="card">
        <h2>Datos extra de los productos</h2>
        <p className="muted small">Por ejemplo "Autor" o "Edad recomendada". Las sugerencias aparecen como opciones al escribir, separadas por comas.</p>
        {form.fields.length === 0 && <p className="muted">Esta categoría no tiene datos extra.</p>}
        {form.fields.map((f, i) => (
          <div key={f.key || `nuevo-${i}`} className="card" style={{ background: 'var(--color-fondo)' }}>
            <div className="grid-2">
              <Field label="Nombre del dato">
                <TextInput value={f.label} onChange={(v) => setFieldAt(i, { label: v })} />
              </Field>
              <Field label="Tipo">
                <select value={f.type} onChange={(e) => setFieldAt(i, { type: e.target.value })}>
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                </select>
              </Field>
            </div>
            {f.type === 'text' && (
              <Field label="Sugerencias (opcional)">
                <TextInput value={f.suggestionsText || ''} onChange={(v) => setFieldAt(i, { suggestionsText: v })} placeholder="Juego de mesa, Rompecabezas" />
              </Field>
            )}
            <div className="row">
              <button type="button" className="btn btn-chico" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={18} aria-hidden="true" /> Subir</button>
              <button type="button" className="btn btn-chico" onClick={() => move(i, 1)} disabled={i === form.fields.length - 1}><ArrowDown size={18} aria-hidden="true" /> Bajar</button>
              <span className="spacer" />
              <button type="button" className="btn btn-chico btn-peligro" onClick={() => removeField(i)}><Trash2 size={18} aria-hidden="true" /> Quitar</button>
            </div>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => set({ fields: [...form.fields, { key: '', label: '', type: 'text', suggestionsText: '' }] })}>
          <Plus size={20} aria-hidden="true" /> Agregar dato
        </button>
      </div>

      <div className="row" style={{ marginBottom: '2rem' }}>
        <button type="submit" className="btn btn-principal btn-grande"><Save size={22} aria-hidden="true" /> Guardar</button>
        <Link to="/categorias" className="btn btn-grande">Cancelar</Link>
      </div>
    </form>
  );
}
