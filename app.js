const SUPABASE_URL = 'AQUÍ_PEGA_TU_PROJECT_URL';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0b3JueXRsY3p5enljY2Nwa2p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MTMxNDEsImV4cCI6MjEwNjE4OTE0MX0.-UqHHTLbSwrTvKw2ChsKR2SUN38FXpmbMf_zatbjFHk';
const _supabase = supabase.createClient(https://ftornytlczyzycccpkjv.supabase.co/rest/v1/);

// --- 1. LÓGICA DEL MAPA Y CLIMA ---
const map = L.map('map').setView([6.0560, -75.6280], 11);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);

// Fuerza al mapa a recalcular su tamaño medio segundo después de cargar
setTimeout(() => {
  map.invalidateSize();
}, 500);

document.getElementById('tipo_evento').addEventListener('change', (e) => {
  document.getElementById('campo-lluvia').style.display = e.target.value === 'lluvia' ? 'block' : 'none';
});

document.getElementById('btn-geolocalizar').addEventListener('click', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      document.getElementById('latitud').value = lat;
      document.getElementById('longitud').value = lng;
      document.getElementById('geo-status').innerText = `📍 Ubicación: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      map.setView([lat, lng], 15);
      L.marker([lat, lng]).addTo(map).bindPopup("Tu ubicación actual").openPopup();
    }, () => alert("Por favor activa el permiso de ubicación/GPS en tu navegador."));
  }
});

document.getElementById('report-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const lat = document.getElementById('latitud').value;
  const lng = document.getElementById('longitud').value;

  if (!lat || !lng) {
    alert("Haz clic en 'Usar mi ubicación actual' antes de enviar.");
    return;
  }

  const fotoInput = document.getElementById('foto').files[0];
  let fotoUrl = null;

  if (fotoInput) {
    const fileName = `${Date.now()}_${fotoInput.name}`;
    const { data, error: storageError } = await _supabase.storage
      .from('reportes-fotos')
      .upload(fileName, fotoInput);

    if (!storageError) {
      fotoUrl = `${SUPABASE_URL}/storage/v1/object/public/reportes-fotos/${fileName}`;
    }
  }

  const { error } = await _supabase.from('reportes').insert([{
    tipo_evento: document.getElementById('tipo_evento').value,
    medida_mm: document.getElementById('medida_mm').value || null,
    descripcion: document.getElementById('descripcion').value,
    foto_url: fotoUrl,
    latitud: parseFloat(lat),
    longitud: parseFloat(lng)
  }]);

  if (error) {
    alert("Error al guardar: " + error.message);
  } else {
    alert("¡Reporte publicado exitosamente!");
    document.getElementById('report-form').reset();
    cargarReportes();
  }
});

async function cargarReportes() {
  const { data: reportes, error } = await _supabase.from('reportes').select('*');
  if (error) return;

  reportes.forEach(r => {
    const popup = `
      <b>${r.tipo_evento.toUpperCase()}</b><br>
      ${r.medida_mm ? `Pluviómetro: ${r.medida_mm} mm<br>` : ''}
      <p>${r.descripcion || ''}</p>
      ${r.foto_url ? `<img src="${r.foto_url}" width="160px" style="border-radius:6px; margin-top:5px;"/>` : ''}
    `;
    L.marker([r.latitud, r.longitud]).addTo(map).bindPopup(popup);
  });
}
cargarReportes();

// --- 2. LÓGICA DE COMPOSTAJE ---
document.getElementById('compost-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const btnCompost = document.getElementById('btn-compost');
  btnCompost.innerText = "Guardando...";
  btnCompost.disabled = true;

  const fecha = document.getElementById('fecha_compost').value;
  const peso = parseFloat(document.getElementById('peso_kg').value);
  const estado = document.getElementById('estado_paca').value;
  const observaciones = document.getElementById('obs_compost').value;
  const fotoInput = document.getElementById('foto_compost').files[0];
  
  let fotoUrl = null;

  // Subir foto si existe (usamos el mismo bucket de las del clima)
  if (fotoInput) {
    const fileName = `compost_${Date.now()}_${fotoInput.name}`;
    const { data, error: storageError } = await _supabase.storage
      .from('reportes-fotos')
      .upload(fileName, fotoInput);

    if (!storageError) {
      fotoUrl = `${SUPABASE_URL}/storage/v1/object/public/reportes-fotos/${fileName}`;
    }
  }

  // Insertar en la tabla 'compostaje'
  const { error } = await _supabase.from('compostaje').insert([{
    fecha: fecha,
    peso_kg: peso,
    estado: estado,
    observaciones: observaciones,
    foto_url: fotoUrl
  }]);

  if (error) {
    alert("Error al guardar el compostaje: " + error.message);
  } else {
    alert("¡Registro de compostaje guardado con éxito! 🌱");
    document.getElementById('compost-form').reset();
    cargarTotalCompostado(); // Actualizamos el contador automáticamente
  }

  btnCompost.innerText = "Guardar Registro de Compostaje";
  btnCompost.disabled = false;
});

// Función para sumar y mostrar el total de kilos compostados
async function cargarTotalCompostado() {
  const { data, error } = await _supabase.from('compostaje').select('peso_kg');
  if (error) return;

  const total = data.reduce((suma, registro) => suma + (registro.peso_kg || 0), 0);
  document.getElementById('total-compostado').innerText = `${total.toFixed(1)} kg`;
}
// Cargar el contador al iniciar la app
cargarTotalCompostado();

// --- 3. LÓGICA DE NAVEGACIÓN (TABS) ---
const tabButtons = document.querySelectorAll('.tab-btn');
const tabSections = document.querySelectorAll('.tab-section');

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabSections.forEach(sec => sec.classList.remove('active'));

    button.classList.add('active');

    const targetId = button.getAttribute('data-target');
    const targetSection = document.getElementById(targetId);
    targetSection.classList.add('active');

    if (targetId === 'seccion-clima') {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
  });
});
