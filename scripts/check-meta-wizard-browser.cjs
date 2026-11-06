// Browser interaction check with synthetic provider responses. Requires Playwright and Chromium.
const {createRequire}=require('node:module');const r=createRequire(process.cwd()+'/package.json');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const output=path.join(os.tmpdir(),'nre-meta-api-workflow');fs.mkdirSync(output,{recursive:true});
(async()=>{
const fixture=`import React from 'react';import{createRoot}from'react-dom/client';import{useReportUploadWizard}from'./src/components/report-upload-wizard/use-report-upload-wizard';import{WizardImportStep}from'./src/components/report-upload-wizard/steps/import-step';import{WizardCampaignsStep}from'./src/components/report-upload-wizard/steps/campaigns-step';function App(){const w=useReportUploadWizard({clientId:'example',clientName:'Example',clientTimezone:'America/New_York',currencySymbol:'$',hasGoogleDriveConnected:false,initialLastDriveFolderId:null,initialLastDriveFolderName:null,initialPreviousMonthDataUpdatedAt:'2026-11-04T12:00:00Z',hasPreviousMonthData:true,clientTemplate:'DARK',metaConfigured:true,metaConnected:true,metaConnectedName:'Test User',apiSyncEnabled:true});window.w=w;return <><WizardImportStep/><WizardCampaignsStep/><output id="step">{w.step}</output></>;}createRoot(document.getElementById('root')).render(<App/>);`;
const mocks=[[/next\/navigation$/,`const params=new URLSearchParams();const router={push:()=>{},replace:()=>{}};export const useRouter=()=>router;export const useSearchParams=()=>params;`],[/\/toast$/,`const toast={showToast:()=>{}};export const useToast=()=>toast;`],[/wizard-context$/,`export const useWizardContext=()=>window.w;`],[/site-theme-provider$/,`export const useSiteTheme=()=>({locale:'en'});`],[/wizard-step-help$/,`export const WizardStepHelp=()=>null;`],[/wizard-sticky-footer$/,`export const WizardStickyFooter=()=>null;`]];
await r('esbuild').build({stdin:{contents:fixture,loader:'tsx',resolveDir:process.cwd()},bundle:true,define:{'process.env':'{}'},platform:'browser',jsx:'automatic',outfile:path.join(output,'browser.js'),plugins:[{name:'mock',setup(build){for(const[filter]of mocks)build.onResolve({filter},args=>({path:args.path,namespace:'mock'}));build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks.find(([filter])=>filter.test(args.path))[1],loader:'tsx'}));}}]});
const css=await r('postcss')([r('@tailwindcss/postcss')({base:process.cwd()})]).process(fs.readFileSync('src/app/globals.css','utf8'),{from:process.cwd()+'/src/app/globals.css'});const browser=await r('playwright').chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),args:['--no-sandbox']});
for(const width of [390,1440])for(const kind of ['WEEKLY','HISTORICAL','COMPARISON','DAY_BREAKDOWN']){
 const page=await browser.newPage({viewport:{width,height:950}});page.setDefaultTimeout(10000);const errors=[];let sent,analyzed;page.on('pageerror',e=>{errors.push(e.message);console.log('PAGEERROR',e.message)});
 await page.clock.install({time:new Date('2026-11-05T12:00:00Z')});
 await page.addInitScript(()=>localStorage.setItem('nre.wizardPrefs.example',JSON.stringify({dataSourceMode:'api',reportType:'WEEKLY',dateMode:'last7',includePreviousMonthComparison:true})));
 await page.route('https://wizard.test/**',async route=>{const req=route.request(),url=new URL(req.url());
 if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:`<html lang="en" data-site-theme="dark"><head><style>${css.css}</style><style>body{background:#101217;padding:16px}#root{max-width:960px;margin:auto}</style></head><body><div class="nre-app-shell" id="root"></div><script>${fs.readFileSync(path.join(output,'browser.js'),'utf8').replaceAll('</script','<\\/script')}</script></body></html>`});
 if(url.pathname==='/api/meta/adaccounts')return route.fulfill({json:{accounts:[{id:'act_123',name:'Example Ads',currency:'USD',timezone:'America/Los_Angeles'}]}});
 if(req.method()==='PATCH')return route.fulfill({json:{client:{timezone:JSON.parse(req.postData()).timezone}}});
 if(url.pathname.endsWith('/wizard-draft'))return route.fulfill({json:{draft:null}});
 if(url.pathname.endsWith('/sync-api')){sent=req.postDataJSON();return route.fulfill({json:{ok:true,csvText:'Campaign name,Day,Amount spent (USD)\nTest leads,2026-11-04,100',rowCount:1,hasPreviousMonthData:false,metaAdAccountId:'act_123'}});}
 if(url.pathname.endsWith('/analyze')){analyzed=req.postData();return route.fulfill({json:{valid:true,campaigns:['Test leads'],selectedCampaigns:['Test leads'],campaignSpend:{'Test leads':100},lowSpendCampaigns:[],headers:['Campaign name','Day','Amount spent (USD)'],dateBounds:{minIso:'2026-08-07',maxIso:'2026-11-04'},weeklyOptions:{last7:{startIso:'2026-10-29',endIso:'2026-11-04'},prev7:{startIso:'2026-10-22',endIso:'2026-10-28'},last14:{startIso:'2026-10-22',endIso:'2026-11-04'}},dateSelection:{mode:'custom',customStart:'2026-08-07',customEnd:'2026-11-04'}}});}
 if(url.pathname.endsWith('/metrics'))return route.fulfill({json:{campaignObjectives:{},perCampaignSelection:{},perCampaignAvailable:{}}});
 return route.fulfill({json:{client:{monthlyBudget:null},ok:true}});
 });
 await page.goto('https://wizard.test/');await page.getByRole('button',{name:'Use America/Los_Angeles for this client'}).click();
 await page.waitForFunction(()=>window.w.clientTimezone==='America/Los_Angeles');
 if(await page.evaluate(()=>window.w.includePreviousMonthComparison || window.w.previousMonthHasFile))throw Error('manual previous-month settings leaked into API');
 if(await page.getByText('Previous-month totals are fetched separately when available. You can include them in the report after syncing.',{exact:true}).count())throw Error('removed API previous-month copy still visible');

 if(await page.getByRole('heading',{name:'Meta will fetch',exact:true}).count())throw Error('removed fetch section still visible');
 if(kind==='WEEKLY'){
  const weekly=page.locator('section').filter({has:page.getByRole('heading',{name:'Weekly report period',exact:true})});
  if(await weekly.getByRole('button',{name:'Previous 7 days',exact:true}).count()||await weekly.getByRole('button',{name:'Last 14 days',exact:true}).count())throw Error('removed weekly presets still visible');
  const text=await weekly.innerText();
  if(text.includes('America/')||text.includes('Choose the reporting period')||text.includes('automatically fetches'))throw Error('extra weekly copy still visible');
  await weekly.getByRole('button',{name:'Custom date range',exact:true}).click();
  await weekly.getByRole('button',{name:'Start date',exact:true}).click();
  await page.getByRole('button',{name:'2026-10-01',exact:true}).click();
  await weekly.getByRole('button',{name:'End date',exact:true}).click();
  await page.getByRole('button',{name:'Previous month',exact:true}).click();
  await page.getByRole('button',{name:'2026-10-07',exact:true}).click();
 }

 if(kind!=='WEEKLY'){
 if(!await page.getByRole('group',{name:'Choose report type',exact:true}).isVisible())await page.getByRole('button',{name:'Change report type',exact:true}).click();
 const label=kind==='HISTORICAL'?'Monthly report':kind==='COMPARISON'?'Compare two periods':'Daily report';
 await page.getByRole('button').filter({has:page.getByText(label,{exact:true})}).first().click();
 if(kind==='HISTORICAL')await page.getByRole('button',{name:'Last 3 complete months',exact:true}).click();
 if(kind==='COMPARISON'){if(await page.getByRole('heading',{name:'Which periods would you like to compare?',exact:true}).count()!==1)throw Error('duplicate comparison controls');await page.getByRole('button',{name:'Last 30 days vs previous 30 days',exact:true}).click();}
 if(kind==='DAY_BREAKDOWN'){
  await page.getByRole('button',{name:'Last 14 days',exact:true}).click();
  await page.getByRole('button',{name:'Custom date range',exact:true}).click();
  await page.getByRole('button',{name:'Start date',exact:true}).click();
  await page.getByRole('button',{name:'2026-10-23',exact:true}).click();
 }
 }
 if(await page.getByRole('heading',{name:'Data to fetch from Meta',exact:true}).count())throw Error('duplicate date selection still visible');
 if(await page.getByRole('button',{name:'Match report dates',exact:true}).count()||await page.getByRole('button',{name:/Last 6/}).count())throw Error('removed fetch options still visible');
 if(kind==='COMPARISON'){
  await page.getByRole('button',{name:'Custom date range',exact:true}).click();
  const periodA=page.locator('div.space-y-2').filter({has:page.getByText('Period A',{exact:true})});
  await periodA.getByRole('button',{name:'Start date',exact:true}).click();
  await page.getByRole('button',{name:'2026-10-07',exact:true}).click();
 }
 const before=await page.evaluate(()=>({type:window.w.reportType,mode:window.w.dateMode,start:window.w.customStart,end:window.w.customEnd}));
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('overflow '+width+' '+kind);
 if(width===390)await page.screenshot({path:path.join(output,`${kind}.png`),fullPage:true});
 await page.getByRole('button',{name:'Analyze campaign data',exact:true}).click();await page.waitForFunction(()=>window.w.step===2);
 const after=await page.evaluate(()=>({type:window.w.reportType,mode:window.w.dateMode,start:window.w.customStart,end:window.w.customEnd}));
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('analysis replaced selection '+JSON.stringify({before,after}));
 if('importRange' in sent)throw Error('independent source window still sent');
 if(sent.reportType!==kind)throw Error('wrong report '+JSON.stringify(sent));
 if(kind==='WEEKLY'&&(sent.dateSelection.mode!=='custom'||sent.dateSelection.customStart!=='2026-10-01'||sent.dateSelection.customEnd!=='2026-10-07'))throw Error('API lost selected custom week '+JSON.stringify(sent));
 if(!analyzed.includes(kind))throw Error('report not sent to analyze');
 if(errors.length)throw Error(errors.join('\n'));
 await page.evaluate(() => window.w.setStep(1));
 await page.getByRole('button').filter({has:page.getByText('Manual CSV upload',{exact:true})}).click();
 if(await page.evaluate(()=>window.w.campaigns.length)!==0 || await page.evaluate(()=>window.w.mtdFile)!==null)throw Error('stale source data survived source change');
 if(!(await page.evaluate(()=>window.w.previousMonthHasFile)) || !(await page.evaluate(()=>window.w.includePreviousMonthComparison)))throw Error('manual previous-month setup was lost after API sync');
 if(kind==='WEEKLY'){
  const weekly=page.locator('section').filter({has:page.getByRole('heading',{name:'Weekly report period',exact:true})});
  await weekly.getByRole('button',{name:'Last 7 days',exact:true}).click();
  if(await page.evaluate(()=>window.w.dateMode)!=='last7')throw Error('CSV last-seven preset failed');
  await weekly.getByRole('button',{name:'Custom date range',exact:true}).click();
  await weekly.getByRole('button',{name:'Start date',exact:true}).click();
  await page.getByRole('button',{name:'2026-10-02',exact:true}).click();
  if(await page.evaluate(()=>window.w.customStart)!=='2026-10-02')throw Error('CSV custom calendar failed');
  if((await weekly.innerText()).includes('America/'))throw Error('CSV weekly timezone still shown');
 }
 console.log('PASS',width,kind,{before,request:sent,sourceReset:'PASS'});await page.close();
}
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
