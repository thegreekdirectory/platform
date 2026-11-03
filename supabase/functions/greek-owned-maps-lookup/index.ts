const headers={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"apikey, authorization, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Content-Type":"application/json",
  "Cache-Control":"no-store"
};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
function validUuid(value:unknown):value is string {
  return typeof value==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function normalizePlaceId(value:unknown):string|null {
  if(typeof value!=="string") return null;
  let id=value.trim();
  if(id.length===28 && id.startsWith("ChIJ") && id.endsWith("A")) id=id.slice(0,-1);
  return /^ChIJ[A-Za-z0-9_-]{23}$/.test(id) ? id : null;
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers});
  if(req.method!=="POST") return reply({error:"Method not allowed"},405);
  try {
    const body=await req.json();
    const installationId=body?.installationId;
    const rawIds=body?.placeIds;
    if(!validUuid(installationId)) return reply({error:"Invalid installation ID",code:"INVALID_INSTALLATION_ID"},400);
    if(!Array.isArray(rawIds)||rawIds.length<1||rawIds.length>30) return reply({error:"Provide 1–30 Place IDs",code:"INVALID_PLACE_ID_BATCH"},400);

    const normalized=rawIds.map(normalizePlaceId);
    if(normalized.some((id)=>id===null)) return reply({error:"One or more Place IDs are not in TGD's supported format",code:"INVALID_PLACE_ID"},400);
    const placeIds=[...new Set(normalized as string[])];

    const base=Deno.env.get("SUPABASE_URL");
    const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!base||!key) return reply({error:"Directory lookup is not configured",code:"BACKEND_CONFIG"},503);

    const quota=await fetch(base+"/rest/v1/rpc/consume_greek_owned_extension_quota",{
      method:"POST",
      headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},
      body:JSON.stringify({p_installation_id:installationId,p_max_requests:90,p_window_seconds:60})
    });
    if(!quota.ok) {
      console.error("TGD Maps lookup quota check failed with status",quota.status);
      return reply({error:"Lookup rate-limit service unavailable",code:"QUOTA_UNAVAILABLE"},503);
    }
    if(await quota.json()!==true) return reply({error:"Rate limit reached. Try again in a minute.",code:"RATE_LIMITED"},429);

    const query=new URLSearchParams({select:"google_place_id",visible:"eq.true"});
    if(placeIds.length===1) query.set("google_place_id","eq."+placeIds[0]);
    else query.set("google_place_id","in.("+placeIds.map((id)=>'"'+id+'"').join(",")+")");

    const response=await fetch(base+"/rest/v1/listings?"+query.toString(),{
      headers:{apikey:key,Authorization:"Bearer "+key}
    });
    if(!response.ok) {
      console.error("TGD Maps listings query failed with status",response.status);
      return reply({error:"Directory lookup failed",code:"LISTINGS_QUERY_FAILED"},502);
    }
    const rows=await response.json();
    if(!Array.isArray(rows)) return reply({error:"Unexpected directory response",code:"INVALID_DIRECTORY_RESPONSE"},502);
    return reply({listedPlaceIds:rows.map((row:{google_place_id:string})=>row.google_place_id)});
  } catch(error) {
    console.error("TGD Maps lookup request failed:",error instanceof Error?error.message:"unknown error");
    return reply({error:"Invalid lookup request",code:"INVALID_REQUEST"},400);
  }
});