/* Local dictionaries only. No visitor text or telemetry is sent to a translation service. */
(() => {
  'use strict';
  const languages = [['en','English'],['es','Español'],['pt','Português'],['fr','Français'],['de','Deutsch'],['it','Italiano'],['nl','Nederlands'],['pl','Polski'],['uk','Українська'],['ru','Русский'],['tr','Türkçe'],['ar','العربية'],['fa','فارسی'],['ur','اردو'],['hi','हिन्दी'],['bn','বাংলা'],['id','Bahasa Indonesia'],['vi','Tiếng Việt'],['th','ไทย'],['zh','简体中文'],['zh-TW','繁體中文'],['ja','日本語'],['ko','한국어'],['fil','Filipino']];
  const supported = new Set(languages.map(([code]) => code));
  const listeners = new Set(), cache = new Map(), sourceNodes = new WeakMap(), sourceAttributes = new WeakMap();
  let dictionary = null, templates = [], requestId = 0, observer;
  let state = { code:'en', loading:false, error:'' };
  const originalTitle=document.title;
  const description=document.querySelector('meta[name=description]');
  const originalDescription=description?.content;
  const normalize = s => s.replace(/\s+/g,' ').trim();
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const excluded = 'script,style,svg,canvas,pre,code,textarea,input,[contenteditable],[data-no-i18n],.brand,.miner-card-name,.community-mining__alias';
  const attributeExcluded=excluded.replace('textarea,input,','');
  function emit() { for (const listener of listeners) listener(); }
  function translate(value) {
    if (typeof value !== 'string' || !dictionary || !value.trim()) return value;
    const key = normalize(value);
    if(/^[A-Z]{2}$/.test(key))return value; // Country codes and technical abbreviations are data.
    if(/^(?:≈\s*)?[+-]?(?:\d[\d,.]*(?:[eE][+-]?\d+)?|—)\s*(?:[KMGTPE]?H\/s|BPS|ZKAS|KAS|USDT|USD|BTC|sompi)$/i.test(key))return value;
    let result = Object.prototype.hasOwnProperty.call(dictionary,key) ? dictionary[key] : null;
    if (!result) {
      for (const entry of templates) {
        const match = key.match(entry.regex);
        if (match) { result = entry.value.replace(/\{(\d+)\}/g, (token, i) => translate(match[entry.slots.indexOf(i)+1] ?? token)); break; }
      }
    }
    return result ? value.match(/^\s*/)[0]+result+value.match(/\s*$/)[0] : value;
  }
  function originalUnit(node) {
    let unit=sourceNodes.get(node);
    if (!unit || node.nodeValue !== unit.last) unit={source:node.nodeValue,last:node.nodeValue};
    const value=translate(unit.source);node.nodeValue=value;unit.last=value;sourceNodes.set(node,unit);
  }
  function translateTree(root) {
    if (root.nodeType===3) { if(root.parentElement&&!root.parentElement.closest(excluded))originalUnit(root);return; }
    if(root.nodeType!==1||root.closest(attributeExcluded))return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()) if(!walker.currentNode.parentElement.closest(excluded))originalUnit(walker.currentNode);
    for(const element of [root,...root.querySelectorAll('[title],[aria-label],[placeholder],[alt]')]) {
      if(element.closest(attributeExcluded))continue;
      let units=sourceAttributes.get(element)||{};
      for(const attr of ['title','aria-label','placeholder','alt']) {
        if(!element.hasAttribute(attr))continue;
        const current=element.getAttribute(attr), prior=units[attr];
        const source=prior&&current===prior.last?prior.source:current;
        const value=translate(source);element.setAttribute(attr,value);units[attr]={source,last:value};
      }
      sourceAttributes.set(element,units);
    }
  }
  function observe() {
    if(observer)observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder','alt']});
  }
  function updateStatic() {
    if(document.documentElement.dataset.i18nRenderer==='react')return;
    observer?.disconnect();
    translateTree(document.body);
    document.querySelectorAll('[data-language-picker]').forEach(p=>{p.value=state.code;p.setAttribute('aria-label',translate('Language'));p.setAttribute('aria-busy',String(state.loading));});
    const status=document.getElementById('languageStatus');if(status)status.textContent=state.error;
    const note=document.getElementById('translationNote');if(note)note.hidden=state.code==='en';
    observe();
  }
  async function setLanguage(code,remember=true) {
    if(!supported.has(code))code='en';
    const id=++requestId;state={...state,loading:true,error:''};emit();
    try {
      let next=null;
      if(code!=='en') {
        next=cache.get(code);
        if(!next) {
          const response=await fetch('/i18n/'+code+'.json');
          if(!response.ok)throw Error('Dictionary unavailable');
          next=await response.json();
          if(!next||typeof next!=='object'||Array.isArray(next)||typeof next.Language!=='string'||Object.values(next).some(value=>typeof value!=='string'))throw Error('Invalid dictionary');
          cache.set(code,next);
        }
      }
      if(id!==requestId)return;
      dictionary=next;
      templates=Object.entries(next||{}).filter(([key])=>/\{\d+\}/.test(key)&&key.replace(/\{\d+\}/g,'').length>=4).map(([key,value])=>{
        const slots=[];const parts=key.split(/(\{\d+\})/).map(part=>{if(/^\{\d+\}$/.test(part)){slots.push(part.slice(1,-1));return '(.+?)';}return escape(part);});
        return {regex:new RegExp('^'+parts.join('')+'$'),slots,value,weight:key.replace(/\{\d+\}/g,'').length};
      }).sort((a,b)=>b.weight-a.weight);
      state={code,loading:false,error:''};
      document.title=translate(originalTitle);
      if(description)description.content=translate(originalDescription);
      document.documentElement.lang=code;
      document.documentElement.dir=['ar','fa','ur'].includes(code)?'rtl':'ltr';
      if(remember) {
        try{localStorage.setItem('zkas-stream-language',code);}catch{}
        const url=new URL(location.href);if(code==='en')url.searchParams.delete('lang');else url.searchParams.set('lang',code);
        history.replaceState(null,'',url);
      }
      updateStatic();emit();
    } catch(error) {
      if(id!==requestId)return;
      state={...state,loading:false,error:translate('Language could not be loaded. Please try again.')};
      updateStatic();emit();
      console.warn('Language could not be loaded',error);
    }
  }
  window.ZkasI18n={languages,t:translate,setLanguage,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},getSnapshot:()=>state};
  function init() {
    if(document.documentElement.dataset.i18nRenderer!=='react') {
      document.querySelectorAll('[data-language-picker]').forEach(picker=>{
        for(const [code,name] of languages){const option=document.createElement('option');option.value=code;option.textContent=name;picker.append(option);}
        picker.addEventListener('change',()=>setLanguage(picker.value));
      });
      observer=new MutationObserver(records=>{
        observer.disconnect();const roots=new Set();
        for(const record of records) {
          if(record.type==='childList')for(const node of record.addedNodes)roots.add(node);
          else roots.add(record.target);
        }
        roots.forEach(translateTree);observe();
      });
      observe();
    }
    let stored;try{stored=localStorage.getItem('zkas-stream-language');}catch{}
    const requested=new URL(location.href).searchParams.get('lang');
    setLanguage(requested||stored||'en',Boolean(requested));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
