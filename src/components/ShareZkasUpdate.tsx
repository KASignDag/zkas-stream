import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Share2, X } from 'lucide-react';
import type { DashboardData } from '../api';
import './ShareZkasUpdate.css';

type Mode = 'network' | 'mining' | 'community' | 'market';
type Metric = { label: string; value: string; tag?: string };
type Community = { gateway?: string; miners?: Array<{ alias?: string; status: string; hashrateHps: number | null; zkasBlocks: number | null; kasBlocks: number | null }>; lifetimeZkasBlocks?: number | null; lifetimeKasBlocks?: number | null };
type ExchangeFeed = { ticker?: { lastPrice?: number | null; volume24h?: number | null } | null; updatedAt?: number | null };
type OtcFeed = { trades?: Array<{ timestamp?: number | null; zkasAmount?: number | null }> };

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
  const android=typeof navigator!=='undefined'&&/Android/i.test(navigator.userAgent);
  const [mode,setMode]=useState<Mode>('network');
  const [communities,setCommunities]=useState<Community[]>([]);
  const [exchangePrice,setExchangePrice]=useState<number|null>(null);
  const [combinedVolume24h,setCombinedVolume24h]=useState<number|null>(null);
  const [copied,setCopied]=useState(false);
  const [imageCopied,setImageCopied]=useState(false);
  const [imageCopyFailed,setImageCopyFailed]=useState(false);
  const canvas=useRef<HTMLCanvasElement|null>(null);

  useEffect(()=>{
    if(!open) return;
    let stopped=false;
    let ctl: AbortController | null=null;
    const refresh=async()=>{
      ctl?.abort();
      ctl=new AbortController();
      const urls=['/api/community-mining?gateway=community','/api/community-mining?gateway=community-107'];
      const results=await Promise.allSettled(urls.map(async url=>{
        const response=await fetch(url,{signal:ctl!.signal,cache:'no-store'});
        if(!response.ok) throw new Error('Community gateway unavailable');
        return await response.json() as Community;
      }));
      if(stopped||ctl.signal.aborted) return;
      const live=results
        .filter((result): result is PromiseFulfilledResult<Community>=>result.status==='fulfilled')
        .map(result=>result.value);
      if(live.length)setCommunities(live);
    };
    void refresh();
    const timer=window.setInterval(()=>void refresh(),15_000);
    return ()=>{stopped=true;ctl?.abort();window.clearInterval(timer);};
  },[open]);

  useEffect(()=>{
    if(!open) return;
    const ctl=new AbortController();
    const exchangeRequests=['neoxex','noirtrade'].map(async exchange=>{
      const response=await fetch(`/api/exchange-market?exchange=${exchange}&pair=ZKAS_USDT&interval=15m`,{signal:ctl.signal,cache:'no-store'});
      if(!response.ok) throw new Error('Exchange feed unavailable');
      return await response.json() as ExchangeFeed;
    });
    const otcRequest=fetch('/api/otc-shared-trades',{signal:ctl.signal,cache:'no-store'})
      .then(response=>response.ok?response.json() as Promise<OtcFeed>:Promise.reject(new Error('OTC feed unavailable')));
    Promise.allSettled([...exchangeRequests,otcRequest]).then(results=>{
      const exchangeResults=results.slice(0,2)
        .filter((result): result is PromiseFulfilledResult<ExchangeFeed>=>result.status==='fulfilled')
        .map(result=>result.value);
      const prices=exchangeResults
        .map(result=>result.ticker?.lastPrice)
        .filter((price): price is number=>typeof price==='number'&&Number.isFinite(price)&&price>0);
      if(prices.length)setExchangePrice(prices[0]);

      const exchangeVolume=exchangeResults.reduce((sum,result)=>{
        const volume=result.ticker?.volume24h;
        return sum+(typeof volume==='number'&&Number.isFinite(volume)&&volume>0?volume:0);
      },0);
      const otcResult=results[2];
      let otcVolume=0;
      if(otcResult?.status==='fulfilled'){
        const cutoff=Date.now()-86_400_000;
        otcVolume=(otcResult.value as OtcFeed).trades?.reduce((sum,trade)=>{
          const timestamp=trade.timestamp;
          const amount=trade.zkasAmount;
          return sum+(typeof timestamp==='number'&&timestamp>=cutoff&&typeof amount==='number'&&Number.isFinite(amount)&&amount>0?amount:0);
        },0)??0;
      }
      if(exchangeResults.length||(otcResult&&otcResult.status==='fulfilled'))setCombinedVolume24h(exchangeVolume+otcVolume);
    }).catch(()=>undefined);
    return ()=>ctl.abort();
  },[open]);

  const totals=useMemo(()=>{
    const miners=communities.flatMap(snapshot=>snapshot.miners??[]);
    return {
      online: miners.filter(m=>m.status==='online').length,
      hashrate: miners.filter(m=>m.status==='online').reduce((sum,m)=>sum+(m.hashrateHps??0),0),
      zkas: communities.reduce((sum,snapshot)=>sum+(snapshot.lifetimeZkasBlocks??0),0),
      kas: communities.reduce((sum,snapshot)=>sum+(snapshot.lifetimeKasBlocks??0),0),
    };
  },[communities]);

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
      {label:'ONLINE MINERS',value:communities.length?String(totals.online):'Loading…'},
      {label:'COMBINED HASHRATE',value:communities.length?hash(totals.hashrate):'Loading…'},
      {label:'ZKAS BLOCKS',value:communities.length?compact(totals.zkas):'Loading…'},
      {label:'KAS BLOCKS',value:communities.length?compact(totals.kas):'Loading…'},
    ],
    market:[
      {label:'ZKAS EXCHANGE PRICE',value:usd(exchangePrice??data.priceUsd),tag:'EXCHANGES'},
      {label:'MARKET CAP',value:usd((exchangePrice??data.priceUsd)!==null&&data.supply!==null?(exchangePrice??data.priceUsd)!*data.supply:data.marketCapUsd)},
      {label:'CIRCULATING SUPPLY',value:compact(data.supply)},
      {label:'24H VOLUME',value:combinedVolume24h===null?'—':`${compact(combinedVolume24h)} ZKAS`,tag:'OTC + EXCHANGES'},
    ],
  }),[data,communities,totals,exchangePrice,combinedVolume24h]);

  const caption=useMemo(()=>[
    mode==='community'?'⛏️ ZKAS Community Mining update':mode==='mining'?'⛏️ ZKAS mining update':mode==='market'?'📊 ZKAS market snapshot':'⚡ ZKAS network update',
    '',...all[mode].map(m=>`${m.label}: ${m.value}`),'','Live ZKAS intelligence: https://zkas.stream','Official ZKAS: https://zkas.info','ZKAS on X: https://x.com/ZKas_X','ZKAS Stream on X: https://x.com/ZKas_Stream','','#ZKAS #Kaspa #Mining #Privacy'
  ].join('\n'),[all,mode]);

  useEffect(()=>{ if(open) draw(); },[open,mode,all]);

  async function draw() {
    const el=canvas.current,c=el?.getContext('2d'); if(!el||!c) return;
    el.width=1200; el.height=675;
    const bg=c.createLinearGradient(0,0,1200,675); bg.addColorStop(0,'#061318'); bg.addColorStop(1,'#0b2528'); c.fillStyle=bg;c.fillRect(0,0,1200,675);
    const glow=c.createRadialGradient(930,80,20,930,80,520);glow.addColorStop(0,'rgba(31,235,216,.25)');glow.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=glow;c.fillRect(0,0,1200,675);
    try { const img=new Image(); await new Promise<void>((ok,bad)=>{img.onload=()=>ok();img.onerror=()=>bad();img.src='/zkas-logo.jpg'}); c.drawImage(img,64,48,92,92); } catch {}
    c.font='800 38px system-ui';c.fillStyle='#fff';c.fillText('ZKAS',178,86);c.fillStyle='#35ead8';c.fillText('.stream',280,86);
    c.font='600 15px system-ui';c.fillStyle='#8ca9aa';c.fillText('PUBLIC NETWORK INTELLIGENCE',180,116);
    c.textAlign='right';c.fillStyle='#70fff0';c.font='700 16px system-ui';c.fillText('LIVE • PUBLIC • SHAREABLE',1136,76);c.textAlign='left';
    c.fillStyle='#fff';c.font='900 55px system-ui';c.fillText(titles[mode],64,215);c.fillStyle='#35ead8';c.fillRect(64,235,180,5);
    const cardCount=all[mode].length;
    const cardGap=cardCount>4?16:24;
    const cardW=(1072-cardGap*(cardCount-1))/cardCount;
    all[mode].forEach((m,i)=>{
      const x=64+i*(cardW+cardGap),y=290,w=cardW,h=190;rr(c,x,y,w,h,22);c.fillStyle='rgba(3,17,21,.9)';c.fill();c.strokeStyle=i%2?'rgba(105,166,255,.55)':'rgba(53,234,216,.7)';c.lineWidth=2;c.stroke();
      c.fillStyle='#86a7a8';c.font=`700 ${cardCount>4?12:14}px system-ui`;c.fillText(m.label,x+18,y+42);
      c.fillStyle='#fff';c.font=`800 ${cardCount>4?24:29}px system-ui`;c.fillText(m.value.slice(0,18),x+18,y+98);
      c.fillStyle='#3cebd9';c.font=`700 ${cardCount>4?11:13}px system-ui`;c.fillText(m.tag??'ZKAS MAINNET',x+18,y+152);
    });
    c.fillStyle='#e6ffff';c.font='800 23px system-ui';c.fillText('Privacy by default • Proof-of-work secured • Built for real payments',64,550);
    rr(c,64,586,1072,54,27);c.fillStyle='rgba(44,221,205,.14)';c.fill();c.strokeStyle='rgba(64,240,223,.5)';c.stroke();
    c.fillStyle='#fff';c.font='800 23px system-ui';const footerLead='Explore live ZKAS data at';c.fillText(footerLead,92,621);const footerLinkX=92+c.measureText(footerLead).width+14;c.fillStyle='#43efdd';c.fillText('zkas.stream',footerLinkX,621);
    c.textAlign='right';c.fillStyle='#94b0b1';c.font='600 14px system-ui';c.fillText('#ZKAS  #Kaspa  #Mining  #Privacy',1108,620);c.textAlign='left';
  }

  function blob(){return new Promise<Blob|null>(resolve=>canvas.current?.toBlob(resolve,'image/png',.96));}
  async function download(){const b=await blob();if(!b)return;const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=`zkas-${mode}-update.png`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  async function copy(){try{await navigator.clipboard.writeText(caption);setCopied(true);setTimeout(()=>setCopied(false),1600);}catch{}}
  async function copyImage(){
    setImageCopyFailed(false);
    const b=await blob();
    if(!b)return;
    try{
      const ClipboardItemCtor=(window as typeof window & {ClipboardItem?: typeof ClipboardItem}).ClipboardItem;
      if(!ClipboardItemCtor||!navigator.clipboard?.write)throw new Error('Image clipboard unavailable');
      await navigator.clipboard.write([new ClipboardItemCtor({'image/png':b})]);
      setImageCopied(true);
      setTimeout(()=>setImageCopied(false),2200);
    }catch{
      setImageCopyFailed(true);
      setTimeout(()=>setImageCopyFailed(false),3500);
    }
  }
  function postToX(){
    const webUrl=`https://x.com/intent/post?text=${encodeURIComponent(caption)}`;
    const appleMobile=/iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Android X can open the legacy compose scheme while dropping its message.
    // Use X's web intent there so the generated caption is preserved.
    if(android){
      window.location.href=webUrl;
      return;
    }
    if(appleMobile){
      window.location.href=`twitter://post?message=${encodeURIComponent(caption)}`;
      return;
    }
    window.open(webUrl,'_blank','noopener,noreferrer');
  }
  async function share(){
    const b=await blob();
    if(b&&navigator.share){const f=new File([b],`zkas-${mode}-update.png`,{type:'image/png'});if(navigator.canShare?.({files:[f]})){await navigator.share({files:[f],text:caption,title:titles[mode]});return;}}
    try{await navigator.clipboard.writeText(caption);}catch{}
    postToX();
  }

  return <>
    <button className="share-zkas-fab" onClick={()=>setOpen(true)} aria-label="Create a ZKAS post for X" title="Post ZKAS update to X"><span className="share-zkas-fab-x">𝕏</span><span>Post to X</span></button>
    {open&&<div className="share-zkas-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
      <section className="share-zkas-modal" role="dialog" aria-modal="true" aria-label="Create ZKAS share card">
        <div className="share-zkas-head"><div><span>SHARE ZKAS TODAY</span><h2>Create a live ZKAS card</h2></div><button onClick={()=>setOpen(false)} aria-label="Close"><X size={20}/></button></div>
        <div className="share-zkas-tabs">{(['network','mining','community','market'] as Mode[]).map(m=><button key={m} className={mode===m?'active':''} onClick={()=>setMode(m)}>{m}</button>)}</div>
        <canvas ref={canvas} className="share-zkas-canvas"/>
        <div className={`share-zkas-actions ${android?'android-clean-flow':''}`}>
          {android&&<button onClick={()=>void copyImage()}><Copy size={17}/> {imageCopied?'Image copied!':'1. Copy image'}</button>}
          <button onClick={download}><Download size={17}/> {android?'Download image':'Download image'}</button>
          <button onClick={copy}><Copy size={17}/> {copied?'Copied!':'Copy caption'}</button>
          <button className="x-post" onClick={postToX}><span className="x-mark">𝕏</span> {android?'2. Post to X':'Post to X'}</button>
          {!android&&<button className="primary" onClick={()=>void share()}><Share2 size={17}/> Share image + text</button>}
        </div>
        {android
          ? <small className="android-share-help"><b>Android test:</b> Tap <b>Copy image</b>, then <b>Post to X</b>. In X, long-press and choose <b>Paste</b>. {imageCopyFailed&&<strong>Image copy is not supported by this browser — use Download image instead.</strong>}</small>
          : <small><b>Post to X</b> opens a prefilled X composer. <b>Share image + text</b> sends the generated card and caption to your phone's share sheet so you can choose X or another app.</small>}
      </section>
    </div>}
  </>;
}
