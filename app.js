// 1. CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = 'https://shocrcokicbkjyoqhvil.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4XqVEqzOrlPmtH5BtyuvdA_-eaRDmOJ';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    // Establecer fecha de hoy por defecto
    const hoy = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(inp => inp.value = hoy);

    // Control de navegación por Pestañas (Solapas)
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // Mostrar/Ocultar Benja, Yaz, Estrella según categoría
    const catFamiliaSelect = document.getElementById('fam-categoria');
    const subcatHijosGroup = document.getElementById('subcat-hijos-group');

    catFamiliaSelect.addEventListener('change', (e) => {
        if (e.target.value === 'Gastos por Hijo') {
            subcatHijosGroup.classList.remove('hidden');
        } else {
            subcatHijosGroup.classList.add('hidden');
        }
    });

    // Cargar datos de ambas pestañas al iniciar la app
    cargarDatosProduccion();
    cargarDatosFamilia();

    // -------------------------------------------------------------
    // GUARDAR Y REFRESCAR DATOS
    // -------------------------------------------------------------

    // 1. Ingresos
    document.getElementById('form-ingreso-prod').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const fecha = document.getElementById('ingreso-fecha').value;
        const concepto = document.getElementById('ingreso-concepto').value;
        const monto = parseFloat(document.getElementById('ingreso-monto').value);

        const { error } = await supabaseClient
            .from('ingresos_produccion')
            .insert([{ fecha, concepto, monto }]);

        if (error) {
            alert('Error al guardar: ' + error.message);
        } else {
            animarGuardadoExito(form);
            form.reset();
            form.querySelector('input[type="date"]').value = hoy;
            cargarDatosProduccion();
        }
    });

    // 2. Gastos de Producción
    document.getElementById('form-gasto-prod').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const fecha = document.getElementById('gasto-prod-fecha').value;
        const concepto = document.getElementById('gasto-prod-concepto').value;
        const monto = parseFloat(document.getElementById('gasto-prod-monto').value);

        const { error } = await supabaseClient
            .from('gastos_produccion')
            .insert([{ fecha, concepto, monto }]);

        if (error) {
            alert('Error al guardar: ' + error.message);
        } else {
            animarGuardadoExito(form);
            form.reset();
            form.querySelector('input[type="date"]').value = hoy;
            cargarDatosProduccion();
        }
    });

    // 3. Diezmos
    document.getElementById('form-diezmo').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const fecha = document.getElementById('diezmo-fecha').value;
        const concepto = document.getElementById('diezmo-concepto').value;
        const monto = parseFloat(document.getElementById('diezmo-monto').value);

        const { error } = await supabaseClient
            .from('diezmos_entregados')
            .insert([{ fecha, concepto, monto }]);

        if (error) {
            alert('Error al guardar: ' + error.message);
        } else {
            animarGuardadoExito(form);
            form.reset();
            form.querySelector('input[type="date"]').value = hoy;
            cargarDatosProduccion();
        }
    });

    // 4. Gastos Familiares
    document.getElementById('form-gasto-fam').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const fecha = document.getElementById('fam-fecha').value;
        const categoria = catFamiliaSelect.value;
        const subcategoria = categoria === 'Gastos por Hijo' ? document.getElementById('fam-subcategoria').value : null;
        const concepto = document.getElementById('fam-concepto').value;
        const monto = parseFloat(document.getElementById('fam-monto').value);

        const { error } = await supabaseClient
            .from('gastos_familiares')
            .insert([{ fecha, categoria, subcategoria, concepto, monto }]);

        if (error) {
            alert('Error al guardar: ' + error.message);
        } else {
            animarGuardadoExito(form);
            form.reset();
            form.querySelector('input[type="date"]').value = hoy;
            subcatHijosGroup.classList.add('hidden');
            cargarDatosFamilia(); // Refrescar lista y totales de familia
        }
    });
});

