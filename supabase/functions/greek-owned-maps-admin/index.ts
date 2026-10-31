// Internal queue endpoint. Requires a GitHub token with write access to the TGD platform repository.
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey, authorization, content-type, x-github-token","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const rest=(path:string,init:RequestInit={})=>fetch(Deno.env.get("SUPABASE_URL")+"/rest/v1/"+path,{...init,headers:{apikey:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,Authorization:"Bearer "+Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,...(init.headers||{})}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try{
  const token=req.headers.get("x-github-token")||"",gh={Authorization:"Bearer "+token,Accept:"application/vnd.github+json"};
  if(token.length<20||token.length>500)return reply({error:"GitHub authentication required"},401);
  const user=await fetch("https://api.github.com/user",{headers:gh});if(!user.ok)return reply({error:"GitHub authentication failed"},403);
  const repo=await fetch("https://api.github.com/repos/thegreekdirectory/platform",{headers:gh});if(!repo.ok)return reply({error:"Repository access denied"},403);
  const perms=(await repo.json()).permissions;if(!perms?.push&&!perms?.admin)return reply({error:"Repository write access required"},403);
  const b=await req.json();
  if(b.action==="list"){
   const q=new URLSearchParams({select:"id,created_at,google_place_id,business_name,address,maps_url,relationship,note",status:"eq.pending",order:"created_at.desc",limit:"250"});
   const r=await rest("greek_owned_extension_suggestions?"+q);if(!r.ok)return reply({error:"Queue unavailable"},502);return reply({suggestions:await r.json()});
  }
  if(b.action==="review"){
   if(typeof b.id!=="string"||!["approved","denied"].includes(b.status))return reply({error:"Invalid review"},400);
   const q=new URLSearchParams({select:"id,google_place_id",id:"eq."+b.id,status:"eq.pending",limit:"1"});
   const r=await rest("greek_owned_extension_suggestions?"+q);const rows=await r.json();if(!r.ok||!rows.length)return reply({error:"Suggestion is no longer pending"},409);
   if(b.status==="approved"){
    const lq=new URLSearchParams({select:"id",visible:"eq.true",google_place_id:"eq."+rows[0].google_place_id,limit:"1"});
    const lr=await rest("listings?"+lq);if(!lr.ok)return reply({error:"Could not verify listing"},502);if((await lr.json()).length)return reply({error:"Place ID already belongs to a visible listing"},409);
   }
   const update=await rest("greek_owned_extension_suggestions?"+new URLSearchParams({id:"eq."+b.id,status:"eq.pending"}),{method:"PATCH",headers:{"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify({status:b.status,reviewed_at:new Date().toISOString(),review_notes:typeof b.reviewNotes==="string"?b.reviewNotes.slice(0,2000):null})});
   if(!update.ok||!(await update.json()).length)return reply({error:"Review could not be saved"},409);return reply({reviewed:true,status:b.status});
  }
  return reply({error:"Unknown action"},400);
 }catch{return reply({error:"Invalid request"},400)}
});