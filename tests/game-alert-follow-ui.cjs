const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
let lang = 'en', userId = null, data, isError = false, stateIndex = 0, saveCalls = [];
const exportsApi = {};
const code = ts.transpileModule(fs.readFileSync('src/components/games/game-alert-follow.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const mocks = {
  react: { ...React, useState: () => [stateIndex++ === 0 ? userId : '', () => {}], useEffect() {} },
  'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
  '@tanstack/react-query': { useQueryClient: () => ({}), useQuery: () => ({ data, isError, isPending: false }), useMutation: () => ({ isPending: false, mutate: value => saveCalls.push(value) }) },
  '@/components/ui/button': { Button: ({ asChild, children, ...props }) => asChild ? children : React.createElement('button', props, children) },
  '@/lib/i18n': { useI18n: () => ({ lang }) },
  '@/lib/supabase/client': {},
  '@/lib/auth-redirect': { authLink: (path, dest) => `${path}?redirectedFrom=${encodeURIComponent(dest)}` },
  '@/lib/push': { usePushNotifications: () => ({ supported: false, subscribed: false }) },
  '@/lib/constants': { COMMUNITY_SPORTS: ['Volleyball', 'Padel'] },
};
new Function('exports', 'require', code)(exportsApi, id => mocks[id] ?? require(id));
function render() { stateIndex = 0; return renderToStaticMarkup(exportsApi.GameAlertFollow({ sport: 'Volleyball', returnTo: '/games/example' })); }
for (lang of ['en', 'ar']) {
  userId = null; data = undefined; isError = false;
  let html = render();
  assert.ok(html.includes('/login?redirectedFrom=%2Fgames%2Fexample'));
  assert.ok(html.includes(lang === 'ar' ? 'سجّل الدخول' : 'Sign in'));
  assert.equal(saveCalls.length, 0, 'viewing a page never subscribes the player');
  userId = 'me'; data = { authenticated: true, interested_sports: ['Padel'], notify_game_alerts: false };
  html = render();
  assert.ok(html.includes(lang === 'ar' ? 'لكل الرياضات' : 'all sports in your interests'), 'global opt-in is explained before enabling');
  assert.ok(html.includes(lang === 'ar' ? 'مش مقصورة على منطقة معينة' : 'not limited to this area'));
  assert.ok(html.includes('aria-pressed="false"'));
  data = { authenticated: true, interested_sports: ['Volleyball'], notify_game_alerts: true };
  html = render();
  assert.ok(html.includes('aria-pressed="true"'));
  assert.ok(html.includes(lang === 'ar' ? 'إلغاء متابعة' : 'Unfollow'));
  assert.ok(html.includes('href="/community"'));
  isError = true; html = render();
  assert.ok(html.includes('role="alert"'));
  assert.ok(!html.includes('aria-pressed='), 'read failure cannot be shown as an unfollowed sport');
}
lang = 'en'; userId = null; isError = false; data = undefined; stateIndex = 0;
assert.ok(renderToStaticMarkup(exportsApi.GameAlertFollow({ sport: 'Volleyball', returnTo: '/ar/play/volleyball-new-cairo', language: 'ar' })).includes('سجّل الدخول'));
console.log('PASS: bilingual follow UI, preserved login destination, explicit opt-in, global-alert disclosure, unfollow and error states');
