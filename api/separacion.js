const {createClient}=require('@supabase/supabase-js');const puntos=require('../lib/puntosAutomaticos');
const BUCKET='ws-huellas-verdes';
const hoy=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
module.exports=async(req,res)=>{res.setHeader('Cache-Control','no-store');if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método no permitido'});try{
 const sb=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),store=sb.storage.from(BUCKET);
 async function list(prefix){let files=[];for(let offset=0;;offset+=100){const r=await store.list(prefix,{offset,limit:100});if(r.error)throw r.error;files.push(...r.data);if(r.data.length<100)break}return Promise.all(files.filter(f=>f.name.endsWith('.json')).map(async f=>{const r=await store.download(prefix+'/'+f.name);if(r.error)throw r.error;return JSON.parse(await r.data.text())}))}
 const roster=await list('estudiantes');
 if(req.method==='GET'){const jornadas=await list('jornadas');return res.json({estudiantes:roster,jornadas:jornadas.sort((a,b)=>(b.fecha+b.hora).localeCompare(a.fecha+a.hora)).slice(0,30)})}
 const b=req.body||{},fecha=String(b.fecha||''),hora=String(b.hora||''),d=new Date(fecha+'T12:00:00Z');
 if(!/^[a-f0-9-]{36}$/.test(b.id||'')||!/^\d{4}-\d{2}-\d{2}$/.test(fecha)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==fecha||fecha>hoy()||!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)||new Date(fecha+'T'+hora+':00-05:00').getTime()>Date.now())throw Error('Revisa la fecha y la hora de la jornada.');
 if(!Array.isArray(b.estudiantes)||b.estudiantes.length>60)throw Error('Selecciona los estudiantes participantes.');
 const identity=await puntos.preparar(sb,{estudiantes:b.estudiantes,roster,registrador:b.registrador});const detalle=String(b.detalle||'Jornada de separación y clasificación de botellas').trim();if(detalle.length<5||detalle.length>1500)throw Error('Describe la jornada usando entre 5 y 1500 caracteres.');
 const participantes=roster.filter(p=>identity.participantes.some(v=>v.id===p.id)).map(p=>({id:p.id,nombre:p.nombre,grado:p.grado||''}));
 const row={id:b.id,fecha,hora,detalle,participantes,registrador:identity.registrador};const path='jornadas/'+b.id+'.json',existing=await store.download(path);
 if(existing.data){const old=JSON.parse(await existing.data.text());if(JSON.stringify(old)!==JSON.stringify(row))return res.status(409).json({error:'Este registro ya se guardó con otros datos. Actualiza el historial.'})}
 else{if(existing.error&&!/not found|does not exist/i.test(existing.error.message||''))throw existing.error;const r=await store.upload(path,Buffer.from(JSON.stringify(row)),{contentType:'application/json',upsert:false});if(r.error)return res.status(409).json({error:'La jornada ya se está guardando. Actualiza antes de volver a intentarlo.'})}
 const claudipoints=await puntos.acreditar(sb,{tipo:'separacion',fuente:b.id,fecha,hora,detalle,identidad:identity});return res.status(201).json({data:row,claudipoints});
 }catch(e){return res.status(400).json({error:e.message||'No se pudo registrar la jornada.'})}};
