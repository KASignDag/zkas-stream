function response(body,status=200,headers={}) {
  return new Response(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
}
async function authorized(request, env) {
  if (!env.BUFFER_ADMIN_TOKEN) return false;
  const supplied=request.headers.get('X-ZKAS-Admin-Token')||'';
  if(!supplied) return false;
  const enc=new TextEncoder();
  const [l,r]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(supplied)),crypto.subtle.digest('SHA-256',enc.encode(env.BUFFER_ADMIN_TOKEN))]);
  const a=new Uint8Array(l),b=new Uint8Array(r);let mismatch=0;
  for(let i=0;i<a.length;i++) mismatch|=a[i]^b[i];
  return mismatch===0;
}
export async function onRequest(context){
  const {request,env}=context;
  if(!env.OTC_TRADES) return response('Media storage unavailable',503);
  const url=new URL(request.url);
  if(request.method==='GET'){
    const id=(url.searchParams.get('id')||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100);
    if(!id) return response('Not found',404);
    const item=await env.OTC_TRADES.get('buffer-media:'+id,{type:'arrayBuffer'});
    if(!item) return response('Not found',404);
    return response(item,200,{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=31536000, immutable'});
  }
  if(request.method==='POST'){
    const origin=request.headers.get('Origin');
    if(origin&&origin!==url.origin) return response('Invalid origin',403);
    if(!(await authorized(request,env))) return response('Admin access required',401);
    const type=request.headers.get('Content-Type')||'';
    if(!type.startsWith('image/jpeg')) return response('JPEG images only',415);
    const bytes=await request.arrayBuffer();
    if(!bytes.byteLength||bytes.byteLength>4_500_000) return response('Image must be under 4.5 MB',413);
    const id=crypto.randomUUID().replace(/-/g,'');
    await env.OTC_TRADES.put('buffer-media:'+id,bytes,{expirationTtl:60*60*24*14});
    return Response.json({ok:true,url:url.origin+'/api/buffer-image?id='+id},{headers:{'Cache-Control':'no-store'}});
  }
  return response('Method not allowed',405);
}
