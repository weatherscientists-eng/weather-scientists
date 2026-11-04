const crypto=require('node:crypto');
const BUCKET='ws-documentos-estudiantes';
const normalizar=v=>String(v||'').trim().replace(/[.\s-]/g,'').toUpperCase();
async function storage(sb){const {data,error}=await sb.storage.getBucket(BUCKET);if(error){if(!/not found|does not exist/i.test(error.message||'')&&!['400','404'].includes(String(error.statusCode||error.status)))throw error;const r=await sb.storage.createBucket(BUCKET,{public:false,fileSizeLimit:4096,allowedMimeTypes:['application/json']});if(r.error&&!/already exists/i.test(r.error.message))throw r.error}else if(data.public)throw Error('El directorio de documentos debe ser privado.');return sb.storage.from(BUCKET)}
const huella=doc=>crypto.createHmac('sha256',process.env.SUPABASE_SERVICE_ROLE_KEY).update(doc).digest('hex');
async function leer(store,path){const {data,error}=await store.download(path);if(error){if(/not found|does not exist/i.test(error.message||''))return null;throw error}return JSON.parse(await data.text())}
async function buscar(sb,documento){const doc=normalizar(documento);if(!/^[A-Z0-9]{3,30}$/.test(doc))throw Error('Escribe un documento válido de 3 a 30 caracteres.');const row=await leer(await storage(sb),'documentos/'+huella(doc)+'.json');if(!row)throw Error('Documento no registrado. Usa Registrar estudiante o completa su documento en Huellas Verdes.');return row.estudiante}
async function registrar(sb,{nombre,grado,documento,estudiante_id}){
 nombre=String(nombre||'').trim().replace(/\s+/g,' ');grado=String(grado||'').trim();const doc=normalizar(documento);
 if(nombre.length<2||nombre.length>120||grado.length>30||!/^[A-Z0-9]{3,30}$/.test(doc))throw Error('Indica nombre, documento válido y grado opcional.');
 const store=await storage(sb),path='documentos/'+huella(doc)+'.json';const existing=await leer(store,path);if(existing)throw Error('Este documento ya está registrado. Selecciona al estudiante de la lista.');
 const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();let id=crypto.createHash('sha256').update(normalize(nombre)+'|'+normalize(grado)).digest('hex');
 if(estudiante_id){if(!/^[a-f0-9]{64}$/.test(estudiante_id))throw Error('Estudiante no válido.');const current=await leer(sb.storage.from('ws-huellas-verdes'),'estudiantes/'+estudiante_id+'.json');if(!current)throw Error('Estudiante no encontrado.');id=current.id;nombre=current.nombre;grado=current.grado||'';}
 const linked=await leer(store,'estudiantes/'+id+'.json');if(linked)throw Error('Este estudiante ya tiene documento registrado. Revisa su nombre y grado.');
 const estudiante={id,nombre,grado,tiene_documento:true},claim={estudiante,documento:doc};
 // Un índice privado por documento y otro por estudiante. Los documentos nunca se devuelven al público.
 const put=await store.upload(path,Buffer.from(JSON.stringify(claim)),{contentType:'application/json',upsert:false});if(put.error)throw Error('El documento ya está registrado o no pudo guardarse.');
 const link=await store.upload('estudiantes/'+id+'.json',Buffer.from(JSON.stringify({id,huella:huella(doc)})),{contentType:'application/json',upsert:false});if(link.error){await store.remove([path]);throw Error('El estudiante ya tiene documento o no pudo vincularse.');}
 const roster=await sb.storage.from('ws-huellas-verdes').upload('estudiantes/'+id+'.json',Buffer.from(JSON.stringify(estudiante)),{contentType:'application/json',upsert:true});if(roster.error){await store.remove([path,'estudiantes/'+id+'.json']);throw roster.error}return {...estudiante,tiene_documento:true};
}
async function verificarIds(sb,ids,roster){const store=await storage(sb);const out=[];for(const id of [...new Set(ids)]){const p=roster.find(v=>v.id===id);if(!p)throw Error('Selecciona estudiantes registrados.');if(!await leer(store,'estudiantes/'+id+'.json'))throw Error(p.nombre+' aún no tiene documento. Regístralo con el mismo nombre y grado, agregando su documento.');out.push(p)}if(!out.length)throw Error('Selecciona al menos un estudiante.');return out}
module.exports={buscar,registrar,verificarIds,normalizar};
