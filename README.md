# Lira. Casa de cuentos

App para manejar el stock, los proveedores, las compras, las ventas, la caja y los informes de **Lira. Casa de cuentos**.

- Funciona **sin internet**.
- Se usa en la compu, la tablet y el celular.
- No necesita usuario ni contraseña.
- Cada dispositivo guarda sus propios datos. Para juntarlos se usa el **Respaldo**.

---

## Publicar la app (una sola vez)

Para abrirla desde cualquier dispositivo, la app tiene que estar en internet. Se publica gratis en **GitHub Pages**. Una vez publicada, cada dispositivo la abre una vez con internet, la instala y después funciona sin conexión. Los datos **no** se suben a internet: siguen guardados en cada dispositivo.

### Paso 1: crear la cuenta de GitHub
1. Entrá a **github.com** y tocá **Sign up**.
2. Poné un mail, una contraseña y un nombre de usuario, por ejemplo `liracasadecuentos`. **El nombre de usuario va a ser parte de la dirección de la app.**
3. Confirmá el mail.

### Paso 2: subir la app
**Opción A (recomendada):** pasale el nombre de usuario a quien armó la app, o a Claude, y te la publica. La app queda en `https://NOMBRE-DE-USUARIO.github.io/lira-casa-de-cuentos/`. Cada vez que haya cambios, se vuelve a publicar sola.

**Opción B (a mano, sin programas):**
1. En esta compu, abrí la carpeta `dist` del proyecto. Ahí está la app lista. Si no existe, la arma `npm run build`.
2. En GitHub, tocá **+ → New repository**. Nombre: `lira-casa-de-cuentos`. Marcá **Public** y tocá **Create repository**.
3. Tocá **uploading an existing file** y arrastrá **todo el contenido** de la carpeta `dist` (los archivos y la carpeta `assets`, no la carpeta `dist` en sí). Abajo, tocá **Commit changes**.
4. Andá a **Settings → Pages**. En "Branch" elegí **main** y la carpeta **/ (root)**. Tocá **Save**.
5. Esperá 1 o 2 minutos. Arriba de esa misma página aparece la dirección de la app.

Con la Opción B, cada actualización se sube de nuevo de la misma forma.

### Paso 3: instalarla en cada dispositivo
Ver "Cómo abrirla e instalarla", más abajo.

---

## Etapa 4: precios masivos, consignación y cuenta corriente

### Actualizar precios de muchos productos juntos
**Productos → Actualizar precios.**
1. Elegí **a qué productos**: todos, una categoría o un proveedor.
2. Elegí **qué cambia**:
   - **Solo el precio de venta**.
   - **Aumentó el proveedor**: sube el costo (o el PVP de la editorial) y el precio en el mismo %. Los libros que se vendían al PVP pasan al PVP nuevo.
3. Elegí **subir o bajar** y el porcentaje.
4. Revisá la **vista previa**. Destildá los productos que no querés cambiar y confirmá.

Cada cambio queda en el **historial de precios** de cada producto (al final de su ficha).

### Consignación (opcional)
Mientras no se use, está oculta. Para usarla:
1. **Configuración → "Usamos productos en consignación"**.
2. En la ficha de cada producto en consignación, elegí **"En consignación"** y cuánto le corresponde al proveedor: un **porcentaje** de lo cobrado o un **monto fijo** por unidad. Si todavía no está definido, se puede dejar vacío.
3. **Informes → Consignaciones a pagar**: cuánto se vendió de cada proveedor y cuánto se le debe en el período elegido.

### Cuenta corriente con proveedores
- Las compras que se pagan después se cargan como **"Se paga después"**, con fecha de vencimiento.
- En **Proveedores**, cada uno muestra **"A pagar $ …"** si tiene compras pendientes. En su ficha está el total adeudado y el botón **Marcar pagada**.
- El **Inicio** avisa cuando una compra está por vencer o ya venció.

