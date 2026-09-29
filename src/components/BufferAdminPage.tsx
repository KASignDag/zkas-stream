import { useEffect, useMemo, useState } from 'react';

type BufferChannel = { id: string; name?: string; displayName?: string; service?: string; isQueuePaused?: boolean };
type BufferOrg = { id: string; name: string; channels: BufferChannel[] };
type BufferStatus = { account?: { name?: string | null; timezone?: string | null }; organizations?: BufferOrg[] };
type DailyPost = { time: string; text: string; imageUrl: string };
const VISUAL_PACK_VERSION = '2026-09-29-a';

const DAILY_POSTS: DailyPost[] = [

  {time:'05:00',imageUrl:'',text:"🔐 Everyday privacy question\n\nShould every digital-money transaction be public forever?\n\nZKAS takes a different approach: privacy by default.\n\nShould privacy be default, optional, or unnecessary?\n\nReply below 👇\n\n#ZKAS #Privacy"},
  {time:'06:54',imageUrl:'',text:"⚡ Why merge mining matters\n\nZKAS can be merge mined alongside Kaspa, letting the same mining work support both networks.\n\nMiners: is merge mining one of the reasons ZKAS caught your attention?\n\n#ZKAS #Kaspa #Mining"},
  {time:'08:48',imageUrl:'',text:"📲 Wallet adoption check\n\nWhat would help ZKAS adoption most?\n\n• easier mobile wallet\n• better UX\n• more exchange access\n• merchant tools\n• education\n\nPick one 👇\n\n#ZKAS #Wallet #Crypto"},
  {time:'10:42',imageUrl:'',text:"📊 What do you check first on ZKAS.stream?\n\n• mining data\n• OTC activity\n• exchange markets\n• explorer/network info\n• supply / market cap\n\nWhat’s your first stop?\n\nhttps://zkas.stream/\n\n#ZKAS"},
  {time:'12:36',imageUrl:'',text:"🛡️ Privacy is normal.\n\nPeople want financial privacy for everyday reasons: salary, savings, purchases, business payments, and personal security.\n\nWhat’s the strongest real-world use case for private digital money?\n\n#ZKAS #Privacy"},
  {time:'14:30',imageUrl:'',text:"⛏️ Community mining question\n\nZKAS miners can choose pool, solo, merged, or community mining.\n\nWhich setup fits you best right now?\n\n#ZKAS #Mining"},
  {time:'16:24',imageUrl:'',text:"💡 Growth question\n\nWhat would help ZKAS grow most?\n\n• stronger wallets\n• more miners\n• better liquidity\n• more community tools\n• more awareness\n\nWhich matters most?\n\n#ZKAS #Crypto"},
  {time:'18:18',imageUrl:'',text:"🌐 Why ZKAS.stream exists\n\nOne place to follow mining, markets, OTC activity, community tools, and live network data.\n\nWhich feature has been most useful to you?\n\nhttps://zkas.stream/\n\n#ZKAS"},
  {time:'20:12',imageUrl:'',text:"🤝 Community check-in\n\nWhat keeps you following ZKAS?\n\n• privacy\n• mining\n• Kaspa connection\n• technology\n• community\n\nReply with your reason 👇\n\n#ZKAS #Kaspa"},
  {time:'22:00',imageUrl:'',text:"🌙 End-of-day question\n\nFinish this sentence:\n\n“ZKAS matters because ________.”\n\nKeep it short. Best replies may get reposted 👇\n\n#ZKAS #Privacy #Kaspa"},

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

    const titles=['EVERYDAY PRIVACY','MERGE MINING','WALLET ADOPTION','FIRST STOP?','PRIVACY IS NORMAL','COMMUNITY MINING','WHAT DRIVES GROWTH?','WHY ZKAS.stream?','WHY ARE YOU HERE?','ZKAS MATTERS BECAUSE...'];
    const subs=['DEFAULT · OPTIONAL · UNNECESSARY?','KASPA + ZKAS','WHAT HELPS MOST?','WHAT DO YOU CHECK FIRST?','REAL-WORLD USE CASES','HOW DO YOU PARTICIPATE?','MINERS · WALLETS · LIQUIDITY · TOOLS','FOLLOW THE NETWORK','PRIVACY · MINING · COMMUNITY','FILL IN THE BLANK'];

    const bg=ctx.createLinearGradient(0,0,1200,675);
    bg.addColorStop(0,'#041716');bg.addColorStop(.55,'#082326');bg.addColorStop(1,index%2?'#0c3030':'#13262f');
    ctx.fillStyle=bg;ctx.fillRect(0,0,1200,675);

    ctx.fillStyle='#edfdf9';ctx.font='800 62px system-ui';ctx.fillText(titles[index],70,108);
    ctx.fillStyle='#46e2cb';ctx.font='700 24px system-ui';ctx.fillText(subs[index],74,150);
    ctx.fillStyle='#8ca9a2';ctx.font='600 18px system-ui';ctx.fillText('ZKAS · '+dateLabel,74,626);
    ctx.fillStyle='#46e2cb';ctx.font='800 23px system-ui';ctx.fillText('ZKAS.stream',968,626);

    const panel=(x:number,y:number,w:number,h:number,r=18)=>{
      ctx.fillStyle='rgba(7,31,32,.88)';ctx.strokeStyle='rgba(70,226,203,.75)';ctx.lineWidth=3;
      ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();ctx.stroke();
    };
    const dot=(x:number,y:number,r=10,fill='#46e2cb')=>{ctx.fillStyle=fill;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};

    if(index===0){
      panel(120,215,400,270,24);
      ['BALANCE','PAYMENTS','HISTORY'].forEach((t,i)=>{ctx.fillStyle='#e8f9f5';ctx.font='800 28px system-ui';ctx.fillText(t,165,285+i*72);ctx.fillStyle='#46e2cb';ctx.fillRect(375,263+i*72,88,16);});
      ctx.strokeStyle='#46e2cb';ctx.lineWidth=8;ctx.beginPath();ctx.arc(790,355,145,Math.PI*.15,Math.PI*1.85);ctx.stroke();
      ctx.fillStyle='#e8f9f5';ctx.font='900 92px system-ui';ctx.textAlign='center';ctx.fillText('?',790,388);ctx.textAlign='left';
    } else if(index===1){
      ctx.strokeStyle='#46e2cb';ctx.lineWidth=6;
      ctx.beginPath();ctx.moveTo(190,470);ctx.lineTo(370,300);ctx.lineTo(560,390);ctx.lineTo(760,235);ctx.lineTo(1000,330);ctx.stroke();
      [[190,470],[370,300],[560,390],[760,235],[1000,330]].forEach(p=>dot(p[0],p[1],14));
      panel(360,500,480,72,18);ctx.fillStyle='#e8f9f5';ctx.font='900 30px system-ui';ctx.textAlign='center';ctx.fillText('0 PREMINE · OPEN START',600,546);ctx.textAlign='left';
    } else if(index===2){
      panel(195,220,315,300,34);ctx.fillStyle='#0c282c';ctx.fillRect(230,260,245,180);
      ctx.strokeStyle='#46e2cb';ctx.lineWidth=4;ctx.strokeRect(230,260,245,180);
      ctx.fillStyle='#e8f9f5';ctx.font='900 34px system-ui';ctx.textAlign='center';ctx.fillText('ZK',352,365);ctx.textAlign='left';
      const items=[['QR',690,260],['BACKUP',895,260],['HISTORY',690,410],['LANGUAGE',895,410]];
      items.forEach(([t,x,y])=>{panel(Number(x)-90,Number(y)-45,180,90,16);ctx.fillStyle='#e8f9f5';ctx.font='800 20px system-ui';ctx.textAlign='center';ctx.fillText(String(t),Number(x),Number(y)+7);});ctx.textAlign='left';
    } else if(index===3){
      const cards=[['NETWORK',165,245],['MINING',440,245],['MARKETS',715,245],['OTC',302,400],['TOOLS',577,400]];
      cards.forEach(([t,x,y],i)=>{panel(Number(x),Number(y),220,110,18);ctx.fillStyle='#e8f9f5';ctx.font='800 24px system-ui';ctx.fillText(String(t),Number(x)+28,Number(y)+48);ctx.fillStyle='#46e2cb';ctx.fillRect(Number(x)+28,Number(y)+70,70+i*18,8);});
    } else if(index===4){
      ctx.fillStyle='rgba(70,226,203,.10)';ctx.fillRect(90,220,470,300);
      ctx.fillStyle='rgba(255,255,255,.04)';ctx.fillRect(640,220,470,300);
      ctx.fillStyle='#46e2cb';ctx.font='900 34px system-ui';ctx.fillText('PUBLIC NETWORK',145,275);
      ctx.fillStyle='#e8f9f5';ctx.font='700 24px system-ui';['HASHRATE','BLOCKS','MINERS','MARKETS'].forEach((t,i)=>ctx.fillText('• '+t,155,330+i*44));
      ctx.fillStyle='#46e2cb';ctx.font='900 34px system-ui';ctx.fillText('PRIVATE FINANCES',695,275);
      ctx.strokeStyle='#46e2cb';ctx.lineWidth=5;ctx.beginPath();ctx.arc(850,390,86,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#e8f9f5';ctx.font='900 48px system-ui';ctx.textAlign='center';ctx.fillText('LOCK',850,405);ctx.textAlign='left';
    } else if(index===5){
      const rigs=[200,450,700,950];
      rigs.forEach((x,i)=>{panel(x,280,180,180,16);ctx.fillStyle='#46e2cb';for(let r=0;r<3;r++)ctx.fillRect(x+28,315+r*40,124,12);ctx.fillStyle='#e8f9f5';ctx.font='800 20px system-ui';ctx.textAlign='center';ctx.fillText(['HOME','POOL','SOLO','COMMUNITY'][i],x+90,495);});ctx.textAlign='left';
    } else if(index===6){
      panel(135,255,390,220,26);panel(675,255,390,220,26);
      ctx.fillStyle='#46e2cb';ctx.font='900 42px system-ui';ctx.textAlign='center';ctx.fillText('OTC',330,335);ctx.fillText('EXCHANGE',870,335);
      ctx.strokeStyle='#46e2cb';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(270,390);ctx.lineTo(390,390);ctx.stroke();
      ctx.beginPath();ctx.moveTo(780,390);ctx.lineTo(960,390);ctx.stroke();
      ctx.fillStyle='#e8f9f5';ctx.font='700 22px system-ui';ctx.fillText('DIRECT',330,435);ctx.fillText('ORDER BOOK',870,435);ctx.textAlign='left';
      ctx.font='900 54px system-ui';ctx.fillStyle='#e8f9f5';ctx.fillText('VS',566,390);
    } else if(index===7){
      dot(600,360,72);ctx.fillStyle='#082326';ctx.font='900 42px system-ui';ctx.textAlign='center';ctx.fillText('ZK',600,375);
      const nodes=[['WALLET',290,240],['ALERTS',910,240],['MINING',280,480],['EXPLORER',920,480],['MARKETS',600,540]];
      nodes.forEach(([t,x,y])=>{ctx.strokeStyle='rgba(70,226,203,.65)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(600,360);ctx.lineTo(Number(x),Number(y));ctx.stroke();dot(Number(x),Number(y),34,'#0f3d3f');ctx.fillStyle='#e8f9f5';ctx.font='800 17px system-ui';ctx.textAlign='center';ctx.fillText(String(t),Number(x),Number(y)+6);});ctx.textAlign='left';
    } else if(index===8){
      for(let i=0;i<14;i++){const x=180+(i%7)*130,y=280+Math.floor(i/7)*170;dot(x,y,24,i%3===0?'#46e2cb':'#1a5a5f');}
      ctx.strokeStyle='rgba(70,226,203,.45)';ctx.lineWidth=2;
      for(let i=0;i<7;i++){ctx.beginPath();ctx.moveTo(180+i*130,280);ctx.lineTo(180+((i+2)%7)*130,450);ctx.stroke();}
      panel(435,315,330,100,20);ctx.fillStyle='#e8f9f5';ctx.font='900 28px system-ui';ctx.textAlign='center';ctx.fillText('DROP YOUR FLAG',600,375);ctx.textAlign='left';
    } else {
      ctx.fillStyle='rgba(255,255,255,.04)';ctx.beginPath();ctx.moveTo(175,245);ctx.lineTo(1025,245);ctx.lineTo(940,455);ctx.lineTo(255,455);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#46e2cb';ctx.lineWidth=4;ctx.stroke();
      ctx.fillStyle='#e8f9f5';ctx.font='900 48px system-ui';ctx.textAlign='center';ctx.fillText('“WHY ZKAS?”',600,330);
      ctx.fillStyle='#46e2cb';ctx.font='800 28px system-ui';ctx.fillText('ONE SENTENCE',600,390);ctx.textAlign='left';
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
