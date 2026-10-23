const SUPABASE_URL = 'https://ftornytlczyzycccpkjv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0b3JueXRsY3p5enljY2Nwa2p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MTMxNDEsImV4cCI6MjEwNjE4OTE0MX0.-UqHHTLbSwrTvKw2ChsKR2SUN38FXpmbMf_zatbjFHk';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Función auxiliar para evitar fallos si un elemento HTML no existe
function safeAddListener(id, event, callback) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, callback);
}

// --- 1. LÓGICA DEL MAPA Y CLIMA ---
const map = L.map('map').setView([6.0560, -75.6280], 11);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);

const reportMarkers = L.layerGroup().addTo(map);
let locationMarker = null;

function seleccionarUbicacion(lat, lng) {
  const btnMapa = document.getElementById('btn-mapa');
  if (btnMapa) btnMapa.setAttribute('aria-pressed', 'false');
  
  const mapEl = document.getElementById('map');
  if (mapEl) mapEl.classList.remove('picking');
  
  const latEl = document.getElementById('latitud');
  const lngEl = document.getElementById('longitud');
  if (latEl) latEl.value = lat;
  if (lngEl) lngEl.value = lng;
  
  const geoStatus = document.getElementById('geo-status');
  if (geoStatus) {
    geoStatus.innerText = `📍 Ubicación: ${lat.toFixed(5)}, ${lng.toFixed(5)}. Puedes mover el marcador.`;
  }

  if (locationMarker) {
    locationMarker.setLatLng([lat, lng]);
  } else {
    locationMarker = L.marker([lat, lng], { draggable: true }).addTo(map);
    locationMarker.on('dragend', () => {
      const position = locationMarker.getLatLng();
      seleccionarUbicacion(position.lat, position.lng);
    });
  }
}

map.on('click', e => seleccionarUbicacion(e.latlng.lat, e.latlng.lng));

setTimeout(() => {
  map.invalidateSize();
}, 500);

// Mostrar/Ocultar pluviómetro
safeAddListener('tipo_evento', 'change', (e) => {
  const campoLluvia = document.getElementById('campo-lluvia');
  if (campoLluvia) campoLluvia.style.display = e.target.value === 'lluvia' ? 'block' : 'none';
});

