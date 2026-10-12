import { useEffect, useMemo, useState } from 'react';

type BufferChannel = { id: string; name?: string; displayName?: string; service?: string; isQueuePaused?: boolean };
type BufferOrg = { id: string; name: string; channels: BufferChannel[] };
type BufferStatus = { account?: { name?: string | null; timezone?: string | null }; organizations?: BufferOrg[] };
type DailyPost = { time: string; text: string; imageUrl: string };
const VISUAL_PACK_VERSION = '2026-10-13-professional-tech-a';

const DAILY_POSTS: DailyPost[] = [

  {time:'05:00',imageUrl:'',text:"ZKAS: privacy at the protocol level\n\nZKAS is designed around shielded transactions rather than adding privacy as an optional layer. Sender, recipient and transaction amounts are protected by the protocol’s privacy architecture.\n\n#ZKAS #Privacy #ZeroKnowledge"},
  {time:'06:54',imageUrl:'',text:"BlockDAG + privacy\n\nZKAS combines a Kaspa-derived BlockDAG architecture with shielded transactions. The objective is to pair parallel block processing with privacy-by-default financial activity.\n\n#ZKAS #BlockDAG #Kaspa"},
  {time:'08:48',imageUrl:'',text:"Merge mining\n\nZKAS uses kHeavyHash and can be merge mined alongside Kaspa. The same mining work can contribute to both networks, allowing existing PoW infrastructure to support additional network security.\n\n#ZKAS #Kaspa #Mining"},
  {time:'10:42',imageUrl:'',text:"Zero-knowledge proofs\n\nZKAS uses Orchard-style shielded transactions together with Halo 2 zero-knowledge proofs. The network can validate transaction rules without publicly exposing the underlying financial details.\n\n#ZKAS #ZeroKnowledge #Privacy"},
  {time:'12:36',imageUrl:'',text:"What ZKAS.stream is for\n\nZKAS.stream is an independent community data layer for the ecosystem — bringing network activity, mining information, markets, OTC activity, nodes and research tools into one interface.\n\n#ZKAS #Data"},
  {time:'14:30',imageUrl:'',text:"Community mining transparency\n\nThe ZKAS.stream Community Mining dashboard gives miners visibility into live mining activity and bridge telemetry while keeping wallet addresses and miner IP addresses out of the public display.\n\n#ZKAS #Mining #Privacy"},
  {time:'16:24',imageUrl:'',text:"Market data should be separated clearly\n\nZKAS.stream keeps exchange activity and OTC activity distinct. Exchange market data reflects order-book markets, while OTC metrics track direct trading activity separately.\n\nDifferent markets. Different signals.\n\n#ZKAS #Markets"},
  {time:'18:18',imageUrl:'',text:"Network visibility without financial surveillance\n\nA privacy network can still publish useful operational information: node distribution, hashrate, blocks, mining activity and market data do not require exposing individual users’ financial histories.\n\n#ZKAS #Privacy"},
  {time:'20:12',imageUrl:'',text:"Infrastructure matters\n\nWallets and exchanges are only part of a cryptocurrency ecosystem. Nodes, explorers, mining infrastructure, network telemetry and reliable data tools are equally important for long-term usability.\n\n#ZKAS #Infrastructure"},
  {time:'22:00',imageUrl:'',text:"ZKAS + ZKAS.stream\n\nZKAS is the network. ZKAS.stream is a community information layer around it.\n\nProtocol privacy + mining + nodes + market intelligence + ecosystem tools.\n\nThe goal is to make the network easier to understand without compromising its privacy principles.\n\n#ZKAS"},
];

