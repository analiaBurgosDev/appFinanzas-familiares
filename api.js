/* ==========================================================================
   MÓDULO DE CAPA DE DATOS (API - SUPABASE)
   ========================================================================== 
   Este archivo centraliza todas las consultas a la base de datos de Supabase.
   Aplica el principio de "Separación de Responsabilidades", evitando que el 
   código de la interfaz (app2.js) realice consultas SQL directamente.
   ========================================================================== */

/**
 * FUNCIÓN AUXILIAR: Calcula el primer y último día del mes seleccionado.
 * Sirve para generar los límites estricto de búsqueda (fechas ISO).
 * @param {number} anio - Año (ej: 2026)
 * @param {number} mes - Mes en formato numérico del 1 al 12
 * @returns {Object} { inicio: "AAAA-MM-01", fin: "AAAA-MM-DD" }
 */
function getRangoMes(anio, mes) {
    const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
    // Pasando el día 0 del mes siguiente se obtiene el último día del mes actual
    const ultimoDia = new Date(anio, mes, 0).getDate();
    const fin = `${anio}-${String(mes).padStart(2, '0')}-${ultimoDia}`;
    return { inicio, fin };
}

/* ==========================================================================
   1. INSERCIONES EN LA BASE DE DATOS (CREATE)
   ========================================================================== */

/**
 * Registra un nuevo ingreso bruto de producción.
 * @param {string} fecha - Fecha en formato 'YYYY-MM-DD'
 * @param {string} concepto - Descripción del ingreso
 * @param {number} monto - Valor monetario
 */
async function dbInsertarIngreso(fecha, concepto, monto) {
    return await supabaseClient
        .from('ingresos_produccion')
        .insert([{ fecha, concepto, monto }]);
}

/**
 * Registra un gasto asociado a la producción.
 */
async function dbInsertarGastoProd(fecha, concepto, monto) {
    return await supabaseClient
        .from('gastos_produccion')
        .insert([{ fecha, concepto, monto }]);
}

/**
 * Registra una entrega efectiva de diezmo/DD.
 */
async function dbInsertarDiezmo(fecha, concepto, monto) {
    return await supabaseClient
        .from('diezmos_entregados')
        .insert([{ fecha, concepto, monto }]);
}

/**
 * Registra un gasto del ámbito familiar (incluye categoría y subcategoría).
 */
async function dbInsertarGastoFam(fecha, categoria, subcategoria, concepto, monto) {
    return await supabaseClient
        .from('gastos_familiares')
        .insert([{ fecha, categoria, subcategoria, concepto, monto }]);
}

/* ==========================================================================
   2. CONSULTAS FILTRADAS POR PERÍODO (READ)
   ========================================================================== */

/**
 * Obtiene todos los registros de producción y diezmo dentro del mes activo.
 * Ejecuta tres consultas en paralelo mediante filtrado por rango de fechas.
 * @returns {Object} { ingresos: Array, gastosProd: Array, diezmos: Array }
 */
async function dbObtenerProduccionYDiezmo(anio, mes) {
    const { inicio, fin } = getRangoMes(anio, mes);

    // .gte() = Greater Than or Equal (Mayor o igual que...)
    // .lte() = Less Than or Equal (Menor o igual que...)
    // .order() = Ordena los resultados por fecha descendente
    const { data: ingresos } = await supabaseClient
        .from('ingresos_produccion')
        .select('*')
        .gte('fecha', inicio)
        .lte('fecha', fin)
        .order('fecha', { ascending: false });

    const { data: gastosProd } = await supabaseClient
        .from('gastos_produccion')
        .select('*')
        .gte('fecha', inicio)
        .lte('fecha', fin)
        .order('fecha', { ascending: false });

    const { data: diezmos } = await supabaseClient
        .from('diezmos_entregados')
        .select('*')
        .gte('fecha', inicio)
        .lte('fecha', fin)
        .order('fecha', { ascending: false });
    
    return { ingresos, gastosProd, diezmos };
}

