import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

// ─── Styles ──────────────────────────────────────────────────────────────────

const C = {
  ink:     "#111827",
  muted:   "#6b7280",
  faint:   "#9ca3af",
  rule:    "#e5e7eb",
  accent:  "#4f46e5",
  bg:      "#f9fafb",
  white:   "#ffffff",
  warn:    "#fef3c7",
  warnBdr: "#d97706",
};

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.ink,
    paddingTop: 54,
    paddingBottom: 54,
    paddingHorizontal: 54,
    lineHeight: 1.5,
  },
  cover: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.ink,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },

  // Cover elements
  coverBand: { backgroundColor: C.accent, height: 10 },
  coverBody: { padding: 54, flex: 1, justifyContent: "center" },
  coverFooter: { backgroundColor: C.bg, padding: 24, borderTopWidth: 1, borderTopColor: C.rule },
  coverTitle: { fontSize: 32, fontFamily: "Helvetica-Bold", color: C.accent, marginBottom: 8 },
  coverSub:   { fontSize: 13, color: C.muted, marginBottom: 40 },
  coverDate:  { fontSize: 9, color: C.faint },

  // TOC
  tocTitle:   { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 18 },
  tocEntry:   { flexDirection: "row", marginBottom: 6 },
  tocLabel:   { flex: 1, fontSize: 10, color: C.ink },
  tocPage:    { fontSize: 10, color: C.muted },
  tocSection: { fontSize: 8, color: C.muted, marginLeft: 14, marginBottom: 4 },

  // Chapter header
  chapterNum: { fontSize: 9, color: C.accent, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  chapterTitle:{ fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 6, color: C.ink },
  chapterRule: { borderBottomWidth: 2, borderBottomColor: C.accent, marginBottom: 20 },

  // Body
  h2:   { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 18, marginBottom: 6, color: C.ink },
  h3:   { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 4, color: C.ink },
  p:    { fontSize: 9, marginBottom: 8, color: C.ink },
  li:   { fontSize: 9, marginBottom: 4, flexDirection: "row" },
  bullet: { width: 12, color: C.accent, fontFamily: "Helvetica-Bold" },
  liText: { flex: 1 },

  // Callout
  callout: { backgroundColor: C.bg, borderLeftWidth: 3, borderLeftColor: C.accent, padding: 10, marginVertical: 10, borderRadius: 2 },
  calloutText: { fontSize: 9, color: C.ink },
  warn: { backgroundColor: C.warn, borderLeftWidth: 3, borderLeftColor: C.warnBdr, padding: 10, marginVertical: 10, borderRadius: 2 },
  warnText: { fontSize: 9, color: "#92400e" },

  // Table
  table:  { marginVertical: 10, borderWidth: 1, borderColor: C.rule, borderRadius: 3 },
  thead:  { flexDirection: "row", backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.rule },
  tbody:  {},
  tr:     { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.rule },
  trLast: { flexDirection: "row" },
  th:     { fontFamily: "Helvetica-Bold", fontSize: 8, padding: 6, color: C.muted },
  td:     { fontSize: 8, padding: 6, color: C.ink },

  // Code
  code:     { fontFamily: "Courier", fontSize: 8, backgroundColor: C.bg, padding: 8, marginVertical: 6, borderRadius: 2, color: C.accent },
  inlineCode:{ fontFamily: "Courier", fontSize: 8, color: C.accent },

  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 54,
    right: 54,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: C.faint,
    borderTopWidth: 1,
    borderTopColor: C.rule,
    paddingTop: 6,
  },
});

// ─── Primitives ───────────────────────────────────────────────────────────────

function P({ children }: { children: React.ReactNode }) {
  return <Text style={S.p}>{children}</Text>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <Text style={S.h2}>{children}</Text>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <Text style={S.h3}>{children}</Text>;
}
function Li({ children }: { children: React.ReactNode }) {
  return (
    <View style={S.li}>
      <Text style={S.bullet}>•  </Text>
      <Text style={S.liText}>{children}</Text>
    </View>
  );
}
function Note({ children }: { children: React.ReactNode }) {
  return <View style={S.callout}><Text style={S.calloutText}>{children}</Text></View>;
}
function Warn({ children }: { children: React.ReactNode }) {
  return <View style={S.warn}><Text style={S.warnText}>{children}</Text></View>;
}
function Code({ children }: { children: React.ReactNode }) {
  return <Text style={S.code}>{children}</Text>;
}