### Otros cambios
- **Caja del día** tiene un botón en el Inicio.
- En **Respaldo**:
  - Aparecen los **productos posiblemente repetidos**, por ejemplo si se cargó el mismo libro en dos dispositivos.
  - Se ve si el navegador guarda los datos de forma permanente.
- Si una pantalla falla, aparece un mensaje con un botón para volver al inicio, en lugar de quedar en blanco. Los datos no se pierden.

---

## Etapa 3: caja, gastos e informes

### Caja del día (menú **Caja**)
1. **Abrir caja**: anotá con cuánto efectivo empezás (el cambio).
2. Durante el día, las ventas se suman solas, separadas por forma de pago.
3. **Entradas y salidas**: plata que entra o sale sin ser una venta ("compré bolsas", "retiro de efectivo").
4. **Cerrar caja**: contá el efectivo y escribilo. La app muestra si **da justo**, si **sobra** o si **falta**, y cuánto.

Si se contó mal, **Reabrir caja** y volver a cerrar. Hay una caja por día: si venden en dos dispositivos el mismo día, al juntar respaldos las ventas en efectivo de los dos se suman en esa caja.

### Gastos
Packaging, impuestos, comisiones de cobro… Se anotan con fecha, monto y categoría. Si se pagó con efectivo de la caja, marcá **"Lo pagué con efectivo de la caja"** y se descuenta del cierre. Las categorías se cambian en Configuración.

### Informes
**Informes** tiene: ventas por período, ganancias, ventas por canal, por forma de pago, lo más vendido, lo que no se vende, stock disponible y lo que hay que reponer.
- Arriba se elige el período: **día, semana, mes o fechas a elección**, con flechas para ir al anterior o al siguiente.
- **Ganancia bruta** = lo vendido menos lo que costaron esos productos.
- **Ganancia neta** = la bruta menos los gastos anotados.
- El envío se muestra aparte y no cuenta como ganancia.
- Todos los informes y listados (productos, ventas, compras, gastos, caja) tienen **Descargar Excel** e **Imprimir**. Al imprimir sale solo el informe, con el nombre del negocio, el título y el período.

---

## Etapa 2: ventas, compras y stock

### Cargar una venta
1. **Vender** (o el botón grande del Inicio).
2. Escribí parte del nombre, el autor o la marca y **tocá el producto** para agregarlo. Tocalo de nuevo o usá **+** para sumar unidades.
3. Elegí la **forma de pago** y el **canal**. La app recuerda los últimos que usaste en ese dispositivo.
4. **Confirmar venta**.

En **"Más datos"** podés cambiar la fecha y hora (para cargar ventas de otros días), y poner cliente, envío, descuento y una nota.
- El **envío** se cobra aparte y **no** cuenta como ganancia.
- Si un producto no tiene stock suficiente, la app **avisa pero deja vender**. Puede pasar que falte cargar una compra.

### Modo feria
Para cargar muchas ventas seguidas. El canal queda fijo en "Feria" y recuerda la última forma de pago. Los productos más vendidos aparecen como botones grandes, y arriba se ve un contador con las ventas y el total del día.

### Ver, editar o anular una venta
En **Ventas**, elegí el día y tocá la venta.
- **Editar venta**: se corrige y queda anotado qué cambió.
- **Anular venta**: deja de contar y los productos vuelven al stock. La venta queda guardada como "anulada".

Cada venta guarda el precio y el costo **del momento en que se vendió**. Si después cambian los precios, los números viejos no se alteran.

### Cargar una compra
**Compras → Cargar compra**: fecha, proveedor y los productos de la factura.
- Para los libros de editorial se carga el PVP y el descuento. Para el resto, el costo por unidad. El IVA se suma solo si el proveedor está marcado así.
- Si un producto no existe todavía, se crea ahí mismo con **Crear producto nuevo**.
- Al guardar, se suma al stock y se actualiza el costo. Si el costo cambió, la app pregunta si querés actualizar el precio de venta. Los precios fijados a mano, como el PVP de Atlantis, vienen sin tildar.
- **Se paga después (cuenta corriente)**: poné la fecha de vencimiento. El Inicio avisa cuando está por vencer o vencida. Desde la compra se marca como pagada.

