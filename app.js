const SUPABASE_URL = 'https://ftornytlczyzycccpkjv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0b3JueXRsY3p5enljY2Nwa2p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MTMxNDEsImV4cCI6MjEwNjE4OTE0MX0.-UqHHTLbSwrTvKw2ChsKR2SUN38FXpmbMf_zatbjFHk';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 1. LÓGICA DEL MAPA Y CLIMA ---
const map = L.map('map').setView([6.0560, -75.6280], 11);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);

const reportMarkers = L.layerGroup().addTo(map);
let locationMarker = null;
function seleccionarUbicacion(lat, lng) {
  document.getElementById('btn-mapa').setAttribute('aria-pressed','false');
  document.getElementById('map').classList.remove('picking');
  document.getElementById('latitud').value = lat;
  document.getElementById('longitud').value = lng;
  document.getElementById('geo-status').innerText =
    `📍 Ubicación: ${lat.toFixed(5)}, ${lng.toFixed(5)}. Puedes mover el marcador.`;
  if (locationMarker) locationMarker.setLatLng([lat, lng]);
  else {
    locationMarker = L.marker([lat, lng], { draggable: true }).addTo(map);
    locationMarker.on('dragend', () => {
      const position = locationMarker.getLatLng();
      seleccionarUbicacion(position.lat, position.lng);
    });
  }
}
map.on('click', e => seleccionarUbicacion(e.latlng.lat, e.latlng.lng));
document.getElementById('geo-status').innerText = 'Toca el mapa para seleccionar el lugar o usa tu ubicación actual.';
// Fuerza al mapa a recalcular su tamaño medio segundo después de cargar
setTimeout(() => {
  map.invalidateSize();
}, 500);

document.getElementById('tipo_evento').addEventListener('change', (e) => {
  document.getElementById('campo-lluvia').style.display = e.target.value === 'lluvia' ? 'block' : 'none';
});

