// Valores iniciales: configuración general y categorías de base.
// Las categorías de base tienen ids fijos para que no se dupliquen entre dispositivos.

export const DEFAULT_SETTINGS = {
  id: 'general',
  businessName: 'Lira. Casa de cuentos',
  defaultMarkup: 100, // recargo general sobre el costo, en %
  roundingStep: 100, // redondear el precio sugerido hacia arriba a múltiplos de $ 100
  vatPct: 21, // IVA que se suma al costo cuando el proveedor factura sin IVA
  backupReminderDays: 7, // avisar si pasaron más días que esto sin respaldo
  useConsignment: false, // mostrar opciones de consignación
  salesChannels: ['Instagram', 'WhatsApp', 'Feria', 'Local', 'Otro'],
  paymentMethods: ['Efectivo', 'Transferencia', 'Mercado Pago'],
  expenseCategories: ['Packaging', 'Impuestos', 'Comisiones de cobro', 'Otros'],
};

/**
 * Tipos de campo extra que puede tener una categoría:
 *   text    texto libre
 *   number  número
 * "suggestions" muestra opciones para elegir, pero deja escribir cualquier otra.
 */
export const DEFAULT_CATEGORIES = [
  {
    id: 'cat-libros',
    name: 'Libros',
    active: true,
    defaultMarkup: null,
    fields: [
      { key: 'autor', label: 'Autor', type: 'text', suggestions: [] },
      { key: 'genero', label: 'Género', type: 'text', suggestions: ['Álbum ilustrado', 'Cuentos', 'Novela', 'Poesía', 'Informativo', 'Primeros lectores'] },
      { key: 'editorial', label: 'Editorial', type: 'text', suggestions: [] },
      { key: 'coleccion', label: 'Colección', type: 'text', suggestions: [] },
      { key: 'isbn', label: 'ISBN', type: 'text', suggestions: [] },
      { key: 'codigo_de_barras', label: 'Código de barras', type: 'text', suggestions: [] },
    ],
  },
  {
    id: 'cat-juegos-y-mapas',
    name: 'Juegos y mapas',
    active: true,
    defaultMarkup: null,
    fields: [
      { key: 'marca', label: 'Marca', type: 'text', suggestions: [] },
      { key: 'edad_recomendada', label: 'Edad recomendada', type: 'text', suggestions: ['+2 años', '+3 años', '+4 años', '+6 años', '+8 años'] },
      { key: 'categoria_de_juego', label: 'Categoría de juego', type: 'text', suggestions: ['Juego de mesa', 'Rompecabezas', 'Mapa para pintar', 'Globo terráqueo', 'Juego de encastre'] },
    ],
  },
];

/** Campos extra en los que también busca el buscador de productos. */
export const SEARCHABLE_EXTRA_KEYS = ['autor', 'editorial', 'marca', 'coleccion', 'isbn', 'codigo_de_barras'];
