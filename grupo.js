/* Grupo WSD sin cuentas: clave compartida validada en servidor. */
(()=>{
const $=id=>document.getElementById(id);
let actual=null,listado=[],clave='',correo='';
const msg=s=>{$('ws-estado').textContent=s};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const campos=['fecha','titulo','lugar','objetivo','participantes','actividades','resultados','dificultades','compromisos','proxima_reunion'];
async function api(action,values){
 const response=await fetch('/api/grupo',{method:'POST',headers:{'Content-Type':'application/json','x-wsd-key':clave,'x-wsd-email':correo},body:JSON.stringify({action,...values})});
 const data=await response.json();if(!response.ok)throw Error(data.error||'Error del servidor');return data;
}
async function cargar(){
 try{const r=await fetch('/api/grupo');const data=await r.json();if(!r.ok)throw Error(data.error);listado=data.data||[];dibujar();msg('Historial actualizado.');}catch(e){msg('No se pudo consultar: '+e.message)}
}
function dibujar(){
 const filtro=$('ws-buscar').value.toLowerCase();const rows=listado.filter(x=>(x.titulo+' '+x.fecha+' '+(x.objetivo||'')).toLowerCase().includes(filtro));
 $('ws-total').textContent=listado.length;
 $('ws-historial').innerHTML=rows.length?rows.map(x=>`<article class="ws-item"><div><strong>${esc(x.titulo)}</strong><p>${esc(x.fecha)} · ${esc(x.lugar||'Lugar sin registrar')}</p></div><button type="button" class="secondary ws-abrir" data-id="${x.id}">Ver / editar</button></article>`).join(''):'<p>No hay reuniones para mostrar.</p>';
}
const acceso=document.createElement('section');
acceso.className='ws-login-card';acceso.id='ws-ingreso';
acceso.innerHTML=`<div class="ws-login-intro"><span class="ws-login-badge">ESPACIO DEL EQUIPO</span><h3>La memoria de nuestras ideas 🌱</h3><p>Registra reuniones, comparte aprendizajes y guarda las bitácoras de Weather Scientists.</p><small>El historial de reuniones está abierto para todos.</small></div><form id="ws-login-form"><h3>Ingresa a las bitácoras</h3><label for="ws-login-email">Correo del grupo</label><input id="ws-login-email" name="correo" type="email" autocomplete="username" required placeholder="weatherscientists@claudinamunera.edu.co"><label for="ws-login-password">Contraseña</label><div class="ws-login-password"><input id="ws-login-password" name="clave" type="password" autocomplete="current-password" required placeholder="Escribe la contraseña del grupo"><button type="button" id="ws-login-toggle" aria-label="Mostrar contraseña" aria-pressed="false">Mostrar</button></div><p id="ws-login-error" role="alert"></p><button type="submit" class="ws-login-submit">Ingresar al equipo →</button></form><div id="ws-login-ok" hidden><h3>¡Ya puedes crear y editar!</h3><p>Acceso del equipo activo en esta página.</p><button type="button" id="ws-login-new">Crear una bitácora</button><button type="button" id="ws-login-out" class="secondary">Cerrar sesión</button></div>`;
document.querySelector('.ws-grupo-hero').after(acceso);
const estilo=document.createElement('style');
estilo.textContent=`
.ws-login-card{display:grid;grid-template-columns:1fr 1.1fr;gap:32px;margin:24px 0;padding:30px;border:1px solid #c5e4dc;border-radius:24px;background:#fff;box-shadow:0 12px 32px #164d3910;color:#173e36}
.ws-login-intro{padding:24px;border-radius:18px;background:linear-gradient(145deg,#e4f5ee,#e9f3fc);display:flex;flex-direction:column;justify-content:center}
.ws-login-badge{font-size:11px;font-weight:800;letter-spacing:1.5px;color:#26735e}.ws-login-card h3{font-size:23px;line-height:1.25;margin:12px 0}.ws-login-card p{line-height:1.65}.ws-login-card small{color:#42685e}
#ws-login-form{display:flex;flex-direction:column;gap:10px}#ws-login-form label{font-size:14px;font-weight:700;margin-top:8px}#ws-login-form input{box-sizing:border-box;width:100%;min-width:0;margin:0;padding:14px;border:1px solid #c8dcd5;border-radius:12px;background:#f8fcfa;font-size:16px;color:#173e36}#ws-login-form input:focus{outline:3px solid #b8e4d5;border-color:#21836a}
.ws-login-password{display:flex;align-items:center;gap:8px}.ws-login-password input{flex:1}.ws-login-password button{background:#edf6f2;color:#21644f;padding:12px;border:0;border-radius:10px;font-size:13px}
#ws-login-error{color:#a52b35;font-size:14px;margin:0;min-height:20px}#ws-login-form .ws-login-submit{width:100%;border:0;border-radius:12px;padding:15px;background:#17664f;color:white;font-weight:700}.ws-login-submit:disabled{opacity:.6}
.ws-login-card [hidden]{display:none!important}#ws-login-ok{align-self:center}#ws-login-out{margin:10px 0}
@media(max-width:640px){.ws-login-card{grid-template-columns:1fr;padding:18px;gap:18px;border-radius:18px}.ws-login-intro{padding:18px}.ws-login-card h3{font-size:21px}}
@media print{.ws-login-card{display:none}}
`;
document.head.append(estilo);
let accesoPendiente=null;
function estadoAcceso(activo){$('ws-login-form').hidden=activo;$('ws-login-ok').hidden=!activo}
async function solicitarClave(){
 if(clave&&correo)return true;
 acceso.scrollIntoView({behavior:'smooth',block:'center'});
 $('ws-login-email').focus({preventScroll:true});
 if(accesoPendiente)accesoPendiente(false);
 return new Promise(resolve=>{accesoPendiente=resolve});
}
$('ws-login-toggle').addEventListener('click',()=>{
 const input=$('ws-login-password'),mostrar=input.type==='password';input.type=mostrar?'text':'password';
 $('ws-login-toggle').textContent=mostrar?'Ocultar':'Mostrar';$('ws-login-toggle').setAttribute('aria-label',mostrar?'Ocultar contraseña':'Mostrar contraseña');$('ws-login-toggle').setAttribute('aria-pressed',String(mostrar));
});
$('ws-login-form').addEventListener('submit',async e=>{
 e.preventDefault();const btn=e.currentTarget.querySelector('[type="submit"]');btn.disabled=true;btn.textContent='Comprobando…';$('ws-login-error').textContent='';
 correo=$('ws-login-email').value.trim().toLowerCase();clave=$('ws-login-password').value;
 try{await api('login');$('ws-login-password').value='';estadoAcceso(true);msg('Acceso correcto. Ya puedes registrar bitácoras.');
 if(accesoPendiente){const resolve=accesoPendiente;accesoPendiente=null;resolve(true)}else{limpiar();$('ws-form').scrollIntoView({behavior:'smooth'});}
 }catch(err){correo='';clave='';$('ws-login-error').textContent=err.message}finally{btn.disabled=false;btn.textContent='Ingresar al equipo →'}
});
$('ws-login-new').addEventListener('click',()=>$('ws-nueva').click());
$('ws-login-out').addEventListener('click',()=>{correo='';clave='';estadoAcceso(false);$('ws-form').hidden=true;$('ws-login-password').value='';msg('Sesión cerrada.');});
function limpiar(){actual=null;$('ws-form').reset();$('ws-form').hidden=false;$('ws-archivos').innerHTML='';$('ws-eliminar').hidden=true;$('ws-form-titulo').textContent='Nueva bitácora';$('ws-fecha').value=new Date().toLocaleDateString('en-CA')}
async function archivos(){
 $('ws-archivos').textContent='';if(!actual)return;
 try{const r=await api('files',{id:actual});for(const f of r.data){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent='📎 '+f.nombre;b.addEventListener('click',()=>{if(f.url)window.open(f.url,'_blank','noopener')});$('ws-archivos').append(b)}}catch(e){msg(e.message)}
}
async function abrir(id){
 if(!await solicitarClave())return;const x=listado.find(v=>v.id===id);if(!x)return;
 actual=id;campos.forEach(k=>{$('ws-'+k).value=x[k]||''});$('ws-form').hidden=false;$('ws-eliminar').hidden=false;$('ws-form-titulo').textContent='Editar bitácora';await archivos();$('ws-form').scrollIntoView({behavior:'smooth'});
}
$('ws-nueva').addEventListener('click',async()=>{if(!await solicitarClave())return;limpiar();msg('Acceso correcto. Completa la nueva bitácora.');$('ws-form').scrollIntoView({behavior:'smooth'});$('ws-titulo').focus({preventScroll:true})});
$('ws-cancelar').addEventListener('click',()=>{$('ws-form').hidden=true});
$('ws-buscar').addEventListener('input',dibujar);
$('ws-historial').addEventListener('click',e=>{const b=e.target.closest('.ws-abrir');if(b)abrir(b.dataset.id)});
$('ws-form').addEventListener('submit',async e=>{
 e.preventDefault();const btn=$('ws-guardar');btn.disabled=true;
 try{
 const values=Object.fromEntries(campos.map(k=>[k,$('ws-'+k).value.trim()||null]));
 const saved=await api('save',{id:actual,values});actual=saved.id;
 for(const f of $('ws-adjuntos').files){
 if(f.size>10485760)throw Error(f.name+': máximo 10 MB');
 const signed=await api('upload',{id:actual,name:f.name});
 const response=await fetch(signed.url,{method:'PUT',headers:{'Content-Type':f.type||'application/octet-stream','x-upsert':'false'},body:f});
 if(!response.ok)throw Error('No se pudo subir '+f.name);
 await api('attach',{id:actual,path:signed.path,name:f.name});
 }
 $('ws-adjuntos').value='';await cargar();await archivos();$('ws-eliminar').hidden=false;msg('Bitácora guardada.');
 }catch(e){msg('Error: '+e.message)}finally{btn.disabled=false}
});
$('ws-eliminar').addEventListener('click',async()=>{if(!actual||!confirm('¿Eliminar esta reunión y sus archivos?'))return;try{await api('delete',{id:actual});limpiar();$('ws-form').hidden=true;clave='';await cargar()}catch(e){msg(e.message)}});
$('ws-exportar').addEventListener('click',()=>window.print());

$('ws-trabajo').hidden=false;
cargar();
})();
