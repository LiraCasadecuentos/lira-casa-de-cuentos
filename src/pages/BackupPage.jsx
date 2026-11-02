// Respaldo: guardar una copia de todo y juntar datos de otros dispositivos.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Upload, Share2 } from 'lucide-react';
import { findDuplicateProducts } from '../logic/merge.js';
import { normalize } from '../logic/text.js';
import { useProducts } from '../ui/useData.js';
import { exportBackup, buildBackup, readBackupFile, importBackup, daysSince } from '../db/backup.js';
import { updateDevice } from '../db/repo.js';
import { useDevice } from '../ui/useData.js';
import { Field, TextInput, Notice } from '../ui/components.jsx';
import { useToast, useConfirm } from '../ui/feedback.jsx';
import { formatDate, todayIso, nowIso } from '../db/ids.js';

const TABLE_LABELS = {
  products: 'productos',
  suppliers: 'proveedores',
  categories: 'categorías',
  stockMoves: 'movimientos de stock',
  purchases: 'compras',
  sales: 'ventas',
  priceHistory: 'cambios de precio',
  expenses: 'gastos',
  cashMoves: 'movimientos de caja',
  cashSessions: 'cajas',
  settings: 'configuración',
};

export default function BackupPage() {
  const device = useDevice();
  const toast = useToast();
  const confirm = useConfirm();
  const [deviceName, setDeviceName] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const products = useProducts();
  const [persisted, setPersisted] = useState(undefined);
  useEffect(() => {
    // Pregunta al navegador si los datos quedan guardados de forma permanente.
    if (!navigator.storage?.persisted) return setPersisted(null);
    navigator.storage.persist?.().catch(() => {}).finally(() => navigator.storage.persisted().then(setPersisted).catch(() => setPersisted(null)));
  }, []);

  if (!device || !products) return null;
  const duplicates = findDuplicateProducts(products, normalize);
  const name = deviceName ?? device.deviceName ?? '';
  const days = daysSince(device.lastBackupAt);
  const canShareFiles = typeof navigator !== 'undefined' && !!navigator.canShare;

  async function onExport() {
    const file = await exportBackup();
    toast(`Respaldo descargado: ${file}`);
  }

  async function onShare() {
    // En celular y tablet: mandarlo directo por WhatsApp, mail, Drive, etc.
    const data = await buildBackup();
    const file = new File([JSON.stringify(data)], `lira-respaldo-${todayIso()}.json`, { type: 'application/json' });
    if (!navigator.canShare({ files: [file] })) {
      toast('Este dispositivo no permite compartir archivos. Usá "Descargar respaldo".', 'error');
      return;
    }
    try {
      await navigator.share({ files: [file], title: 'Respaldo de Lira' });
      await updateDevice({ lastBackupAt: nowIso() });
      toast('Respaldo compartido');
    } catch (err) {
      if (err?.name !== 'AbortError') toast('No se pudo compartir. Probá con "Descargar respaldo".', 'error');
    }
  }

  async function onImport(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setSummary(null);
    try {
      const data = await readBackupFile(file);
      const from = data.deviceName ? `del dispositivo "${data.deviceName}"` : 'de otro dispositivo';
      const ok = await confirm({
        title: '¿Juntar este respaldo?',
        message: `Es un respaldo ${from}, del ${formatDate(data.exportedAt)}. Se agregan los datos que falten acá. No se borra ni se duplica nada.`,
        confirmText: 'Sí, juntar',
      });
      if (!ok) return;
      setSummary(await importBackup(data));
      toast('Respaldo unido');
    } catch (err) {
      setError(err.message || 'No se pudo leer el respaldo.');
    }
  }

  const changes = summary ? Object.entries(summary).filter(([, s]) => s.added || s.updated) : [];

  return (
    <>
      <h1>Respaldo</h1>
      <p>Los datos se guardan solo en este dispositivo. Hacé un respaldo seguido: si se rompe o se pierde el equipo, con el archivo de respaldo se recupera todo.</p>

      {days === null ? (
        <Notice type="aviso">Este dispositivo todavía no tiene ningún respaldo.</Notice>
      ) : (
        <Notice type={days >= 7 ? 'aviso' : 'ok'}>Último respaldo: {formatDate(device.lastBackupAt)} (hace {days} {days === 1 ? 'día' : 'días'}).</Notice>
      )}

      <div className="card">
        <h2>Nombre de este dispositivo</h2>
        <p className="small muted">Así sabés de dónde viene cada respaldo. Por ejemplo: "Compu", "Tablet", "Celu de Ana".</p>
        <div className="row">
          <div style={{ flex: '1 1 220px' }}>
            <Field label="Nombre"><TextInput value={name} onChange={setDeviceName} placeholder="Compu" /></Field>
          </div>
          <button type="button" className="btn" onClick={async () => { await updateDevice({ deviceName: name.trim() }); toast('Nombre guardado'); }}>Guardar nombre</button>
        </div>
      </div>

      <div className="card">
        <h2>Guardar una copia</h2>
        <p>Se descarga un archivo con todos los datos. Guardalo en un lugar seguro (Drive, mail, un pendrive) o mandalo a la compu principal.</p>
        <div className="row">
          <button type="button" className="btn btn-principal btn-grande" onClick={onExport}><Download size={24} aria-hidden="true" /> Descargar respaldo</button>
          {canShareFiles && <button type="button" className="btn btn-grande" onClick={onShare}><Share2 size={24} aria-hidden="true" /> Compartir (WhatsApp, mail…)</button>}
        </div>
      </div>

      <div className="card">
        <h2>Juntar datos de otro dispositivo</h2>
        <p>Elegí un archivo de respaldo. Se suman las ventas, compras y productos que no estén acá. Si un producto se editó en los dos lados, queda el cambio más reciente.</p>
        {error && <Notice type="error">{error}</Notice>}
        <label className="btn btn-grande">
          <Upload size={24} aria-hidden="true" /> Elegir archivo de respaldo
          <input type="file" accept=".json,application/json" onChange={onImport} style={{ display: 'none' }} />
        </label>
        {summary && (
          <Notice type="ok">
            {changes.length === 0
              ? 'Listo. Este dispositivo ya tenía todo lo del respaldo, no hubo cambios.'
              : <>Listo. Se sumaron: {changes.map(([t, s]) => `${s.added + s.updated} ${TABLE_LABELS[t] || t}`).join(', ')}.</>}
          </Notice>
        )}
      </div>

      {duplicates.length > 0 && (
        <div className="card">
          <h2>Posibles productos repetidos</h2>
          <Notice type="aviso">
            Estos productos tienen el mismo código o el mismo nombre. Suele pasar cuando se cargan por separado en dos dispositivos.
            Revisalos: podés pasar el stock a uno ("Corregir stock") y desactivar o borrar el otro.
          </Notice>
          <ul>
            {duplicates.map((group) => (
              <li key={group[0].id}>
                {group.map((p, i) => (
                  <span key={p.id}>{i > 0 && ' · '}<Link to={`/productos/${p.id}`}>{p.name}</Link></span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2>¿Este dispositivo guarda los datos de forma segura?</h2>
        {persisted === true && <Notice type="ok">Sí. El navegador no va a borrar los datos por su cuenta (igual, hacé respaldos).</Notice>}
        {persisted === false && (
          <Notice type="aviso">
            El navegador podría borrar los datos si queda sin espacio o si no se usa la app por mucho tiempo.
            Instalá la app (ver el README) y hacé respaldos seguido.
          </Notice>
        )}
        {persisted === null && <p className="muted">Este navegador no informa si guarda los datos de forma permanente. Hacé respaldos seguido.</p>}
      </div>

      <div className="card">
        <h2>Cómo juntar los datos de las tres</h2>
        <ol>
          <li>En la tablet y en los celulares: <strong>Descargar respaldo</strong> (o Compartir) y mandarlo a la compu principal.</li>
          <li>En la compu principal: <strong>Juntar datos</strong> con cada archivo que llegó.</li>
          <li>En la compu principal: <strong>Descargar respaldo</strong>. Ese archivo ya tiene todo.</li>
          <li>En la tablet y los celulares: <strong>Juntar datos</strong> con ese archivo. Ahora todos están al día.</li>
        </ol>
        <p className="small muted">Consejo: los productos nuevos conviene cargarlos solo en la compu principal y después pasarlos a los demás, así no quedan repetidos.</p>
      </div>
    </>
  );
}
