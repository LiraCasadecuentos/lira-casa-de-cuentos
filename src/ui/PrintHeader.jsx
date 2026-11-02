// Encabezado que aparece solo al imprimir: nombre del negocio, título y período.

import { useSettings } from './useData.js';

export default function PrintHeader({ title, subtitle }) {
  const settings = useSettings();
  return (
    <div className="print-only print-header">
      <div className="print-business">{settings?.businessName || 'Lira. Casa de cuentos'}</div>
      <div className="print-title">{title}</div>
      {subtitle && <div className="print-subtitle">{subtitle}</div>}
      <div className="print-date">Impreso el {new Date().toLocaleDateString('es-AR')}</div>
    </div>
  );
}
