// Piezas de interfaz reutilizables: campos, avisos, elecciones.

import { useEffect, useId, useState } from 'react';
import { Info, AlertTriangle, CircleCheck, CircleX } from 'lucide-react';
import { parseNumber } from '../logic/money.js';

export function Field({ label, help, error, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {help && <span className="field-help">{help}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function TextInput({ value, onChange, suggestions, ...props }) {
  const listId = useId();
  return (
    <>
      <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} list={suggestions?.length ? listId : undefined} {...props} />
      {suggestions?.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
    </>
  );
}

/** Campo numérico que acepta "12.500,50". Devuelve número o null. */
export function NumberInput({ value, onChange, className = '', ...props }) {
  const [text, setText] = useState(value === null || value === undefined ? '' : formatEditable(value));
  useEffect(() => {
    // Si el valor cambia desde afuera (por ejemplo, "Usar sugerido"), actualizamos lo que se ve.
    if (parseNumber(text) !== (value ?? null)) setText(value === null || value === undefined ? '' : formatEditable(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseNumber(e.target.value));
      }}
      {...props}
    />
  );
}

function formatEditable(n) {
  return Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2, useGrouping: false });
}

export function MoneyInput(props) {
  return (
    <div className="input-money">
      <NumberInput {...props} />
    </div>
  );
}

export function PercentInput(props) {
  return (
    <div className="input-percent">
      <NumberInput {...props} />
    </div>
  );
}

export function Checkbox({ checked, onChange, children }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/** Botones grandes para elegir una opción (en lugar de un desplegable). */
export function ChoiceGroup({ options, value, onChange }) {
  return (
    <div className="choice-group" role="radiogroup">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={`choice ${value === o.value ? 'selected' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const NOTICE_ICONS = { info: Info, aviso: AlertTriangle, ok: CircleCheck, error: CircleX };

export function Notice({ type = 'info', children }) {
  const Icon = NOTICE_ICONS[type];
  return (
    <div className={`notice notice-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon size={22} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="card center" style={{ padding: '2rem 1.25rem' }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <div className="muted">{children}</div>
    </div>
  );
}
