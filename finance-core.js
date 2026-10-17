/* Exact fixed-point money: two decimals; rates: six decimals; half away from zero. */
(function(root){
'use strict';
function fixed(v,places=2){const s=String(v).trim();if(!/^-?\d+(\.\d+)?$/.test(s))throw Error('أدخل رقماً صحيحاً');const neg=s[0]==='-', [a,b='']=s.replace('-','').split('.');if(b.length>places)throw Error('عدد المنازل العشرية المسموح: '+places);return (neg?-1n:1n)*(BigInt(a)*10n**BigInt(places)+BigInt(b.padEnd(places,'0')));}
function decimal(v,p=2){v=BigInt(v);const sign=v<0n?'-':'';v=v<0n?-v:v;const s=v.toString().padStart(p+1,'0');return sign+s.slice(0,-p)+'.'+s.slice(-p);}
function round(n,d){if(d<=0n)throw Error('سعر الصرف يجب أن يكون موجباً');return n<0n?-round(-n,d):(n+d/2n)/d;}
function convert(cents,from,to,rate){if(from===to)return BigInt(cents);if(!rate)return null;const r=fixed(rate,6);if(r<=0n)throw Error('سعر الصرف يجب أن يكون موجباً');return from==='USD'?round(BigInt(cents)*r,1000000n):round(BigInt(cents)*1000000n,r);}
function balances(rows){const out={};rows.filter(r=>r.kind==='account'&&!r.deleted).forEach(a=>out[a.id]=BigInt(a.opening));for(const t of rows.filter(r=>r.kind==='transaction'&&!r.deleted&&r.status==='confirmed')){if(out[t.account]===undefined)continue;const amount=BigInt(t.amount);out[t.account]+=(t.type==='income'?amount:-amount);if(t.type==='transfer'){out[t.account]-=BigInt(t.fee||0);if(out[t.to]!==undefined)out[t.to]+=BigInt(t.received);}}return out;}
function flows(rows,currency){let income=0n,expense=0n,missing=false;for(const t of rows.filter(r=>r.kind==='transaction'&&!r.deleted)){const amount=t.type==='transfer'?BigInt(t.fee||0):BigInt(t.amount);if(!amount)continue;const v=convert(amount,t.currency,currency,t.rate);if(v===null){missing=true;continue;}if(t.type==='income')income+=v;else expense+=v;}return {income,expense,net:income-expense,missing};}
function occurrence(rule,month){const day=Number(rule.date.slice(8,10)),[y,m]=month.split('-').map(Number);const date=month+'-'+String(Math.min(day,new Date(y,m,0).getDate())).padStart(2,'0');return {...rule,id:'occ:'+rule.id+':'+month,kind:'transaction',rule:rule.id,date,status:'planned'};}
function generate(rows,month){const ids=new Set(rows.map(r=>r.id));return rows.filter(r=>r.kind==='recurrence'&&!r.deleted&&r.date.slice(0,7)<=month).map(r=>occurrence(r,month)).filter(r=>!ids.has(r.id));}
const api={fixed,decimal,convert,balances,flows,generate,occurrence};if(typeof module!=='undefined')module.exports=api;root.FinanceCore=api;
})(typeof window==='undefined'?globalThis:window);
