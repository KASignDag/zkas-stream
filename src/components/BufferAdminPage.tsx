import { useEffect, useMemo, useState } from 'react';

type BufferChannel = { id: string; name?: string; displayName?: string; service?: string; isQueuePaused?: boolean };
type BufferOrg = { id: string; name: string; channels: BufferChannel[] };
type BufferStatus = { account?: { name?: string | null; timezone?: string | null }; organizations?: BufferOrg[] };

export function BufferAdminPage() {
  const [token,setToken]=useState(()=>sessionStorage.getItem('zkas-buffer-admin')||'');
  const [status,setStatus]=useState<BufferStatus|null>(null);
  const [channelId,setChannelId]=useState('');
  const [text,setText]=useState('');
  const [mode,setMode]=useState<'addToQueue'|'customScheduled'>('addToQueue');
  const [dueAt,setDueAt]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const channels=useMemo(()=>status?.organizations?.flatMap(org=>org.channels.map(channel=>({...channel,orgName:org.name})))??[],[status]);

  async function connect() {
    setBusy(true);setMessage('');
    try {
      const response=await fetch('/api/buffer',{headers:{'X-ZKAS-Admin-Token':token},cache:'no-store'});
      const body=await response.json();
      if(!response.ok) throw new Error(body.message||'Could not connect to Buffer.');
      sessionStorage.setItem('zkas-buffer-admin',token);
      setStatus(body);
      const x=body.organizations?.flatMap((org:BufferOrg)=>org.channels).find((channel:BufferChannel)=>channel.service==='twitter'||channel.service==='x');
      setChannelId((current)=>current||x?.id||body.organizations?.[0]?.channels?.[0]?.id||'');
      setMessage('Buffer connected.');
    } catch(error){setStatus(null);setMessage(error instanceof Error?error.message:'Connection failed.');}
    finally{setBusy(false);}
  }

  useEffect(()=>{if(token) void connect();},[]);

  async function send() {
    if(!channelId||!text.trim()) return;
    setBusy(true);setMessage('');
    try {
      const response=await fetch('/api/buffer',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-ZKAS-Admin-Token':token},
        body:JSON.stringify({channelId,text,mode,dueAt:mode==='customScheduled'?new Date(dueAt).toISOString():undefined}),
      });
      const body=await response.json();
      if(!response.ok) throw new Error(body.message||'Buffer could not create the post.');
      setMessage(mode==='addToQueue'?'Added to the Buffer queue.':`Scheduled in Buffer for ${new Date(body.post?.dueAt||dueAt).toLocaleString()}.`);
      setText('');
    } catch(error){setMessage(error instanceof Error?error.message:'Scheduling failed.');}
    finally{setBusy(false);}
  }

  return <main style={{maxWidth:900,margin:'0 auto',padding:'36px 20px 80px',fontFamily:'system-ui'}}>
    <a href="/" style={{textDecoration:'none',fontWeight:900,color:'#159a7e'}}>← ZKAS.stream</a>
    <h1 style={{fontSize:'clamp(34px,6vw,64px)',margin:'22px 0 8px'}}>Buffer Publisher</h1>
    <p style={{color:'#687a75',fontWeight:650}}>Private ZKAS.stream admin workspace. Your Buffer API key stays server-side in Cloudflare.</p>
    <section style={{marginTop:28,padding:24,border:'1px solid #cfe2dc',borderRadius:22,background:'#fff'}}>
      <label style={{display:'grid',gap:8,fontWeight:800}}>Admin token
        <input type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder="Enter your ZKAS Buffer admin token" style={{padding:14,border:'1px solid #b9cec7',borderRadius:12,fontSize:16}} />
      </label>
      <button onClick={()=>void connect()} disabled={!token||busy} style={{marginTop:12,padding:'12px 18px',border:0,borderRadius:999,background:'#0b2b24',color:'#fff',fontWeight:900,cursor:'pointer'}}>Connect to Buffer</button>
      {status&&<p style={{marginBottom:0,fontWeight:750}}>Connected{status.account?.name?` as ${status.account.name}`:''} · {channels.length} channel{channels.length===1?'':'s'}</p>}
    </section>
    {status&&<section style={{marginTop:18,padding:24,border:'1px solid #cfe2dc',borderRadius:22,background:'#fff',display:'grid',gap:16}}>
      <label style={{display:'grid',gap:8,fontWeight:800}}>Buffer channel
        <select value={channelId} onChange={e=>setChannelId(e.target.value)} style={{padding:14,border:'1px solid #b9cec7',borderRadius:12,fontSize:16}}>
          {channels.map(channel=><option key={channel.id} value={channel.id}>{channel.displayName||channel.name||channel.id} · {channel.service} · {channel.orgName}</option>)}
        </select>
      </label>
      <label style={{display:'grid',gap:8,fontWeight:800}}>Post
        <textarea value={text} onChange={e=>setText(e.target.value)} rows={10} placeholder="Paste or write the ZKAS post here…" style={{padding:14,border:'1px solid #b9cec7',borderRadius:12,fontSize:16,resize:'vertical'}} />
      </label>
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        <button onClick={()=>setMode('addToQueue')} style={{padding:'10px 14px',borderRadius:999,border:'1px solid #9ec8bb',background:mode==='addToQueue'?'#159a7e':'#fff',color:mode==='addToQueue'?'#fff':'#10251f',fontWeight:850}}>Next queue slot</button>
        <button onClick={()=>setMode('customScheduled')} style={{padding:'10px 14px',borderRadius:999,border:'1px solid #9ec8bb',background:mode==='customScheduled'?'#159a7e':'#fff',color:mode==='customScheduled'?'#fff':'#10251f',fontWeight:850}}>Exact time</button>
      </div>
      {mode==='customScheduled'&&<label style={{display:'grid',gap:8,fontWeight:800}}>Schedule time<input type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)} style={{padding:14,border:'1px solid #b9cec7',borderRadius:12,fontSize:16}} /></label>}
      <button onClick={()=>void send()} disabled={busy||!channelId||!text.trim()||(mode==='customScheduled'&&!dueAt)} style={{padding:'14px 20px',border:0,borderRadius:14,background:'#0b2b24',color:'#fff',fontSize:17,fontWeight:900,cursor:'pointer'}}>{busy?'Working…':mode==='addToQueue'?'Add to Buffer queue':'Schedule in Buffer'}</button>
    </section>}
    {message&&<p style={{padding:'14px 16px',borderRadius:14,background:'#eaf8f3',fontWeight:800}}>{message}</p>}
    <p style={{marginTop:24,color:'#687a75',fontSize:13}}>Security: never put your Buffer API key in this page or in GitHub. Store BUFFER_API_KEY and BUFFER_ADMIN_TOKEN as encrypted Cloudflare environment secrets.</p>
  </main>;
}
