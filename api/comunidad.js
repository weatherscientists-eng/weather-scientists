const {createClient}=require('@supabase/supabase-js');const puntos=require('../lib/puntosAutomaticos');const crypto=require('node:crypto');
const hoy=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
module.exports=async(req,res)=>{res.setHeader('Cache-Control','no-store');if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método no permitido'});try{
 const sb=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 if(req.method==='GET'){const tabla=req.query?.tipo;if(!['reportes','reciclaje'].includes(tabla))return res.status(400).json({error:'Consulta no válida.'});let rows=[];for(let i=0;;i+=1000){const r=await sb.from(tabla).select('*').order('id').range(i,i+999);if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<1000)break}return res.json({data:rows})}
 const b=req.body||{};
 if(b.action==='foto'){const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};if(!types[b.mime])throw Error('Escoge una foto JPG, PNG o WebP.');const path='clima_'+crypto.randomUUID()+'.'+types[b.mime];const {data,error}=await sb.storage.from('reportes-fotos').createSignedUploadUrl(path);if(error)throw error;return res.json({url:data.signedUrl,publicUrl:sb.storage.from('reportes-fotos').getPublicUrl(path).data.publicUrl})}
 if(b.action==='evento'){
 const v=b.values||{},when=String(v.fecha||'');const observed=new Date(when+'-05:00');if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when)||!Number.isFinite(observed.getTime())||observed.getTime()>Date.now())throw Error('Revisa la fecha y hora del evento.');
 if(!['lluvia','derrumbe','viento','granizo','otro'].includes(v.tipo_evento)||typeof v.descripcion!=='string'||v.descripcion.length<5||v.descripcion.length>4000)throw Error('Completa el tipo de evento y la descripción.');
 if(!Number.isFinite(v.latitud)||!Number.isFinite(v.longitud)||Math.abs(v.latitud)>90||Math.abs(v.longitud)>180)throw Error('Selecciona una ubicación válida.');
 if(v.medida_mm!==null&&(!Number.isFinite(v.medida_mm)||v.medida_mm<0))throw Error('Lectura no válida.');
 const identity=await puntos.preparar(sb,b);if(v.foto_url&&!String(v.foto_url).startsWith(process.env.SUPABASE_URL+'/storage/v1/object/public/reportes-fotos/'))throw Error('Foto no válida.');
 const row={tipo_evento:v.tipo_evento,descripcion:v.descripcion,latitud:v.latitud,longitud:v.longitud,medida_mm:v.medida_mm,foto_url:v.foto_url||null};const {data,error}=await sb.from('reportes').insert(row).select('id').single();if(error)throw error;
 const claudipoints=await puntos.acreditar(sb,{tipo:'evento',fuente:data.id,fecha:when.slice(0,10),hora:when.slice(11,16),detalle:'Evento climático: '+v.tipo_evento+' · '+v.descripcion.slice(0,800),identidad:identity});return res.status(201).json({id:data.id,claudipoints});
 }
 if(b.action==='reciclaje'){
 const v=b.values||{},fecha=String(v.fecha||''),d=new Date(fecha+'T12:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==fecha||fecha>hoy()||!['plastico','carton_papel','vidrio','metal','ecoladrillos'].includes(v.tipo_material)||!Number.isFinite(v.cantidad_kg)||v.cantidad_kg<=0)throw Error('Revisa la fecha, el material y el peso.');
 const cantidad=b.botellas;if(!Number.isInteger(cantidad)||cantidad<0||cantidad>10000)throw Error('Indica una cantidad entera de botellas.');if(cantidad>0&&!['plastico','vidrio'].includes(v.tipo_material))throw Error('Las botellas deben registrarse como plástico o vidrio.');
 const identity=cantidad>0?await puntos.preparar(sb,{...b,cantidad}):null;if(identity&&identity.participantes.length!==1)throw Error('Registra por separado las botellas de cada estudiante para asignar su cantidad correctamente.');
 const {data,error}=await sb.from('reciclaje').insert({fecha,tipo_material:v.tipo_material,cantidad_kg:v.cantidad_kg}).select('id').single();if(error)throw error;
 const claudipoints=identity?await puntos.acreditar(sb,{tipo:'botellas',fuente:data.id,fecha,detalle:`Entrega de ${cantidad} botellas · ${v.cantidad_kg} kg`,identidad:identity}):null;return res.status(201).json({id:data.id,claudipoints});
 }
 return res.status(400).json({error:'Acción no válida.'});
 }catch(e){return res.status(400).json({error:e.message||'No se pudo guardar la actividad.'})}};