/**
 * Consulta los gastos familiares registrados en el mes indicado.
 * @returns {Array} Listado de gastos o un arreglo vacío si no existen registros.
 */
async function dbObtenerGastosFamilia(anio, mes) {
    const { inicio, fin } = getRangoMes(anio, mes);
    const { data: gastosFam } = await supabaseClient
        .from('gastos_familiares')
        .select('*')
        .gte('fecha', inicio)
        .lte('fecha', fin)
        .order('fecha', { ascending: false });

    return gastosFam || [];
}

/* ==========================================================================
   3. ELIMINACIÓN DE REGISTROS (DELETE)
   ========================================================================== */

/**
 * Borra un registro genérico de cualquier tabla especificando su ID.
 * @param {string} tabla - Nombre de la tabla de destino
 * @param {string|number} id - Identificador único de la fila a borrar
 */
async function dbEliminarRegistro(tabla, id) {
    return await supabaseClient
        .from(tabla)
        .delete()
        .eq('id', id); // .eq() = Equal to (Igual a...)
}

/* ==========================================================================
   4. CONFIGURACIÓN Y PERSISTENCIA DEL AHORRO ACUMULADO
   ========================================================================== */

/**
 * Lee el ahorro histórico acumulado guardado en la tabla de configuración.
 * Utiliza `.single()` para forzar la devolución de una sola fila en lugar de un arreglo.
 */
async function dbObtenerAhorroAcumulado() {
    const { data } = await supabaseClient
        .from('configuracion_ahorro')
        .select('monto_acumulado')
        .eq('id', 1)
        .single();

    return data ? parseFloat(data.monto_acumulado) : 0.0;
}

/**
 * Actualiza o inserta (Upsert) el nuevo monto de ahorro acumulado.
 */
async function dbGuardarAhorroAcumulado(nuevoMonto) {
    return await supabaseClient
        .from('configuracion_ahorro')
        .upsert({ 
            id: 1, 
            monto_acumulado: nuevoMonto, 
            updated_at: new Date() 
        });
}

/**
 * Proceso de Cierre de Mes: Actualiza el balance acumulado para el siguiente período.
 */
async function dbCerrarMes(nuevoAhorroAcumulado) {
    return await dbGuardarAhorroAcumulado(nuevoAhorroAcumulado);
}

/* ==========================================================================
   5. MÓDULO DE AUTENTICACIÓN (SUPABASE AUTH)
   ========================================================================== */

/**
 * Autentica al usuario usando credenciales de correo y contraseña.
 */
async function dbIniciarSesion(email, password) {
    return await supabaseClient.auth.signInWithPassword({ email, password });
}

/**
 * Destruye el token de sesión activo del navegador.
 */
async function dbCerrarSesion() {
    return await supabaseClient.auth.signOut();
}

/**
 * Verifica si existe un JWT/sesión válida almacenada localmente.
 * @returns {Object|null} Devuelve el objeto usuario o null si no hay sesión.
 */
async function dbObtenerUsuarioActual() {
    const { data } = await supabaseClient.auth.getUser();
    return data?.user || null;
}

// Busca gastos familiares por concepto o categoría en un rango amplio de fechas
async function dbBuscarGastosAvanzado(fechaInicio, fechaFin, categoria, conceptoBusqueda) {
    let query = supabaseClient
        .from('gastos_familiares')
        .select('*')
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)
        .order('fecha', { ascending: false });

    // Filtro opcional por categoría
    if (categoria && categoria !== 'TODAS') {
        query = query.eq('categoria', categoria);
    }

    // Filtro opcional por coincidencia de texto en el concepto (ej: "nafta", "peaje")
    if (conceptoBusqueda && conceptoBusqueda.trim() !== '') {
        query = query.ilike('concepto', `%${conceptoBusqueda.trim()}%`);
    }

    const { data, error } = await query;
    if (error) {
        console.error("Error al buscar gastos:", error);
        return [];
    }
    return data || [];
}