---

## Qué hay en la Etapa 1

- **Productos**: alta, edición, buscador (sin importar tildes ni mayúsculas), filtros por categoría, proveedor y stock bajo.
- **Precios**: el programa sugiere el precio de venta de dos formas:
  - **Costo + recargo**: por ejemplo los mapas de Atlantis.
  - **Precio de lista (PVP) con descuento**: por ejemplo los libros de editoriales.
- **Recargo y margen**: cada producto muestra las dos medidas de ganancia (ver más abajo).
- **Categorías**: se pueden crear, renombrar y desactivar, y cada una define sus propios datos extra.
- **Proveedores**: datos, productos que nos venden e historial de compras.
- **Importar desde Excel**: facturas de proveedores o listas de productos, con vista previa.
- **Plantilla de Excel** para cargar muchos productos de una vez.
- **Respaldo**: guardar una copia de todo y juntar los datos de otros dispositivos.
- **Datos de ejemplo** para probar sin cargar nada real.

---

## Recargo y margen: no son lo mismo

| | Qué mide | Ejemplo: costo $ 8.000, venta $ 16.000 |
|---|---|---|
| **Recargo sobre el costo** | Cuánto le sumamos a lo que nos costó | 100 % (le sumamos otros $ 8.000) |
| **Margen sobre la venta** | Qué parte de lo que cobramos es ganancia | 50 % (la mitad de lo cobrado es ganancia) |

**¿Qué recargo se usa?** Gana el más específico:

1. el del producto;
2. si no tiene, el del proveedor;
3. si no tiene, el de la categoría;
4. si no, el general (en Configuración).

**IVA:** si un proveedor factura sin IVA (como Atlantis), en su ficha marcá *"Factura sin IVA: sumar 21 % al costo"*. Así el costo refleja lo que realmente se paga.

---

## Cómo abrirla e instalarla

La app se abre desde una dirección de internet, por ejemplo `https://NOMBRE.github.io/lira-casa-de-cuentos/`. La primera vez hace falta internet. Después se instala y funciona sin conexión.

### En la compu (Windows o Mac) con Chrome o Edge
1. Abrí la dirección de la app.
2. Arriba a la derecha, en la barra de direcciones, aparece un ícono de una pantalla con una flecha ("Instalar"). Tocalo.
3. Confirmá con **Instalar**. Queda un ícono en el escritorio o en el menú de aplicaciones.

### En la Mac con Safari
1. Abrí la dirección de la app.
2. Menú **Archivo → Agregar al Dock**.

### En el celular o la tablet Android (Chrome)
1. Abrí la dirección de la app.
2. Tocá los tres puntitos ⋮ arriba a la derecha.
3. Tocá **Instalar app** o **Agregar a la pantalla principal**.

### En el iPhone o el iPad (Safari)
1. Abrí la dirección de la app **en Safari** (no en otro navegador).
2. Tocá el botón **Compartir** (el cuadrado con una flecha hacia arriba).
3. Tocá **Agregar a inicio**.

> **Importante en iPhone y iPad:** usala siempre desde el ícono instalado. Si no está instalada, Safari puede borrar los datos de una página que no se abre por varias semanas.

### Actualizaciones
Cuando haya una versión nueva, se actualiza sola la próxima vez que abran la app con internet. Si no ven un cambio, cierren la app del todo y vuelvan a abrirla.

---

## Respaldos: muy importante

Los datos viven **dentro de cada dispositivo**. Si se borra el navegador, se desinstala la app o se pierde el equipo, se pierden los datos. **El respaldo es la única copia de seguridad.**

- Entrá a **Respaldo → Descargar respaldo**. Se baja un archivo que termina en `.json`.
- Guardalo en un lugar seguro: Google Drive, un mail a ustedes mismas, un pendrive.
- La app avisa en el Inicio si hace más de 7 días que no se hace un respaldo (se cambia en Configuración).