const estadoReporte = document.getElementById('report-status');
const fechaEvento = document.getElementById('fecha_evento');
function horaColombia() {
  const parts = new Intl.DateTimeFormat('sv-SE', {timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
  return parts.replace(' ', 'T');
}
function prepararFecha() { fechaEvento.value = horaColombia(); fechaEvento.max = horaColombia(); }
prepararFecha();
fechaEvento.addEventListener('focus', () => { fechaEvento.max = horaColombia(); });
const botonMapa = document.getElementById('btn-mapa');
function modoMapa() {
  botonMapa.setAttribute('aria-pressed', 'true');
  document.getElementById('map').classList.add('picking');
  document.getElementById('geo-status').textContent = 'Toca el lugar del fenómeno o mueve el mapa y elige su centro.';
  document.getElementById('map').focus({preventScroll:true});
  map.invalidateSize();
}
botonMapa.addEventListener('click', modoMapa);
document.getElementById('btn-centro').addEventListener('click', () => { const p = map.getCenter(); seleccionarUbicacion(p.lat,p.lng); });
const gpsButton = document.getElementById('btn-geolocalizar');
document.getElementById('btn-geolocalizar').addEventListener('click', () => {
  const status = document.getElementById('geo-status');
  if (!navigator.geolocation) { status.textContent = 'Tu navegador no ofrece ubicación. Escoge el lugar en el mapa.'; return; }
  gpsButton.disabled = true;
  status.textContent = 'Buscando tu ubicación…';
  navigator.geolocation.getCurrentPosition(pos => {
    seleccionarUbicacion(pos.coords.latitude,pos.coords.longitude);
    map.setView([pos.coords.latitude,pos.coords.longitude],15);
    gpsButton.disabled = false;
  }, error => {
    status.textContent = error.code === 1 ? 'No se concedió permiso de ubicación. Puedes escoger el lugar en el mapa.' : 'No pudimos obtener tu ubicación. Escoge el lugar en el mapa o vuelve a intentar.';
    gpsButton.disabled = false;
  }, {enableHighAccuracy:true,timeout:15000,maximumAge:60000});
});
let previewUrl;
const fotoInputElement = document.getElementById('foto');
fotoInputElement.addEventListener('change', () => {
  const preview = document.getElementById('foto-preview');
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  preview.hidden = true; preview.removeAttribute('src');
  const file = fotoInputElement.files[0];
  fotoInputElement.setCustomValidity('');
  if (!file) return;
  if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
    fotoInputElement.setCustomValidity('Escoge una imagen de hasta 8 MB.'); fotoInputElement.reportValidity(); return;
  }
  previewUrl = URL.createObjectURL(file); preview.src = previewUrl; preview.hidden = false;
});
function construirDescripcion() {
  const value = id => document.getElementById(id).value.trim();
  return [
    'Observado: ' + value('fecha_evento').replace('T',' ') + ' (Colombia)',
    value('sector') && 'Sector: ' + value('sector'),
    value('intensidad') && 'Intensidad percibida: ' + value('intensidad'),
    value('duracion') && 'Duración aproximada: ' + value('duracion') + ' min',
    value('tipo_evento') === 'lluvia' && value('medida_mm') && value('periodo_lluvia') && 'Período del pluviómetro: ' + value('periodo_lluvia'),
    'Observación: ' + value('descripcion'),
    value('afectacion') && 'Afectación observada: ' + value('afectacion')
  ].filter(Boolean).join('\n');
}
document.getElementById('report-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (document.getElementById('btn-enviar').disabled) return;
  estadoReporte.className = '';
  estadoReporte.textContent = '';
  const lat = document.getElementById('latitud').value, lng = document.getElementById('longitud').value;
  if (!lat || !lng) {
    document.getElementById('geo-status').textContent = 'Falta el lugar del fenómeno. Usa tu ubicación o escógelo en el mapa.';
    document.getElementById('map').scrollIntoView({behavior:'smooth',block:'center'}); return;
  }
  if (fechaEvento.value > horaColombia()) { estadoReporte.textContent = 'La observación no puede tener una fecha futura.'; estadoReporte.className='error'; return; }
  const button = document.getElementById('btn-enviar'); button.disabled=true; button.textContent='Compartiendo…';
  try {
    let fotoUrl = null;
    const file = fotoInputElement.files[0];
    if (file) {
      const fileName = `clima_${crypto.randomUUID()}.${file.name.split('.').pop().replace(/[^a-z0-9]/gi,'') || 'jpg'}`;
      const {error} = await _supabase.storage.from('reportes-fotos').upload(fileName,file);
      if (error) throw new Error('No se pudo subir la foto. Tu reporte sigue aquí para que vuelvas a intentar.');
      fotoUrl = _supabase.storage.from('reportes-fotos').getPublicUrl(fileName).data.publicUrl;
    }
    const lluvia = document.getElementById('tipo_evento').value === 'lluvia';
    const {error} = await _supabase.from('reportes').insert([{
      tipo_evento:document.getElementById('tipo_evento').value,
      medida_mm:lluvia && document.getElementById('medida_mm').value !== '' ? Number(document.getElementById('medida_mm').value) : null,
      descripcion:construirDescripcion(),foto_url:fotoUrl,latitud:Number(lat),longitud:Number(lng)
    }]);
    if (error) throw new Error('No se pudo guardar: ' + error.message);
    document.getElementById('report-form').reset(); prepararFecha();
    document.getElementById('latitud').value=''; document.getElementById('longitud').value='';
    document.getElementById('campo-lluvia').style.display='none';
    document.getElementById('foto-preview').hidden=true;
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl=null; }
    if (locationMarker) {map.removeLayer(locationMarker);locationMarker=null;}
    document.getElementById('geo-status').textContent='Selecciona el lugar para un nuevo reporte.';
    estadoReporte.textContent='¡Gracias! Tu observación climática ya fue compartida con la comunidad 💚';
    estadoReporte.focus(); cargarReportes();
  } catch(error) { estadoReporte.className='error';estadoReporte.textContent=error.message || 'No pudimos conectar. Intenta nuevamente.';estadoReporte.focus(); }
  finally {button.disabled=false;button.textContent='Compartir mi reporte ↗';}
});
async function cargarReportes() {
  try {
    const {data:reportes,error} = await _supabase.from('reportes').select('*');
    if (error) throw error;
    reportMarkers.clearLayers();
    reportes.forEach(r => {
      if (r.latitud == null || r.longitud == null || r.latitud === '' || r.longitud === '') return;
      const lat=Number(r.latitud),lng=Number(r.longitud);
      if (!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180) return;
      const popup=document.createElement('div');
      const title=document.createElement('strong');title.textContent=String(r.tipo_evento || 'Observación').toUpperCase();popup.append(title);
      if (r.medida_mm != null) {const measurement=document.createElement('p');measurement.textContent='Pluviómetro: '+r.medida_mm+' mm';popup.append(measurement);}
      const description=document.createElement('p');description.textContent=r.descripcion || '';popup.append(description);
      if (r.foto_url) {try {const url=new URL(r.foto_url);if (url.protocol==='https:') {const img=document.createElement('img');img.src=url.href;img.width=180;img.alt='Fotografía del fenómeno';img.loading='lazy';popup.append(img);}} catch {}}
      L.marker([lat,lng]).addTo(reportMarkers).bindPopup(popup);
    });
  } catch { document.querySelector('.map-caption').textContent='No pudimos cargar los reportes existentes. Revisa tu conexión y recarga la página.'; }
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

// --- 3. LÓGICA DE RECICLAJE ---
document.getElementById('reciclaje-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const btnReciclaje = document.getElementById('btn-reciclaje');
  btnReciclaje.innerText = "Guardando...";
  btnReciclaje.disabled = true;

  const fecha = document.getElementById('fecha_reciclaje').value;
  const tipo = document.getElementById('tipo_material').value;
  const cantidad = parseFloat(document.getElementById('cantidad_reciclaje').value);
  
  // Insertar en la tabla 'reciclaje'
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
    cargarTotalReciclado(); // Actualizamos el contador automáticamente
  }

  btnReciclaje.innerText = "
