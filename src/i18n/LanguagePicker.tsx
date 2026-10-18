import { useSyncExternalStore } from 'react';
import { languageEngine } from './engine';
import { Globe2 } from 'lucide-react';
export function LanguagePicker() {
  const engine=languageEngine();
  const state=useSyncExternalStore(engine.subscribe,engine.getSnapshot);
  return <div className="language-control" data-no-i18n>
    <label className="language-picker"><Globe2 size={16} aria-hidden="true" />
      <select aria-label={engine.t('Language')} value={state.code} aria-busy={state.loading} onChange={event=>void engine.setLanguage(event.target.value)}>
        {engine.languages.map(([code,name]:[string,string])=><option key={code} value={code}>{name}</option>)}
      </select>
    </label>
    <span className="language-status" role="status">{state.error}</span>
  </div>;
}
export function TranslationNote() {
  const engine=languageEngine();
  const state=useSyncExternalStore(engine.subscribe,engine.getSnapshot);
  return state.code==='en'?null:<p className="translation-note">Translations are generated automatically. Refer to English for the original wording.</p>;
}
