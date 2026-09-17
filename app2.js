/* ==========================================================================
   APP FINANZAS FAMILIARES - LÓGICA DE INTERFAZ Y MANEJO DEL DOM
   ========================================================================== */

/**
 * FUNCIÓN AUXILIAR: Obtiene el año y mes seleccionados en el selector global.
 * Si el selector está vacío, toma como fallback el año y mes actuales.
 * @returns {Object} Objeto con propiedades { anio: number, mes: number }
 */
function getPeriodoActivo() {
    const val = document.getElementById('select-mes-global')?.value;
    if (!val) {
        const hoy = new Date();
        return { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 };
    }
    // Desestructuramos el valor "AAAA-MM" que entrega el input tipo month
    const [anio, mes] = val.split('-');
    return { anio: parseInt(anio), mes: parseInt(mes) };
}

/* ==========================================================================
   INICIALIZACIÓN DE LA APLICACIÓN (DOM CONTENT LOADED)
   ========================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0]; // Formato AAAA-MM-DD
    const anioActual = hoy.getFullYear();
    const mesActualStr = String(hoy.getMonth() + 1).padStart(2, '0');

    // 1. Asignar la fecha de hoy por defecto en todos los inputs de tipo fecha
    document.querySelectorAll('input[type="date"]').forEach(inp => inp.value = hoyStr);

    // 2. Configurar el selector de mes global (Input Month)
    const selectMes = document.getElementById('select-mes-global');
    if (selectMes) {
        selectMes.value = `${anioActual}-${mesActualStr}`;
        // Evento 'change': Cada vez que el usuario cambia el mes, recalculamos todo
        selectMes.addEventListener('change', () => {
            cargarDatosProduccion();
            cargarDatosFamilia();
            cargarGranResumen();
        });
    }

    // 3. Control de Autenticación de Usuario (Supabase Auth)
    const usuario = await dbObtenerUsuarioActual();
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.querySelector('.app-container');
    const btnLogout = document.getElementById('btn-logout');

    if (!usuario) {
        // Si NO hay sesión activa: mostramos login, ocultamos app
        if (loginScreen) loginScreen.classList.remove('hidden');
        if (appContainer) appContainer.classList.add('hidden');
        if (btnLogout) btnLogout.classList.add('hidden');
    } else {
        // Si HAY sesión activa: ocultamos login, mostramos app
        if (loginScreen) loginScreen.classList.add('hidden');
        if (appContainer) appContainer.classList.remove('hidden');
        if (btnLogout) btnLogout.classList.remove('hidden');

        // Carga inicial de datos desde la base de datos
        cargarDatosProduccion();
        cargarDatosFamilia();
        cargarGranResumen();
    }

    // 4. Navegación por Pestañas (Adaptado a las 5 pestañas de la barra inferior)
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Quitamos la clase 'active' de todos los botones y secciones
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // Activamos únicamente el botón clickeado y su sección correspondiente
            btn.classList.add('active');
            const targetTab = btn.dataset.tab;
            document.getElementById(targetTab)?.classList.add('active');

            // Si se abre la pestaña de Resumen, recalculamos las métricas generales
            if (targetTab === 'tab-resumen') {
                cargarGranResumen();
            }
        });
    });

    // 5. Mostrar/Ocultar el desplegable de Hijos en Gastos Familiares
    const catFamiliaSelect = document.getElementById('fam-categoria');
    const subcatHijosGroup = document.getElementById('subcat-hijos-group');

    if (catFamiliaSelect) {
        catFamiliaSelect.addEventListener('change', (e) => {
            if (e.target.value === 'Gastos por Hijo') {
                subcatHijosGroup.classList.remove('hidden');
            } else {
                subcatHijosGroup.classList.add('hidden');
            }
        });
    }

    /* ==========================================================================
       MANEJO DE FORMULARIOS (INSERCIÓN DE DATOS ASÍNCRONA)
       ========================================================================== */

    // --- FORMULARIO 1: INGRESOS BRUTOS ---
    document.getElementById('form-ingreso-prod')?.addEventListener('submit', async (e) => {
        e.preventDefault(); // Previene que la página se recargue automáticamente
        const form = e.target;
        
        // Llamada asíncrona a la base de datos
        const { error } = await dbInsertarIngreso(
            document.getElementById('ingreso-fecha').value,
            document.getElementById('ingreso-concepto').value,
            parseFloat(document.getElementById('ingreso-monto').value)
        );

        if (error) return alert('Error al guardar: ' + error.message);
        
        animarGuardadoExito(form);
        form.reset(); // Limpia los campos del formulario
        form.querySelector('input[type="date"]').value = hoyStr; // Restablece fecha
        cargarDatosProduccion(); // Refresca las listas y totales
    });

    // --- FORMULARIO 2: GASTOS DE PRODUCCIÓN ---
    document.getElementById('form-gasto-prod')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        
        const { error } = await dbInsertarGastoProd(
            document.getElementById('gasto-prod-fecha').value,
            document.getElementById('gasto-prod-concepto').value,
            parseFloat(document.getElementById('gasto-prod-monto').value)
        );

        if (error) return alert('Error al guardar: ' + error.message);
        
        animarGuardadoExito(form);
        form.reset();
        form.querySelector('input[type="date"]').value = hoyStr;
        cargarDatosProduccion();
    });

    // --- FORMULARIO 3: ENTREGAS DE DIEZMO ---
    document.getElementById('form-diezmo')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        
        const { error } = await dbInsertarDiezmo(
            document.getElementById('diezmo-fecha').value,
            document.getElementById('diezmo-concepto').value,
            parseFloat(document.getElementById('diezmo-monto').value)
        );

        if (error) return alert('Error al guardar: ' + error.message);
        
        animarGuardadoExito(form);
        form.reset();
        form.querySelector('input[type="date"]').value = hoyStr;
        cargarDatosProduccion();
    });

    // --- FORMULARIO 4: GASTOS FAMILIARES ---
    document.getElementById('form-gasto-fam')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const categoria = catFamiliaSelect.value;
        // Solo guardamos subcategoría si la categoría es 'Gastos por Hijo'
        const subcategoria = categoria === 'Gastos por Hijo' ? document.getElementById('fam-subcategoria').value : null;

        const { error } = await dbInsertarGastoFam(
            document.getElementById('fam-fecha').value,
            categoria,
            subcategoria,
            document.getElementById('fam-concepto').value,
            parseFloat(document.getElementById('fam-monto').value)
        );

        if (error) return alert('Error al guardar: ' + error.message);
        
        animarGuardadoExito(form);
        form.reset();
        form.querySelector('input[type="date"]').value = hoyStr;
        subcatHijosGroup.classList.add('hidden');
        cargarDatosFamilia();
    });

    // --- EDITAR AHORRO ACUMULADO ANTERIOR ---
    document.getElementById('btn-editar-ahorro')?.addEventListener('click', async () => {
        const actual = await dbObtenerAhorroAcumulado();
        const nuevo = prompt('Ingresá el nuevo monto de Ahorro Acumulado Anterior:', actual);
        
        if (nuevo !== null && !isNaN(parseFloat(nuevo))) {
            await dbGuardarAhorroAcumulado(parseFloat(nuevo));
            cargarGranResumen();
        }
    });

    // --- CIERRE Y REINICIO DE MES ---
    document.getElementById('btn-reiniciar-mes')?.addEventListener('click', async () => {
        if (confirm('¿Estás segura de cerrar el mes? Esto sumará el saldo disponible al Ahorro Acumulado y pasará al siguiente período.')) {
            const { anio, mes } = getPeriodoActivo();
            const ahorroAnterior = await dbObtenerAhorroAcumulado();
            
            // Obtenemos los datos del mes activo para calcular el saldo final
            const { ingresos, gastosProd } = await dbObtenerProduccionYDiezmo(anio, mes);
            const gastosFam = await dbObtenerGastosFamilia(anio, mes);
            
            let ingBruto = 0, gastProd = 0, gastFam = 0;
            (ingresos || []).forEach(i => ingBruto += parseFloat(i.monto));
            (gastosProd || []).forEach(g => gastProd += parseFloat(g.monto));
            (gastosFam || []).forEach(f => gastFam += parseFloat(f.monto));
            
            // Lógica financiera
            const ingNeto = ingBruto - gastProd;
            const ingLiquido = ingNeto - (ingNeto > 0 ? ingNeto * 0.10 : 0);
            const ahorroMes = ingLiquido - gastFam;

            const nuevoAhorroTotal = ahorroAnterior + ahorroMes;

            // Impactamos el nuevo ahorro acumulado en Supabase
            await dbCerrarMes(nuevoAhorroTotal);
            
            alert('¡Mes cerrado con éxito! Se ha actualizado el Ahorro Acumulado.');
            
            cargarDatosProduccion();
            cargarDatosFamilia();
            cargarGranResumen();
        }
    });

    // --- EVENTO SUBMIT DE LOGIN ---
    document.getElementById('form-login')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        const { error } = await dbIniciarSesion(email, password);

        if (error) {
            alert('Error al iniciar sesión: ' + error.message);
        } else {
            location.reload(); // Recarga la página para levantar la sesión iniciada
        }
    });

    // --- EVENTO CLICK DE CERRAR SESIÓN ---
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        if (confirm('¿Querés cerrar la sesión?')) {
            const { error } = await dbCerrarSesion();
            if (error) {
                alert('Error al cerrar sesión: ' + error.message);
            } else {
                window.location.reload(); // Recarga la página para volver al login
            }
        }
    });
});

