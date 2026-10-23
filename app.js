const SUPABASE_URL = 'AQUÍ_PEGA_TU_PROJECT_URL';
const SUPABASE_ANON_KEY = 'AQUÍ_PEGA_TU_ANON_KEY';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Inicializar Mapa centrado en una ubicación por defecto
const map = L.map('map').setView([6.0560, -75.6280], 11);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);

// 👇 ESTA ES LA SOLUCIÓN AGREGADA 👇
// Fuerza al mapa a recalcular su tamaño medio segundo después de cargar
setTimeout(() => {
  map.invalidateSize();
}, 500);
// 👆 ---------------------------- 👆

// Mostrar el campo del pluviómetro solo si eligen 'lluvia'
document.getElementById('tipo_evento').addEventListener('change', (e) => {
  document.getElementById('campo-lluvia').style.display = e.target.value === 'lluvia' ? 'block' : 'none';
});

// Capturar ubicación con GPS del celular/computador
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

// Enviar reporte a Supabase
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

  // Si hay foto, la subimos a Storage
  if (fotoInput) {
    const fileName = `${Date.now()}_${fotoInput.name}`;
    const { data, error: storageError } = await _supabase.storage
      .from('reportes-fotos')
      .upload(fileName, fotoInput);

    if (!storageError) {
      fotoUrl = `${SUPABASE_URL}/storage/v1/object/public/reportes-fotos/${fileName}`;
    }
  }

  // Guardar en la base de datos
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

// Cargar todos los reportes comunitarios en el mapa
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

// --- LÓGICA DE NAVEGACIÓN (TABS) ---
const tabButtons = document.querySelectorAll('.tab-btn');
const tabSections = document.querySelectorAll('.tab-section');

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    // 1. Quitar la clase 'active' de todos los botones y secciones
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabSections.forEach(sec => sec.classList.remove('active'));

    // 2. Añadir clase 'active' al botón clickeado
    button.classList.add('active');

    // 3. Mostrar la sección correspondiente
    const targetId = button.getAttribute('data-target');
    const targetSection = document.getElementById(targetId);
    targetSection.classList.add('active');

    // 4. Si volvemos a la pestaña de clima, re-ajustar el mapa (soluciona error visual de Leaflet)
    if (targetId === 'seccion-clima') {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
  });
});
