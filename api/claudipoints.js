const crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const login=require('./grupo');
const BUCKET='ws-claudipoints';
const actividades={lluvia:'Lectura del pluviómetro',compostaje:'Entrega de residuos al compostaje',botellas:'Entrega de botellas',evento:'Reporte de evento climático',bitacora:'Elaboración de bitácora'};
const initial={version:'inicial',tarifas:{lluvia:5,compostaje:5,botellas:1,evento:5,bitacora:10},premios:[
{id:'semilla-huerta',tipo:'insignia',nombre:'🌱 Semilla de la Huerta',descripcion:'Cada acción hace crecer nuestro colegio.',meta:20,activo:true},
{id:'huellas-verdes',tipo:'insignia',nombre:'🍃 Huella Verde',descripcion:'Transformamos residuos en nuevas oportunidades.',meta:40,activo:true},
{id:'weather-scientist',tipo:'insignia',nombre:'🌦️ Weather Scientist',descripcion:'Observamos, medimos y aprendemos del territorio.',meta:60,activo:true},
{id:'guardian-corrala',tipo:'insignia',nombre:'🏞️ Guardián de La Corrala',descripcion:'Cuidamos nuestra vereda con acciones.',meta:100,activo:true},
{id:'lider-claudina',tipo:'insignia',nombre:'🏅 Líder Claudina Múnera',descripcion:'Amor, sabiduría y liderazgo para transformar realidades.',meta:150,activo:true}]};
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const validId=s=>typeof s==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(s);
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método no permitido'});
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return res.status(503).json({error:'Conexión pendiente de configuración.'});
 const sb=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const body=req.body||{},action=req.method==='GET'?'contexto':body.action;
 try{
 const adminActions=['administrar','decidir','anular','configurar','premio','entregar'];
 if(adminActions.includes(action)){
 let status=200;let message;
 await login({...req,method:'POST',body:{action:'login'}},{setHeader(){},status(n){status=n;return this},json(d){message=d;return this}});
 if(status!==200)return res.status(status).json({error:message?.error||'Ingresa a Administrar.'});
 }
 const {data:b,error:be}=await sb.storage.getBucket(BUCKET);
 if(be){if(!/not found|does not exist/i.test(be.message||'')&&!['400','404'].includes(String(be.statusCode||be.status)))throw be;const {error}=await sb.storage.createBucket(BUCKET,{public:false,fileSizeLimit:65536,allowedMimeTypes:['application/json']});if(error&&!/already exists|duplicate/i.test(error.message||''))throw error}else if(b.public)throw Error('Se requiere almacenamiento privado.');
 const storage=sb.storage.from(BUCKET);
 async function list(prefix,source=storage){let items=[];for(let offset=0;;offset+=100){const {data,error}=await source.list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}});if(error)throw error;items.push(...data);if(data.length<100)break}return Promise.all(items.filter(f=>f.name.endsWith('.json')).map(async f=>{const {data,error}=await source.download(prefix+'/'+f.name);if(error)throw error;return JSON.parse(await data.text())}))}
 async function read(path){const {data,error}=await storage.download(path);if(error){if(/not found|does not exist/i.test(error.message||''))return null;throw error}return JSON.parse(await data.text())}
 async function write(path,row){const {error}=await storage.upload(path,Buffer.from(JSON.stringify(row)),{upsert:false,contentType:'application/json'});if(error){if(String(error.statusCode)==='409'||/already exists|duplicate/i.test(error.message||''))return false;throw error}return true}
 async function students(){return list('estudiantes',sb.storage.from('ws-huellas-verdes'))}
 const configs=await list('config');configs.sort((a,b)=>b.version.localeCompare(a.version));let config=configs[0]||JSON.parse(JSON.stringify(initial));
 async function saveConfig(){config.version=Date.now().toString().padStart(14,'0')+'-'+crypto.randomUUID();await write('config/'+config.version+'.json',config)}
 if(action==='solicitar'){
 const {id,tipo,fecha,hora}=body;const d=new Date(String(fecha)+'T12:00:00Z');
 if(!validId(id)||!actividades[tipo]||!/^\d{4}-\d{2}-\d{2}$/.test(fecha||'')||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==fecha||fecha>today()||!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora||''))return res.status(400).json({error:'Revisa la actividad, la fecha y la hora.'});
 const nowTime=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Bogota',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());if(fecha+'T'+hora>today()+'T'+nowTime)return res.status(400).json({error:'La fecha y hora de la labor no pueden ser futuras.'});
 const registrador=String(body.registrador||'').trim(),detalle=String(body.detalle||'').trim();
 if(registrador.length<3||registrador.length>120||detalle.length<5||detalle.length>1500)return res.status(400).json({error:'Indica quién hace el registro y describe la actividad (5 a 1500 caracteres).'});
 const roster=await students();const participantes=body.participantes;
 if(!Array.isArray(participantes)||!participantes.length||participantes.length>60||new Set(participantes.map(p=>p.id)).size!==participantes.length)return res.status(400).json({error:'Selecciona los estudiantes que realizaron la actividad, sin repetirlos.'});
 const equipo=[];for(const p of participantes){const student=roster.find(s=>s.id===p.id);if(!student)return res.status(400).json({error:'Selecciona estudiantes registrados.'});const cantidad=tipo==='botellas'?p.cantidad:1;if(!Number.isInteger(cantidad)||cantidad<1||cantidad>10000)return res.status(400).json({error:'Indica cuántas botellas aportó cada estudiante (número entero mayor que cero).'});equipo.push({id:student.id,nombre:student.nombre,grado:student.grado||'',cantidad})}
 const claim={id,tipo,fecha,hora,registrador,detalle,participantes:equipo,creado_en:new Date().toISOString()};
 const old=await read('solicitudes/'+id+'.json');if(old){const same=['tipo','fecha','hora','registrador','detalle','participantes'].every(k=>JSON.stringify(old[k])===JSON.stringify(claim[k]));return res.status(same?200:409).json(same?{ok:true,id}:{error:'Este registro ya existe con otros datos. Actualiza antes de continuar.'})}
 const saved=await write('solicitudes/'+id+'.json',claim);return res.status(saved?201:200).json({ok:true,id});
 }
 if(action==='configurar'){
 if(body.version!==config.version)return res.status(409).json({error:'La configuración cambió. Actualiza antes de guardar.'});
 for(const k of Object.keys(actividades))if(!Number.isInteger(body.tarifas?.[k])||body.tarifas[k]<0||body.tarifas[k]>10000)return res.status(400).json({error:'Los puntajes deben ser enteros entre 0 y 10000.'});
 config.tarifas=Object.fromEntries(Object.keys(actividades).map(k=>[k,body.tarifas[k]]));await saveConfig();return res.json({ok:true});
 }
 if(action==='premio'){
 if(body.version!==config.version)return res.status(409).json({error:'La configuración cambió. Actualiza antes de guardar.'});
 const p=body.premio||{};if(!['premio','insignia'].includes(p.tipo)||typeof p.nombre!=='string'||p.nombre.trim().length<3||p.nombre.length>120||!Number.isInteger(p.meta)||p.meta<1||p.meta>1000000||String(p.descripcion||'').length>1000)return res.status(400).json({error:'Revisa el nombre, el tipo y la meta de puntos.'});
 const id=p.id||crypto.randomUUID();if(!validId(id))return res.status(400).json({error:'Premio no válido.'});const row={id,tipo:p.tipo,nombre:p.nombre.trim(),descripcion:String(p.descripcion||'').trim(),meta:p.meta,activo:p.activo!==false};config.premios=config.premios.filter(v=>v.id!==id);config.premios.push(row);await saveConfig();return res.json({ok:true});
 }
 const [claims,decisions,revokes,deliveries]=await Promise.all(['solicitudes','decisiones','anulaciones','entregas'].map(p=>list(p)));
 const state=c=>revokes.some(v=>v.id===c.id)?'anulado':decisions.find(v=>v.id===c.id)?.estado||'pendiente';
 const totals=new Map();for(const c of claims){if(state(c)!=='aprobado')continue;const decision=decisions.find(v=>v.id===c.id);for(const p of c.participantes){const t=totals.get(p.id)||{id:p.id,nombre:p.nombre,grado:p.grado,puntos:0,acciones:0};t.puntos+=decision.puntaje*p.cantidad;t.acciones++;totals.set(p.id,t)}}
 if(action==='decidir'){
 const c=claims.find(v=>v.id===body.id);const nombre=String(body.aprobador||'').trim();if(!c||!['aprobado','rechazado'].includes(body.estado)||nombre.length<3||nombre.length>120)return res.status(400).json({error:'Indica tu nombre y selecciona la decisión.'});
 if(state(c)!=='pendiente')return res.status(409).json({error:'Esta solicitud ya fue revisada. No vuelve a sumar puntos.'});
 const decision={id:c.id,estado:body.estado,puntaje:config.tarifas[c.tipo],aprobador:nombre,motivo:String(body.motivo||'').slice(0,1000),fecha:new Date().toISOString()};const ok=await write('decisiones/'+c.id+'.json',decision);return res.status(ok?200:409).json(ok?{ok:true}:{error:'Otra persona acaba de revisar este registro. Actualiza.'});
 }
 if(action==='anular'){
 const c=claims.find(v=>v.id===body.id),motivo=String(body.motivo||'').trim(),nombre=String(body.aprobador||'').trim();if(!c||state(c)!=='aprobado'||motivo.length<5||nombre.length<3||nombre.length>120)return res.status(400).json({error:'Solo puedes anular una aprobación indicando tu nombre y un motivo de al menos cinco caracteres.'});
 const ok=await write('anulaciones/'+c.id+'.json',{id:c.id,motivo,aprobador:nombre,fecha:new Date().toISOString()});return res.status(ok?200:409).json(ok?{ok:true}:{error:'Ya estaba anulado.'});
 }
 if(action==='entregar'){
 const p=config.premios.find(p=>p.id===body.premio&&p.activo&&p.tipo==='premio');const t=totals.get(body.estudiante),nombre=String(body.aprobador||'').trim();if(!p||!t||t.puntos<p.meta||nombre.length<3||nombre.length>120)return res.status(400).json({error:'Revisa la meta del premio, el estudiante y tu nombre.'});
 const id=crypto.createHash('sha256').update(p.id+'|'+t.id).digest('hex');const ok=await write('entregas/'+id+'.json',{id,premio:p.id,estudiante:t.id,nombre:p.nombre,meta:p.meta,aprobador:nombre,fecha:new Date().toISOString()});return res.status(ok?200:409).json(ok?{ok:true}:{error:'Este premio ya fue entregado a este estudiante.'});
 }
 if(!['contexto','administrar','perfil'].includes(action))return res.status(400).json({error:'Acción no válida.'});
 const roster=await students();const clasificacion=roster.map(p=>({...p,...(totals.get(p.id)||{puntos:0,acciones:0}),insignias:config.premios.filter(v=>v.activo&&v.tipo==='insignia'&&(totals.get(p.id)?.puntos||0)>=v.meta)})).sort((a,b)=>b.puntos-a.puntos||a.nombre.localeCompare(b.nombre,'es'));
 const result={actividades,config,estudiantes:roster,clasificacion};
 if(action==='administrar')Object.assign(result,{solicitudes:claims.map(c=>({...c,estado:state(c),decision:decisions.find(v=>v.id===c.id)||null,anulacion:revokes.find(v=>v.id===c.id)||null})).sort((a,b)=>b.creado_en.localeCompare(a.creado_en)),entregas:deliveries});
 if(action==='perfil'){if(!validId(body.estudiante))return res.status(400).json({error:'Selecciona un estudiante.'});Object.assign(result,{perfil:clasificacion.find(p=>p.id===body.estudiante)||null,historial:claims.filter(c=>c.participantes.some(p=>p.id===body.estudiante)).map(c=>({id:c.id,tipo:c.tipo,fecha:c.fecha,hora:c.hora,detalle:c.detalle,estado:state(c),puntos:state(c)==='aprobado'?decisions.find(d=>d.id===c.id).puntaje*c.participantes.find(p=>p.id===body.estudiante).cantidad:0})),entregas:deliveries.filter(v=>v.estudiante===body.estudiante)})}
 return res.json(result);
 }catch(e){console.error('ClaudiPoints:',e.message);return res.status(500).json({error:'No fue posible completar la operación de ClaudiPoints. Inténtalo de nuevo.'})}
};
