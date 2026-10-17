# مساحة مهامي — Maham Task Manager

تطبيق شخصي باللغة العربية لإدارة المهام والمشاريع والتقويم والملاحظات والدخل والمصروفات والأهداف المالية.

## التشغيل

الموقع منشور عبر GitHub Pages على:
https://hussamzahda-lang.github.io/Task-Manager/

- `index.html`: واجهة المهام والمال + شاشة تسجيل الدخول.
- `cloud.js`: ربط Supabase باستخدام المفتاح العام publishable فقط.
- قاعدة البيانات: جدول `maham_state` في Supabase مع Row Level Security، وكتابة مشروطة برقم الإصدار.
- عند أول تسجيل دخول تُستورد بيانات المتصفح المحلي وتُدمج مع البيانات السحابية، وتُحفظ السحابة بعد أي تعديل، مع تحديث دوري من الأجهزة الأخرى.
- يمكن تصدير JSON احتياطياً من واجهة التطبيق.

## إعداد أمني ضروري

1. أنشئ مستخدماً خاصاً في Supabase Authentication.
2. من Authentication > Providers > Email (أو قسم إعدادات التسجيل المكافئ)، عطّل **Allow new users to sign up** / التسجيل الذاتي، بعد إنشاء المستخدم.
3. أضف مصادقة متعددة العوامل إن كانت متاحة.
4. لا تضع كلمة مرور أو service_role/secret key داخل الكود.
5. تأكد من ظهور **✓ تمت المزامنة** قبل إغلاق التبويب؛ عند انقطاع الشبكة تُحفظ التعديلات محلياً مؤقتاً في نفس المتصفح.
6. عند الانتقال بين الأجهزة تجنّب تعديل نفس المدخلة في الجهازين بالتزامن؛ يتم دمج التعارضات بأفضل جهد ولكن قد يتطلب مراجعة بشرية.

## الخصوصية

الواجهة والكود مستضافان بشكل عام عبر GitHub Pages، ولكن الوصول للبيانات المخزنة على Supabase محكوم بتسجيل الدخول وRLS.
يمكن لأي زائر رؤية صفحة الدخول والشيفرة العامة؛ لا تعتبر الواجهة خاصة بحد ذاتها.
البيانات المحفوظة مسبقاً في المتصفح قد تبقى محلياً على جهاز المستخدم ولا تُنسخ إلى GitHub.


## Personal Finance v2

Finance remains inside the existing Arabic navigation, with the existing Supabase login,
`maham_state` JSON document, revision-checked `maham_save` RPC and user ownership RLS.
No new credentials, tables, or manual SQL setup are required. Lucy's login markup and asset
are unchanged. Reload all open tabs/devices after deployment before editing: old app versions
cannot preserve the new financeRows field when saving a whole document.

- `finance-core.js`: integer minor-unit calculations using BigInt; two decimals for USD/SYP,
  rates up to six decimals; half-away-from-zero conversion rounding per record.
- `finance.js`: accounts, confirmed/planned transactions, monthly recurring templates,
  atomic transfer records with source-currency fees, manual rate history, budgets, goals,
  dated contributions, CSV and monthly/annual reporting. All new data lives in financeRows.
- Legacy transactions migrate once into per-currency zero-opening-balance accounts. Their
  original values stay in the backup and are not assigned fabricated historical rates.
  Review imported account opening balances and supply actual historical rates where needed.
- Current balance estimates use the latest rate; historical reports use each saved rate.
  Missing-rate reports explicitly remain incomplete. Opening balances represent the balance
  before recorded transactions, not a second deposit of today's balance.
- Recurrence generates plans for the opened/selected month, clamping dates to month-end.
  Deterministic occurrence IDs and deletion tombstones prevent regeneration/duplicate merging.
  It does not run while closed, auto-confirm payments, or silently fill skipped months.
- Goals allocate existing funds and never create income or expenses. Use a transfer when
  physically moving funds to savings. Transfer fees alone are spending.
- Pending cloud saves are stored per authenticated user; on logout in-memory state is cleared.
  Concurrent edits to the same record still use the existing local-edit-wins merge behavior.
- CSV exports all transaction statuses within the selected date range and includes original
  amounts, currencies, saved rates, recipient amount/currency and fees. JSON backup includes
  financeRows and the rest of the workspace.

Validation: `node finance.test.cjs`. Covered exact arithmetic, transfers/fees, historical rates,
edits/deletion, planned exclusion, recurrence deduplication, three-way merge, savings balance
invariance, retained service sections and Lucy. Database RLS and ownership policies inspected;
a read under an unrelated authenticated UUID returned no records. Browser/mobile visual QA
and a real-user authenticated write round-trip were not performed in this environment.
