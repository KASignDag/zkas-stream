export type LanguageState = { code: string; loading: boolean; error: string };
export type LanguageEngine = {
  languages: Array<[string, string]>;
  t(value: string): string;
  setLanguage(code: string, remember?: boolean): Promise<void>;
  subscribe(listener: () => void): () => void;
  getSnapshot(): LanguageState;
};
declare global { interface Window { ZkasI18n: LanguageEngine } }
export const languageEngine = () => window.ZkasI18n;