// -------------------------------------------------------------
// CONSULTA Y CÁLCULOS: PRODUCCIÓN Y DIEZMO
// -------------------------------------------------------------
async function cargarDatosProduccion() {
    const { data: ingresos } = await supabaseClient.from('ingresos_produccion').select('*').order('fecha', { ascending: false });
    const { data: gastosProd } = await supabaseClient.from('gastos_produccion').select('*').order('fecha', { ascending: false });
    const { data: diezmos } = await supabaseClient.from('diezmos_entregados').select('*').order('fecha', { ascending: false });

    // Lista de Ingresos
    const listaIngresos = document.getElementById('lista-ingresos');
    listaIngresos.innerHTML = '';
    let totalIngresos = 0;
    (ingresos || []).forEach(item => {
        totalIngresos += parseFloat(item.monto);
        listaIngresos.innerHTML += `
            <li>
                <div>
                    <strong>${item.concepto}</strong>
                    <span class="fecha">${item.fecha}</span>
                </div>
                <strong>+$${parseFloat(item.monto).toFixed(2)}</strong>
            </li>`;
    });

    // Lista de Gastos Producción
    const listaGastos = document.getElementById('lista-gastos-prod');
    listaGastos.innerHTML = '';
    let totalGastosProd = 0;
    (gastosProd || []).forEach(item => {
        totalGastosProd += parseFloat(item.monto);
        listaGastos.innerHTML += `
            <li>
                <div>
                    <strong>${item.concepto}</strong>
                    <span class="fecha">${item.fecha}</span>
                </div>
                <strong style="color: #e53e3e;">-$${parseFloat(item.monto).toFixed(2)}</strong>
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
                <div>
                    <strong>${item.concepto}</strong>
                    <span class="fecha">${item.fecha}</span>
                </div>
                <strong style="color: #8a2be2;">$${parseFloat(item.monto).toFixed(2)}</strong>
            </li>`;
    });

    // Cálculos
    const ingresoNeto = totalIngresos - totalGastosProd;
    const diezmoSugerido = ingresoNeto > 0 ? ingresoNeto * 0.10 : 0;
    const diezmoPendiente = diezmoSugerido - totalDiezmoEntregado;

    // Actualizar Totales
    document.getElementById('tot-ingresos-bruto').innerText = `$${totalIngresos.toFixed(2)}`;
    document.getElementById('tot-gastos-prod').innerText = `$${totalGastosProd.toFixed(2)}`;
    document.getElementById('tot-ingreso-neto').innerText = `$${ingresoNeto.toFixed(2)}`;
    document.getElementById('tot-diezmo-sugerido').innerText = `$${diezmoSugerido.toFixed(2)}`;
    document.getElementById('tot-diezmo-pendiente').innerText = `$${diezmoPendiente.toFixed(2)}`;
}

// -------------------------------------------------------------
// CONSULTA Y CÁLCULOS: GASTOS FAMILIARES
// -------------------------------------------------------------
// -------------------------------------------------------------
// CONSULTA Y CÁLCULOS: GASTOS FAMILIARES
// -------------------------------------------------------------
async function cargarDatosFamilia() {
    const { data: gastosFam } = await supabaseClient
        .from('gastos_familiares')
        .select('*')
        .order('fecha', { ascending: false });

    const listaGastosFam = document.getElementById('lista-gastos-fam');
    listaGastosFam.innerHTML = '';

    let totalGastosFam = 0;
    let totalAlimentos = 0;
    let totalCuentas = 0;
    let totalVarios = 0;

    (gastosFam || []).forEach(item => {
        const monto = parseFloat(item.monto);
        totalGastosFam += monto;

        // Clasificación estricta en 3 grupos:
        if (item.categoria === 'Alimentos') {
            totalAlimentos += monto;
        } else if (item.categoria === 'Cuentas y Servicios') {
            totalCuentas += monto;
        } else {
            // Todo lo demás (Combustible, Limpieza, Farmacia, Varios y Gastos por Hijo) va a Gastos Varios
            totalVarios += monto;
        }

        // Formato para el historial
        const detalleSubcat = item.subcategoria ? ` (${item.subcategoria})` : '';

        listaGastosFam.innerHTML += `
            <li>
                <div>
                    <strong>${item.categoria}${detalleSubcat}</strong> - ${item.concepto}
                    <span class="fecha">${item.fecha}</span>
                </div>
                <strong style="color: #e53e3e;">-$${monto.toFixed(2)}</strong>
            </li>`;
    });

    // Actualizar tarjetas en pantalla
    document.getElementById('tot-gastos-familia').innerText = `$${totalGastosFam.toFixed(2)}`;
    document.getElementById('tot-gasto-alimentos').innerText = `$${totalAlimentos.toFixed(2)}`;
    document.getElementById('tot-gasto-cuentas').innerText = `$${totalCuentas.toFixed(2)}`;
    document.getElementById('tot-gasto-varios').innerText = `$${totalVarios.toFixed(2)}`;
}

// ANIMACIÓN NATIVA CSS
function animarGuardadoExito(formElement) {
    const card = formElement.closest('.card');
    if (card) {
        card.classList.remove('exito-pulse');
        void card.offsetWidth;
        card.classList.add('exito-pulse');
    }
}