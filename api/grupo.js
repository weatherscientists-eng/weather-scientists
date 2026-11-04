// Vercel Serverless Function. Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and WSD_GROUP_KEY.
const crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método no permitido'});
 const url=process.env.SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY,key=process.env.WSD_GROUP_KEY;
 if(!url||!secret||!key)return res.status(503).json({error:'Configuración pendiente en Vercel'});
 const sb=createClient(url,secret,{auth:{persistSession:false}});
 const equal=(a,b)=>{const x=crypto.createHash('sha256').update(String(a||'')).digest(),y=crypto.createHash('sha256').update(key).digest();return crypto.timingSafeEqual(x,y)};
 const fail=e=>res.status(400).json({error:e.message||String(e)});
 try{
 const body=req.body||{},action=req.method==='GET'?'list':body.action;
 if(action==='list'){
 const {data,error}=await sb.from('ws_reuniones').select('id,fecha,titulo,lugar,objetivo,participantes,actividades,resultados,dificultades,compromisos,proxima_reunion').order('fecha',{ascending:false});if(error)throw error;
 return res.json({data});
 }
 if(String(req.headers['x-wsd-email']||'').trim().toLowerCase()!=='weatherscientists@claudinamunera.edu.co'||!equal(req.headers['x-wsd-key'],key))return res.status(403).json({error:'Correo o contraseña incorrectos'});
 if(action==='login')return res.json({ok:true});
 if(action==='save'){
 const allowed=['fecha','titulo','lugar','objetivo','participantes','actividades','resultados','dificultades','compromisos','proxima_reunion'];
 const row=Object.fromEntries(allowed.map(k=>[k,body.values?.[k]||null]));
 if(!row.fecha||!row.titulo)return res.status(400).json({error:'Fecha y título obligatorios'});
 const q=body.id?sb.from('ws_reuniones').update(row).eq('id',body.id):sb.from('ws_reuniones').insert(row);
 const {data,error}=await q.select('id').single();if(error)throw error;return res.json({id:data.id});
 }
 if(action==='files'){
 const {data,error}=await sb.from('ws_archivos').select('id,ruta,nombre').eq('reunion_id',body.id);if(error)throw error;
 const out=[];for(const f of data){const signed=await sb.storage.from('ws-bitacoras').createSignedUrl(f.ruta,300);out.push({id:f.id,nombre:f.nombre,url:signed.data?.signedUrl||null})}
 return res.json({data:out});
 }
 if(action==='upload'){
 const {data:meeting}=await sb.from('ws_reuniones').select('id').eq('id',body.id).maybeSingle();if(!meeting)return res.status(404).json({error:'Reunión no encontrada'});
 const name=String(body.name||'archivo').slice(0,150);
 const ext=name.split('.').pop().toLowerCase();if(!['pdf','doc','docx','jpg','jpeg','png','webp'].includes(ext))return res.status(400).json({error:'Tipo de archivo no permitido'});
 const path=body.id+'/'+crypto.randomUUID()+'.'+ext;
 const {data,error}=await sb.storage.from('ws-bitacoras').createSignedUploadUrl(path);if(error)throw error;
 return res.json({path,token:data.token,url:data.signedUrl});
 }
 if(action==='attach'){
 const path=String(body.path||'');if(!path.startsWith(body.id+'/'))return res.status(400).json({error:'Ruta inválida'});
 const {data:objects,error:listError}=await sb.storage.from('ws-bitacoras').list(body.id,{search:path.split('/').pop()});if(listError)throw listError;
 if(!objects?.some(o=>o.name===path.split('/').pop()))return res.status(400).json({error:'Archivo no encontrado'});
 const {error}=await sb.from('ws_archivos').insert({reunion_id:body.id,ruta:path,nombre:String(body.name||'Adjunto').slice(0,150)});if(error)throw error;return res.json({ok:true});
 }
 if(action==='delete'){
 const {data:files,error:fe}=await sb.from('ws_archivos').select('ruta').eq('reunion_id',body.id);if(fe)throw fe;
 if(files.length){const {error}=await sb.storage.from('ws-bitacoras').remove(files.map(f=>f.ruta));if(error)throw error}
 const {error}=await sb.from('ws_reuniones').delete().eq('id',body.id);if(error)throw error;return res.json({ok:true});
 }
 return res.status(400).json({error:'Acción desconocida'});
 }catch(e){return fail(e)}
};
