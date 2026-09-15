// Función auxiliar para obtener el rango exacto de fechas del mes
function getRangoMes(anio, mes) {
    const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const ultimoDia = new Date(anio, mes, 0).getDate();
    const fin = `${anio}-${String(mes).padStart(2, '0')}-${ultimoDia}`;
    return { inicio, fin };
}

// --- INSERCIONES (CREATE) ---
async function dbInsertarIngreso(fecha, concepto, monto) {
    return await supabaseClient.from('ingresos_produccion').insert([{ fecha, concepto, monto }]);
}

async function dbInsertarGastoProd(fecha, concepto, monto) {
    return await supabaseClient.from('gastos_produccion').insert([{ fecha, concepto, monto }]);
}

async function dbInsertarDiezmo(fecha, concepto, monto) {
    return await supabaseClient.from('diezmos_entregados').insert([{ fecha, concepto, monto }]);
}

async function dbInsertarGastoFam(fecha, categoria, subcategoria, concepto, monto) {
    return await supabaseClient.from('gastos_familiares').insert([{ fecha, categoria, subcategoria, concepto, monto }]);
}

// --- CONSULTAS FILTRADAS POR PERÍODO (READ) ---
async function dbObtenerProduccionYDiezmo(anio, mes) {
    const { inicio, fin } = getRangoMes(anio, mes);

    const { data: ingresos } = await supabaseClient.from('ingresos_produccion').select('*').gte('fecha', inicio).lte('fecha', fin).order('fecha', { ascending: false });
    const { data: gastosProd } = await supabaseClient.from('gastos_produccion').select('*').gte('fecha', inicio).lte('fecha', fin).order('fecha', { ascending: false });
    const { data: diezmos } = await supabaseClient.from('diezmos_entregados').select('*').gte('fecha', inicio).lte('fecha', fin).order('fecha', { ascending: false });
    
    return { ingresos, gastosProd, diezmos };
}

async function dbObtenerGastosFamilia(anio, mes) {
    const { inicio, fin } = getRangoMes(anio, mes);
    const { data: gastosFam } = await supabaseClient.from('gastos_familiares').select('*').gte('fecha', inicio).lte('fecha', fin).order('fecha', { ascending: false });
    return gastosFam || [];
}

// --- ELIMINACIÓN (DELETE) ---
async function dbEliminarRegistro(tabla, id) {
    return await supabaseClient.from(tabla).delete().eq('id', id);
}

// --- CONFIGURACIÓN DE AHORRO ACUMULADO ---
async function dbObtenerAhorroAcumulado() {
    const { data } = await supabaseClient.from('configuracion_ahorro').select('monto_acumulado').eq('id', 1).single();
    return data ? parseFloat(data.monto_acumulado) : 0.0;
}

async function dbGuardarAhorroAcumulado(nuevoMonto) {
    return await supabaseClient.from('configuracion_ahorro').upsert({ id: 1, monto_acumulado: nuevoMonto, updated_at: new Date() });
}

// --- CIERRE DE MES (SÓLO CONGELA EL AHORRO, SIN BORRAR DATOS) ---
async function dbCerrarMes(nuevoAhorroAcumulado) {
    return await dbGuardarAhorroAcumulado(nuevoAhorroAcumulado);
}

// --- AUTENTICACIÓN ---
async function dbIniciarSesion(email, password) {
    return await supabaseClient.auth.signInWithPassword({ email, password });
}

async function dbCerrarSesion() {
    return await supabaseClient.auth.signOut();
}

async function dbObtenerUsuarioActual() {
    const { data } = await supabaseClient.auth.getUser();
    return data?.user || null;
}