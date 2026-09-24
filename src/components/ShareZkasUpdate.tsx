import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Copy, Download, Share2, X } from 'lucide-react';
import type { DashboardData } from '../api';
import './ShareZkasUpdate.css';

type Mode = 'network' | 'mining' | 'community' | 'market';
type Metric = { label: string; value: string };
type Community = { miners?: Array<{ status: string; hashrateHps: number | null; zkasBlocks: number | null; kasBlocks: number | null }> };

const titles: Record<Mode, string> = {
  network: 'ZKAS NETWORK TODAY',
  mining: 'ZKAS MINING TODAY',
  community: 'ZKAS COMMUNITY MINING',
  market: 'ZKAS MARKET SNAPSHOT',
};

function compact(v: number | null | undefined) {
  return v === null || v === undefined || !Number.isFinite(v) ? '—' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(v);
}
function hash(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const u = ['H/s','KH/s','MH/s','GH/s','TH/s','PH/s','EH/s']; let n=v,i=0;
  while (Math.abs(n)>=1000 && i<u.length-1) { n/=1000; i++; }
  return `${new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n)} ${u[i]}`;
}
function usd(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:Math.abs(v)<1?6:2});
}
function reward(v: number | null | undefined) {
  return v === null || v === undefined || !Number.isFinite(v) ? '—' : `${new Intl.NumberFormat('en-US',{maximumFractionDigits:4}).format(v)} ZKAS`;
}
function rr(c: CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number) {
  c.beginPath(); c.roundRect(x,y,w,h,r);
}

