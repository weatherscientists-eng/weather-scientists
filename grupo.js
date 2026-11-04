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
async function solicitarClave(){
 if(clave&&correo)return true;
 const dialog=document.createElement('dialog');
 dialog.innerHTML=`<form><h3>Ingresar a las bitácoras</h3><label>Correo del grupo<input name="correo" type="email" autocomplete="username" required placeholder="Correo del grupo"></label><label>Contraseña<input name="clave" type="password" autocomplete="current-password" required></label><p role="alert"></p><button type="submit">Ingresar</button><button type="button" data-cancelar>Cancelar</button></form>`;
 document.body.append(dialog);
 return new Promise(resolve=>{
 let aceptado=false;
 dialog.addEventListener('close',()=>{dialog.remove();resolve(aceptado)},{once:true});
 dialog.querySelector('[data-cancelar]').onclick=()=>dialog.close();
 dialog.querySelector('form').onsubmit=async e=>{
 e.preventDefault();const form=e.currentTarget,btn=form.querySelector('[type="submit"]');btn.disabled=true;
 correo=form.elements.correo.value.trim().toLowerCase();clave=form.elements.clave.value;
 try{await api('login');aceptado=true;dialog.close()}catch(err){correo='';clave='';form.querySelector('[role="alert"]').textContent=err.message}finally{btn.disabled=false}
 };
 dialog.showModal();
 });
}
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
$('ws-cancelar').addEventListener('click',()=>{$('ws-form').hidden=true;clave=''});
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
if($('ws-acceso'))$('ws-acceso').hidden=true;
$('ws-trabajo').hidden=false;
cargar();
})();
