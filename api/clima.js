// Lecturas diarias del pluviómetro institucional. No solicita geolocalización.
const {createClient}=require('@supabase/supabase-js');
const BUCKET='ws-pluviosidad';
function fechaColombia(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function fechaValida(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s&&s<=fechaColombia()}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método no permitido'});
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return res.status(503).json({error:'La conexión de pluviosidad no está configurada.'});
 const sb=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 try{
  let values;
  if(req.method==='POST'){
   const {fecha,mm}=req.body||{};
   if(!fechaValida(fecha))return res.status(400).json({error:'Escoge una fecha válida que no sea futura.'});
   if(typeof mm!=='number'||!Number.isFinite(mm)||mm<0||mm>10000||Math.abs(mm*100-Math.round(mm*100))>0.000001)return res.status(400).json({error:'Escribe una lectura entre 0 y 10000 mm, con hasta dos decimales.'});
   values={fecha,mm,lugar:'C.E.R. Claudina Múnera',registrado_en:new Date().toISOString()};
  }
  const {data:bucket,error:be}=await sb.storage.getBucket(BUCKET);
  if(be){
   if(!/not found|does not exist/i.test(be.message||'')&&!['400','404'].includes(String(be.statusCode||be.status)))throw be;
   const {error:ce}=await sb.storage.createBucket(BUCKET,{public:false,fileSizeLimit:2048,allowedMimeTypes:['application/json']});
   if(ce&&!/already exists|duplicate/i.test(ce.message||''))throw ce;
  }else if(bucket.public)throw Error('La configuración del registro requiere almacenamiento privado.');
  const storage=sb.storage.from(BUCKET);
  if(req.method==='POST'){
   const {error}=await storage.upload(values.fecha+'.json',Buffer.from(JSON.stringify(values)),{contentType:'application/json',upsert:false});
   if(error){if(String(error.statusCode)==='409'||/already exists|duplicate/i.test(error.message||''))return res.status(409).json({error:'Ya hay una lectura para esta fecha. Consulta el historial antes de registrar otra.'});throw error}
   return res.status(201).json({data:values});
  }
  const {data:files,error}=await storage.list('',{limit:30,sortBy:{column:'name',order:'desc'}});if(error)throw error;
  const data=await Promise.all((files||[]).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f.name)).map(async f=>{const {data,error}=await storage.download(f.name);if(error)throw error;const r=JSON.parse(await data.text());return {fecha:r.fecha,mm:r.mm,lugar:r.lugar}}));
  return res.json({data});
 }catch(e){console.error('Registro de pluviosidad:',e.message);return res.status(500).json({error:'No fue posible consultar o guardar la lectura. Comprueba la conexión e inténtalo de nuevo.'})}
};
module.exports.fechaValida=fechaValida;
