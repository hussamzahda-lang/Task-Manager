/* Maham Cloud Sync — Supabase authentication + optimistic revision sync.
   This file contains only a public Supabase URL and publishable key. */
(() => {
  'use strict';
  const PROJECT_URL = 'https://dongbrsmbdhxighenpoc.supabase.co';
  const PUBLIC_KEY = 'sb_publishable_7XLUmdhCmgssgColgTOPZA_smaI1Rp0';
  const $ = id => document.getElementById(id);
  const api = window.mahamSyncAPI;
  const keys = ['mt_tasks', 'mt_projects', 'mt_notes', 'mt_fin_transactions', 'mt_fin_goals', 'mt_fin_budgets'];
  const blank = () => ({ tasks:[], projects:[], notes:'', transactions:[], financeGoals:[], financeBudgets:{}, financeRows:[] });
  const copy = value => JSON.parse(JSON.stringify(value));
  const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const meaningful = d => !!(d.financeRows?.length || d.tasks?.length || d.transactions?.length || d.financeGoals?.length || String(d.notes||'').trim() || Object.keys(d.financeBudgets||{}).length || (d.projects||[]).some(p=>!['work','personal'].includes(p.id)));
  const validate = d => d && typeof d === 'object' && Array.isArray(d.tasks) && Array.isArray(d.projects) && Array.isArray(d.transactions) && Array.isArray(d.financeGoals) && typeof d.notes === 'string' && d.financeBudgets && typeof d.financeBudgets === 'object';
  let client=null, user=null, revision=0, baseline=blank(), timer=null, busy=false, dirty=false, loading=false, syncEpoch=0;
  let polling=null;
  function status(s, extra='') { $('cloudStatus').textContent = s; $('cloudStatus').title = extra; }
  function authMessage(msg) { $('loginMessage').textContent = msg; }
  function hideApp() { document.body.classList.remove('authenticated'); $('accountLabel').textContent = ''; }
  function showApp() { document.body.classList.add('authenticated'); $('accountLabel').textContent = user?.email || 'حسابي'; }
  function cachePending(d) {
    try { if(user)localStorage.setItem('mt_pending_'+user.id,JSON.stringify(d)); localStorage.setItem('mt_tasks', JSON.stringify(d.tasks)); localStorage.setItem('mt_projects', JSON.stringify(d.projects)); localStorage.setItem('mt_notes', d.notes);
      localStorage.setItem('mt_fin_transactions', JSON.stringify(d.transactions)); localStorage.setItem('mt_fin_goals', JSON.stringify(d.financeGoals)); localStorage.setItem('mt_fin_budgets', JSON.stringify(d.financeBudgets)); } catch(e) { status('⚠️ التخزين المحلي ممتلئ'); }
  }
  function clearPending() { try { if(user)localStorage.removeItem('mt_pending_'+user.id); keys.forEach(k=>localStorage.removeItem(k)); } catch(e) {} }
  // Three-way merge: preserve edits made on either device, including deletions.
  function mergeList(base, mine, theirs) {
    const map = list => new Map((list||[]).filter(x=>x && x.id != null).map(x=>[String(x.id),x]));
    const b=map(base), m=map(mine), t=map(theirs), output=[];
    for(const id of new Set([...t.keys(), ...m.keys(), ...b.keys()])) {
      const B=b.get(id), M=m.get(id), T=t.get(id);
      const changedMine=!equal(M,B), changedTheirs=!equal(T,B);
      const chosen=changedMine?M:T;
      if(chosen!==undefined) output.push(chosen);
    }
    return output;
  }
  function mergeObj(base,mine,theirs) {
    const out={...theirs};
    for(const k of new Set([...Object.keys(base||{}), ...Object.keys(mine||{})])) {
      if(!equal((mine||{})[k],(base||{})[k])) {
        if(Object.prototype.hasOwnProperty.call(mine||{},k))out[k]=mine[k];else delete out[k];
      }
    }
    return out;
  }
  function merge(base,mine,theirs) {
    const out=blank();
    for(const key of ['tasks','projects','transactions','financeGoals','financeRows'])out[key]=mergeList(base[key],mine[key],theirs[key]);
    out.notes=mine.notes!==base.notes ? mine.notes : theirs.notes;
    out.financeBudgets=mergeObj(base.financeBudgets,mine.financeBudgets,theirs.financeBudgets);
    return out;
  }
  function mergeInitial(local,remote) {
    const combined=blank();
    for(const key of ['tasks','projects','transactions','financeGoals','financeRows']) {
      const cloudItems=remote[key]||[], ids=new Set(cloudItems.map(x=>String(x.id)));
      combined[key]=[...cloudItems,...(local[key]||[]).filter(x=>!ids.has(String(x.id)))];
    }
    combined.notes=remote.notes && local.notes && remote.notes!==local.notes ? remote.notes+'\n\n'+local.notes : (remote.notes||local.notes);
    combined.financeBudgets={...local.financeBudgets,...remote.financeBudgets};
    return combined;
  }
  async function fetchCloud() {
    const {data,error}=await client.from('maham_state').select('data,revision').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    const raw=data?.data ?? blank();
    if(!validate(raw))throw new Error('بيانات سحابية غير متوافقة. لم يتم إجراء أي تغيير.');
    return { data:raw, revision:Number(data?.revision||0) };
  }
  function schedule(delay=650) {
    dirty=true; cachePending(api.snapshot()); status('⏳ جاري الحفظ…');
    clearTimeout(timer);
    timer=setTimeout(()=>void flush(),delay);
  }
  async function flush() {
    if(!user || loading || busy || !dirty)return;
    clearTimeout(timer); timer=null;
    busy=true;
    const epoch=syncEpoch;
    const snapshot=copy(api.snapshot());
    dirty=false;
    try {
      const {data,error}=await client.rpc('maham_save',{p_expected_revision:revision,p_data:snapshot});
      if(error)throw error;
      if(epoch!==syncEpoch)return;
      revision=Number(data); baseline=snapshot;
      try {localStorage.setItem('mt_cloud_base_'+user.id,JSON.stringify(snapshot));}catch(e){}
      if(equal(api.snapshot(),snapshot)&&!dirty){clearPending();status('✓ تمت المزامنة');}
      else schedule(250);
    } catch(e) {
      if(epoch!==syncEpoch)return;
      // A revision mismatch means another device saved; merge changed fields safely.
      const conflict=/revision_conflict|23505|409/i.test([e.code,e.message,e.details].join(' '));
      if(conflict) {
        try {
          const latest=await fetchCloud();
          if(epoch!==syncEpoch)return;
          const combined=merge(baseline,api.snapshot(),latest.data);
          baseline=copy(latest.data);revision=latest.revision;
          api.apply(combined); cachePending(combined); schedule(200);
        } catch(err) {dirty=true;status('⚠️ تعذّرت المزامنة',err.message||'');}
      } else {dirty=true;status('⚠️ لم تُحفظ التغييرات سحابياً',e.message||'');}
    } finally {
      busy=false;
      if(dirty && !timer && user && epoch===syncEpoch)timer=setTimeout(()=>void flush(),3500);
    }
  }
  async function refresh() {
    if(!user || busy || dirty || loading || document.hidden)return;
    const epoch=syncEpoch;
    try {
      const latest=await fetchCloud();
      if(epoch!==syncEpoch || busy || dirty)return;
      if(latest.revision!==revision){ revision=latest.revision;baseline=copy(latest.data);api.apply(latest.data);try{localStorage.setItem('mt_cloud_base_'+user.id,JSON.stringify(latest.data));}catch(e){}status('✓ تم تحديث البيانات من جهاز آخر'); }
    } catch(e) {status('⚠️ مشكلة في الاتصال',e.message||'');}
  }
  async function activate(session) {
    if(!session?.user || loading)return;
    if(user?.id===session.user.id && document.body.classList.contains('authenticated'))return;
    const epoch=++syncEpoch;
    user=session.user; loading=true; dirty=false;revision=0;clearTimeout(timer);
    $('loginButton').disabled=true;
    authMessage('جارٍ تحميل بياناتك الخاصة…');
    try {
      let local=blank();
      const owner=localStorage.getItem('mt_cache_owner');
      if(!owner || owner===user.id)local=copy(api.snapshot());
      const pending=localStorage.getItem('mt_pending_'+user.id);
      if(pending)local=JSON.parse(pending);
      localStorage.setItem('mt_cache_owner',user.id);
      const remote=await fetchCloud();
      if(epoch!==syncEpoch)return;
      revision=remote.revision; baseline=copy(remote.data);
      // First login / interrupted save: local data is merged, never silently discarded.
      let combined=remote.data;
      if(meaningful(local)) {
        if(revision===0) combined=local;
        else {
          // One-time import: preserve existing cloud entries when IDs match and bring
          // in locally unique tasks/goals. Unsaved edits on a previously-synced device
          // still take precedence based on its stored baseline.
          let lastBase=null;
          try { lastBase=JSON.parse(localStorage.getItem('mt_cloud_base_'+user.id)||'null'); } catch(e) {}
          if(lastBase && validate(lastBase)) combined=merge(lastBase,local,remote.data);
          else combined=mergeInitial(local,remote.data);
        }
      }
      api.apply(combined);
      loading=false; showApp(); authMessage('');
      if(revision===0 || !equal(api.snapshot(),remote.data)) {cachePending(api.snapshot());schedule(100);}
      else {clearPending();try{localStorage.setItem('mt_cloud_base_'+user.id,JSON.stringify(remote.data));}catch(e){}status('✓ متصل بالسحابة');}
      if(polling)clearInterval(polling);
      polling=setInterval(()=>void refresh(),12000);
    } catch(e) {
      if(epoch!==syncEpoch)return;
      loading=false;user=null; hideApp();
      authMessage('تعذّر تحميل البيانات بأمان: '+(e.message||'تحقق من الاتصال وحاول مجدداً.'));
      $('loginButton').disabled=false;
    }
  }
  async function logout() {
    if(!client || !user)return;
    $('logoutBtn').disabled=true;
    await flush();
    if(dirty || busy) {alert('هناك تغييرات لم تتم مزامنتها. تحقق من الإنترنت وحاول مجدداً قبل تسجيل الخروج.');$('logoutBtn').disabled=false;return;}
    try {
      const {error}=await client.auth.signOut();if(error)throw error;
      syncEpoch++; user=null;revision=0;baseline=blank();dirty=false;clearTimeout(timer);
      if(polling)clearInterval(polling);
      api.apply(blank());clearPending();hideApp();$('loginForm').reset();authMessage('تم تسجيل الخروج.');
    } catch(e) {alert('تعذّر تسجيل الخروج: '+(e.message||''));}
    $('logoutBtn').disabled=false;
  }
  window.mahamSyncOnSave=() => {
    if(!user || loading)return;
    schedule();
  };
  $('logoutBtn').addEventListener('click',()=>void logout());
  $('retrySyncBtn').addEventListener('click',()=>{if(user) {if(dirty)void flush();else void refresh();}});
  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();if(!client)return;
    const email=$('loginEmail').value.trim(),password=$('loginPassword').value;
    if(!email||!password)return;
    $('loginButton').disabled=true;authMessage('جارٍ تسجيل الدخول…');
    try {
      const {data,error}=await client.auth.signInWithPassword({email,password});
      if(error)throw error;
      await activate(data.session);
      $('loginPassword').value='';
    } catch(err) {authMessage('تعذّر تسجيل الدخول: '+(err.message||'تحقق من البريد وكلمة المرور.'));}
    finally {$('loginButton').disabled=false;}
  });
  async function init() {
    if(!api || !window.supabase?.createClient) {
      authMessage('تعذّر تحميل خدمة تسجيل الدخول. تحقق من الإنترنت ثم حدّث الصفحة.');return;
    }
    try {
      client=window.supabase.createClient(PROJECT_URL,PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      client.auth.onAuthStateChange((event,session)=>{
        if(event==='SIGNED_OUT') {syncEpoch++;user=null;api.apply(blank());hideApp();if(polling)clearInterval(polling);}
        else if((event==='SIGNED_IN'||event==='TOKEN_REFRESHED') && session?.user && !user)
          setTimeout(()=>void activate(session),0);
      });
      const {data,error}=await client.auth.getSession();if(error)throw error;
      if(data.session)await activate(data.session);
      else authMessage('ادخل بحسابك الخاص للمتابعة.');
    } catch(e) {authMessage('فشل الاتصال: '+(e.message||'حاول تحديث الصفحة.'));}
  }
  void init();
})();
