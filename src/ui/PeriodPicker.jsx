// Selector de período para los informes: día, semana, mes o rango de fechas.
// El período queda en la dirección (por ejemplo ?modo=mes&dia=2026-11-02),
// así al volver atrás se mantiene lo que se estaba mirando.

import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ChoiceGroup } from './components.jsx';
import { periodRange, shiftPeriod } from '../logic/reports.js';
import { todayIso } from '../db/ids.js';

const LABELS = { dia: 'Día', semana: 'Semana', mes: 'Mes', rango: 'Elegir fechas' };

export function usePeriod(defaultMode = 'mes') {
  const [params, setParams] = useSearchParams();
  const mode = params.get('modo') || defaultMode;
  const ref = params.get('dia') || todayIso();
  const from = params.get('desde') || '';
  const to = params.get('hasta') || '';
  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };
  return {
    mode,
    ref,
    from,
    to,
    range: periodRange(mode, ref, from || ref, to || ref),
    setMode: (m) => update({ modo: m, desde: m === 'rango' ? from || periodRange(mode, ref).from : '', hasta: m === 'rango' ? to || periodRange(mode, ref).to : '' }),
    shift: (delta) => update({ dia: shiftPeriod(mode, ref, delta) }),
    setRange: (desde, hasta) => update({ desde, hasta }),
    goToday: () => update({ dia: '' }),
  };
}

export default function PeriodPicker({ period, modes = ['dia', 'semana', 'mes', 'rango'] }) {
  const { mode, range } = period;
  return (
    <div className="card no-print">
      <ChoiceGroup options={modes.map((m) => ({ value: m, label: LABELS[m] }))} value={mode} onChange={period.setMode} />
      {mode === 'rango' ? (
        <div className="row" style={{ marginTop: '0.75rem' }}>
          <label className="field" style={{ flex: '1 1 160px', margin: 0 }}>
            <span className="field-label">Desde</span>
            <input type="date" value={range.from} onChange={(e) => period.setRange(e.target.value, range.to)} />
          </label>
          <label className="field" style={{ flex: '1 1 160px', margin: 0 }}>
            <span className="field-label">Hasta</span>
            <input type="date" value={range.to} onChange={(e) => period.setRange(range.from, e.target.value)} />
          </label>
        </div>
      ) : (
        <div className="row" style={{ marginTop: '0.75rem' }}>
          <button type="button" className="btn btn-chico" onClick={() => period.shift(-1)} aria-label="Período anterior"><ChevronLeft size={20} aria-hidden="true" /> Anterior</button>
          <strong className="spacer center">{range.label}</strong>
          <button type="button" className="btn btn-chico" onClick={() => period.shift(1)} aria-label="Período siguiente">Siguiente <ChevronRight size={20} aria-hidden="true" /></button>
        </div>
      )}
      {mode !== 'rango' && period.ref !== todayIso() && (
        <button type="button" className="btn btn-chico btn-texto" onClick={period.goToday} style={{ marginTop: '0.5rem' }}>Volver a hoy</button>
      )}
    </div>
  );
}