function Footer({ chapter }: { chapter: string }) {
  return (
    <View style={S.footer} fixed>
      <Text>{chapter}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function ChapterHeader({ num, title }: { num: string; title: string }) {
  return (
    <View>
      <Text style={S.chapterNum}>Capítulo {num}</Text>
      <Text style={S.chapterTitle}>{title}</Text>
      <View style={S.chapterRule} />
    </View>
  );
}

// ─── Cover ────────────────────────────────────────────────────────────────────

function Cover({ generatedAt }: { generatedAt: string }) {
  return (
    <Page size="LETTER" style={S.cover}>
      <View style={S.coverBand} />
      <View style={S.coverBody}>
        <Text style={S.coverTitle}>Sistema de{"\n"}Gestión de{"\n"}Inventario</Text>
        <Text style={S.coverSub}>Manual de Usuario  ·  v1</Text>

        <View style={{ marginTop: 40 }}>
          {[
            "Panel y métricas KPI",
            "Catálogo, productos y códigos de barras",
            "Movimientos y seguimiento de lotes",
            "Informes y exportaciones (CSV / PDF)",
            "Asistente de chat (IA)",
            "Tokens API MCP",
            "Preferencias de administrador y auditoría",
          ].map((item) => (
            <View key={item} style={{ flexDirection: "row", marginBottom: 8 }}>
              <Text style={{ color: C.accent, fontFamily: "Helvetica-Bold", marginRight: 8 }}>→</Text>
              <Text style={{ color: C.muted, fontSize: 11 }}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={S.coverFooter}>
        <Text style={S.coverDate}>Generado el {generatedAt}</Text>
      </View>
    </Page>
  );
}

// ─── Table of Contents ────────────────────────────────────────────────────────

function TOC() {
  const entries = [
    { num: "1", title: "Primeros Pasos", subs: ["Inicio de sesión", "Roles: admin vs. usuario", "Navegación"] },
    { num: "2", title: "Panel de Control", subs: ["Métricas KPI", "Gráfico de movimientos", "Productos más activos", "Stock bajo y por vencer"] },
    { num: "3", title: "Catálogo", subs: ["Explorar y buscar", "Detalle del producto", "Unidades y unidades de visualización"] },
    { num: "4", title: "Productos (Admin)", subs: ["Crear un producto", "Códigos de barras", "Archivar"] },
    { num: "5", title: "Movimientos", subs: ["Entrada y salida", "Ajustes", "Seguimiento de lotes y FEFO", "Conversión de unidades"] },
    { num: "6", title: "Escaneo de Códigos de Barras", subs: ["Alternativa web", "Escaneo nativo en Android"] },
    { num: "7", title: "Informes", subs: ["Ejecutar un informe", "Filtros y parámetros", "Exportar CSV", "Exportar PDF", "Imprimir", "Referencia de informes"] },
    { num: "8", title: "Asistente de Chat", subs: ["Herramientas disponibles", "Límites diarios", "Configuración del proveedor"] },
    { num: "9", title: "Preferencias (Admin)", subs: ["Unidades", "Configuración de inventario", "Proveedor IA / LLM", "Modo oscuro", "Tokens MCP"] },
    { num: "10", title: "Usuarios y Auditoría (Admin)", subs: ["Gestión de usuarios", "Registro de auditoría"] },
    { num: "11", title: "Importar y Exportar", subs: ["Plantilla CSV", "Proceso de importación", "Gestión de errores"] },
    { num: "12", title: "Tokens MCP / API", subs: ["Qué son los tokens MCP", "Generar un token", "Configuración con Claude Code", "Revocar"] },
  ];

  return (
    <Page size="LETTER" style={S.page}>
      <Text style={S.tocTitle}>Índice</Text>
      {entries.map((e) => (
        <View key={e.num}>
          <View style={S.tocEntry}>
            <Text style={S.tocLabel}>{e.num}. {e.title}</Text>
          </View>
          {e.subs.map((s) => (
            <Text key={s} style={S.tocSection}>— {s}</Text>
          ))}
        </View>
      ))}
      <Footer chapter="Índice" />
    </Page>
  );
}

// ─── Chapters ─────────────────────────────────────────────────────────────────

function Ch1() {
  return (
    <Page size="LETTER" style={S.page}>
      <ChapterHeader num="1" title="Primeros Pasos" />

      <H2>Inicio de sesión</H2>
      <P>
        Abra la URL de la aplicación en cualquier navegador moderno. Verá una pantalla de inicio de sesión.
        Ingrese su dirección de correo electrónico y contraseña, luego haga clic en Iniciar sesión. Si su
        organización utiliza enlaces mágicos, ingrese su correo electrónico y revise su bandeja de entrada
        para obtener un enlace de un solo uso.
      </P>
      <P>
        En dispositivos móviles (Android), abra la aplicación instalada. Su sesión se almacena de forma
        segura y solo necesitará iniciar sesión una vez por dispositivo.
      </P>
      <Note>
        Si no puede iniciar sesión, comuníquese con su administrador. Puede verificar que su cuenta existe
        y está activa, y restablecer su contraseña a través del panel de Supabase si es necesario.
      </Note>

      <H2>Roles: admin vs. usuario</H2>
      <P>Cada cuenta tiene uno de dos roles:</P>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>admin</Text> — acceso completo: puede crear/editar/archivar productos, gestionar usuarios, cambiar preferencias, ver el registro de auditoría, ejecutar informes solo para administradores (Stock Muerto, Registro de Auditoría) e importar datos.</Li>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>usuario</Text> — acceso operativo: puede explorar el catálogo, registrar movimientos en productos donde tiene permiso, ver informes y usar el asistente de chat.</Li>
      <P>
        Los administradores pueden promover a un usuario a administrador visitando Usuarios en la navegación
        y cambiando su rol. La primera cuenta de administrador se configura mediante un script de CLI
        durante la instalación.
      </P>

      <H2>Navegación</H2>
      <P>La barra de navegación superior contiene todas las secciones principales:</P>
      <View style={S.table}>
        <View style={S.thead}>
          <Text style={[S.th, { width: 110 }]}>Enlace</Text>
          <Text style={[S.th, { flex: 1 }]}>Propósito</Text>
        </View>
        {[
          ["Panel", "Resumen de KPI, gráficos, actividad reciente"],
          ["Catálogo", "Explorar y buscar todos los productos activos"],
          ["Movimiento", "Registrar una entrada, salida o ajuste"],
          ["Escanear", "Escaneo de código de barras → movimiento rápido (móvil)"],
          ["Chat", "Asistente de IA para consultas de inventario"],
          ["Informes", "Informes parametrizados con exportación CSV / PDF"],
          ["+ Producto", "Crear un nuevo producto (solo admin)"],
          ["Usuarios", "Gestionar cuentas y roles (solo admin)"],
          ["Preferencias", "Configuración del sistema y claves API (solo admin)"],
          ["Auditoría", "Historial de cambios (solo admin)"],
          ["Importar/Exportar", "Operaciones CSV masivas (solo admin)"],
        ].map(([link, desc], i, arr) => (
          <View key={link} style={i === arr.length - 1 ? S.trLast : S.tr}>
            <Text style={[S.td, { width: 110, fontFamily: "Helvetica-Bold" }]}>{link}</Text>
            <Text style={[S.td, { flex: 1 }]}>{desc}</Text>
          </View>
        ))}
      </View>

      <Footer chapter="1 · Primeros Pasos" />
    </Page>
  );
}

function Ch2() {
  return (
    <Page size="LETTER" style={S.page}>
      <ChapterHeader num="2" title="Panel de Control" />
      <P>
        El panel de control es su vista general del almacén. Se carga automáticamente al iniciar sesión
        y se actualiza cada vez que navega a él.
      </P>

      <H2>Métricas KPI</H2>
      <P>Cuatro indicadores se encuentran en la parte superior de la página:</P>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>SKUs activos</Text> — recuento de productos no archivados.</Li>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Stock bajo</Text> — productos en o por debajo de su punto de reorden. En rojo cuando no es cero.</Li>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Por vencer (30d)</Text> — lotes con stock restante que vencen dentro de 30 días. En rojo cuando no es cero.</Li>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Movimientos hoy</Text> — total de entradas y salidas registradas hoy.</Li>

      <H2>Movimientos a lo largo del tiempo</H2>
      <P>
        Un gráfico de líneas muestra los recuentos diarios de entradas (índigo) y salidas (naranja) de
        los últimos 30 días. Pase el cursor sobre un punto para ver el día exacto y los recuentos. Estos
        datos provienen directamente del libro de movimientos — siempre están actualizados.
      </P>

      <H2>Productos más activos</H2>
      <P>
        Un gráfico de barras horizontal muestra los 10 productos con más movimientos totales (entradas +
        salidas) en los últimos 30 días. Úselo para identificar artículos de alta rotación que pueden
        necesitar reordenamiento más frecuente o mayor atención.
      </P>

      <H2>Lista de stock bajo</H2>
      <P>
        Los productos cuya cantidad actual en mano está en o por debajo de su punto de reorden aparecen
        aquí, ordenados por peor escasez primero. Cada fila muestra la cantidad actual en mano y el umbral
        de reorden en la unidad de visualización del producto. Al hacer clic en una fila se abre la
        página de detalle del producto.
      </P>

      <H2>Por vencer pronto</H2>
      <P>
        Lotes con stock restante que vencen dentro de 30 días, ordenados por fecha de vencimiento. Los
        lotes que vencen en 7 días se resaltan en rojo; de 8 a 30 días en ámbar. Al hacer clic en una
        fila se abre la página de detalle del producto donde puede registrar una salida o ajuste.
      </P>

      <H2>Movimientos recientes</H2>
      <P>
        Los 15 movimientos más recientes en todos los productos, los más nuevos primero. Cada entrada
        muestra la cantidad firmada, el nombre del producto, el tipo de movimiento y la fecha. El verde
        indica una entrada (stock agregado); el rojo indica una salida o ajuste que redujo el stock.
      </P>

      <Footer chapter="2 · Panel de Control" />
    </Page>
  );
}

function Ch3() {
  return (
    <Page size="LETTER" style={S.page}>
      <ChapterHeader num="3" title="Catálogo" />

      <H2>Explorar y buscar</H2>
      <P>
        La página Catálogo lista todos los productos activos (no archivados). Use el cuadro de búsqueda
        en la parte superior para encontrar productos por nombre, SKU o código de barras. La búsqueda
        utiliza una combinación de similitud de trigramas y coincidencia semántica (por embeddings), por
        lo que funcionan consultas aproximadas y en lenguaje natural — por ejemplo, buscar "harina de uso
        general" encontrará un producto llamado "harina de trigo AP blanqueada" aunque no haya coincidencia
        de palabras.
      </P>
      <P>
        Los controles de filtro permiten reducir por tipo de medida (masa / volumen / unidad) y activar el
        filtro "Solo stock bajo". Los resultados se actualizan mientras escribe.
      </P>

      <H2>Detalle del producto</H2>
      <P>Al hacer clic en un producto se abre su página de detalle, que muestra:</P>
      <Li>Cantidad actual en mano en la unidad de visualización del producto.</Li>
      <Li>Punto de reorden y cantidad (si está configurado).</Li>
      <Li>Códigos de barras / QR registrados en el producto.</Li>
      <Li>Lista de lotes con existencias por lote y fechas de vencimiento (si se usa seguimiento de lotes).</Li>
      <Li>Los 10 movimientos más recientes para este producto.</Li>
      <Li>Botones de acción rápida: Entrada y Salida (según los permisos por producto).</Li>

      <H2>Unidades y unidades de visualización</H2>
      <P>
        Todas las cantidades en la base de datos se almacenan en una unidad base canónica: gramos (g) para
        masa, mililitros (ml) para volumen, y unidades (ea) para conteo. El sistema convierte solo en el
        límite de visualización.
      </P>
      <P>
        La unidad mostrada para un producto se resuelve en este orden:
      </P>
      <Li>La unidad de visualización propia del producto (p.ej. kg), si está configurada.</Li>
      <Li>El valor predeterminado del sistema para ese tipo de medida, desde Preferencias.</Li>
      <Li>La unidad base (g / ml / ea) como alternativa.</Li>
      <P>
        Al registrar un movimiento puede ingresar cualquier unidad compatible (p.ej. ingresar 500 g para
        un producto cuya unidad de visualización es kg). El sistema convierte automáticamente y almacena
        la cantidad base.
      </P>

      <Footer chapter="3 · Catálogo" />
    </Page>
  );
}

function Ch4() {
  return (
    <Page size="LETTER" style={S.page}>
      <ChapterHeader num="4" title="Productos (Admin)" />
      <P>
        Solo los administradores pueden crear, editar o archivar productos. Acceda a la gestión de
        productos a través del enlace "+ Producto" en la navegación o a través del botón de edición
        en la página de detalle del producto.
      </P>

      <H2>Crear un producto</H2>
      <P>Complete el formulario del producto:</P>
      <View style={S.table}>
        <View style={S.thead}>
          <Text style={[S.th, { width: 140 }]}>Campo</Text>
          <Text style={[S.th, { flex: 1 }]}>Notas</Text>
        </View>
        {[
          ["SKU", "Identificador único. No se puede cambiar después de la creación."],
          ["Nombre", "Nombre legible del producto."],
          ["Descripción", "Texto libre opcional."],
          ["Tipo de medida", "Masa, Volumen o Conteo. No se puede cambiar después de la creación."],
          ["Unidad de visualización", "Anulación opcional para la visualización. Debe coincidir con el tipo de medida."],
          ["Tamaño de paquete", "Solo productos de conteo. Define cuántas unidades hay en una 'caja'."],
          ["Punto de reorden", "Cantidad (en unidades base) en la que se activan las alertas de Stock Bajo."],
          ["Cantidad de reorden", "Tamaño de pedido sugerido que se muestra en el informe de Stock Bajo."],
          ["Usuario puede ingresar", "Permite que usuarios no administradores registren entradas en este producto."],
          ["Usuario puede egresar", "Permite que usuarios no administradores registren salidas en este producto."],
        ].map(([f, n], i, arr) => (
          <View key={f} style={i === arr.length - 1 ? S.trLast : S.tr}>
            <Text style={[S.td, { width: 140, fontFamily: "Helvetica-Bold" }]}>{f}</Text>
            <Text style={[S.td, { flex: 1 }]}>{n}</Text>
          </View>
        ))}
      </View>

      <H2>Códigos de barras</H2>
      <P>
        Se pueden registrar uno o más códigos de barras, códigos QR o alias de SKU adicionales en un
        producto. Cada código debe ser globalmente único. Formatos admitidos: EAN-13, QR o cualquier
        cadena de texto libre (use el tipo "barcode" para códigos generales). Prefije el código con el
        formato en la importación CSV: p.ej. <Text style={S.inlineCode}>ean13:1234567890123</Text>.
      </P>
      <P>
        Los códigos de barras son usados por la función Escanear para buscar un producto instantáneamente.
        Múltiples códigos de barras pueden apuntar al mismo producto (p.ej. código de barras de caja
        maestra + código de barras de unidad).
      </P>

      <H2>Archivar un producto</H2>
      <P>
        Los productos no pueden eliminarse una vez que tienen movimientos, porque el libro de movimientos
        es de solo adición y debe permanecer preciso. En cambio, archive un producto: desaparece del
        catálogo y todos los informes que muestran inventario activo, pero sus movimientos se retienen
        para informes históricos.
      </P>
      <Warn>
        Archivar es reversible — un administrador puede desarchivar un producto desde su página de detalle.
        Sin embargo, si desea ocultar permanentemente un producto, asegúrese de que todos sus lotes también
        estén archivados primero.
      </Warn>

      <Footer chapter="4 · Productos" />
    </Page>
  );
}

function Ch5() {
  return (
    <Page size="LETTER" style={S.page}>
      <ChapterHeader num="5" title="Movimientos" />
      <P>
        Un movimiento es cualquier transacción que cambia el inventario en mano: una recepción (entrada),
        un envío o consumo (salida), o un ajuste correctivo. Cada movimiento se registra como una entrada
        inmutable en el libro mayor. El inventario en mano siempre se calcula sumando el libro mayor —
        no hay un campo de "stock actual" editable.
      </P>

      <H2>Registrar un movimiento</H2>
      <P>
        Navegue a Movimiento en la barra de navegación superior, o use los botones de acción rápida en
        la página de detalle de un producto. El formulario solicita:
      </P>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Producto</Text> — buscar por nombre o SKU.</Li>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Tipo</Text> — Entrada, Salida o Ajuste.</Li>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Cantidad y unidad</Text> — ingrese en cualquier unidad compatible; el sistema convierte a la unidad base.</Li>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Lote</Text> — requerido si el producto tiene lotes o si "Requerir lote en cada movimiento" está habilitado en Preferencias.</Li>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Motivo</Text> — nota de texto libre opcional.</Li>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Fecha/hora</Text> — predeterminado a ahora; puede retrodatarse.</Li>

      <H2>Entrada vs. salida vs. ajuste</H2>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Entrada</Text> — agrega stock (recepción, producción, devolución). La cantidad debe ser positiva.</Li>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Salida</Text> — elimina stock (envío, consumo, muestra). La cantidad debe ser positiva; el sistema la almacena como negativa.</Li>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Ajuste</Text> — corrige el stock después de un recuento físico. Puede ser positivo o negativo.</Li>
      <Warn>
        El sistema bloqueará una salida que resulte en stock negativo. Si cree que el recuento es
        incorrecto, registre primero un ajuste positivo.
      </Warn>

      <H2>Seguimiento de lotes y FEFO</H2>
      <P>
        Los lotes representan un lote específico de un producto, identificado por un código de lote y una
        fecha de vencimiento opcional. Cuando el seguimiento de lotes está activo, cada movimiento está
        vinculado a un lote específico para que el sistema pueda informar el inventario por lote y el
        estado de vencimiento.
      </P>
      <P>
        Al registrar una salida, el sistema preselecciona el lote que vence primero con stock disponible
        (Primero en Vencer, Primero en Salir — FEFO). Puede anular esto si es necesario, pero el valor
        predeterminado FEFO ayuda a evitar que el stock venza desapercibido.
      </P>
      <P>
        Para crear un nuevo lote en línea, haga clic en "Nuevo lote" en el selector de lotes e ingrese
        un código de lote y una fecha de vencimiento opcional. Esto es útil durante una entrada cuando
        llega un nuevo lote.
      </P>

      <H2>Conversión de unidades</H2>
      <P>
        Puede ingresar un movimiento en cualquier unidad que coincida con el tipo de medida del producto.
        Ejemplos:
      </P>
      <Li>El producto es masa; ingrese "2,5 kg" — se almacena como 2500 g.</Li>
      <Li>El producto es volumen; ingrese "1 gal" — se almacena como 3785,41 ml.</Li>
      <Li>El producto es conteo con tamaño de paquete 12; ingrese "3 caja" — se almacena como 36 ea.</Li>
      <P>
        El menú desplegable de unidades muestra solo las unidades compatibles con el tipo de medida
        del producto.
      </P>

      <Footer chapter="5 · Movimientos" />
    </Page>
  );
}

function Ch6() {
  return (
    <Page size="LETTER" style={S.page}>
      <ChapterHeader num="6" title="Escaneo de Códigos de Barras" />
      <P>
        La página Escanear proporciona un camino rápido desde un código de barras físico hasta un
        formulario de movimiento sin necesidad de buscar manualmente en el catálogo.
      </P>

      <H2>Navegador web</H2>
      <P>
        En un navegador web de escritorio o móvil, la página Escanear muestra un campo de texto donde
        puede escribir o pegar una cadena de código de barras, o usar un escáner de código de barras
        USB/Bluetooth conectado (que emite pulsaciones de teclas). Envíe el formulario para resolver
        el código de barras a su producto.
      </P>

      <H2>Aplicación nativa para Android</H2>
      <P>
        En la aplicación Android instalada (construida con Capacitor), la página Escanear activa la
        cámara del dispositivo usando el escáner de códigos de barras ML Kit de Google. Apunte la
        cámara a cualquier código de barras 1D o 2D; cuando sea reconocido, la aplicación lo resuelve
        inmediatamente.
      </P>
      <P>
        Después de que se resuelve un código de barras, aparece una hoja de acción con el nombre del
        producto, el inventario actual y dos botones: Entrada y Salida. Toque uno para abrir el formulario
        de cantidad. Después de enviar el movimiento, regresa a la pantalla de escaneo, listo para el
        siguiente artículo.
      </P>
      <Note>
        Si no se encuentra un código de barras, la aplicación muestra "Ningún producto coincide con este
        código de barras." Es posible que deba registrar el código de barras en un producto primero a
        través de la página de edición del producto del administrador.
      </Note>

      <H2>Formatos de códigos de barras admitidos</H2>
      <P>
        EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, Código QR, Data Matrix, PDF417, Aztec. El
        sistema almacena el valor de cadena sin formato — la etiqueta de formato (p.ej.
        <Text style={S.inlineCode}> ean13:</Text>) es una sugerencia usada solo durante la importación CSV.
      </P>

      <Footer chapter="6 · Escaneo de Códigos de Barras" />
    </Page>
  );
}

function Ch7() {
  return (
    <Page size="LETTER" style={S.page}>
      <ChapterHeader num="7" title="Informes" />
      <P>
        La sección Informes proporciona nueve informes parametrizados, cada uno impulsado por una función
        de Postgres. Cada informe puede verse en pantalla, descargarse como CSV, descargarse como PDF o
        imprimirse directamente desde el navegador.
      </P>

      <H2>Ejecutar un informe</H2>
      <P>
        Navegue a Informes en la barra de navegación superior. Haga clic en cualquier tarjeta de informe
        para abrirlo. Si el informe tiene parámetros (rango de fechas, producto, número de días), complétalos
        y haga clic en Ejecutar. Los resultados aparecen en la tabla de abajo. La tabla admite ordenación de
        columnas haciendo clic en cualquier encabezado; la paginación es de 100 filas por página.
      </P>

      <H2>Exportar</H2>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>CSV</Text> — descarga un archivo .csv con nombre {`<informe>-<fecha>.csv`}. Todas las filas de datos, sin columnas en blanco.</Li>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>PDF</Text> — descarga un PDF en formato carta horizontal con los mismos datos. Saltos de página cada 25 filas; el encabezado se repite en cada página.</Li>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Imprimir</Text> — activa el diálogo de impresión del navegador. El encabezado de navegación se oculta automáticamente mediante una hoja de estilos de impresión.</Li>

      <H2>Referencia de informes</H2>
      <View style={S.table}>
        <View style={S.thead}>
          <Text style={[S.th, { width: 130 }]}>Informe</Text>
          <Text style={[S.th, { width: 60 }]}>Acceso</Text>
          <Text style={[S.th, { flex: 1 }]}>Descripción</Text>
        </View>
        {[
          ["Inventario por Producto", "Todos", "Inventario actual en unidades de visualización, estado de reorden, recuento de lotes."],
          ["Inventario — Detalle por Lote", "Todos", "Inventario por lote, vencimiento y marca de vencido."],
          ["Hoja de Conteo Físico", "Todos", "Formulario imprimible con columna de Conteo del Sistema y columnas en blanco de Contado / Varianza / Notas. Bloque de firma en la última página."],
          ["Libro de Movimientos", "Todos", "Libro completo para un producto en un rango de fechas: fecha, tipo, cantidad, lote, motivo y quién lo registró."],
          ["Resumen de Movimientos", "Todos", "Totales diarios de entradas / salidas en todos los productos para un rango de fechas. Útil para revisión semanal o mensual."],
          ["Stock Bajo", "Todos", "Productos en o por debajo del punto de reorden, ordenados por peor escasez. Incluye cantidad de reorden sugerida."],
          ["Lotes por Vencer", "Todos", "Lotes que vencen dentro de N días (predeterminado 30) con cantidad en mano. Se incluyen lotes vencidos si aún tienen stock."],
          ["Stock Muerto", "Admin", "Productos sin movimiento en N días (predeterminado 90). Útil para identificar candidatos para baja o disposición."],
          ["Registro de Auditoría", "Admin", "Todos los cambios de catálogo, preferencia y rol para un rango de fechas, con valores antes/después."],
        ].map(([name, aud, desc], i, arr) => (
          <View key={name} style={i === arr.length - 1 ? S.trLast : S.tr}>
            <Text style={[S.td, { width: 130, fontFamily: "Helvetica-Bold" }]}>{name}</Text>
            <Text style={[S.td, { width: 60 }]}>{aud}</Text>
            <Text style={[S.td, { flex: 1 }]}>{desc}</Text>
          </View>
        ))}
      </View>

      <H2>Flujo de trabajo de la Hoja de Conteo Físico</H2>
      <P>
        1. Ejecute el informe Hoja de Conteo Físico (opcionalmente filtre por nombre). Imprímalo o descargue el PDF.{"\n"}
        2. Distribuya las hojas impresas a los contadores. Completan la columna Contado y calculan la Varianza.{"\n"}
        3. Para cada varianza, registre un movimiento de Ajuste en el sistema con un motivo que indique la fecha del conteo.{"\n"}
        4. Vuelva a ejecutar el informe Inventario por Producto para confirmar que las cantidades coinciden con el conteo físico.
      </P>

      <Footer chapter="7 · Informes" />
    </Page>
  );
}

function Ch8() {
  return (
    <Page size="LETTER" style={S.page}>
      <ChapterHeader num="8" title="Asistente de Chat" />
      <P>
        La página Chat proporciona una interfaz de lenguaje natural para consultar datos de inventario.
        Escriba una pregunta en lenguaje sencillo y el asistente llamará a las herramientas apropiadas,
        luego compondrá una respuesta legible. Todas las consultas son de solo lectura — el asistente
        no puede modificar el stock ni la configuración.
      </P>

      <H2>Ejemplos de consultas</H2>
      <Li>"¿Cuánta harina tenemos?"</Li>
      <Li>"¿Qué lotes vencen en las próximas dos semanas?"</Li>
      <Li>"Muéstrame todos los movimientos del SKU FLOUR-001 este mes."</Li>
      <Li>"¿Cuáles son nuestros 5 productos con menor stock?"</Li>
      <Li>"Convierte 3 galones a litros."</Li>
      <Li>"¿Cuáles son las configuraciones de preferencias actuales?"</Li>

      <H2>Herramientas disponibles</H2>
      <P>El asistente tiene acceso a estas herramientas de solo lectura:</P>
      <View style={S.table}>
        <View style={S.thead}>
          <Text style={[S.th, { width: 140 }]}>Herramienta</Text>
          <Text style={[S.th, { flex: 1 }]}>Qué hace</Text>
        </View>
        {[
          ["search_products", "Búsqueda de texto completo + semántica en nombres de productos y SKUs."],
          ["get_product", "Obtener un solo producto por ID o SKU."],
          ["get_stock", "Inventario actual para un producto, en unidades de visualización."],
          ["get_lots", "Listar lotes de un producto con vencimiento e inventario."],
          ["list_low_stock", "Todos los productos actualmente por debajo de su punto de reorden."],
          ["list_expiring_lots", "Lotes que vencen dentro de un número determinado de días."],
          ["list_movements", "Movimientos recientes para un producto."],
          ["convert_units", "Conversión de unidades (p.ej. oz → g, gal → ml)."],
          ["get_preferences", "Preferencias actuales del sistema (unidades, límites)."],
        ].map(([t, d], i, arr) => (
          <View key={t} style={i === arr.length - 1 ? S.trLast : S.tr}>
            <Text style={[S.td, { width: 140, fontFamily: "Courier", fontSize: 8 }]}>{t}</Text>
            <Text style={[S.td, { flex: 1 }]}>{d}</Text>
          </View>
        ))}
      </View>

      <H2>Límite de mensajes diarios</H2>
      <P>
        Los administradores pueden establecer un límite de mensajes diarios por usuario no administrador
        en Preferencias → IA / Chat → Límite de mensajes diarios (predeterminado: 50). Los administradores
        están exentos de este límite. Cuando un usuario alcanza el límite, recibe un error 429 y debe
        esperar hasta el siguiente día calendario.
      </P>

      <H2>Configuración del proveedor</H2>
      <P>
        El asistente de chat requiere una clave API para el proveedor LLM configurado (OpenAI, Anthropic
        o un endpoint compatible con OpenAI personalizado). Configure la clave en Preferencias → IA / Chat.
        La clave se almacena cifrada en el servidor y nunca se envía al navegador.
      </P>
      <Note>
        Si el chat devuelve un error sobre una clave API faltante, pida a su administrador que configure
        una en Preferencias → IA / Chat.
      </Note>

      <Footer chapter="8 · Asistente de Chat" />
    </Page>
  );
}

function Ch9() {
  return (
    <Page size="LETTER" style={S.page}>
      <ChapterHeader num="9" title="Preferencias (Admin)" />
      <P>
        Preferencias es una página solo para administradores que controla la configuración de todo el
        sistema. Navegue a ella a través de Preferencias en la barra de navegación superior.
      </P>

      <H2>Unidades de visualización predeterminadas</H2>
      <P>
        Configure la unidad de visualización alternativa para cada tipo de medida (masa, volumen, conteo).
        Se usan cuando un producto no tiene una unidad de visualización por producto configurada. Cambiar
        estas afecta cómo se muestran las cantidades en el catálogo, el panel y los informes.
      </P>

      <H2>Configuración de inventario</H2>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Requerir lote en cada movimiento</Text> — cuando está habilitado, los usuarios no pueden enviar un movimiento sin seleccionar o crear un lote. Útil para entornos regulados.</Li>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Alertas de stock bajo habilitadas</Text> — controla si la insignia de stock bajo aparece en el panel.</Li>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Retención de auditoría (días)</Text> — cuánto tiempo se conservan las entradas del registro de auditoría (30–3650 días). Las entradas más antiguas pueden ser eliminadas por un trabajo de mantenimiento.</Li>

      <H2>IA / Chat — Proveedor LLM</H2>
      <P>Elija un proveedor y pegue la clave API correspondiente:</P>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>OpenAI</Text> — usa modelos GPT. Pegue su clave API de OpenAI (comienza con sk-).</Li>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Anthropic</Text> — usa modelos Claude. Pegue su clave API de Anthropic (comienza con sk-ant-).</Li>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Otro (compatible con OpenAI)</Text> — ingrese una URL base y una clave API para cualquier endpoint compatible con OpenAI (p.ej. Azure OpenAI, Groq, Ollama).</Li>
      <P>
        Las claves API son de solo escritura en la interfaz: una vez configuradas, solo se muestran los
        primeros 10 caracteres. Enviar el formulario con un campo de clave en blanco deja la clave
        existente sin cambios. Use Modelo personalizado para forzar un nombre de modelo específico;
        déjelo en blanco para usar el predeterminado del proveedor.
      </P>

      <H2>Apariencia — Modo oscuro</H2>
      <P>
        Active el interruptor de Modo oscuro para cambiar entre temas claro y oscuro. La preferencia se
        guarda en su perfil de usuario y se aplica en todos los dispositivos y sesiones. El sistema también
        respeta el esquema de colores de su sistema operativo en la primera visita antes de que establezca
        una preferencia.
      </P>

      <H2>Tokens de acceso MCP</H2>
      <P>
        Consulte el Capítulo 12 para obtener detalles completos sobre la generación y gestión de tokens MCP.
      </P>

      <Footer chapter="9 · Preferencias" />
    </Page>
  );
}

function Ch10() {
  return (
    <Page size="LETTER" style={S.page}>
      <ChapterHeader num="10" title="Usuarios y Auditoría (Admin)" />

      <H2>Gestión de usuarios</H2>
      <P>
        Navegue a Usuarios en la barra de navegación superior. La página lista todas las cuentas
        registradas con su correo electrónico, nombre para mostrar, rol y estado activo.
      </P>
      <P>Acciones de administrador disponibles en cada fila de usuario:</P>
      <Li>Promover a administrador / degradar a usuario (cambio de rol).</Li>
      <Li>Desactivar / reactivar una cuenta (evita el inicio de sesión sin eliminar la cuenta).</Li>
      <P>
        Las nuevas cuentas son creadas por el propio usuario a través del flujo de registro. Comienzan
        con el rol de "usuario". Un administrador debe promoverlos si se necesita acceso elevado.
      </P>
      <Warn>
        Tenga cuidado al degradar otra cuenta de administrador. Si usted es el único administrador y se
        degrada a sí mismo, perderá acceso a las funciones de administrador. Use el script de bootstrap
        o el panel de Supabase para recuperar el acceso.
      </Warn>

      <H2>Registro de auditoría</H2>
      <P>
        La página Auditoría muestra un registro paginado y filtrable de todos los cambios realizados a
        través de la aplicación. Cada acción de administrador que modifica datos — creación/edición/archivado
        de productos, cambio de rol de usuario, actualización de preferencias — se registra aquí
        automáticamente.
      </P>
      <P>Cada entrada registra:</P>
      <Li>Cuándo ocurrió el cambio (marca de tiempo en hora local).</Li>
      <Li>Quién realizó el cambio (dirección de correo electrónico).</Li>
      <Li>Qué acción se realizó (p.ej. product.update, preferences.update).</Li>
      <Li>Qué entidad fue afectada (tipo e ID).</Li>
      <Li>Valores antes y después (diff), con claves API redactadas.</Li>
      <P>
        Filtre por tipo de entidad, actor o rango de fechas. Los usuarios no administradores solo pueden
        ver sus propias entradas (p.ej. sus propios movimientos), no el registro completo.
      </P>
      <Note>
        Para una exportación de rango de fechas del registro de auditoría adecuada para revisión de
        cumplimiento, use el informe Registro de Auditoría en la sección Informes.
      </Note>

      <Footer chapter="10 · Usuarios y Auditoría" />
    </Page>
  );
}

function Ch11() {
  return (
    <Page size="LETTER" style={S.page}>
      <ChapterHeader num="11" title="Importar y Exportar" />
      <P>
        La página Importar/Exportar (solo admin) proporciona operaciones CSV masivas para el catálogo de
        productos. Las exportaciones de movimientos y stock individuales están disponibles en la sección
        Informes.
      </P>

      <H2>Exportar datos</H2>
      <P>Tres enlaces de exportación están disponibles desde la página Importar/Exportar:</P>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Productos CSV</Text> — todos los productos activos con sus campos (SKU, nombre, tipo de medida, unidad de visualización, punto de reorden, etc.).</Li>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Stock CSV</Text> — inventario actual para cada producto activo en su unidad de visualización.</Li>
      <Li><Text style={{ fontFamily: "Helvetica-Bold" }}>Movimientos CSV</Text> — libro de movimientos completo (puede ser grande para almacenes muy activos).</Li>

      <H2>Importar productos</H2>
      <P>
        Descargue la plantilla CSV desde la página Importar/Exportar. La plantilla contiene filas de
        ejemplo para productos de masa, volumen y conteo con todos los campos opcionales y ejemplos de
        códigos de barras.
      </P>
      <P>Columnas requeridas:</P>
      <Li>sku, name, measure_type (mass/volume/count)</Li>
      <P>Columnas opcionales:</P>
      <Li>description, display_unit, pack_size, reorder_point, reorder_quantity, user_can_check_in, user_can_check_out, barcodes</Li>
      <P>
        La columna <Text style={S.inlineCode}>barcodes</Text> acepta uno o más códigos separados por
        punto y coma. Prefije cada uno con su tipo:
      </P>
      <Code>ean13:1234567890123;qr:MYPRODUCT-A</Code>
      <P>
        Suba el CSV completado en la página de Importación y haga clic en Importar. El sistema procesa
        las filas una por una: los SKUs existentes se actualizan (upsert), los nuevos SKUs se crean.
        Después del procesamiento, la página muestra una tabla de resultados con una fila por fila de
        entrada, su estado (ok / error) y cualquier mensaje de error.
      </P>

      <H2>Gestión de errores</H2>
      <P>
        Un error de fila (p.ej. measure_type no válido, código de barras duplicado) falla solo esa fila —
        el resto del lote continúa. Corrija las filas fallidas y vuelva a importar; las filas existentes
        se actualizarán sin crear duplicados.
      </P>
      <Warn>
        La importación no crea movimientos. El stock inicial debe ingresarse mediante movimientos de
        entrada después de que se importen los productos, o mediante el CSV de movimientos (que no es
        editable — los movimientos son solo de adición a través de la interfaz).
      </Warn>

      <Footer chapter="11 · Importar y Exportar" />
    </Page>
  );
}

function Ch12() {
  return (
    <Page size="LETTER" style={S.page}>
      <ChapterHeader num="12" title="Tokens MCP / API" />
      <P>
        Los tokens MCP (Model Context Protocol) permiten que clientes de IA externos como Claude Code y
        Claude Desktop consulten su inventario de solo lectura usando las mismas nueve herramientas que
        el asistente de chat integrado. Los tokens se gestionan en Preferencias → Tokens de acceso MCP.
      </P>

      <H2>Qué son los tokens MCP</H2>
      <P>
        Cada token es una cadena aleatoria larga con el prefijo <Text style={S.inlineCode}>inv_pat_</Text>.
        Se aplica hash con argon2id antes del almacenamiento — el valor sin formato se muestra exactamente
        una vez (inmediatamente después de la generación) y no puede recuperarse. Si pierde un token,
        revóquelo y genere uno nuevo.
      </P>
      <P>
        Los tokens otorgan acceso de solo lectura limitado a los datos de inventario del propietario.
        Respetan las mismas reglas de Seguridad a Nivel de Fila que la sesión del navegador. Un token
        no puede escribir movimientos, cambiar configuraciones ni acceder a datos privados de otros usuarios.
      </P>

      <H2>Generar un token</H2>
      <P>
        1. Vaya a Preferencias → Tokens de acceso MCP.{"\n"}
        2. Ingrese un nombre descriptivo (p.ej. "Claude Desktop – MacBook") y haga clic en Generar.{"\n"}
        3. El token se muestra una vez en un cuadro verde. Cópielo ahora.{"\n"}
        4. La página también muestra el comando exacto para registrarlo con Claude Code (ver abajo).
      </P>

      <H2>Conectar con Claude Code</H2>
      <P>Ejecute el comando que aparece en la pantalla de generación de tokens:</P>
      <Code>{`claude mcp add --transport http inventory \\
  https://your-app-url/api/mcp \\
  --header "Authorization: Bearer inv_pat_..."`}</Code>
      <P>
        Una vez conectado, puede hacer preguntas a Claude Code sobre su inventario directamente en su
        terminal o IDE:
      </P>
      <Li>"¿Cuál es el stock actual del SKU FLOUR-001?"</Li>
      <Li>"Lista todo lo que vence este mes."</Li>
      <Li>"¿Qué productos están por debajo de su punto de reorden?"</Li>

      <H2>Lista y revocación de tokens</H2>
      <P>
        La lista de tokens en Preferencias muestra el nombre de cada token, prefijo (primeros caracteres),
        fecha de creación y fecha de último uso. Para revocar un token, haga clic en Revocar junto a él.
        Los tokens revocados son rechazados inmediatamente — cualquier cliente que use ese token recibirá
        una respuesta 401 No autorizado.
      </P>
      <P>
        Buena práctica: use un token por dispositivo cliente o aplicación. Nómbrelos claramente para saber
        cuál revocar si se pierde un dispositivo o se da de baja una aplicación.
      </P>

      <Note>
        Los tokens MCP solo admiten operaciones de lectura. El asistente impulsado por un token MCP no
        puede registrar movimientos, cambiar preferencias ni realizar ninguna acción de escritura.
      </Note>

      <Footer chapter="12 · Tokens MCP / API" />
    </Page>
  );
}

// ─── Root document ────────────────────────────────────────────────────────────

export function ManualDocument({ generatedAt }: { generatedAt: string }) {
  return (
    <Document
      title="Sistema de Gestión de Inventario — Manual de Usuario"
      author="Sistema de Gestión de Inventario"
      subject="Manual de Usuario v1"
    >
      <Cover generatedAt={generatedAt} />
      <TOC />
      <Ch1 />
      <Ch2 />
      <Ch3 />
      <Ch4 />
      <Ch5 />
      <Ch6 />
      <Ch7 />
      <Ch8 />
      <Ch9 />
      <Ch10 />
      <Ch11 />
      <Ch12 />
    </Document>
  );
}
