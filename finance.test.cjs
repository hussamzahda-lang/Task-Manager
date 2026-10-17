const assert=require('node:assert/strict'),C=require('./finance-core.js');
const account=(id,currency,opening)=>({id,kind:'account',currency,opening});
const tx=(id,type,amount,extra={})=>({id,kind:'transaction',account:'usd',currency:'USD',status:'confirmed',type,amount,rate:'100',...extra});
let rows=[account('usd','USD','10000'),account('syp','SYP','50000'),tx('salary','income','20000'),tx('food','expense','1000'),tx('rent','expense','5000',{status:'planned'})];
assert.equal(C.balances(rows).usd,29000n);
rows.push(tx('transfer','transfer','1000',{to:'syp',received:'100000',fee:'100'}));
assert.deepEqual(C.balances(rows),{usd:27900n,syp:150000n});
let f=C.flows(rows.filter(t=>t.status==='confirmed'),'USD');assert.equal(f.income,20000n);assert.equal(f.expense,1100n);
assert.equal(C.convert('100','USD','SYP','100'),10000n);assert.equal(C.convert('10000','SYP','USD','100'),100n);
assert.equal(C.convert('100','SYP','USD',null),null);assert.throws(()=>C.convert('1','USD','SYP','0'));assert.throws(()=>C.convert('1','USD','SYP','-1'));
assert.equal(C.fixed('0.10')+C.fixed('0.20'),30n);assert.equal(C.convert('1','SYP','USD','2'),1n);assert.equal(C.convert('-1','SYP','USD','2'),-1n);
rows=rows.map(t=>t.id==='food'?{...t,amount:'2000'}:t);assert.equal(C.balances(rows).usd,26900n);
rows=rows.map(t=>t.id==='transfer'?{...t,deleted:true}:t);assert.deepEqual(C.balances(rows),{usd:28000n,syp:50000n});
const historical=tx('old','expense','10000',{currency:'SYP',rate:'100'});assert.equal(C.flows([historical],'USD').expense,100n);rows.push({id:'new-rate',kind:'rate',value:'200'});assert.equal(C.flows([historical],'USD').expense,100n);
const rule={id:'salary-rule',kind:'recurrence',type:'income',date:'2026-01-31',amount:'10000',account:'usd',currency:'USD'};let rules=[rule];let generated=C.generate(rules,'2026-02');assert.equal(generated[0].date,'2026-02-28');rules.push(...generated);assert.equal(C.generate(rules,'2026-02').length,0);rules[1].deleted=true;assert.equal(C.generate(rules,'2026-02').length,0);assert.equal(C.generate(rules,'2025-12').length,0);
assert.equal(C.balances([...rows,{kind:'contribution',amount:'99999'}]).usd,C.balances(rows).usd);
// Execute the actual sync merge functions with a test-only DOM and no network.
const vm=require('node:vm'),fs=require('node:fs');let source=fs.readFileSync(__dirname+'/cloud.js','utf8').replace('  void init();','  globalThis.testMerge={merge,mergeInitial};');const sandbox={window:{mahamSyncAPI:{}},document:{getElementById:()=>({addEventListener(){}})},setTimeout,clearTimeout};vm.runInNewContext(source,sandbox);const blank={tasks:[],projects:[],notes:'',transactions:[],financeGoals:[],financeBudgets:{},financeRows:[]};const base={...blank,financeRows:[rule]},mine={...blank,financeRows:[rule,...generated]},theirs={...blank,financeRows:[rule,...generated,{id:'other',kind:'account'}]};const merged=sandbox.testMerge.merge(base,mine,theirs);assert.equal(merged.financeRows.filter(r=>r.id===generated[0].id).length,1);assert(merged.financeRows.some(r=>r.id==='other'));
// Preserve unrelated services and Lucy's complete login markup.
const html=fs.readFileSync(__dirname+'/index.html','utf8');for(const id of ['dashboardView','tasksView','calendarView','projectsView','notesView','financeView','loginForm'])assert(html.includes('id="'+id+'"'));assert(html.includes('lucy-welcome.webp'));const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];scripts.forEach(s=>new vm.Script(s[1]));
console.log('PASS: exact decimals, balances, planned exclusion, cross-currency transfers/fees, edits/deletions, historical rates, recurring deduplication/tombstones, sync merging, savings non-duplication, section and Lucy preservation, script syntax.');