/* ==========================================================================
   RENDERIZADO Y CÁLCULOS: PRODUCCIÓN Y DIEZMO
   ========================================================================== */
async function cargarDatosProduccion() {
    const { anio, mes } = getPeriodoActivo();
    const { ingresos, gastosProd, diezmos } = await dbObtenerProduccionYDiezmo(anio, mes);

    // 1. Renderizar Historial de Ingresos
    const listaIngresos = document.getElementById('lista-ingresos');
    listaIngresos.innerHTML = '';
    let totalIngresos = 0;

    (ingresos || []).forEach(item => {
        totalIngresos += parseFloat(item.monto);
        listaIngresos.innerHTML += `
            <li>
                <div><strong>${item.concepto}</strong><span class="fecha">${item.fecha}</span></div>                 <div>                     <strong style="margin-right: 8px;">+$${parseFloat(item.monto).toFixed(2)}</strong>
                    <button class="btn-delete" onclick="eliminarFila('ingresos_produccion', '${item.id}')" title="Eliminar">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </li>`;
    });

    // 2. Renderizar Historial de Gastos de Producción
    const listaGastos = document.getElementById('lista-gastos-prod');
    listaGastos.innerHTML = '';
    let totalGastosProd = 0;

    (gastosProd || []).forEach(item => {
        totalGastosProd += parseFloat(item.monto);
        listaGastos.innerHTML += `
            <li>
                <div><strong>${item.concepto}</strong><span class="fecha">${item.fecha}</span></div>                 <div>                     <strong style="color: #dc2626; margin-right: 8px;">-$${parseFloat(item.monto).toFixed(2)}</strong>
                    <button class="btn-delete" onclick="eliminarFila('gastos_produccion', '${item.id}')" title="Eliminar">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </li>`;
    });

    // 3. Renderizar Historial de Diezmos Entregados
    const listaDiezmos = document.getElementById('lista-diezmos');
    listaDiezmos.innerHTML = '';
    let totalDiezmoEntregado = 0;

    (diezmos || []).forEach(item => {
        totalDiezmoEntregado += parseFloat(item.monto);
        listaDiezmos.innerHTML += `
            <li>
                <div><strong>${item.concepto}</strong><span class="fecha">${item.fecha}</span></div>                 <div>                     <strong style="color: #c026d3; margin-right: 8px;">$${parseFloat(item.monto).toFixed(2)}</strong>
                    <button class="btn-delete" onclick="eliminarFila('diezmos_entregados', '${item.id}')" title="Eliminar">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </li>`;
    });

    // 4. Cálculos Matemáticos de Producción y Diezmo
    const ingresoNeto = totalIngresos - totalGastosProd;
    const diezmoSugerido = ingresoNeto > 0 ? ingresoNeto * 0.10 : 0;
    const diezmoPendiente = diezmoSugerido - totalDiezmoEntregado;

    // Actualización de nodos en el DOM
    document.getElementById('tot-ingresos-bruto').innerText = `$${totalIngresos.toFixed(2)}`;
    document.getElementById('tot-gastos-prod').innerText = `$${totalGastosProd.toFixed(2)}`;
    document.getElementById('tot-ingreso-neto').innerText = `$${ingresoNeto.toFixed(2)}`;
    document.getElementById('tot-diezmo-sugerido').innerText = `$${diezmoSugerido.toFixed(2)}`;
    document.getElementById('tot-diezmo-pendiente').innerText = `$${diezmoPendiente.toFixed(2)}`;

    // Disparamos la actualización del resumen general
    cargarGranResumen();
}

