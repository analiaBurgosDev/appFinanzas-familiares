// Función auxiliar para leer el Año y Mes seleccionado en el selector global
function getPeriodoActivo() {
    const val = document.getElementById('select-mes-global')?.value;
    if (!val) {
        const hoy = new Date();
        return { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 };
    }
    const [anio, mes] = val.split('-');
    return { anio: parseInt(anio), mes: parseInt(mes) };
}

document.addEventListener('DOMContentLoaded', () => {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];
    const anioActual = hoy.getFullYear();
    const mesActualStr = String(hoy.getMonth() + 1).padStart(2, '0');

    // 1. Cargar fecha de hoy en formularios
    document.querySelectorAll('input[type="date"]').forEach(inp => inp.value = hoyStr);

    // 2. Setear selector global de mes
    const selectMes = document.getElementById('select-mes-global');
    if (selectMes) {
        selectMes.value = `${anioActual}-${mesActualStr}`;
        selectMes.addEventListener('change', () => {
            // Refrescar todas las pantallas al cambiar de mes
            cargarDatosProduccion();
            cargarDatosFamilia();
            cargarGranResumen();
        });
    }

    // 3. Navegación por Solapas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetTab = btn.dataset.tab;
            document.getElementById(targetTab).classList.add('active');

            if (targetTab === 'tab-resumen') {
                cargarGranResumen();
            }
        });
    });

    // 4. Desplegable de Hijos
    const catFamiliaSelect = document.getElementById('fam-categoria');
    const subcatHijosGroup = document.getElementById('subcat-hijos-group');

    catFamiliaSelect.addEventListener('change', (e) => {
        if (e.target.value === 'Gastos por Hijo') {
            subcatHijosGroup.classList.remove('hidden');
        } else {
            subcatHijosGroup.classList.add('hidden');
        }
    });

    // 5. Carga inicial
    cargarDatosProduccion();
    cargarDatosFamilia();
    cargarGranResumen();

    // --- FORMULARIO INGRESOS ---
    document.getElementById('form-ingreso-prod').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const { error } = await dbInsertarIngreso(
            document.getElementById('ingreso-fecha').value,
            document.getElementById('ingreso-concepto').value,
            parseFloat(document.getElementById('ingreso-monto').value)
        );

        if (error) return alert('Error: ' + error.message);
        animarGuardadoExito(form);
        form.reset();
        form.querySelector('input[type="date"]').value = hoyStr;
        cargarDatosProduccion();
    });

    // --- FORMULARIO GASTOS PROD ---
    document.getElementById('form-gasto-prod').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const { error } = await dbInsertarGastoProd(
            document.getElementById('gasto-prod-fecha').value,
            document.getElementById('gasto-prod-concepto').value,
            parseFloat(document.getElementById('gasto-prod-monto').value)
        );

        if (error) return alert('Error: ' + error.message);
        animarGuardadoExito(form);
        form.reset();
        form.querySelector('input[type="date"]').value = hoyStr;
        cargarDatosProduccion();
    });

    // --- FORMULARIO DIEZMOS ---
    document.getElementById('form-diezmo').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const { error } = await dbInsertarDiezmo(
            document.getElementById('diezmo-fecha').value,
            document.getElementById('diezmo-concepto').value,
            parseFloat(document.getElementById('diezmo-monto').value)
        );

        if (error) return alert('Error: ' + error.message);
        animarGuardadoExito(form);
        form.reset();
        form.querySelector('input[type="date"]').value = hoyStr;
        cargarDatosProduccion();
    });

    // --- FORMULARIO GASTOS FAMILIA ---
    document.getElementById('form-gasto-fam').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const categoria = catFamiliaSelect.value;
        const subcategoria = categoria === 'Gastos por Hijo' ? document.getElementById('fam-subcategoria').value : null;

        const { error } = await dbInsertarGastoFam(
            document.getElementById('fam-fecha').value,
            categoria,
            subcategoria,
            document.getElementById('fam-concepto').value,
            parseFloat(document.getElementById('fam-monto').value)
        );

        if (error) return alert('Error: ' + error.message);
        animarGuardadoExito(form);
        form.reset();
        form.querySelector('input[type="date"]').value = hoyStr;
        subcatHijosGroup.classList.add('hidden');
        cargarDatosFamilia();
    });

    // --- EVENTO PARA EDITAR AHORRO ACUMULADO ---
    document.getElementById('btn-editar-ahorro')?.addEventListener('click', async () => {
        const actual = await dbObtenerAhorroAcumulado();
        const nuevo = prompt('Ingresá el nuevo monto de Ahorro Acumulado Anterior:', actual);
        if (nuevo !== null && !isNaN(parseFloat(nuevo))) {
            await dbGuardarAhorroAcumulado(parseFloat(nuevo));
            cargarGranResumen();
        }
    });

    // --- EVENTO PARA CIERRE Y REINICIO DE MES ---
    document.getElementById('btn-reiniciar-mes')?.addEventListener('click', async () => {
        if (confirm('¿Estás segura de cerrar el mes? Esto sumará el saldo del mes al Ahorro Acumulado y pasarás al siguiente período.')) {
            const { anio, mes } = getPeriodoActivo();
            const ahorroAnterior = await dbObtenerAhorroAcumulado();
            
            const { ingresos, gastosProd } = await dbObtenerProduccionYDiezmo(anio, mes);
            const gastosFam = await dbObtenerGastosFamilia(anio, mes);
            
            let ingBruto = 0, gastProd = 0, gastFam = 0;
            (ingresos || []).forEach(i => ingBruto += parseFloat(i.monto));
            (gastosProd || []).forEach(g => gastProd += parseFloat(g.monto));
            (gastosFam || []).forEach(f => gastFam += parseFloat(f.monto));
            
            const ingNeto = ingBruto - gastProd;
            const ingLiquido = ingNeto - (ingNeto > 0 ? ingNeto * 0.10 : 0);
            const ahorroMes = ingLiquido - gastFam;

            const nuevoAhorroTotal = ahorroAnterior + ahorroMes;

            await dbCerrarMes(nuevoAhorroTotal);
            
            alert('¡Mes cerrado con éxito! Se ha actualizado el Ahorro Acumulado.');
            
            cargarDatosProduccion();
            cargarDatosFamilia();
            cargarGranResumen();
        }
    });
});

