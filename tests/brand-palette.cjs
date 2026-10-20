const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync('public/playza-tokens.css','utf8')+'\n'+fs.readFileSync('src/app/globals.css','utf8');
const palette = fs.readFileSync('public/playza-tokens.css','utf8');
const vars = Object.fromEntries([...palette.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m=>[m[1],m[2]]));
function resolve(v){return v.replace(/var\((--[\w-]+)\)/g,(_,k)=>{assert.ok(vars[k],`Defined token ${k}`);return resolve(vars[k]);});}
function rgb(token){const [h,s,l]=resolve(vars[token]).match(/[\d.]+/g).map(Number);const sat=s/100,light=l/100,a=sat*Math.min(light,1-light);return [0,8,4].map(n=>{const k=(n+h/30)%12;return Math.round(255*(light-a*Math.max(-1,Math.min(k-3,9-k,1))));});}
function hex(t){return '#'+rgb(t).map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();}
for(const [token,value] of Object.entries({'--playza-lime':'#C6FF00','--playza-lime-hover':'#B4E600','--playza-purple':'#7B2CBF','--playza-purple-700':'#6923A5','--playza-purple-dark':'#4C1D95','--playza-purple-400':'#A855F7','--playza-slate-50':'#F8F9FC','--playza-slate-900':'#171725','--playza-slate-500':'#6B7280','--playza-slate-200':'#E5E7EB','--playza-green':'#16A34A','--playza-orange':'#F59E0B','--playza-red':'#EF4444','--playza-blue':'#3B82F6'}))assert.equal(hex(token),value,token);
function lum(rgb){return rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);}
function contrast(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
for(const [a,b] of [['--playza-slate-900','--playza-lime'],['--playza-slate-500','--playza-slate-50'],['--playza-purple','--playza-slate-50'],['--playza-green-700','--playza-green-100'],['--playza-orange-800','--playza-orange-100'],['--playza-red-700','--playza-red-100'],['--playza-blue-700','--playza-blue-100']])assert.ok(contrast(rgb(a),rgb(b))>=4.5,`${a} on ${b}`);
assert.ok(contrast([255,255,255],rgb('--playza-purple'))>=4.5);
assert.ok(contrast([255,255,255],rgb('--playza-purple-dark'))>=4.5);
for(const match of css.matchAll(/var\((--[\w-]+)\)/g))if(match[1].startsWith('--playza-')||match[1].startsWith('--color-'))assert.ok(vars[match[1]],match[1]);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const file of walk('src').filter(f=>/\.(css|tsx)$/.test(f))){const text=fs.readFileSync(file,'utf8');assert.doesNotMatch(text,/\bdark:[\w\[]|prefers-color-scheme|from ["']next-themes["']/ ,file);}
assert.doesNotMatch(css,/\.dark\s*\{/);
assert.equal(fs.existsSync('src/components/layout/theme-toggle.tsx'),false);
assert.match(fs.readFileSync('src/components/ui/sonner.tsx','utf8'),/theme="light"/);
assert.match(fs.readFileSync('public/beach-challenge/style.css','utf8'),/playza-tokens\.css/);
console.log('PASS: exact palette, readable AA text pairs, shared static-game tokens and a single light theme');
