import { useEffect, useMemo, useState } from 'react';

type BufferChannel = { id: string; name?: string; displayName?: string; service?: string; isQueuePaused?: boolean };
type BufferOrg = { id: string; name: string; channels: BufferChannel[] };
type BufferStatus = { account?: { name?: string | null; timezone?: string | null }; organizations?: BufferOrg[] };
type DailyPost = { time: string; text: string; imageUrl: string };

const DAILY_POSTS: DailyPost[] = [

  {time:'08:01',imageUrl:'',text:'⚡ Good morning, ZKAS.\n\nThe network does not sleep.\n\nFollow live ZKAS network activity — hashrate, block flow, nodes and blocks — on ZKAS.stream.\n\n#ZKAS #Kaspa'},
  {time:'09:17',imageUrl:'',text:'🔐 Should financial privacy be something you turn ON — or something you turn OFF?\n\nZKAS starts with privacy by default.\n\nWhat would you rather have for everyday digital money?\n\n#ZKAS #Privacy'},
  {time:'10:43',imageUrl:'',text:'⚡ Kaspa 🤝 ZKAS\n\nOne of the most interesting parts of ZKAS is merged mining: the same mining work can participate in securing Kaspa and ZKAS.\n\nIt is not Kaspa vs. ZKAS. It is another example of what can be built around the ecosystem.\n\n#Kaspa #ZKAS'},
  {time:'12:15',imageUrl:'',text:'⛏️ MINERS — quick question:\n\nIf you were mining ZKAS today, which setup would you choose?\n\n🟢 Pool mining\n🔵 Solo mining\n⚡ Merge mining\n🟣 ZKAS.stream Community Mining\n\nReply with your setup 👇\n\n#ZKAS #Mining'},
  {time:'13:37',imageUrl:'',text:'📊 ZKAS MARKET CHECK\n\nPrice is only one number.\n\nZKAS.stream tracks 24H average market cap, total trading volume, total ZKAS traded, exchange markets and OTC activity.\n\nSee the complete picture:\nhttps://zkas.stream/#exchanges\n\n#ZKAS #Crypto'},
  {time:'14:04',imageUrl:'',text:'Privacy is not suspicious.\n\nYour bank balance is not public.\nYour paycheck is not public.\nYour purchases are not everyone’s business.\n\nWhy should digital money automatically expose everything?\n\n🔐 Privacy by default.\n\n#ZKAS #Privacy'},
  {time:'15:26',imageUrl:'',text:'⛏️ Want to help secure ZKAS?\n\nZKAS.stream Community Mining gives miners a simple place to connect and see live community mining activity.\n\nYour miner. Your work. The community growing together. ⚡\n\nhttps://zkas.stream/community-mining\n\n#ZKAS #Mining'},
  {time:'17:11',imageUrl:'',text:'💚 ZKAS COMMUNITY CHECK\n\nIf you are following ZKAS this early, you are part of the story being built right now.\n\n🔁 Repost\n❤️ Like\n💬 Reply with ZKAS\n\nLet’s take this far. ⚡\n\n#ZKAS #Kaspa'},
  {time:'18:43',imageUrl:'',text:'🌐 What exactly is ZKAS.stream?\n\n⚡ Network intelligence\n⛏️ Mining data\n🤝 Community mining\n📊 Exchange markets\n💱 OTC activity\n🔐 Supply & privacy\n🔎 Explorer tools\n\nExplore ZKAS in one place:\nhttps://zkas.stream/\n\n#ZKAS #Kaspa'},
  {time:'20:02',imageUrl:'',text:'🌙 ZKAS is still early.\n\nThe network is running.\nMiners are securing it.\nMarkets are developing.\nTools are being built.\nThe community is growing.\n\nAnd we are documenting it as it happens.\n\nTomorrow, we keep building. ⚡\n\n@ZKas_X @ZKas_Stream\n#ZKAS #Kaspa'},
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
    const cached=sessionStorage.getItem('zkas-buffer-visuals-'+day);
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
    const titles=['ZKAS NETWORK','PRIVACY BY DEFAULT','KASPA + ZKAS','HOW DO YOU MINE?','ZKAS MARKET CHECK','PRIVACY IS NORMAL','COMMUNITY MINING','ZKAS COMMUNITY','EXPLORE ZKAS.stream','ZKAS IS STILL EARLY'];
    const subs=['THE NETWORK NEVER SLEEPS','YOUR MONEY. YOUR CHOICE.','ONE MINING EFFORT · TWO NETWORKS','POOL · SOLO · MERGED · COMMUNITY','REAL DATA · CLEAR INSIGHTS','YOUR MONEY IS YOUR BUSINESS','CONNECT · MINE · GROW','PEOPLE POWER PRIVACY','NETWORK · MINING · MARKETS · OTC','BUILD · MINE · LEARN · GROW'];
    const g=ctx.createLinearGradient(0,0,1200,675);g.addColorStop(0,'#031814');g.addColorStop(.55,'#061e24');g.addColorStop(1,index===9?'#352414':'#07383a');ctx.fillStyle=g;ctx.fillRect(0,0,1200,675);
    ctx.globalAlpha=.22;ctx.strokeStyle='#2ee8ca';ctx.lineWidth=2;
    for(let x=-200;x<1400;x+=90){ctx.beginPath();ctx.moveTo(600,340);ctx.lineTo(x,675);ctx.stroke();}
    for(let y=390;y<675;y+=55){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1200,y);ctx.stroke();}
    ctx.globalAlpha=1;
    ctx.fillStyle='#eafffb';ctx.font='800 66px system-ui';ctx.fillText(titles[index],70,115);
    ctx.fillStyle='#45e3cd';ctx.font='700 25px system-ui';ctx.fillText(subs[index],74,158);
    ctx.fillStyle='#8ba9a3';ctx.font='600 18px system-ui';ctx.fillText('ZKAS · '+dateLabel,75,620);
    ctx.fillStyle='#45e3cd';ctx.font='800 24px system-ui';ctx.fillText('ZKAS.stream',965,620);

    const glow=(x:number,y:number,r:number)=>{const q=ctx.createRadialGradient(x,y,0,x,y,r);q.addColorStop(0,'rgba(42,235,207,.65)');q.addColorStop(1,'rgba(42,235,207,0)');ctx.fillStyle=q;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
    glow(790,350,240);
    ctx.strokeStyle='#43e7d1';ctx.fillStyle='#071f23';ctx.lineWidth=5;

    if(index===0){const pts=[[330,310],[500,260],[650,365],[810,245],[970,350],[430,470],[760,490],[1010,475]];pts.forEach((p,i)=>{pts.slice(i+1).forEach(q=>{if(Math.hypot(p[0]-q[0],p[1]-q[1])<330){ctx.globalAlpha=.35;ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();}});ctx.globalAlpha=1;ctx.fillStyle='#43e7d1';ctx.beginPath();ctx.arc(p[0],p[1],10,0,7);ctx.fill();});}
    else if(index===1||index===5){ctx.beginPath();ctx.moveTo(720,225);ctx.lineTo(875,280);ctx.lineTo(850,455);ctx.quadraticCurveTo(795,525,720,555);ctx.quadraticCurveTo(645,525,590,455);ctx.lineTo(565,280);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#43e7d1';ctx.font='900 86px system-ui';ctx.fillText('ZK',652,410);['BALANCE','PAYCHECK','PURCHASES'].forEach((t,i)=>{ctx.fillStyle='#d8f7f1';ctx.font='700 22px system-ui';ctx.fillText('✓ '+t,285,300+i*70);});}
    else if(index===2){[['KASPA',470],['ZKAS',850]].forEach(([t,x])=>{ctx.beginPath();ctx.arc(Number(x),360,115,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#eafffb';ctx.font='900 38px system-ui';ctx.textAlign='center';ctx.fillText(String(t),Number(x),373);});ctx.textAlign='left';ctx.strokeStyle='#43e7d1';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(585,360);ctx.bezierCurveTo(650,280,680,440,735,360);ctx.stroke();}
    else if(index===3){['POOL','SOLO','MERGED','COMMUNITY'].forEach((t,i)=>{const x=300+(i%2)*330,y=250+Math.floor(i/2)*150;ctx.fillStyle='rgba(5,35,39,.92)';ctx.strokeStyle='#43e7d1';ctx.lineWidth=3;ctx.fillRect(x,y,285,115);ctx.strokeRect(x,y,285,115);ctx.fillStyle='#eafffb';ctx.font='800 25px system-ui';ctx.fillText(t,x+28,y+48);ctx.fillStyle='#45e3cd';ctx.font='600 17px system-ui';ctx.fillText(i===0?'STEADY':i===1?'YOUR BLOCKS':i===2?'KAS + ZKAS':'TOGETHER',x+28,y+80);});}
    else if(index===4){ctx.strokeStyle='#45e3cd';ctx.lineWidth=7;ctx.beginPath();[[280,500],[390,450],[500,475],[610,360],[720,390],[830,275],[950,215]].forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();for(let i=0;i<7;i++){ctx.fillStyle=i%2?'#2b9cc8':'#45e3cd';ctx.fillRect(300+i*100,530-(i%4)*25,42,70+(i%4)*25);}}
    else if(index===6){const pts=[[600,355],[390,260],[820,250],[330,455],[865,455],[600,520]];pts.slice(1).forEach(p=>{ctx.globalAlpha=.55;ctx.beginPath();ctx.moveTo(600,355);ctx.lineTo(p[0],p[1]);ctx.stroke();});ctx.globalAlpha=1;pts.forEach((p,i)=>{ctx.fillStyle=i?'#0a3033':'#43e7d1';ctx.beginPath();ctx.arc(p[0],p[1],i?38:72,0,7);ctx.fill();ctx.stroke();});ctx.fillStyle='#06211f';ctx.font='900 48px system-ui';ctx.fillText('ZK',558,372);}
    else if(index===7){for(let i=0;i<11;i++){const a=i/11*Math.PI*2,x=710+Math.cos(a)*220,y=380+Math.sin(a)*155;ctx.beginPath();ctx.arc(x,y,30,0,7);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(710,380);ctx.lineTo(x,y);ctx.stroke();}ctx.fillStyle='#43e7d1';ctx.beginPath();ctx.arc(710,380,85,0,7);ctx.fill();ctx.fillStyle='#06211f';ctx.font='900 52px system-ui';ctx.fillText('ZK',662,398);}
    else if(index===8){['NETWORK','MINING','MARKETS','OTC','EXPLORER','COMMUNITY'].forEach((t,i)=>{const x=275+(i%3)*270,y=250+Math.floor(i/3)*145;ctx.fillStyle='rgba(5,35,39,.95)';ctx.strokeStyle='#43e7d1';ctx.lineWidth=3;ctx.fillRect(x,y,235,105);ctx.strokeRect(x,y,235,105);ctx.fillStyle='#eafffb';ctx.font='800 20px system-ui';ctx.textAlign='center';ctx.fillText(t,x+117,y+62);});ctx.textAlign='left';}
    else {const mountain=[[230,535],[430,330],[535,440],[705,235],[1010,535]];ctx.fillStyle='#102b2e';ctx.strokeStyle='#45e3cd';ctx.lineWidth=4;ctx.beginPath();mountain.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.lineTo(230,535);ctx.fill();ctx.stroke();for(let i=0;i<8;i++){ctx.fillStyle='#43e7d1';ctx.fillRect(340+i*70,500-i*28,18,18);}}
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
      sessionStorage.setItem('zkas-buffer-visuals-'+day,JSON.stringify(urls));
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
        const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1280;
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
          <button type="button" onClick={()=>{setVisualDay('');sessionStorage.removeItem('zkas-buffer-visuals-'+day);void generateAutomaticVisuals();}} disabled={packBusy||busy} style={{padding:'11px 15px',border:0,borderRadius:999,background:'#0b2b24',color:'#fff',fontWeight:900,cursor:'pointer'}}>Regenerate visuals</button>
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