// -------------------------------------------------------------
// RENDERIZADO Y CÁLCULOS PRODUCCIÓN
// -------------------------------------------------------------
async function cargarDatosProduccion() {
    const { anio, mes } = getPeriodoActivo();
    const { ingresos, gastosProd, diezmos } = await dbObtenerProduccionYDiezmo(anio, mes);

    // Lista de Ingresos
    const listaIngresos = document.getElementById('lista-ingresos');
    listaIngresos.innerHTML = '';
    let totalIngresos = 0;
    (ingresos || []).forEach(item => {
        totalIngresos += parseFloat(item.monto);
        listaIngresos.innerHTML += `
            <li>
                <div><strong>${item.concepto}</strong><span class="fecha">${item.fecha}</span></div>
                <div>
                    <strong style="margin-right: 8px;">+$${parseFloat(item.monto).toFixed(2)}</strong>
                    <button class="btn-delete" onclick="eliminarFila('ingresos_produccion', '${item.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </li>`;
    });

    // Lista de Gastos Prod
    const listaGastos = document.getElementById('lista-gastos-prod');
    listaGastos.innerHTML = '';
    let totalGastosProd = 0;
    (gastosProd || []).forEach(item => {
        totalGastosProd += parseFloat(item.monto);
        listaGastos.innerHTML += `
            <li>
                <div><strong>${item.concepto}</strong><span class="fecha">${item.fecha}</span></div>
                <div>
                    <strong style="color: #e53e3e; margin-right: 8px;">-$${parseFloat(item.monto).toFixed(2)}</strong>
                    <button class="btn-delete" onclick="eliminarFila('gastos_produccion', '${item.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </li>`;
    });

    // Lista de Diezmos
    const listaDiezmos = document.getElementById('lista-diezmos');
    listaDiezmos.innerHTML = '';
    let totalDiezmoEntregado = 0;
    (diezmos || []).forEach(item => {
        totalDiezmoEntregado += parseFloat(item.monto);
        listaDiezmos.innerHTML += `
            <li>
                <div><strong>${item.concepto}</strong><span class="fecha">${item.fecha}</span></div>
                <div>
                    <strong style="color: #8a2be2; margin-right: 8px;">$${parseFloat(item.monto).toFixed(2)}</strong>
                    <button class="btn-delete" onclick="eliminarFila('diezmos_entregados', '${item.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </li>`;
    });

    // Totales
    const ingresoNeto = totalIngresos - totalGastosProd;
    const diezmoSugerido = ingresoNeto > 0 ? ingresoNeto * 0.10 : 0;
    const diezmoPendiente = diezmoSugerido - totalDiezmoEntregado;

    document.getElementById('tot-ingresos-bruto').innerText = `$${totalIngresos.toFixed(2)}`;
    document.getElementById('tot-gastos-prod').innerText = `$${totalGastosProd.toFixed(2)}`;
    document.getElementById('tot-ingreso-neto').innerText = `$${ingresoNeto.toFixed(2)}`;
    document.getElementById('tot-diezmo-sugerido').innerText = `$${diezmoSugerido.toFixed(2)}`;
    document.getElementById('tot-diezmo-pendiente').innerText = `$${diezmoPendiente.toFixed(2)}`;

    cargarGranResumen();
}