### Cómo juntar los datos de las tres (con una compu principal)
1. En la tablet y los celulares: **Respaldo → Descargar respaldo** (o **Compartir** para mandarlo por WhatsApp o mail) y mandarlo a la compu principal.
2. En la compu principal: **Respaldo → Juntar datos** con cada archivo que llegó.
3. En la compu principal: **Descargar respaldo**. Ese archivo ya tiene todo.
4. En la tablet y los celulares: **Juntar datos** con ese archivo.

Juntar respaldos **nunca duplica ni pisa ventas**. Si el mismo producto se editó en dos lugares, queda el cambio más reciente. Se puede juntar el mismo archivo dos veces sin problema.

**Consejo:** carguen los productos nuevos solo en la compu principal y después pásenlos a los demás. Si dos dispositivos crean el mismo producto por separado, quedan dos productos.

### Pasar todo a otra compu (por ejemplo, a una Mac)
1. En la compu vieja: **Descargar respaldo**.
2. En la compu nueva: abrir la app, instalarla y en **Respaldo → Juntar datos** elegir ese archivo.

---

## Importar productos desde Excel

1. **Importar Excel → Elegir archivo** (sirven .xlsx, .xls y .csv).
2. Revisá qué es cada columna. La app intenta adivinarlo, pero se puede corregir.
3. Elegí el proveedor y la categoría. Si no existen, se crean solos.
4. Revisá la vista previa:
   - Las líneas con el **mismo código se suman** en un solo producto.
   - Las líneas **sin precio** (por ejemplo "lámina" y "caja" de un mapa) se toman como componentes y no se cargan. Se pueden marcar a mano si hace falta.
   - Si un producto **ya existía** (mismo código o ISBN), se suma al stock y se actualiza el costo.
   - Las líneas con errores aparecen en rojo y no se importan.
5. Si es una factura, dejá marcado **"registrarla como compra pagada"**: la cantidad de cada línea entra al stock y la factura queda en el historial del proveedor.

Para cargar muchos productos nuevos: **Importar Excel → Descargar plantilla de Excel**, completala y después importala.

---

## Probar con datos de ejemplo

En **Inicio** o en **Configuración** está el botón **Cargar datos de ejemplo**. Carga productos y proveedores inventados. Cuando quieran empezar en serio: **Configuración → Borrar datos de ejemplo**. Lo que hayan cargado ustedes no se toca.

---

## Si algo falla

| Qué pasa | Qué hacer |
|---|---|
| La app no abre o queda en blanco | Cerrala del todo y volvé a abrirla. Si sigue igual, reiniciá el dispositivo. |
| Dice "No se pudo abrir la app" | Probablemente el navegador está en modo privado o incógnito. Abrila en una ventana normal. |
| No aparece un cambio nuevo | Abrila con internet, cerrala y volvé a abrirla. |
| Faltan datos de otro dispositivo | Hay que juntar el respaldo de ese dispositivo (ver "Cómo juntar los datos"). |
| Se perdieron los datos | Abrí la app, entrá a **Respaldo → Juntar datos** y elegí el último respaldo descargado. |
| El Excel no se importa bien | Abrilo en Excel y guardalo de nuevo como .xlsx. Revisá que la columna del nombre esté bien asignada. |

---

## Para quien quiera tocar el código

Hecha con **React + Vite**. Los datos se guardan en el navegador (IndexedDB) con **Dexie**. Los Excel se leen y se escriben con **SheetJS**. Funciona sin conexión gracias a **vite-plugin-pwa**.

### Comandos (hace falta [Node.js](https://nodejs.org) LTS)
```bash
npm install        # instalar dependencias (una sola vez)
npm run dev        # abrir en modo desarrollo: http://localhost:5173
npm test           # correr las pruebas automáticas
npm run build      # armar la versión para publicar (carpeta dist)
npm run iconos     # regenerar los íconos provisorios
```
Con `npm run dev` también se puede abrir desde la tablet o el celular, si están en el mismo wifi. Usá la dirección "Network" que aparece en la pantalla.

