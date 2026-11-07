const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const output=ts.transpileModule(fs.readFileSync('src/lib/shop.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const result={};new Function('exports',output)(result);
for(const [hex,name] of [['#000000','Black'],['#ffffff','White'],['#0000ff','Blue'],['#00ff00','Green'],['#ff0000','Red'],['#345a9c','Blue'],['#202027','Charcoal'],['#f5f5f7','White'],['#808080','Gray'],['#000080','Navy']])assert.equal(result.colorNames(hex).color,name,hex);
assert.equal(result.colorNames('#00f').color,'Blue');
assert.equal(result.colorNames('#ff0000').color_ar,'أحمر');
console.log('PASS: primary colors, supplied shirt shades, neutral tones, navy and Arabic names');