/* ==========================================================================
   RENDERIZADO Y CÁLCULOS: GASTOS FAMILIARES
   ========================================================================== */
async function cargarDatosFamilia() {
    const { anio, mes } = getPeriodoActivo();
    const gastosFam = await dbObtenerGastosFamilia(anio, mes);
    const listaGastosFam = document.getElementById('lista-gastos-fam');
    listaGastosFam.innerHTML = '';

    let totalGastosFam = 0, totalAlimentos = 0, totalCuentas = 0, totalVarios = 0;

    gastosFam.forEach(item => {
        const monto = parseFloat(item.monto);
        totalGastosFam += monto;

        // Clasificación por categoría
        if (item.categoria === 'Alimentos') totalAlimentos += monto;
        else if (item.categoria === 'Cuentas y Servicios') totalCuentas += monto;
        else totalVarios += monto;

        const detalleSubcat = item.subcategoria ? ` (${item.subcategoria})` : '';

        listaGastosFam.innerHTML += `
            <li>
                <div><strong>${item.categoria}${detalleSubcat}</strong> -${item.concepto}<span class="fecha">${item.fecha}</span></div>                 <div>                     <strong style="color: #dc2626; margin-right: 8px;">-$${monto.toFixed(2)}</strong>
                    <button class="btn-delete" onclick="eliminarFila('gastos_familiares', '${item.id}')" title="Eliminar">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </li>`;
    });

    // Actualización de nodos en el DOM
    document.getElementById('tot-gastos-familia').innerText = `$${totalGastosFam.toFixed(2)}`;
    document.getElementById('tot-gasto-alimentos').innerText = `$${totalAlimentos.toFixed(2)}`;
    document.getElementById('tot-gasto-cuentas').innerText = `$${totalCuentas.toFixed(2)}`;
    document.getElementById('tot-gasto-varios').innerText = `$${totalVarios.toFixed(2)}`;

    cargarGranResumen();
}