function tomorrowLocalDate(){
  const d=new Date(); d.setDate(d.getDate()+1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

export function BufferAdminPage() {
  const [token,setToken]=useState(()=>sessionStorage.getItem('zkas-buffer-admin')||'');
  const [status,setStatus]=useState<BufferStatus|null>(null);
  const [channelId,setChannelId]=useState('');
  const [text,setText]=useState('');
  const [mode,setMode]=useState<'addToQueue'|'customScheduled'>('addToQueue');
  const [dueAt,setDueAt]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [day,setDay]=useState(tomorrowLocalDate);
  const [dailyPosts,setDailyPosts]=useState<DailyPost[]>(DAILY_POSTS);
  const [scheduled,setScheduled]=useState<number[]>([]);
  const [packBusy,setPackBusy]=useState(false);
  const [visualDay,setVisualDay]=useState('');
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
  useEffect(()=>{
    if(!status||!token||visualDay===day) return;
    const cached=sessionStorage.getItem('zkas-buffer-visuals-'+VISUAL_PACK_VERSION+'-'+day);
    if(cached){
      try{
        const urls=JSON.parse(cached) as string[];
        if(urls.length===10){setDailyPosts(rows=>rows.map((row,i)=>({...row,imageUrl:urls[i]})));setVisualDay(day);setMessage('Today’s 10 matching visuals are loaded automatically.');return;}
      }catch{}
    }
    void generateAutomaticVisuals();
  },[status,day]);

  async function createBufferPost(postText:string, iso?:string, imageUrl='') {
    const response=await fetch('/api/buffer',{
      method:'POST',
      headers:{'Content-Type':'application/json','X-ZKAS-Admin-Token':token},
      body:JSON.stringify({channelId,text:postText,mode:iso?'customScheduled':'addToQueue',dueAt:iso,imageUrl}),
    });
    const body=await response.json();
    if(!response.ok) throw new Error(body.message||'Buffer could not create the post.');
    return body;
  }

  async function send() {
    if(!channelId||!text.trim()) return;
    setBusy(true);setMessage('');
    try {
      const iso=mode==='customScheduled'?new Date(dueAt).toISOString():undefined;
      const body=await createBufferPost(text,iso);
      setMessage(mode==='addToQueue'?'Added to the Buffer queue.':'Scheduled in Buffer for '+new Date(body.post?.dueAt||dueAt).toLocaleString()+'.');
      setText('');
    } catch(error){setMessage(error instanceof Error?error.message:'Scheduling failed.');}
    finally{setBusy(false);}
  }

  function drawAutomaticVisual(index:number,dateLabel:string){
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=675;
    const ctx=canvas.getContext('2d');if(!ctx) throw new Error('Could not create visual.');

    const titles=['LIVE NETWORK','MINING TOOLS','OTC DASHBOARD','EXCHANGE MARKETS','EXPLORER TOOLS','MINING CALCULATOR','NODE MAP','KAS + ZKAS CONVERTER','STREAM WALLET','ALL ZKAS FEATURES'];
    const subs=['BLOCKS · HASHRATE · NODES','SOLO · POOL · MERGED · COMMUNITY','TRADES · ORDERS · ACTIVITY','PRICE · VOLUME · MARKET CAP','BLOCKS · SUPPLY · DAG','SOLO · KAS · COMBINED VALUE','GLOBAL NETWORK VIEW','USDT CONVERSIONS','NON-CUSTODIAL MOBILE WALLET','NETWORK · MINING · MARKETS · TOOLS'];

    const bg=ctx.createLinearGradient(0,0,1200,675);
    bg.addColorStop(0,'#031512');bg.addColorStop(.58,'#09272a');bg.addColorStop(1,'#0b3537');
    ctx.fillStyle=bg;ctx.fillRect(0,0,1200,675);

    ctx.globalAlpha=.16;ctx.strokeStyle='#46e2cb';ctx.lineWidth=1.5;
    for(let x=0;x<=1200;x+=80){ctx.beginPath();ctx.moveTo(x,190);ctx.lineTo(600+(x-600)*.55,675);ctx.stroke();}
    for(let y=210;y<675;y+=58){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1200,y);ctx.stroke();}
    ctx.globalAlpha=1;

    ctx.fillStyle='#edfdf9';ctx.font='800 58px system-ui';ctx.fillText(titles[index],64,102);
    ctx.fillStyle='#46e2cb';ctx.font='700 23px system-ui';ctx.fillText(subs[index],68,143);
    ctx.fillStyle='#8ca9a2';ctx.font='600 18px system-ui';ctx.fillText('ZKAS · '+dateLabel,68,626);
    ctx.fillStyle='#46e2cb';ctx.font='800 23px system-ui';ctx.fillText('ZKAS.stream',966,626);

    const panel=(x:number,y:number,w:number,h:number,r=18)=>{
      ctx.fillStyle='rgba(6,31,33,.90)';ctx.strokeStyle='rgba(70,226,203,.82)';ctx.lineWidth=3;
      ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();ctx.stroke();
    };
    const dot=(x:number,y:number,r=10,fill='#46e2cb')=>{ctx.fillStyle=fill;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
    const label=(t:string,x:number,y:number,size=22)=>{ctx.fillStyle='#e8f9f5';ctx.font='800 '+size+'px system-ui';ctx.textAlign='center';ctx.fillText(t,x,y);ctx.textAlign='left';};

    if(index===0){
      dot(600,355,78);ctx.fillStyle='#082326';ctx.font='900 52px system-ui';ctx.textAlign='center';ctx.fillText('ZK',600,373);ctx.textAlign='left';
      const items=[['PRIVACY',260,255],['MINING',940,255],['MARKETS',260,470],['COMMUNITY',940,470]];
      items.forEach(([t,x,y])=>{ctx.strokeStyle='rgba(70,226,203,.58)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(600,355);ctx.lineTo(Number(x),Number(y));ctx.stroke();panel(Number(x)-120,Number(y)-48,240,96,18);label(String(t),Number(x),Number(y)+8,22);});
    } else if(index===1){
      ctx.strokeStyle='#46e2cb';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(600,210);ctx.lineTo(755,270);ctx.lineTo(730,455);ctx.quadraticCurveTo(665,525,600,552);ctx.quadraticCurveTo(535,525,470,455);ctx.lineTo(445,270);ctx.closePath();ctx.stroke();
      ctx.fillStyle='rgba(70,226,203,.10)';ctx.fill();
      ctx.strokeStyle='#e8f9f5';ctx.lineWidth=9;ctx.beginPath();ctx.arc(600,340,48,Math.PI,0);ctx.stroke();ctx.strokeRect(548,340,104,110);
      ['KEEP IT PRIVATE','REVEAL WHEN NEEDED','SHARE ON YOUR TERMS'].forEach((t,i)=>{panel(115,255+i*92,280,68,16);label(t,255,298+i*92,16);});
    } else if(index===2){
      panel(160,255,300,230,28);panel(740,255,300,230,28);
      dot(310,355,86,'#0f3d3f');dot(890,355,86,'#0f3d3f');
      label('KASPA',310,367,30);label('ZKAS',890,367,30);
      ctx.strokeStyle='#46e2cb';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(396,355);ctx.bezierCurveTo(500,240,700,470,804,355);ctx.stroke();
      ctx.beginPath();ctx.moveTo(396,355);ctx.bezierCurveTo(500,470,700,240,804,355);ctx.stroke();
      label('ONE MINING EFFORT · TWO NETWORKS',600,530,19);
    } else if(index===3){
      panel(440,215,320,330,34);ctx.strokeStyle='#46e2cb';ctx.lineWidth=4;ctx.strokeRect(485,260,230,175);label('ZKAS WALLET',600,352,28);
      const cards=[['BACKUP',180,275],['QR PAY',900,275],['HISTORY',180,450],['ALERTS',900,450]];
      cards.forEach(([t,x,y])=>{panel(Number(x)-105,Number(y)-46,210,92,16);label(String(t),Number(x),Number(y)+8,19);ctx.strokeStyle='rgba(70,226,203,.5)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(Number(x)<600?Number(x)+105:Number(x)-105,Number(y));ctx.lineTo(Number(x)<600?440:760,Number(y));ctx.stroke();});
    } else if(index===4){
      const cards=[['MINING',115],['OTC',385],['MARKETS',655],['EXPLORER',925]];
      cards.forEach(([t,x],i)=>{panel(Number(x),245,220,250,20);label(String(t),Number(x)+110,300,22);ctx.fillStyle='#46e2cb';for(let b=0;b<4;b++)ctx.fillRect(Number(x)+42+b*34,425-(b+i%2)*22,18,55+(b+i%2)*22);});
    } else if(index===5){
      const items=[['SAVINGS',255,280],['SALARY',255,450],['PURCHASES',945,280],['SECURITY',945,450]];
      items.forEach(([t,x,y])=>{panel(Number(x)-135,Number(y)-50,270,100,18);label(String(t),Number(x),Number(y)+8,21);});
      ctx.strokeStyle='#46e2cb';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(600,235);ctx.lineTo(735,285);ctx.lineTo(715,450);ctx.quadraticCurveTo(655,510,600,535);ctx.quadraticCurveTo(545,510,485,450);ctx.lineTo(465,285);ctx.closePath();ctx.stroke();label('PRIVATE',600,388,34);
    } else if(index===6){
      const modes=[['POOL',180],['SOLO',420],['MERGED',660],['COMMUNITY',900]];
      modes.forEach(([t,x],i)=>{panel(Number(x),270,200,200,20);ctx.fillStyle='#46e2cb';ctx.beginPath();ctx.arc(Number(x)+100,335,34,0,Math.PI*2);ctx.fill();label(String(t),Number(x)+100,430,19);ctx.strokeStyle='rgba(70,226,203,.45)';ctx.lineWidth=3;if(i<3){ctx.beginPath();ctx.moveTo(Number(x)+200,370);ctx.lineTo(Number(x)+240,370);ctx.stroke();}});
    } else if(index===7){
      const pillars=[['WALLETS',155,420,90],['MINERS',385,370,140],['LIQUIDITY',615,315,195],['AWARENESS',845,250,260]];
      pillars.forEach(([t,x,y,h])=>{panel(Number(x),Number(y),190,Number(h),18);label(String(t),Number(x)+95,Number(y)+45,18);});
      ctx.strokeStyle='#46e2cb';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(250,400);ctx.lineTo(480,345);ctx.lineTo(710,290);ctx.lineTo(940,225);ctx.stroke();ctx.beginPath();ctx.moveTo(940,225);ctx.lineTo(900,220);ctx.moveTo(940,225);ctx.lineTo(918,260);ctx.stroke();
    } else if(index===8){
      dot(600,365,82,'#0f3d3f');label('ZKAS.stream',600,374,25);
      const nodes=[['NETWORK DATA',280,250],['MINING',920,250],['MARKETS',280,485],['EXPLORER',920,485],['OTC',600,540]];
      nodes.forEach(([t,x,y])=>{ctx.strokeStyle='rgba(70,226,203,.58)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(600,365);ctx.lineTo(Number(x),Number(y));ctx.stroke();panel(Number(x)-112,Number(y)-42,224,84,16);label(String(t),Number(x),Number(y)+7,17);});
    } else {
      dot(600,360,78,'#0f3d3f');label('ZK',600,374,40);
      for(let i=0;i<10;i++){const a=i/10*Math.PI*2,x=600+Math.cos(a)*310,y=360+Math.sin(a)*150;ctx.strokeStyle='rgba(70,226,203,.48)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(600,360);ctx.lineTo(x,y);ctx.stroke();dot(x,y,25,i%3===0?'#46e2cb':'#1c6267');}
      panel(430,505,340,68,18);label('PRIVACY · MINING · KASPA · COMMUNITY',600,548,14);
    }
    return canvas;
  }

  async function hostCanvas(canvas:HTMLCanvasElement){
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Could not encode visual.')),'image/jpeg',0.91));
    const response=await fetch('/api/buffer-image',{method:'POST',headers:{'Content-Type':'image/jpeg','X-ZKAS-Admin-Token':token},body:blob});
    const body=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(body.message||'Could not host automatic visual.');
    return body.url as string;
  }

  async function generateAutomaticVisuals(){
    if(packBusy||!token) return;
    setVisualDay(day);setPackBusy(true);setMessage('Generating and matching 10 original ZKAS visuals automatically…');
    try{
      const urls:string[]=[];
      for(let index=0;index<10;index++){
        const canvas=drawAutomaticVisual(index,new Date(day+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'}));
        const url=await hostCanvas(canvas);urls.push(url);
        setDailyPosts(rows=>rows.map((row,i)=>i===index?{...row,imageUrl:url}:row));
      }
      sessionStorage.setItem('zkas-buffer-visuals-'+VISUAL_PACK_VERSION+'-'+day,JSON.stringify(urls));
      setMessage('Ready: 10 posts are automatically matched with 10 original ZKAS visuals. Review them, then schedule when ready.');
    }catch(error){setVisualDay('');setMessage(error instanceof Error?error.message:'Automatic visual generation failed.');}
    finally{setPackBusy(false);}
  }

  async function uploadVisualPack(file:File){
    if(!file.type.startsWith('image/')){setMessage('Choose an image file for the visual pack.');return;}
    setPackBusy(true);setMessage('Preparing and matching the 10-image visual pack…');
    try{
      const bitmap=await createImageBitmap(file);
      const next=[...dailyPosts];
      for(let index=0;index<10;index++){
        const col=index%5,row=Math.floor(index/5);
        const sx=Math.round(col*bitmap.width/5),sy=Math.round(row*bitmap.height/2);
        const sw=Math.round((col+1)*bitmap.width/5)-sx,sh=Math.round((row+1)*bitmap.height/2)-sy;
        const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=675;
        const ctx=canvas.getContext('2d');if(!ctx) throw new Error('Could not prepare image.');
        ctx.drawImage(bitmap,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
        const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Could not encode image.')),'image/jpeg',0.9));
        const response=await fetch('/api/buffer-image',{method:'POST',headers:{'Content-Type':'image/jpeg','X-ZKAS-Admin-Token':token},body:blob});
        const body=await response.json().catch(()=>({}));
        if(!response.ok) throw new Error(body.message||'Could not host visual '+(index+1)+'.');
        next[index]={...next[index],imageUrl:body.url};
        setDailyPosts([...next]);
      }
      bitmap.close();
      const urls=next.map(row=>row.imageUrl);
      sessionStorage.setItem('zkas-buffer-visuals-'+VISUAL_PACK_VERSION+'-'+day,JSON.stringify(urls));
      setVisualDay(day);
      setMessage('Visual pack matched: all 10 posts now have their corresponding custom image.');
    }catch(error){setMessage(error instanceof Error?error.message:'Visual-pack upload failed.');}
    finally{setPackBusy(false);}
  }

  async function scheduleDay(){
    if(!channelId||!day) return;
    setBusy(true);setMessage('Scheduling daily posts…');
    const completed:number[]=[];
    try{
      for(let i=0;i<dailyPosts.length;i++){
        if(scheduled.includes(i)){completed.push(i);continue;}
        const local=new Date(day+'T'+dailyPosts[i].time+':00');
        if(local.getTime()<=Date.now()) throw new Error('Post '+(i+1)+' is in the past. Choose a future date.');
        await createBufferPost(dailyPosts[i].text,local.toISOString(),dailyPosts[i].imageUrl);
        completed.push(i);setScheduled([...completed]);
      }
      setMessage('All '+dailyPosts.length+' posts scheduled in Buffer for '+new Date(day+'T12:00:00').toLocaleDateString()+'.');
    }catch(error){
      setMessage((error instanceof Error?error.message:'Scheduling stopped.')+' '+completed.length+' of '+dailyPosts.length+' posts are scheduled.');
    }finally{setBusy(false);}
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
      <div><b style={{fontSize:24}}>Daily ZKAS schedule</b><p style={{margin:'6px 0 0',color:'#687a75',fontWeight:650}}>10 editable posts at staggered times. The default date is tomorrow so every slot is safely in the future.</p></div>
      <label style={{display:'grid',gap:8,fontWeight:800}}>Schedule date
        <input type="date" value={day} onChange={e=>{setDay(e.target.value);setScheduled([])}} style={{padding:12,border:'1px solid #b9cec7',borderRadius:12,fontSize:16,maxWidth:260}} />
      </label>
      <label style={{display:'grid',gap:8,fontWeight:800}}>Buffer channel
        <select value={channelId} onChange={e=>setChannelId(e.target.value)} style={{padding:14,border:'1px solid #b9cec7',borderRadius:12,fontSize:16}}>
          {channels.map(channel=><option key={channel.id} value={channel.id}>{channel.displayName||channel.name||channel.id} · {channel.service} · {channel.orgName}</option>)}
        </select>
      </label>
      <div style={{padding:16,border:'1px dashed #9ec8bb',borderRadius:14,background:'#f5fbf9'}}>
        <b>Automatic daily visual pack</b>
        <p style={{margin:'5px 0 10px',color:'#687a75',fontWeight:650}}>{packBusy?'Generating and matching 10 original graphics…':'The 10 matching graphics load automatically for the selected day. No download or upload is required.'}</p>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <button type="button" onClick={()=>{setVisualDay('');sessionStorage.removeItem('zkas-buffer-visuals-'+VISUAL_PACK_VERSION+'-'+day);void generateAutomaticVisuals();}} disabled={packBusy||busy} style={{padding:'11px 15px',border:0,borderRadius:999,background:'#0b2b24',color:'#fff',fontWeight:900,cursor:'pointer'}}>Regenerate visuals</button>
          <label style={{display:'inline-block',padding:'11px 15px',borderRadius:999,border:'1px solid #159a7e',background:'#fff',color:'#159a7e',fontWeight:900,cursor:'pointer'}}>
            Choose visual pack (optional)
            <input type="file" accept="image/*" disabled={packBusy||busy} onChange={e=>{const file=e.target.files?.[0];if(file) void uploadVisualPack(file);e.currentTarget.value='';}} style={{display:'none'}} />
          </label>
        </div>
      </div>
      <div style={{display:'grid',gap:12}}>
        {dailyPosts.map((post,index)=><div key={index} style={{display:'grid',gridTemplateColumns:'92px 1fr',gap:12,padding:14,border:'1px solid #d8e7e2',borderRadius:14,background:scheduled.includes(index)?'#eaf8f3':'#fbfdfc'}}>
          <input type="time" value={post.time} onChange={e=>setDailyPosts(rows=>rows.map((row,i)=>i===index?{...row,time:e.target.value}:row))} disabled={scheduled.includes(index)} style={{padding:10,border:'1px solid #b9cec7',borderRadius:10,fontWeight:800}} />
          <div style={{display:'grid',gap:8}}>
            <textarea value={post.text} onChange={e=>setDailyPosts(rows=>rows.map((row,i)=>i===index?{...row,text:e.target.value}:row))} disabled={scheduled.includes(index)} rows={5} style={{padding:11,border:'1px solid #b9cec7',borderRadius:10,fontSize:14,resize:'vertical'}} />
            <div style={{display:'grid',gridTemplateColumns:'72px 1fr',gap:10,alignItems:'center'}}>
              {post.imageUrl?<img src={post.imageUrl} alt="" style={{width:72,height:50,objectFit:'cover',borderRadius:8,border:'1px solid #d8e7e2'}} />:<div style={{width:72,height:50,border:'1px dashed #b9cec7',borderRadius:8,display:'grid',placeItems:'center',fontSize:11,color:'#687a75'}}>No image</div>}
              <input type="url" value={post.imageUrl} onChange={e=>setDailyPosts(rows=>rows.map((row,i)=>i===index?{...row,imageUrl:e.target.value}:row))} disabled={scheduled.includes(index)} placeholder="Public HTTPS image URL" style={{padding:10,border:'1px solid #b9cec7',borderRadius:10,fontSize:13}} />
            </div>
          </div>
          {scheduled.includes(index)&&<small style={{gridColumn:'2',fontWeight:850,color:'#159a7e'}}>✓ Scheduled in Buffer with image</small>}
        </div>)}
      </div>
      <button onClick={()=>void scheduleDay()} disabled={busy||!channelId||scheduled.length===dailyPosts.length} style={{padding:'15px 20px',border:0,borderRadius:14,background:'#0b2b24',color:'#fff',fontSize:17,fontWeight:900,cursor:'pointer'}}>{busy?'Scheduling…':scheduled.length?'Continue scheduling ('+(dailyPosts.length-scheduled.length)+' left)':'Schedule all '+dailyPosts.length+' in Buffer'}</button>
    </section>}

    {status&&<details style={{marginTop:18,padding:24,border:'1px solid #cfe2dc',borderRadius:22,background:'#fff'}}><summary style={{fontWeight:900,cursor:'pointer'}}>Single post publisher</summary><section style={{marginTop:18,display:'grid',gap:16}}>
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
    </section></details>}
    {message&&<p style={{padding:'14px 16px',borderRadius:14,background:'#eaf8f3',fontWeight:800}}>{message}</p>}
    <p style={{marginTop:24,color:'#687a75',fontSize:13}}>Security: never put your Buffer API key in this page or in GitHub. Store BUFFER_API_KEY and BUFFER_ADMIN_TOKEN as encrypted Cloudflare environment secrets.</p>
  </main>;
}