// Geolocalización por GPS
safeAddListener('btn-geolocalizar', 'click', () => {
  const status = document.getElementById('geo-status');
  const gpsButton = document.getElementById('btn-geolocalizar');
  
  if (!navigator.geolocation) {
    if (status) status.textContent = 'Tu navegador no ofrece ubicación. Escoge el lugar en el mapa.';
    return;
  }
  
  if (gpsButton) gpsButton.disabled = true;
  if (status) status.textContent = 'Buscando tu ubicación…';
  
  navigator.geolocation.getCurrentPosition(
    pos => {
      seleccionarUbicacion(pos.coords.latitude, pos.coords.longitude);
      map.setView([pos.coords.latitude, pos.coords.longitude], 15);
      if (gpsButton) gpsButton.disabled = false;
    },
    error => {
      if (status) {
        status.textContent = error.code === 1 
          ? 'No se concedió permiso de ubicación. Puedes escoger el lugar en el mapa.' 
          : 'No pudimos obtener tu ubicación. Escoge el lugar en el mapa.';
      }
      if (gpsButton) gpsButton.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
});

// Envío del formulario de Clima
safeAddListener('report-form', 'submit', async (e) => {
  e.preventDefault();
  
  const latEl = document.getElementById('latitud');
  const lngEl = document.getElementById('longitud');
  const lat = latEl ? latEl.value : null;
  const lng = lngEl ? lngEl.value : null;

  if (!lat || !lng) {
    alert("Por favor selecciona una ubicación en el mapa o usa tu GPS.");
    return;
  }

  const btnEnviar = document.getElementById('btn-enviar');
  if (btnEnviar) {
    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Guardando…';
  }

  try {
    let fotoUrl = null;
    const fotoInput = document.getElementById('foto');
    const file = fotoInput && fotoInput.files ? fotoInput.files[0] : null;

    if (file) {
      const fileName = `clima_${Date.now()}_${file.name}`;
      const { error: storageError } = await _supabase.storage.from('reportes-fotos').upload(fileName, file);
      if (!storageError) {
        fotoUrl = `${SUPABASE_URL}/storage/v1/object/public/reportes-fotos/${fileName}`;
      }
    }

    const tipoEvento = document.getElementById('tipo_evento').value;
    const medidaMm = document.getElementById('medida_mm');
    const descripcion = document.getElementById('descripcion');

    const { error } = await _supabase.from('reportes').insert([{
      tipo_evento: tipoEvento,
      medida_mm: (tipoEvento === 'lluvia' && medidaMm && medidaMm.value) ? Number(medidaMm.value) : null,
      descripcion: descripcion ? descripcion.value : '',
      foto_url: fotoUrl,
      latitud: Number(lat),
      longitud: Number(lng)
    }]);

    if (error) throw error;

    alert("¡Reporte publicado exitosamente! 🌧️");
    document.getElementById('report-form').reset();
    if (locationMarker) {
      map.removeLayer(locationMarker);
      locationMarker = null;
    }
    cargarReportes();
  } catch (error) {
    alert("Error al guardar el reporte: " + error.message);
  } finally {
    if (btnEnviar) {
      btnEnviar.disabled = false;
      btnEnviar.textContent = 'Guardar Reporte';
    }
  }
});

async function cargarReportes() {
  try {
    const { data: reportes, error } = await _supabase.from('reportes').select('*');
    if (error) throw error;
    reportMarkers.clearLayers();
    reportes.forEach(r => {
      if (r.latitud == null || r.longitud == null) return;
      const lat = Number(r.latitud), lng = Number(r.longitud);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      
      const popup = `
        <b>${String(r.tipo_evento || 'Reporte').toUpperCase()}</b><br>
        ${r.medida_mm ? `Pluviómetro: ${r.medida_mm} mm<br>` : ''}
        <p>${r.descripcion || ''}</p>
        ${r.foto_url ? `<img src="${r.foto_url}" width="160px" style="border-radius:6px; margin-top:5px;"/>` : ''}
      `;
      L.marker([lat, lng]).addTo(reportMarkers).bindPopup(popup);
    });
  } catch (err) {
    console.warn("No se pudieron cargar los reportes anteriores:", err);
  }
}
cargarReportes();

// --- 2. LÓGICA DE COMPOSTAJE ---
safeAddListener('compost-form', 'submit', async (e) => {
  e.preventDefault();
  
  const btnCompost = document.getElementById('btn-compost');
  if (btnCompost) {
    btnCompost.innerText = "Guardando...";
    btnCompost.disabled = true;
  }

  const fecha = document.getElementById('fecha_compost').value;
  const peso = parseFloat(document.getElementById('peso_kg').value);
  const estado = document.getElementById('estado_paca').value;
  const observaciones = document.getElementById('obs_compost').value;
  
  const fotoInputEl = document.getElementById('foto_compost');
  const fotoInput = fotoInputEl && fotoInputEl.files ? fotoInputEl.files[0] : null;
  let fotoUrl = null;

  if (fotoInput) {
    const fileName = `compost_${Date.now()}_${fotoInput.name}`;
    const { error: storageError } = await _supabase.storage
      .from('reportes-fotos')
      .upload(fileName, fotoInput);

    if (!storageError) {
      fotoUrl = `${SUPABASE_URL}/storage/v1/object/public/reportes-fotos/${fileName}`;
    }
  }

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
    cargarTotalCompostado();
  }

  if (btnCompost) {
    btnCompost.innerText = "Guardar Registro de Compostaje";
    btnCompost.disabled = false;
  }
});

async function cargarTotalCompostado() {
  const { data, error } = await _supabase.from('compostaje').select('peso_kg');
  if (error) return;

  const total = data.reduce((suma, registro) => suma + (registro.peso_kg || 0), 0);
  const totalEl = document.getElementById('total-compostado');
  if (totalEl) totalEl.innerText = `${total.toFixed(1)} kg`;
}
cargarTotalCompostado();

// --- 3. LÓGICA DE RECICLAJE ---
safeAddListener('reciclaje-form', 'submit', async (e) => {
  e.preventDefault();
  
  const btnReciclaje = document.getElementById('btn-reciclaje');
  if (btnReciclaje) {
    btnReciclaje.innerText = "Guardando...";
    btnReciclaje.disabled = true;
  }

  const fecha = document.getElementById('fecha_reciclaje').value;
  const tipo = document.getElementById('tipo_material').value;
  const cantidad = parseFloat(document.getElementById('cantidad_reciclaje').value);
  
  const { error } = await _supabase.from('reciclaje').insert([{
    fecha: fecha,
    tipo_material: tipo,
    cantidad_kg: cantidad
  }]);

  if (error) {
    alert("Error al guardar el reciclaje: " + error.message);
  } else {
    alert("¡Registro de reciclaje guardado con éxito! ♻️");
    document.getElementById('reciclaje-form').reset();
    cargarTotalReciclado();
  }

  if (btnReciclaje) {
    btnReciclaje.innerText = "Registrar Reciclaje";
    btnReciclaje.disabled = false;
  }
});

async function cargarTotalReciclado() {
  const { data, error } = await _supabase.from('reciclaje').select('cantidad_kg');
  if (error) return;

  const total = data.reduce((suma, registro) => suma + (registro.cantidad_kg || 0), 0);
  const totalEl = document.getElementById('total-reciclado');
  if (totalEl) totalEl.innerText = `${total.toFixed(1)} kg`;
}
cargarTotalReciclado();

// --- 4. LÓGICA DE NAVEGACIÓN (TABS) ---
const tabButtons = document.querySelectorAll('.tab-btn');
const tabSections = document.querySelectorAll('.tab-section');

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabSections.forEach(sec => sec.classList.remove('active'));

    button.classList.add('active');

    const targetId = button.getAttribute('data-target');
    const targetSection = document.getElementById(targetId);
    if (targetSection) targetSection.classList.add('active');

    if (targetId === 'seccion-clima') {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
  });
});
