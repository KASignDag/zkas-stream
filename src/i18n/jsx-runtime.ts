// Translate at React render time so live data and reconciliation keep their original values.
import { createContext, createElement, forwardRef, isValidElement, useContext, useSyncExternalStore } from 'react';
import { languageEngine } from './engine';
import { jsx as baseJsx, jsxs as baseJsxs, Fragment } from 'react/jsx-runtime';
export { Fragment };
export type { JSX } from 'react/jsx-runtime';
const engine = languageEngine;
const SkipTranslation = createContext(false);
const noTranslationTags = new Set(['script','style','svg','canvas','code','pre']);
const noTranslationClasses = new Set(['brand','community-mining__alias','miner-card-name']);
function strings(value: any): any {
  if (typeof value === 'string') return engine()?.t(value) ?? value;
  return Array.isArray(value) ? value.map(strings) : value;
}
function originalText(value: any): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value == null || typeof value === 'boolean') return '';
  if (Array.isArray(value)) {
    const parts=value.map(originalText);
    return parts.every(part=>part!==undefined) ? parts.join('') : undefined;
  }
  if (isValidElement(value) && (value.type === Fragment || value.type === TranslatedFragment)) return originalText((value.props as any).children);
  return undefined;
}
function TranslatedFragment({children}: any) {
  const skip=useContext(SkipTranslation);
  useSyncExternalStore(engine().subscribe,engine().getSnapshot);
  return createElement(Fragment,null,skip ? children : strings(children));
}
const TranslatedElement = forwardRef<any, any>(function TranslatedElement({__zkasTag:tag,...source}, ref) {
  const inherited = useContext(SkipTranslation);
  useSyncExternalStore(engine().subscribe, engine().getSnapshot);
  const skip = inherited || noTranslationTags.has(tag) || source['data-no-i18n'] !== undefined || String(source.className || '').split(/\s+/).some(c=>noTranslationClasses.has(c));
  const props: any = {...source, ref};
  if (!skip) {
    for (const name of ['title','aria-label','placeholder','alt']) if(typeof props[name]==='string')props[name]=engine().t(props[name]);
    props.children = tag === 'textarea' ? source.children : strings(source.children);
    // The untranslated value is the form contract, even when no explicit value was supplied.
    if(tag==='option' && source.value===undefined) {
      const value=originalText(source.children);
      if(value!==undefined)props.value=value;
    }
  }
  const element=createElement(tag,props);
  return skip && !inherited ? createElement(SkipTranslation.Provider,{value:true},element) : element;
});
function render(factory: typeof baseJsx, type: any, props: any, key?: any) {
  if(type===Fragment)return factory(TranslatedFragment,props,key);
  return typeof type === 'string' ? factory(TranslatedElement,{...props,__zkasTag:type},key) : factory(type,props,key);
}
export const jsx = (type:any,props:any,key?:any) => render(baseJsx,type,props,key);
export const jsxs = (type:any,props:any,key?:any) => render(baseJsxs,type,props,key);
