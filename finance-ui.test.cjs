const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict'),C=require('./finance-core.js');
// Headless DOM contract test, not browser/visual QA. Exercises actual event handlers and forms.
const elements=new Map(),events={};function element(id){if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',remove(){elements.delete(id)},showModal(){},close(){}});return elements.get(id);}
const doc={getElementById:element,addEventListener:(event,fn)=>events[event]=fn,body:{classList:{contains:()=>true},insertAdjacentHTML(){}}};
let base={tasks:[],projects:[],notes:'',transactions:[],financeGoals:[],financeBudgets:{}};const win={FinanceCore:C,mahamSyncAPI:{snapshot:()=>base,apply:d=>{base=d}},mahamSyncOnSave(){}};const ctx={window:win,document:doc,crypto:require('node:crypto').webcrypto,structuredClone,Date,BigInt,console,confirm:()=>true,alert:m=>{throw Error(m)},FormData:class{constructor(form){return Object.entries(form.values)}},setTimeout};vm.runInNewContext(fs.readFileSync(__dirname+'/finance.js','utf8'),ctx);
win.mahamSyncAPI.apply(base);
function click(action,id=''){events.click({target:{closest:()=>({dataset:{fAction:action,id}})}});}
function submit(values){element('fForm').onsubmit({preventDefault(){},target:{values}});assert.equal(element('fError').textContent,'');}
click('account');submit({name:'USD cash',currency:'USD',opening:'100.00'});let a=win.mahamSyncAPI.snapshot().financeRows.find(r=>r.kind==='account');
click('transaction');submit({title:'Salary',account:a.id,amount:'20.00',type:'income',category:'راتب',date:'2026-10-17',rate:'100',status:'confirmed',note:''});
assert.equal(C.balances(win.mahamSyncAPI.snapshot().financeRows)[a.id],12000n);
click('account');submit({name:'SYP cash',currency:'SYP',opening:'0'});let b=win.mahamSyncAPI.snapshot().financeRows.find(r=>r.kind==='account'&&r.id!==a.id);
click('transfer');submit({title:'Exchange',account:a.id,to:b.id,amount:'10',fee:'1',date:'2026-10-17',rate:'100',status:'confirmed',note:''});assert.equal(C.balances(win.mahamSyncAPI.snapshot().financeRows)[a.id],10900n);assert.equal(C.balances(win.mahamSyncAPI.snapshot().financeRows)[b.id],100000n);
for(const tab of ['overview','transactions','accounts','budgets','plans','goals','reports','settings']){events.click({target:{closest:()=>({dataset:{fTab:tab}})}});assert(element('fContent').innerHTML.length>0);}
let saved=structuredClone(win.mahamSyncAPI.snapshot());win.mahamSyncAPI.apply({...base,financeRows:[]});assert.equal(win.mahamSyncAPI.snapshot().financeRows.filter(r=>r.kind==='account').length,0);win.mahamSyncAPI.apply(saved);assert.equal(win.mahamSyncAPI.snapshot().financeRows.filter(r=>r.kind==='account').length,2);
console.log('PASS: actual UI account/income/transfer forms, all eight tab render paths, snapshot hydration and account switching.');
