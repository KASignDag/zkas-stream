# Site languages

ZKas.stream offers English and the same 23 additional languages as ZKas.io. The header selector remembers a successful choice in `zkas-stream-language`. A `?lang=es` (or another supported code) link overrides that preference. Hash routes, standalone Community Mining and pool preview pages, and the admin page share the same language files.

## Rollback

The production site before this change is preserved on branch `backup/pre-multilingual-2026-10-18`, commit `4fb84a602c4369ee87042c776e96e9213878e5c8`. Restore that snapshot and redeploy to return to the prior English site. This feature does not change API handlers, mining settings, accounting, or telemetry collectors.

## Implementation

`public/i18n.js` loads a single same-origin JSON dictionary from `public/i18n/`. No visitor text or live telemetry is sent to any translation provider. There is no runtime translation API or AI inference cost. Dictionaries are static assets; existing telemetry remains on its current hosting arrangement.

React uses a small JSX runtime adapter in `src/i18n/`. It translates display strings when React renders, retaining the source strings for exact English restoration. It does not change component state, callbacks, URLs, field values, option values or numerical data. A skip context protects code, addresses, user inputs, miner aliases and anything marked `data-no-i18n`. Vite and TypeScript both use the same adapter. The language control uses the same store, so route changes do not reset it. The existing hidden Supporters navigation entry is now filtered by its stable route identifier rather than matching English button text. Standalone HTML pages use a mutation observer to translate newly rendered display text without replacing controls or table markup.

Dynamic labels use numbered placeholders such as `Total {0} blocks`. The immutable values are inserted at display time, not submitted for translation. Arabic, Persian and Urdu set the document direction to RTL. Missing keys display the original English; a dictionary download failure retains the active language and shows a retry message.

## Updating wording

Add new English display strings to `public/i18n/en.json`, then supply corresponding keys in every language file. Preserve placeholder tokens, numbers, protocol names and tickers. Do not translate machine identifiers, payout addresses or copied configuration text. `data-no-i18n` can protect a display subtree.

Geographic names are precomputed from ICU/CLDR region display names to avoid model-generated additions to country labels.

Translations are automatic drafts and have not received native-speaker review in every language. The site displays a note when a translated language is active. Video audio, embedded external services and user-authored content retain their original language.
