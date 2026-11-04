const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const exported = {};
new Function('exports', ts.transpileModule(fs.readFileSync('src/lib/automatic-theme.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(exported);
for (const [hour, theme] of [[0,'dark'],[5,'dark'],[6,'light'],[12,'light'],[17,'light'],[18,'dark'],[23,'dark']]) assert.equal(exported.themeForHour(hour), theme);
let hour = 17;
const classes = new Set(['light']);
const root = { classList: { toggle(name, active) { if (active) classes.add(name); else classes.delete(name); } }, style: {} };
const context = vm.createContext({ Date: class { getHours() { return hour; } }, document: { documentElement: root } });
for (hour of [17,18,23,0,5,6,12,18]) {
 vm.runInContext(exported.automaticThemeScript, context);
 const theme = exported.themeForHour(hour);
 assert.equal(classes.has('dark'), theme === 'dark');
 assert.equal(classes.has('light'), theme === 'light');
 assert.equal(root.style.colorScheme, theme);
 assert.equal(classes.size, 1);
}
console.log('PASS: local evening/morning boundaries, midnight, repeated updates and pre-paint theme script');