/* ==========================================================================
   CÁLCULO INTEGRAL: GRAN RESUMEN Y ESTADO DE CAJA
   ========================================================================== */
async function cargarGranResumen() {
    const { anio, mes } = getPeriodoActivo();
    const { ingresos, gastosProd, diezmos } = await dbObtenerProduccionYDiezmo(anio, mes);
    const gastosFam = await dbObtenerGastosFamilia(anio, mes);
    const ahorroAnterior = await dbObtenerAhorroAcumulado();

    // 1. Totales de Producción
    let totIngBruto = 0, totGastProd = 0, totDDEntregado = 0;
    (ingresos || []).forEach(i => totIngBruto += parseFloat(i.monto));
    (gastosProd || []).forEach(g => totGastProd += parseFloat(g.monto));
    (diezmos || []).forEach(d => totDDEntregado += parseFloat(d.monto));

    const ingNeto = totIngBruto - totGastProd;
    const ddCalculado = ingNeto > 0 ? ingNeto * 0.10 : 0;
    const ingLiquido = ingNeto - ddCalculado;

    // 2. Totales y Desglose de Gastos Familiares
    let totAlimentos = 0, totCuentas = 0, totBenja = 0, totYaz = 0, totEstrella = 0, totVarios = 0, totGastFam = 0;

    gastosFam.forEach(item => {
        const monto = parseFloat(item.monto);
        totGastFam += monto;

        if (item.categoria === 'Alimentos') totAlimentos += monto;
        else if (item.categoria === 'Cuentas y Servicios') totCuentas += monto;
        else totVarios += monto;

        if (item.subcategoria === 'Benja') totBenja += monto;
        if (item.subcategoria === 'Yaz') totYaz += monto;
        if (item.subcategoria === 'Estrella') totEstrella += monto;
    });

    // 3. Fórmulas de Balance General y Caja
    const ahorroMes = ingLiquido - totGastFam;
    const cajaLibre = ahorroMes + ahorroAnterior;
    const ahorroDD = ddCalculado - totDDEntregado;
    const totalFisico = cajaLibre + ahorroDD;

    // 4. Inyección de valores en la pantalla (usamos validación previa para evitar null errors)
    if (document.getElementById('res-ing-bruto')) document.getElementById('res-ing-bruto').innerText = `$${totIngBruto.toFixed(2)}`;
    if (document.getElementById('res-gast-prod')) document.getElementById('res-gast-prod').innerText = `-$${totGastProd.toFixed(2)}`;
    if (document.getElementById('res-ing-neto')) document.getElementById('res-ing-neto').innerText = `$${ingNeto.toFixed(2)}`;
    if (document.getElementById('res-dd-calc')) document.getElementById('res-dd-calc').innerText = `$${ddCalculado.toFixed(2)}`;
    if (document.getElementById('res-dd-entregado')) document.getElementById('res-dd-entregado').innerText = `$${totDDEntregado.toFixed(2)}`;
    if (document.getElementById('res-ing-liquido')) document.getElementById('res-ing-liquido').innerText = `$${ingLiquido.toFixed(2)}`;

    if (document.getElementById('res-fam-alimentos')) document.getElementById('res-fam-alimentos').innerText = `-$${totAlimentos.toFixed(2)}`;
    if (document.getElementById('res-fam-cuentas')) document.getElementById('res-fam-cuentas').innerText = `-$${totCuentas.toFixed(2)}`;
    if (document.getElementById('res-fam-benja')) document.getElementById('res-fam-benja').innerText = `-$${totBenja.toFixed(2)}`;
    if (document.getElementById('res-fam-yaz')) document.getElementById('res-fam-yaz').innerText = `-$${totYaz.toFixed(2)}`;
    if (document.getElementById('res-fam-estrella')) document.getElementById('res-fam-estrella').innerText = `-$${totEstrella.toFixed(2)}`;
    if (document.getElementById('res-fam-varios')) document.getElementById('res-fam-varios').innerText = `-$${totVarios.toFixed(2)}`;
    if (document.getElementById('res-fam-total')) document.getElementById('res-fam-total').innerText = `-$${totGastFam.toFixed(2)}`;

    if (document.getElementById('res-ahorro-mes')) document.getElementById('res-ahorro-mes').innerText = `$${ahorroMes.toFixed(2)}`;
    if (document.getElementById('res-ahorro-anterior')) document.getElementById('res-ahorro-anterior').innerText = `$${ahorroAnterior.toFixed(2)}`;
    if (document.getElementById('res-caja-libre')) document.getElementById('res-caja-libre').innerText = `$${cajaLibre.toFixed(2)}`;
    if (document.getElementById('res-ahorro-dd')) document.getElementById('res-ahorro-dd').innerText = `$${ahorroDD.toFixed(2)}`;
    if (document.getElementById('res-total-fisico')) document.getElementById('res-total-fisico').innerText = `$${totalFisico.toFixed(2)}`;
}

