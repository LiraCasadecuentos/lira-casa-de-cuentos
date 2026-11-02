// Leer y escribir archivos de Excel. La librería se carga solo cuando hace falta.

import { downloadBlob } from './download.js';

async function loadXlsx() {
  return import('xlsx');
}

/** Lee un .xlsx, .xls o .csv. Devuelve [{ name, rows }] con una entrada por hoja. */
export async function readSpreadsheet(file) {
  const XLSX = await loadXlsx();
  const buffer = await file.arrayBuffer();
  const isText = /\.(csv|txt|tsv)$/i.test(file.name);
  let workbook;
  try {
    workbook = isText
      ? // En los CSV leemos los valores como texto: así "25.500,00" no se confunde con 25,5
        // (después los interpretamos nosotros con el formato argentino).
        XLSX.read(decodeText(buffer), { type: 'string', raw: true })
      : XLSX.read(buffer, { type: 'array', cellDates: true });
  } catch {
    throw new Error('No se pudo leer el archivo. Probá guardarlo de nuevo desde Excel como .xlsx o .csv.');
  }
  return workbook.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', raw: true, blankrows: false }),
  }));
}

/** Los CSV pueden venir en UTF-8 o en el formato viejo de Windows (Excel en español). Probamos los dos. */
function decodeText(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

/**
 * Descarga un Excel con una o varias hojas.
 * sheets: [{ name, rows: [[...], ...], widths?: [número de caracteres por columna] }]
 */
export async function downloadSpreadsheet(filename, sheets) {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
    if (sheet.widths) ws['!cols'] = sheet.widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}
