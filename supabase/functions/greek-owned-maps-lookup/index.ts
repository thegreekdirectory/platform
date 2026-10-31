const headers={ "Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey, authorization, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store" };
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
Deno.serve(async req=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers});
 if(req.method!=="POST") return reply({error:"Method not allowed"},405);
 try{
  const body=await req.json(), id=body?.installationId, ids=body?.placeIds;
  if(typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id)) return reply({error:"Invalid installation ID"},400);
  if(!Array.isArray(ids)||ids.length<1||ids.length>30||!ids.every(x=>typeof x==="string"&&/^[A-Za-z0-9_-]{8,300}$/.test(x))) return reply({error:"Invalid Place IDs"},400);
  const base=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const quota=await fetch(base+"/rest/v1/rpc/consume_greek_owned_extension_quota",{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({p_installation_id:id,p_max_requests:90,p_window_seconds:60})});
  if(!quota.ok||await quota.json()!==true) return reply({error:"Rate limit reached"},429);
  const q=new URLSearchParams({select:"google_place_id",visible:"eq.true",google_place_id:"in.("+[...new Set(ids)].join(",")+")"});
  const res=await fetch(base+"/rest/v1/listings?"+q,{headers:{apikey:key,Authorization:"Bearer "+key}});
  if(!res.ok) return reply({error:"Lookup unavailable"},502);
  const rows=await res.json();return reply({listedPlaceIds:rows.map((r:{google_place_id:string})=>r.google_place_id)});
 }catch{return reply({error:"Invalid request"},400)}
});