// -------------------------------------------------------------
// RENDERIZADO Y CÁLCULOS GASTOS FAMILIA
// -------------------------------------------------------------
async function cargarDatosFamilia() {
    const { anio, mes } = getPeriodoActivo();
    const gastosFam = await dbObtenerGastosFamilia(anio, mes);
    const listaGastosFam = document.getElementById('lista-gastos-fam');
    listaGastosFam.innerHTML = '';

    let totalGastosFam = 0, totalAlimentos = 0, totalCuentas = 0, totalVarios = 0;

    gastosFam.forEach(item => {
        const monto = parseFloat(item.monto);
        totalGastosFam += monto;

        if (item.categoria === 'Alimentos') totalAlimentos += monto;
        else if (item.categoria === 'Cuentas y Servicios') totalCuentas += monto;
        else totalVarios += monto;

        const detalleSubcat = item.subcategoria ? ` (${item.subcategoria})` : '';

        listaGastosFam.innerHTML += `
            <li>
                <div><strong>${item.categoria}${detalleSubcat}</strong> - ${item.concepto}<span class="fecha">${item.fecha}</span></div>
                <div>
                    <strong style="color: #e53e3e; margin-right: 8px;">-$${monto.toFixed(2)}</strong>
                    <button class="btn-delete" onclick="eliminarFila('gastos_familiares', '${item.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </li>`;
    });

    document.getElementById('tot-gastos-familia').innerText = `$${totalGastosFam.toFixed(2)}`;
    document.getElementById('tot-gasto-alimentos').innerText = `$${totalAlimentos.toFixed(2)}`;
    document.getElementById('tot-gasto-cuentas').innerText = `$${totalCuentas.toFixed(2)}`;
    document.getElementById('tot-gasto-varios').innerText = `$${totalVarios.toFixed(2)}`;

    cargarGranResumen();
}

