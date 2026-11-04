const puntos=require('../lib/puntosAutomaticos');
const identidad=require('../lib/identidadEstudiante');
const crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const BUCKET='ws-huellas-verdes';
const defaults={lugares:[{id:'cama-1',nombre:'Cama 1'},{id:'cama-2',nombre:'Cama 2'}],origenes:[{id:'restaurante',nombre:'Restaurante'},{id:'huerta',nombre:'Huerta escolar'},{id:'hogares',nombre:'Hogares'}]};
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método no permitido'});
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return res.status(503).json({error:'Conexión pendiente.'});
 const sb=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 try{
 const {data:bucket,error:be}=await sb.storage.getBucket(BUCKET);
 if(be){if(!/not found|does not exist/i.test(be.message||'')&&!['400','404'].includes(String(be.statusCode||be.status)))throw be;const {error}=await sb.storage.createBucket(BUCKET,{public:false,fileSizeLimit:8388608,allowedMimeTypes:['application/json','image/jpeg','image/png','image/webp']});if(error&&!/already exists|duplicate/i.test(error.message||''))throw error;}else if(bucket.public)throw Error('Se requiere almacenamiento privado');
 const storage=sb.storage.from(BUCKET);
 async function catalogo(tipo){let offset=0,all=[];while(true){const {data,error}=await storage.list(tipo,{limit:100,offset,sortBy:{column:'name',order:'asc'}});if(error)throw error;all.push(...data);if(data.length<100)break;offset+=100;}return Promise.all(all.filter(f=>f.name.endsWith('.json')).map(async f=>{const {data,error}=await storage.download(tipo+'/'+f.name);if(error)throw error;return JSON.parse(await data.text())}))}
 const body=req.body||{};
 if(req.method==='POST'&&body.action==='registrar'){
 const {tipo}=body;if(tipo==='estudiantes'){const data=await identidad.registrar(sb,body);return res.status(201).json({data})}if(!['estudiantes','lugares','origenes'].includes(tipo))return res.status(400).json({error:'Lista no válida.'});
 const nombre=String(body.nombre||'').trim().replace(/\s+/g,' '),grado=String(body.grado||'').trim();
 if(nombre.length<2||nombre.length>120||grado.length>30)return res.status(400).json({error:'Escribe un nombre de 2 a 120 caracteres.'});
 const normal=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if((defaults[tipo]||[]).some(v=>normal(v.nombre)===normal(nombre)))return res.status(409).json({error:'Esta opción ya está en la lista.'});
 const id=crypto.createHash('sha256').update(normal(nombre)+'|'+(tipo==='estudiantes'?normal(grado):'')).digest('hex');const row={id,nombre,...(tipo==='estudiantes'?{grado}:{})};
 const {error}=await storage.upload(tipo+'/'+id+'.json',Buffer.from(JSON.stringify(row)),{contentType:'application/json',upsert:false});
 if(error){if(String(error.statusCode)==='409'||/already exists|duplicate/i.test(error.message||''))return res.status(409).json({error:'Ya está registrado en la lista.'});throw error;}return res.status(201).json({data:row});
 }
 const [estudiantes,lugaresExtra,origenesExtra]=await Promise.all(['estudiantes','lugares','origenes'].map(catalogo));
 const lugares=[...defaults.lugares,...lugaresExtra],origenes=[...defaults.origenes,...origenesExtra];
 if(req.method==='GET'){
 let data=[];for(let offset=0;;offset+=1000){const page=await sb.from('compostaje').select('*').order('fecha',{ascending:false}).order('id',{ascending:false}).range(offset,offset+999);if(page.error)throw page.error;data.push(...page.data);if(page.data.length<1000)break;}
 const registros=await Promise.all((data||[]).map(async r=>{let extra={};if(r.observaciones?.startsWith('WS_COMPOST_V2\n')){try{extra=JSON.parse(r.observaciones.slice(14))}catch{}}let foto=r.foto_url||null;if(foto?.startsWith('ws-huellas-verdes:')){const signed=await storage.createSignedUrl(foto.slice('ws-huellas-verdes:'.length),300);foto=signed.data?.signedUrl||null;}return {foto,id:r.id,fecha:r.fecha,peso_kg:r.peso_kg,estado:r.estado,observaciones:extra.observaciones??r.observaciones,lugar:extra.lugar||null,origen:extra.origen||null,estudiantes:extra.estudiantes||[]}}));
 return res.json({estudiantes:estudiantes.sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')),lugares,origenes,registros,total:registros.reduce((s,r)=>s+(Number(r.peso_kg)||0),0)});
 }
 if(body.action==='foto'){
 if(!['image/jpeg','image/png','image/webp'].includes(body.mime))return res.status(400).json({error:'Escoge una imagen JPG, PNG o WebP.'});
 const path='fotos/'+crypto.randomUUID()+'.'+({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[body.mime]);const {data,error}=await storage.createSignedUploadUrl(path);if(error)throw error;return res.json({path,url:data.signedUrl});
 }
 if(body.action==='guardar'){
 const {fecha,peso_kg,estado}=body;const date=new Date(String(fecha)+'T12:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha||'')||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==fecha||fecha>today())return res.status(400).json({error:'Escoge una fecha válida que no sea futura.'});
 if(typeof peso_kg!=='number'||!Number.isFinite(peso_kg)||peso_kg<=0||peso_kg>100000)return res.status(400).json({error:'Escribe un peso mayor que cero.'});
 if(!['llenado','maduracion','cosecha'].includes(estado))return res.status(400).json({error:'Estado no válido.'});
 const lugar=lugares.find(v=>v.id===body.lugar),origen=origenes.find(v=>v.id===body.origen),ids=[...new Set(Array.isArray(body.estudiantes)?body.estudiantes:[])],equipo=ids.map(id=>estudiantes.find(v=>v.id===id));
 if(!lugar||!origen||!equipo.length||equipo.some(v=>!v))return res.status(400).json({error:'Selecciona el lugar, la procedencia y al menos un estudiante registrado.'});
 const autores=await puntos.preparar(sb,{estudiantes:ids,roster:estudiantes,registrador:body.registrador});
 const observaciones=String(body.observaciones||'').trim();if(observaciones.length>3000)return res.status(400).json({error:'Usa hasta 3000 caracteres en las observaciones.'});
 let fotoUrl=null;
 if(body.foto){if(!/^fotos\/[0-9a-f-]+\.(jpg|png|webp)$/.test(body.foto))return res.status(400).json({error:'Foto no válida.'});const {data,error}=await storage.createSignedUrl(body.foto,300);if(error)throw error;/* Guardar ruta privada, sin enlaces que expiran. */fotoUrl='ws-huellas-verdes:'+body.foto;}
 const metadata={grupo:'Huellas Verdes',lugar,origen,estudiantes:equipo,observaciones};
 const {data:guardado,error}=await sb.from('compostaje').insert({fecha,peso_kg,estado,observaciones:'WS_COMPOST_V2\n'+JSON.stringify(metadata),foto_url:fotoUrl}).select('id').single();if(error)throw error;
 const claudipoints=await puntos.acreditar(sb,{tipo:'compostaje',fuente:guardado.id,fecha,detalle:`Entrega de ${peso_kg} kg · ${origen.nombre} → ${lugar.nombre}`,identidad:autores});
 return res.status(201).json({ok:true,claudipoints});
 }
 return res.status(400).json({error:'Acción no válida.'});
 }catch(e){console.error('Compostaje:',e.message);return res.status(e.statusCode?500:400).json({error:e.statusCode?'No fue posible completar la operación. Revisa tu conexión y vuelve a intentarlo.':e.message||'No se pudo completar la operación.'})}
};
