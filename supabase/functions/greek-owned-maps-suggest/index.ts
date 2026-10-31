const headers={ "Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey, authorization, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store" };
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const uuid=(v:unknown)=>typeof v==="string"&&/^[0-9a-f-]{36}$/i.test(v);
const clean=(v:unknown,n:number)=>typeof v==="string"&&v.trim()?v.trim().slice(0,n):null;
Deno.serve(async req=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers});
 if(req.method!=="POST") return reply({error:"Method not allowed"},405);
 try{
  const b=await req.json(),id=b?.installationId,pid=b?.placeId,name=clean(b?.businessName,200),address=clean(b?.address,300),note=clean(b?.note,500),relationship=b?.relationship;
  if(!uuid(id)||typeof pid!=="string"||!/^[A-Za-z0-9_-]{8,300}$/.test(pid)||!name) return reply({error:"Invalid business details"},400);
  if(!["owner","family_friend","knows"].includes(relationship)) return reply({error:"Choose a relationship option"},400);
  const base=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(id+":suggestions")));
  const h=Array.from(bytes.slice(0,16),x=>x.toString(16).padStart(2,"0")).join("").split("");h[12]="5";h[16]="a";const s=h.join("");const scoped=s.slice(0,8)+"-"+s.slice(8,12)+"-"+s.slice(12,16)+"-"+s.slice(16,20)+"-"+s.slice(20);
  const quota=await fetch(base+"/rest/v1/rpc/consume_greek_owned_extension_quota",{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({p_installation_id:scoped,p_max_requests:5,p_window_seconds:3600})});
  if(!quota.ok||await quota.json()!==true) return reply({error:"Suggestion limit reached"},429);
  const q=new URLSearchParams({select:"google_place_id",visible:"eq.true",google_place_id:"eq."+pid,limit:"1"});
  const exists=await fetch(base+"/rest/v1/listings?"+q,{headers:{apikey:key,Authorization:"Bearer "+key}});
  if(!exists.ok) return reply({error:"Could not verify listing"},502);
  if((await exists.json()).length) return reply({message:"Already listed"},409);
  const insert=await fetch(base+"/rest/v1/greek_owned_extension_suggestions",{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({google_place_id:pid,business_name:name,address,maps_url:"https://www.google.com/maps/search/?api=1&query_place_id="+encodeURIComponent(pid),relationship,note})});
  if(insert.status===409) return reply({message:"Suggestion already pending"},409);
  if(!insert.ok) return reply({error:"Could not submit suggestion"},502);
  return reply({message:"Thank you. Your suggestion will be reviewed by The Greek Directory."},201);
 }catch{return reply({error:"Invalid request"},400)}
});