// -------------------------------------------------------------
// CÁLCULO DEL GRAN RESUMEN Y CAJA
// -------------------------------------------------------------
async function cargarGranResumen() {
    const { anio, mes } = getPeriodoActivo();
    const { ingresos, gastosProd, diezmos } = await dbObtenerProduccionYDiezmo(anio, mes);
    const gastosFam = await dbObtenerGastosFamilia(anio, mes);
    const ahorroAnterior = await dbObtenerAhorroAcumulado();

    // 1. Producción
    let totIngBruto = 0, totGastProd = 0, totDDEntregado = 0;
    (ingresos || []).forEach(i => totIngBruto += parseFloat(i.monto));
    (gastosProd || []).forEach(g => totGastProd += parseFloat(g.monto));
    (diezmos || []).forEach(d => totDDEntregado += parseFloat(d.monto));

    const ingNeto = totIngBruto - totGastProd;
    const ddCalculado = ingNeto > 0 ? ingNeto * 0.10 : 0;
    const ingLiquido = ingNeto - ddCalculado;

    // 2. Gastos Familiares
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

    // 3. Balance Final
    const ahorroMes = ingLiquido - totGastFam;
    const cajaLibre = ahorroMes + ahorroAnterior;
    const ahorroDD = ddCalculado - totDDEntregado;
    const totalFisico = cajaLibre + ahorroDD;

    // Renderizado en pantalla
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

// -------------------------------------------------------------
// AUXILIARES
// -------------------------------------------------------------
async function eliminarFila(tabla, id) {
    if (confirm('¿Estás segura de eliminar este registro?')) {
        const { error } = await dbEliminarRegistro(tabla, id);
        if (error) alert('Error: ' + error.message);
        else {
            if (tabla === 'gastos_familiares') cargarDatosFamilia();
            else cargarDatosProduccion();
        }
    }
}

function animarGuardadoExito(formElement) {
    const card = formElement.closest('.card');
    if (card) {
        card.classList.remove('exito-pulse');
        void card.offsetWidth;
        card.classList.add('exito-pulse');
    }
}

// Control de Sesión al iniciar la app
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Establecer fecha de hoy en inputs tipo date
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(inp => inp.value = hoyStr);

    // 2. Setear selector global de mes
    const selectMes = document.getElementById('select-mes-global');
    if (selectMes) {
        const anioActual = hoy.getFullYear();
        const mesActualStr = String(hoy.getMonth() + 1).padStart(2, '0');
        selectMes.value = `${anioActual}-${mesActualStr}`;
        selectMes.addEventListener('change', () => {
            cargarDatosProduccion();
            cargarDatosFamilia();
            cargarGranResumen();
        });
    }

    // 3. Verificar si hay usuario autenticado
    const usuario = await dbObtenerUsuarioActual();

    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.querySelector('.app-container');
    const btnLogout = document.getElementById('btn-logout');

    if (!usuario) {
        if (loginScreen) loginScreen.classList.remove('hidden');
        if (appContainer) appContainer.classList.add('hidden');
        if (btnLogout) btnLogout.classList.add('hidden');
    } else {
        if (loginScreen) loginScreen.classList.add('hidden');
        if (appContainer) appContainer.classList.remove('hidden');
        if (btnLogout) btnLogout.classList.remove('hidden');

        // Cargar datos de la app
        cargarDatosProduccion();
        cargarDatosFamilia();
        cargarGranResumen();
    }
});


// Evento Submit del Login
document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { data, error } = await dbIniciarSesion(email, password);

    if (error) {
        alert('Error al iniciar sesión: ' + error.message);
    } else {
        location.reload(); // Recarga para levantar la sesión autenticada
    }
});

// EVENTO PARA CERRAR SESIÓN
document.getElementById('btn-logout')?.addEventListener('click', async () => {
    if (confirm('¿Querés cerrar la sesión?')) {
        const { error } = await dbCerrarSesion();
        if (error) {
            alert('Error al cerrar sesión: ' + error.message);
        } else {
            // Limpia la sesión y recarga para volver al login
            window.location.reload();
        }
    }
});