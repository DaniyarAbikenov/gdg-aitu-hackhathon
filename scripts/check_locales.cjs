// Locale parity and placeholder checks prevent partially translated releases.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../frontend/src/i18n/locales');
function flatten(value,prefix=''){return Object.fromEntries(Object.entries(value).flatMap(([k,v])=>typeof v==='object'?Object.entries(flatten(v,prefix+k+'.')):[[prefix+k,v]]));}
const dictionaries=Object.fromEntries(['ru','en','kz'].map(l=>[l,flatten(JSON.parse(fs.readFileSync(path.join(root,l+'.json'),'utf8')))]));
const placeholders=text=>[...text.matchAll(/\{\{([^}]+)\}\}/g)].map(m=>m[1]).sort();
for(const [language,values] of Object.entries(dictionaries)){
 assert.deepEqual(Object.keys(values).sort(),Object.keys(dictionaries.ru).sort(),language+' keys differ');
 for(const [key,value] of Object.entries(values)){
  assert.ok(typeof value==='string'&&value.trim(),language+'.'+key+' is empty');
  assert.deepEqual(placeholders(value),placeholders(dictionaries.ru[key]),language+'.'+key+' placeholders differ');
 }
}
console.log('All three locales have complete matching keys and interpolation parameters.');
