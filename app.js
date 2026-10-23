function safeAddListener(id,event,callback) { const el=document.getElementById(id); if(el) el.addEventListener(event,callback); }
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
  document.getElementById('geo-status').textContent = 'Acerca el mapa y toca el lugar del fenómeno. Puedes mover el marcador para ajustar.';
  document.getElementById('map').focus({preventScroll:true});
  map.invalidateSize();
}
botonMapa.addEventListener('click', modoMapa);
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
const fotoCamara = document.getElementById('foto-camara');
let selectedPhoto = null;
document.getElementById('btn-galeria').addEventListener('click', () => fotoInputElement.click());
document.getElementById('btn-camara').addEventListener('click', () => fotoCamara.click());
function actualizarFoto(input) {
  const preview = document.getElementById('foto-preview');
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  preview.hidden = true; preview.removeAttribute('src');
  const file = input.files[0];
  if (!file) return;
  selectedPhoto = null;
  document.getElementById('foto-nombre').textContent='';
  input.setCustomValidity('');
  if (!file) return;
  if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
    input.value=''; document.getElementById('foto-nombre').textContent='Escoge una imagen de hasta 8 MB.'; return;
  }
  selectedPhoto = file;
  document.getElementById('foto-nombre').textContent = file.name;
  previewUrl = URL.createObjectURL(file); preview.src = previewUrl; preview.hidden = false;
}
fotoInputElement.addEventListener('change', () => actualizarFoto(fotoInputElement));
fotoCamara.addEventListener('change', () => actualizarFoto(fotoCamara));
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
    const file = selectedPhoto;
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
    selectedPhoto=null; document.getElementById('foto-nombre').textContent='';
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
const materialesReciclaje = {
 plastico: {nombre:'Plástico',icono:'🥤',total:'tot-plastico'},
 carton_papel: {nombre:'Cartón y papel',icono:'📦',total:'tot-carton'},
 vidrio: {nombre:'Vidrio',icono:'🍾',total:'tot-vidrio'},
 metal: {nombre:'Metal',icono:'🥫',total:'tot-metal'},
 ecoladrillos: {nombre:'Ecoladrillos',icono:'🧱',total:'tot-ecoladrillos'}
};
const fechaReciclaje = document.getElementById('fecha_reciclaje');
const reciclajeStatus = document.getElementById('reciclaje-status');
const formatoKg = value => new Intl.NumberFormat('es-CO',{maximumFractionDigits:2}).format(value) + ' kg';
function iniciarFechaReciclaje() {
 const hoy=horaColombia().slice(0,10);
 fechaReciclaje.value=hoy;fechaReciclaje.max=hoy;
}
iniciarFechaReciclaje();
fechaReciclaje.addEventListener('focus',()=>fechaReciclaje.max=horaColombia().slice(0,10));
function mensajeReciclaje(texto,error=false) {
 reciclajeStatus.textContent=texto;reciclajeStatus.classList.toggle('error',error);
}
safeAddListener('reciclaje-form','submit',async e=>{
 e.preventDefault();
 const button=document.getElementById('btn-reciclaje');
 if(button.disabled) return;
 const fecha=fechaReciclaje.value;
 const tipo=document.getElementById('tipo_material').value;
 const cantidad=Number(document.getElementById('cantidad_reciclaje').value);
 if(!fecha || fecha>horaColombia().slice(0,10) || !materialesReciclaje[tipo] || !Number.isFinite(cantidad) || cantidad<=0) {
  mensajeReciclaje('Revisa la fecha, el material y un peso mayor que cero.',true);return;
 }
 button.disabled=true;button.textContent='Guardando…';mensajeReciclaje('');
 try {
  const {error}=await _supabase.from('reciclaje').insert([{fecha,tipo_material:tipo,cantidad_kg:cantidad}]);
  if(error) throw error;
  document.getElementById('reciclaje-form').reset();iniciarFechaReciclaje();
  mensajeReciclaje('¡Registro guardado! '+formatoKg(cantidad)+' de '+materialesReciclaje[tipo].nombre.toLowerCase()+'. Gracias por aportar 💚');
  await cargarTotalReciclado();
 } catch(error) {
  mensajeReciclaje('No se pudo guardar. Tus datos siguen en el formulario. '+(error.message || 'Revisa la conexión e intenta de nuevo.'),true);
 } finally {button.disabled=false;button.textContent='♻️ Registrar material';}
});
let cargandoReciclaje=false;
async function cargarTotalReciclado() {
 if(cargandoReciclaje) return;
 cargandoReciclaje=true;
 const feed=document.getElementById('historial-reciclaje');
 const retry=document.getElementById('btn-recargar-reciclaje');
 retry.disabled=true;
 try {
  let registros=[],desde=0;
  while(true) {
   const {data,error}=await _supabase.from('reciclaje').select('fecha,tipo_material,cantidad_kg').order('fecha',{ascending:false}).range(desde,desde+999);
   if(error) throw error;
   registros.push(...data);
   if(data.length<1000) break;
   desde+=1000;
  }
  const totales=Object.fromEntries(Object.keys(materialesReciclaje).map(k=>[k,0]));
  let total=0;
  registros.forEach(r=>{
   const peso=Number(r.cantidad_kg);
   if(!Number.isFinite(peso)||peso<=0) return;
   total+=peso;if(r.tipo_material in totales) totales[r.tipo_material]+=peso;
  });
  for(const [tipo,material] of Object.entries(materialesReciclaje)) document.getElementById(material.total).textContent=formatoKg(totales[tipo]);
  document.getElementById('total-reciclado').textContent=formatoKg(total);
  const porcentaje=total; // Meta comunitaria de 100 kg.
  document.getElementById('goal-percentage').textContent=new Intl.NumberFormat('es-CO',{maximumFractionDigits:1}).format(porcentaje)+'%';
  const progress=document.getElementById('progress-bar-fill');
  progress.style.width=Math.min(100,porcentaje)+'%';
  document.getElementById('recycling-progress').setAttribute('aria-valuenow',Math.min(100,porcentaje));
  feed.replaceChildren();
  if(!registros.length) {const empty=document.createElement('p');empty.className='empty-feed';empty.textContent='Todavía no hay registros. ¡El primer aporte puede ser el tuyo!';feed.append(empty);}
  registros.slice(0,10).forEach(r=>{
   const material=materialesReciclaje[r.tipo_material] || {nombre:'Otro material',icono:'♻️'};
   const row=document.createElement('article');row.className='recycling-entry';
   const title=document.createElement('strong');title.textContent=material.icono+' '+material.nombre;
   const amount=document.createElement('span');amount.textContent=formatoKg(Number(r.cantidad_kg)||0);
   const date=document.createElement('small');
   const fecha=new Date(String(r.fecha).slice(0,10)+'T12:00:00-05:00');
   date.textContent=Number.isNaN(fecha.getTime()) ? 'Fecha no disponible' : fecha.toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric',timeZone:'America/Bogota'});
   row.append(title,amount,date);feed.append(row);
  });
 } catch(error) {
  feed.replaceChildren();
  const warning=document.createElement('p');warning.className='recycling-error';warning.textContent='No se pudieron cargar los registros. Usa “Actualizar registros” para intentar de nuevo.';feed.append(warning);
  document.querySelectorAll('#seccion-reciclaje .mat-card h4').forEach(el=>el.textContent='—');
  document.getElementById('total-reciclado').textContent='—';
  document.getElementById('goal-percentage').textContent='Sin datos';
 } finally {cargandoReciclaje=false;retry.disabled=false;}
}
document.getElementById('btn-recargar-reciclaje').addEventListener('click',cargarTotalReciclado);
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