### Dónde está cada cosa
```
src/
  theme/theme.css     COLORES Y TIPOGRAFÍAS (todo el tema en un solo lugar)
  theme/brand.js      nombre y logo
  theme/app.css       estilos generales
  logic/              cálculos "puros", con pruebas (*.test.js)
    pricing.js        precios, recargo, margen, IVA, redondeo
    stock.js          stock calculado a partir de movimientos
    merge.js          unión de respaldos
    sales.js          totales de una venta, descuentos, resúmenes
    reports.js        cálculos de todos los informes
    cash.js           caja diaria (efectivo esperado y diferencia)
    massPrices.js     actualización masiva de precios (vista previa)
    consignment.js    consignaciones a pagar
    importer.js       lectura y vista previa de Excel
    money.js, text.js formatos de dinero y búsqueda sin tildes
  db/                 base de datos local
    db.js             tablas
    repo.js           guardar y leer (todas las pantallas pasan por acá)
    backup.js         exportar, importar y borrar todo
    importCommit.js   guardar lo importado desde Excel
    sample.js         datos de ejemplo
    defaults.js       configuración y categorías iniciales
  pages/              una pantalla por archivo
  ui/                 piezas reutilizables (campos, avisos, confirmaciones)
```

### Decisiones importantes
- **El stock no se guarda como un número**: se calcula sumando movimientos (`stockMoves`: inicial, compra y ajuste) y restando las ventas que cuentan (`sales` no anuladas ni borradas). Las ventas restan desde la venta misma, así, si una venta se edita o se anula en otro dispositivo, al juntar respaldos el stock se corrige solo. Ver `logic/stock.js`.
- **Ventas** (`db/sales.js`): guardan precio y costo de cada línea al momento de vender, `totals` calculados (`logic/sales.js`) e `history` con los cambios. Campos preparados sin uso todavía: `orderId` (señas/encargos), `invoice` (facturación), `table` (mesas del bar). `suggestedDiscount()` en `logic/sales.js` es el lugar para sumar reglas de descuento.
- **Compras** (`db/purchases.js`): crean movimientos de stock con `refId` = id de la compra. Anular una compra marca esos movimientos como borrados.
- **Cada registro** tiene `id` (UUID), `createdAt`, `updatedAt`, `deviceId` y `deleted`. Nunca se borra de verdad: se marca `deleted: true`, así el borrado también viaja en los respaldos. Esto deja todo listo para una sincronización en la nube en el futuro: alcanzaría con mandar y recibir los registros con `updatedAt` más nuevo.
- **Categorías y proveedores** usan ids armados con el nombre (`prov-atlantis`). Así, si dos dispositivos los crean por separado, no se duplican.
- **Productos de bar** (más adelante): `trackStock: false` para productos sin control de stock.
- **Para el futuro** (todavía sin hacer, pero sin cerrar la puerta):
  - **Bar o café**: productos con `trackStock: false` (sin stock) y ventas con `table` (mesa).
  - **Facturación electrónica**: campo `invoice` en cada venta.
  - **Señas o encargos**: campo `orderId` en cada venta.
  - **Lector de código de barras**: el buscador ya busca por código, ISBN y código de barras. Un lector USB "escribe" el código en el buscador y Enter agrega el primer resultado.
  - **Descuentos por reglas**: `suggestedDiscount()` en `logic/sales.js`.
  - **Sincronización en la nube**: todos los registros tienen `id`, `updatedAt`, `deviceId` y `deleted`. Alcanzaría con mandar y recibir los cambios usando la misma unión de `logic/merge.js`.

### Publicar en GitHub Pages
El archivo `.github/workflows/publicar.yml` publica la app sola cada vez que se suben cambios a la rama `main`:
1. Crear el repositorio en GitHub y subir el código.
2. En el repositorio: **Settings → Pages → Source: GitHub Actions**.
3. A los pocos minutos, la app queda en `https://USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/`.
