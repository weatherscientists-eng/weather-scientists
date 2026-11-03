/* Módulo Grupo — reutiliza el cliente Supabase de app.js. */
(()=>{
const $=id=>document.getElementById(id), sb=()=>_supabase;
let actual=null, listado=[];
const msg=t=>{$('ws-estado').textContent=t};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const campos=['fecha','titulo','lugar','objetivo','participantes','actividades','resultados','dificultades','compromisos','proxima_reunion'];
async function verificar(){
 const {data:{user}}=await sb().auth.getUser();
 $('ws-acceso').hidden=!!user;$('ws-trabajo').hidden=!user;
 if(!user){msg('Inicia sesión para consultar y gestionar las bitácoras.');return}
 const {data,error}=await sb().from('ws_integrantes').select('user_id').eq('user_id',user.id).maybeSingle();
 if(error||!data){$('ws-trabajo').hidden=true;msg('Tu cuenta aún no está incorporada al grupo. Solicita al docente que la autorice.');return}
 msg('Sesión activa.');await cargar();
}
async function cargar(){
 const {data,error}=await sb().from('ws_reuniones').select('*').order('fecha',{ascending:false});
 if(error){msg('No se pudieron consultar las reuniones: '+error.message);return}
 listado=data||[];dibujar();
}
function dibujar(){
 const filtro=$('ws-buscar').value.toLowerCase();
 const rows=listado.filter(x=>(x.titulo+' '+x.fecha+' '+(x.objetivo||'')).toLowerCase().includes(filtro));
 $('ws-total').textContent=listado.length;
 $('ws-historial').innerHTML=rows.length?rows.map(x=>`<article class="ws-item"><div><strong>${esc(x.titulo)}</strong><p>${esc(x.fecha)} · ${esc(x.lugar||'Lugar sin registrar')}</p></div><button type="button" class="secondary ws-abrir" data-id="${x.id}">Ver / editar</button></article>`).join(''):'<p>No hay reuniones para mostrar.</p>';
}
function limpiar(){actual=null;$('ws-form').reset();$('ws-form').hidden=false;$('ws-archivos').innerHTML='';$('ws-eliminar').hidden=true;$('ws-form-titulo').textContent='Nueva bitácora';$('ws-fecha').value=new Date().toLocaleDateString('en-CA');}
async function abrir(id){
 const x=listado.find(v=>v.id===id);if(!x)return;
 actual=id;campos.forEach(k=>{$('ws-'+k).value=x[k]||''});
 $('ws-form').hidden=false;$('ws-eliminar').hidden=false;$('ws-form-titulo').textContent='Editar bitácora';await archivos();$('ws-form').scrollIntoView({behavior:'smooth'});
}
async function archivos(){
 $('ws-archivos').textContent='';if(!actual)return;
 const {data,error}=await sb().from('ws_archivos').select('*').eq('reunion_id',actual);
 if(error){msg(error.message);return}
 for(const f of data||[]){
 const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent='📎 '+f.nombre;
 b.addEventListener('click',async()=>{const {data,error}=await sb().storage.from('ws-bitacoras').createSignedUrl(f.ruta,60);if(error)msg(error.message);else window.open(data.signedUrl,'_blank','noopener')});
 $('ws-archivos').append(b);
 }
}
$('ws-login').addEventListener('submit',async e=>{
 e.preventDefault();const {error}=await sb().auth.signInWithPassword({email:$('ws-email').value.trim(),password:$('ws-clave').value});
 if(error)msg('No se pudo iniciar sesión: '+error.message);else await verificar();
});
$('ws-salir').addEventListener('click',async()=>{await sb().auth.signOut();await verificar()});
$('ws-nueva').addEventListener('click',limpiar);
$('ws-cancelar').addEventListener('click',()=>{$('ws-form').hidden=true});
$('ws-buscar').addEventListener('input',dibujar);
$('ws-historial').addEventListener('click',e=>{const b=e.target.closest('.ws-abrir');if(b)abrir(b.dataset.id)});
$('ws-form').addEventListener('submit',async e=>{
 e.preventDefault();const btn=$('ws-guardar');btn.disabled=true;
 try{
 const values=Object.fromEntries(campos.map(k=>[k,$('ws-'+k).value.trim()||null]));
 if(!values.fecha||!values.titulo)throw Error('Fecha y título son obligatorios.');
 const result=actual?await sb().from('ws_reuniones').update(values).eq('id',actual).select('id').single():await sb().from('ws_reuniones').insert(values).select('id').single();
 if(result.error)throw result.error;actual=result.data.id;
 const files=$('ws-adjuntos').files;
 for(const f of files){
 if(f.size>10485760)throw Error(f.name+': máximo 10 MB');
 if(!['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp'].includes(f.type))throw Error('Tipo de archivo no permitido: '+f.name);
 const ruta=actual+'/'+crypto.randomUUID()+'-'+f.name.replace(/[^a-zA-Z0-9._-]/g,'_');
 const up=await sb().storage.from('ws-bitacoras').upload(ruta,f);if(up.error)throw up.error;
 const ins=await sb().from('ws_archivos').insert({reunion_id:actual,ruta,nombre:f.name});if(ins.error)throw ins.error;
 }
 $('ws-adjuntos').value='';await cargar();await archivos();$('ws-eliminar').hidden=false;msg('Bitácora guardada correctamente.');
 }catch(err){msg('Error: '+err.message)}finally{btn.disabled=false}
});
$('ws-eliminar').addEventListener('click',async()=>{
 if(!actual||!confirm('¿Eliminar esta reunión y sus bitácoras?'))return;
 const {data:files}=await sb().from('ws_archivos').select('ruta').eq('reunion_id',actual);
 if(files?.length){const rem=await sb().storage.from('ws-bitacoras').remove(files.map(x=>x.ruta));if(rem.error){msg(rem.error.message);return}}
 const {error}=await sb().from('ws_reuniones').delete().eq('id',actual);if(error){msg(error.message);return}
 limpiar();$('ws-form').hidden=true;await cargar();msg('Reunión eliminada.');
});
$('ws-exportar').addEventListener('click',()=>window.print());
sb().auth.onAuthStateChange(()=>{setTimeout(verificar,0)});
verificar();
})();
