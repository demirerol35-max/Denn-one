// Cloudflare Worker + Durable Object: Google Places quota gate for Deen One.
// Required secrets: GOOGLE_PLACES_API_KEY. Required binding: QUOTA (Durable Object).
// Set ALLOWED_ORIGIN to the exact GitHub Pages origin; never commit API keys.
// Note: this controls calls made THROUGH THIS worker, not other use of the Google Cloud key.
export class MosqueQuota {
  constructor(state, env) { this.state=state; this.env=env; }
  async fetch(request) {
    const {lat,lon,radius,client}=await request.json();
    if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180||
       !Number.isInteger(radius)||radius<500||radius>20000||!/^[-a-zA-Z0-9_]{16,80}$/.test(client))
      return Response.json({error:'invalid_request'},{status:400});
    const month=new Date().toISOString().slice(0,7);
    // Transaction reserves a call before contacting Google. A failed Google request still
    // consumes one attempt; this makes the upper bound conservative.
    const allowed=await this.state.storage.transaction(async tx=>{
      const globalKey='global:'+month, userKey='user:'+month+':'+client;
      const total=(await tx.get(globalKey))||0, perUser=(await tx.get(userKey))||0;
      if(total>=1000) return {ok:false,reason:'global_quota'};
      if(perUser>=10) return {ok:false,reason:'user_quota'};
      await tx.put(globalKey,total+1);await tx.put(userKey,perUser+1);
      return {ok:true,remaining:999-total};
    });
    if(!allowed.ok) return Response.json({error:allowed.reason},{status:429});
    const google=await fetch('https://places.googleapis.com/v1/places:searchNearby',{
      method:'POST',headers:{'Content-Type':'application/json',
        'X-Goog-Api-Key':this.env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask':'places.id,places.displayName,places.location,places.formattedAddress'},
      body:JSON.stringify({includedTypes:['mosque'],maxResultCount:20,
        locationRestriction:{circle:{center:{latitude:lat,longitude:lon},radius}}})
    });
    if(!google.ok) return Response.json({error:'provider_unavailable'},{status:502});
    const body=await google.json();
    return Response.json({source:'google',places:(body.places||[]).map(p=>({
      id:p.id,name:p.displayName?.text||'Mosquée',address:p.formattedAddress||'',
      lat:p.location?.latitude,lon:p.location?.longitude
    }))});
  }
}
export default {
  async fetch(request,env) {
    const origin=request.headers.get('Origin')||'';
    const allowedOrigin=env.ALLOWED_ORIGIN||'https://demirerol35-max.github.io';
    const headers={'Access-Control-Allow-Origin':allowedOrigin,'Vary':'Origin',
      'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
    if(origin!==allowedOrigin) return new Response('Forbidden',{status:403});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return new Response('Method not allowed',{status:405,headers});
    try {
      const body=await request.json();
      const id=env.QUOTA.idFromName('mosque-places-global');
      const response=await env.QUOTA.get(id).fetch(new Request('https://quota.internal/',{
        method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}
      }));
      const out=new Response(response.body,response);
      for(const [k,v] of Object.entries(headers))out.headers.set(k,v);
      return out;
    } catch(_){return Response.json({error:'service_unavailable'},{status:503,headers});}
  }
};