export function ShareZkasUpdate({ data }: { data: DashboardData }) {
  const [open,setOpen]=useState(false);
  const [mode,setMode]=useState<Mode>('network');
  const [community,setCommunity]=useState<Community|null>(null);
  const [copied,setCopied]=useState(false);
  const canvas=useRef<HTMLCanvasElement|null>(null);

  useEffect(()=>{
    if(!open||community) return;
    const ctl=new AbortController();
    fetch('/api/community-mining',{signal:ctl.signal,cache:'no-store'})
      .then(r=>r.ok?r.json():Promise.reject()).then(setCommunity).catch(()=>undefined);
    return ()=>ctl.abort();
  },[open,community]);

  const totals=useMemo(()=>{
    const miners=community?.miners??[];
    return {
      online: miners.filter(m=>m.status==='online').length,
      hashrate: miners.reduce((s,m)=>s+(m.hashrateHps??0),0),
      zkas: miners.reduce((s,m)=>s+(m.zkasBlocks??0),0),
      kas: miners.reduce((s,m)=>s+(m.kasBlocks??0),0),
    };
  },[community]);

  const all=useMemo<Record<Mode,Metric[]>>(()=>({
    network:[
      {label:'NETWORK HASHRATE',value:hash(data.hashrate)},
      {label:'BLOCK FLOW',value:data.bps===null?'—':`${data.bps.toFixed(2)} BPS`},
      {label:'VISIBLE NODES',value:compact(data.publicNodes.totals.nodes??data.nodes)},
      {label:'BLOCKS',value:compact(data.blockCount)},
    ],
    mining:[
      {label:'NETWORK HASHRATE',value:hash(data.hashrate)},
      {label:'BLOCK REWARD',value:reward(data.reward)},
      {label:'MINER SHARE',value:reward(data.reward===null?null:data.reward*.95)},
      {label:'DIFFICULTY',value:compact(data.difficulty)},
    ],
    community:[
      {label:'ONLINE MINERS',value:community?String(totals.online):'Loading…'},
      {label:'COMBINED HASHRATE',value:community?hash(totals.hashrate):'Loading…'},
      {label:'ZKAS BLOCKS',value:community?compact(totals.zkas):'Loading…'},
      {label:'KAS BLOCKS',value:community?compact(totals.kas):'Loading…'},
    ],
    market:[
      {label:'ZKAS PRICE',value:usd(data.priceUsd)},
      {label:'MARKET CAP',value:usd(data.marketCapUsd)},
      {label:'CIRCULATING SUPPLY',value:compact(data.supply)},
      {label:'BLOCK REWARD',value:reward(data.reward)},
    ],
  }),[data,community,totals]);

  const caption=useMemo(()=>[
    mode==='community'?'⛏️ ZKAS Community Mining update':mode==='mining'?'⛏️ ZKAS mining update':mode==='market'?'📊 ZKAS market snapshot':'⚡ ZKAS network update',
    '',...all[mode].map(m=>`${m.label}: ${m.value}`),'','Live ZKAS intelligence: https://zkas.stream','','#ZKAS #Kaspa #Mining #Privacy'
  ].join('\n'),[all,mode]);

  useEffect(()=>{ if(open) draw(); },[open,mode,all]);

  async function draw() {
    const el=canvas.current,c=el?.getContext('2d'); if(!el||!c) return;
    el.width=1200; el.height=675;
    const bg=c.createLinearGradient(0,0,1200,675); bg.addColorStop(0,'#061318'); bg.addColorStop(1,'#0b2528'); c.fillStyle=bg;c.fillRect(0,0,1200,675);
    const glow=c.createRadialGradient(930,80,20,930,80,520);glow.addColorStop(0,'rgba(31,235,216,.25)');glow.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=glow;c.fillRect(0,0,1200,675);
    try { const img=new Image(); await new Promise<void>((ok,bad)=>{img.onload=()=>ok();img.onerror=()=>bad();img.src='/zkas-logo.png'}); c.drawImage(img,64,48,92,92); } catch {}
    c.font='800 38px system-ui';c.fillStyle='#fff';c.fillText('ZKAS',178,86);c.fillStyle='#35ead8';c.fillText('.stream',280,86);
    c.font='600 15px system-ui';c.fillStyle='#8ca9aa';c.fillText('PUBLIC NETWORK INTELLIGENCE',180,116);
    c.textAlign='right';c.fillStyle='#70fff0';c.font='700 16px system-ui';c.fillText('LIVE • PUBLIC • SHAREABLE',1136,76);c.textAlign='left';
    c.fillStyle='#fff';c.font='900 55px system-ui';c.fillText(titles[mode],64,215);c.fillStyle='#35ead8';c.fillRect(64,235,180,5);
    all[mode].forEach((m,i)=>{
      const x=64+i*274,y=290,w=250,h=190;rr(c,x,y,w,h,22);c.fillStyle='rgba(3,17,21,.9)';c.fill();c.strokeStyle=i%2?'rgba(105,166,255,.55)':'rgba(53,234,216,.7)';c.lineWidth=2;c.stroke();
      c.fillStyle='#86a7a8';c.font='700 14px system-ui';c.fillText(m.label,x+22,y+42);
      c.fillStyle='#fff';c.font='800 29px system-ui';c.fillText(m.value.slice(0,18),x+22,y+98);
      c.fillStyle='#3cebd9';c.font='700 13px system-ui';c.fillText('ZKAS MAINNET',x+22,y+152);
    });
    c.fillStyle='#e6ffff';c.font='800 23px system-ui';c.fillText('Privacy by default • Proof-of-work secured • Built for real payments',64,550);
    rr(c,64,586,1072,54,27);c.fillStyle='rgba(44,221,205,.14)';c.fill();c.strokeStyle='rgba(64,240,223,.5)';c.stroke();
    c.fillStyle='#fff';c.font='800 23px system-ui';c.fillText('Explore live ZKAS data at',92,621);c.fillStyle='#43efdd';c.fillText('zkas.stream',365,621);
    c.textAlign='right';c.fillStyle='#94b0b1';c.font='600 14px system-ui';c.fillText('#ZKAS  #Kaspa  #Mining  #Privacy',1108,620);c.textAlign='left';
  }

  function blob(){return new Promise<Blob|null>(resolve=>canvas.current?.toBlob(resolve,'image/png',.96));}
  async function download(){const b=await blob();if(!b)return;const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=`zkas-${mode}-update.png`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  async function copy(){try{await navigator.clipboard.writeText(caption);setCopied(true);setTimeout(()=>setCopied(false),1600);}catch{}}
  async function share(){
    const b=await blob();
    if(b&&navigator.share){const f=new File([b],`zkas-${mode}-update.png`,{type:'image/png'});if(navigator.canShare?.({files:[f]})){await navigator.share({files:[f],text:caption,title:titles[mode]});return;}}
    try{await navigator.clipboard.writeText(caption);}catch{}
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(caption)}`,'_blank','noopener,noreferrer');
  }

  return <>
    <section className="share-zkas-strip">
      <div><span className="share-zkas-eyebrow"><Camera size={16}/> SHARE ZKAS TODAY</span><h2>Turn live ZKAS data into a shareable update.</h2><p>Create a branded card from the public stats already on ZKAS.stream.</p></div>
      <button className="share-zkas-open" onClick={()=>setOpen(true)}><Share2 size={18}/> Create & share update</button>
    </section>
    {open&&<div className="share-zkas-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
      <section className="share-zkas-modal" role="dialog" aria-modal="true" aria-label="Create ZKAS share card">
        <div className="share-zkas-head"><div><span>SHARE ZKAS TODAY</span><h2>Create a live ZKAS card</h2></div><button onClick={()=>setOpen(false)} aria-label="Close"><X size={20}/></button></div>
        <div className="share-zkas-tabs">{(['network','mining','community','market'] as Mode[]).map(m=><button key={m} className={mode===m?'active':''} onClick={()=>setMode(m)}>{m}</button>)}</div>
        <canvas ref={canvas} className="share-zkas-canvas"/>
        <div className="share-zkas-actions">
          <button onClick={download}><Download size={17}/> Download image</button>
          <button onClick={copy}><Copy size={17}/> {copied?'Copied!':'Copy caption'}</button>
          <button className="primary" onClick={()=>void share()}><Share2 size={17}/> Share</button>
        </div>
        <small>On desktop, Share opens X with the caption copied; attach the downloaded card. On supported phones, the image can open directly in the system share sheet.</small>
      </section>
    </div>}
  </>;
}