/* ==========================================================================
   FUNCIONES AUXILIARES DE INTERFAZ Y ELIMINACIÓN
   ========================================================================== */

/**
 * Elimina un registro específico de Supabase tras pedir confirmación al usuario.
 * @param {string} tabla Nombre de la tabla en Supabase
 * @param {string} id ID único del registro a borrar
 */
async function eliminarFila(tabla, id) {
    if (confirm('¿Estás segura de eliminar este registro?')) {
        const { error } = await dbEliminarRegistro(tabla, id);
        if (error) {
            alert('Error al eliminar: ' + error.message);
        } else {
            // Refrescamos la vista adecuada según la tabla modificada
            if (tabla === 'gastos_familiares') cargarDatosFamilia();
            else cargarDatosProduccion();
        }
    }
}

/**
 * Aplica una pequeña animación CSS para dar feedback visual de éxito al guardar.
 * @param {HTMLElement} formElement Elemento <form> enviado
 */
function animarGuardadoExito(formElement) {
    const card = formElement.closest('.card');
    if (card) {
        card.classList.remove('exito-pulse');
        void card.offsetWidth; // Forzado de reflow para reiniciar la animación CSS
        card.classList.add('exito-pulse');
    }
}

document.getElementById('btn-ejecutar-busqueda')?.addEventListener('click', async () => {
    const concepto = document.getElementById('filtro-concepto').value;
    const categoria = document.getElementById('filtro-categoria').value;
    const mesesAtras = parseInt(document.getElementById('filtro-periodo').value, 10);

    // Calcular rango de fechas (Desde hace N meses hasta hoy)
    const hoy = new Date();
    const fechaFin = hoy.toISOString().split('T')[0];
    
    const fechaInicioObj = new Date(hoy.getFullYear(), hoy.getMonth() - (mesesAtras - 1), 1);
    const fechaInicio = fechaInicioObj.toISOString().split('T')[0];

    // Consultar a Supabase
    const resultados = await dbBuscarGastosAvanzado(fechaInicio, fechaFin, categoria, concepto);

    // Calcular Total y armar lista
    let totalGeneral = 0;
    const listaUI = document.getElementById('lista-busqueda-resultados');
    listaUI.innerHTML = '';

    if (resultados.length === 0) {
        listaUI.innerHTML = '<li><span>No se encontraron registros.</span></li>';
        document.getElementById('res-busqueda-total').textContent = '$0.00';
    } else {
        resultados.forEach(item => {
            totalGeneral += parseFloat(item.monto);
            const li = document.createElement('li');
            li.innerHTML = `
                <div>
                    <strong>${item.concepto}</strong> <small>(${item.categoria})</small><br>
                    <span class="fecha"><i class="fa-regular fa-calendar"></i> ${item.fecha}</span>
                </div>
                <strong class="text-red">-$${parseFloat(item.monto).toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
            `;
            listaUI.appendChild(li);
        });

        document.getElementById('res-busqueda-total').textContent = `$${totalGeneral.toLocaleString('es-AR', {minimumFractionDigits: 2})}`;
    }

    document.getElementById('resultado-busqueda-container').classList.remove('hidden');
});