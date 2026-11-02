// Botones "Descargar Excel" e "Imprimir" de los informes y listados.
// build() devuelve { filename, sheets } (ver downloadSpreadsheet en excel.js).

import { useState } from 'react';
import { FileSpreadsheet, Printer } from 'lucide-react';
import { downloadSpreadsheet } from './excel.js';
import { useToast } from './feedback.jsx';

export default function ReportActions({ build }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onExcel() {
    setBusy(true);
    try {
      const { filename, sheets } = build();
      await downloadSpreadsheet(filename, sheets);
      toast('Excel descargado');
    } catch (err) {
      console.error(err);
      toast('No se pudo armar el Excel. Probá de nuevo.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row no-print" style={{ marginBottom: '1rem' }}>
      <button type="button" className="btn btn-chico" onClick={onExcel} disabled={busy}><FileSpreadsheet size={20} aria-hidden="true" /> Descargar Excel</button>
      <button type="button" className="btn btn-chico" onClick={() => window.print()}><Printer size={20} aria-hidden="true" /> Imprimir</button>
    </div>
  );
}
