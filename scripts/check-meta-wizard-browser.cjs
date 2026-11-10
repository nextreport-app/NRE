// Browser interaction check with synthetic provider responses. Requires Playwright and Chromium.
const {createRequire}=require('node:module');const r=createRequire(process.cwd()+'/package.json');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const output=path.join(os.tmpdir(),'nre-meta-api-workflow');fs.mkdirSync(output,{recursive:true});
(async()=>{
const fixture=`import React from 'react';import{createRoot}from'react-dom/client';import{useReportUploadWizard}from'./src/components/report-upload-wizard/use-report-upload-wizard';import{WizardImportStep}from'./src/components/report-upload-wizard/steps/import-step';import{WizardCampaignsStep}from'./src/components/report-upload-wizard/steps/campaigns-step';import{WizardMetricsStep}from'./src/components/report-upload-wizard/steps/metrics-step';function App(){const w=useReportUploadWizard({clientId:'example',clientName:'Example',clientTimezone:'America/New_York',currencySymbol:'$',hasGoogleDriveConnected:false,initialLastDriveFolderId:null,initialLastDriveFolderName:null,initialPreviousMonthDataUpdatedAt:'2026-11-04T12:00:00Z',hasPreviousMonthData:true,clientTemplate:'DARK',metaConfigured:true,metaConnected:true,metaConnectedName:'Test User',apiSyncEnabled:true});window.w=w;return <><WizardImportStep/><WizardCampaignsStep/><WizardMetricsStep/><output id="step">{w.step}</output></>;}createRoot(document.getElementById('root')).render(<App/>);`;
const mocks=[[/next\/navigation$/,`const params=new URLSearchParams();const router={push:()=>{},replace:()=>{}};export const useRouter=()=>router;export const useSearchParams=()=>params;`],[/\/toast$/,`const toast={showToast:()=>{}};export const useToast=()=>toast;`],[/wizard-context$/,`export const useWizardContext=()=>window.w;`],[/site-theme-provider$/,`export const useSiteTheme=()=>({locale:'en'});`],[/wizard-step-help$/,`export const WizardStepHelp=()=>null;`]];
await r('esbuild').build({stdin:{contents:fixture,loader:'tsx',resolveDir:process.cwd()},bundle:true,define:{'process.env':'{}'},platform:'browser',jsx:'automatic',outfile:path.join(output,'browser.js'),plugins:[{name:'mock',setup(build){for(const[filter]of mocks)build.onResolve({filter},args=>({path:args.path,namespace:'mock'}));build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks.find(([filter])=>filter.test(args.path))[1],loader:'tsx'}));}}]});
const css=await r('postcss')([r('@tailwindcss/postcss')({base:process.cwd()})]).process(fs.readFileSync('src/app/globals.css','utf8'),{from:process.cwd()+'/src/app/globals.css'});const browser=await r('playwright').chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),args:['--no-sandbox']});
for(const width of [390,1440])for(const kind of ['WEEKLY','HISTORICAL','COMPARISON','DAY_BREAKDOWN']){
 const page=await browser.newPage({viewport:{width,height:950}});page.setDefaultTimeout(10000);const errors=[];let sent,analyzed,releaseAnalysis,releaseManualAnalysis;let analyzeCount=0;let savedAdSets=[];let draftRequests=0;const manualAnalysisGate=new Promise(resolve=>{releaseManualAnalysis=resolve;});const analysisGate=new Promise(resolve=>{releaseAnalysis=resolve;});page.on('pageerror',e=>{errors.push(e.message);console.log('PAGEERROR',e.message)});
 await page.clock.install({time:new Date('2026-11-05T12:00:00Z')});
 await page.addInitScript(()=>{sessionStorage.setItem('nre.wizardDraft.example',JSON.stringify({version:1,savedAt:new Date().toISOString(),step:3,uploadSessionId:'expired-upload',platform:'META',reportType:'WEEKLY'}));if(!localStorage.getItem('nre.wizardPrefs.example'))localStorage.setItem('nre.wizardPrefs.example',JSON.stringify({dataSourceMode:'api',reportType:'WEEKLY',dateMode:'last7',includePreviousMonthComparison:true}));});
 await page.route('https://wizard.test/**',async route=>{const req=route.request(),url=new URL(req.url());
 if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:`<html lang="en" data-site-theme="dark"><head><style>${css.css}</style><style>body{background:#101217;padding:16px}#root{max-width:960px;margin:auto}</style></head><body><div class="nre-app-shell" id="root"></div><script>${fs.readFileSync(path.join(output,'browser.js'),'utf8').replaceAll('</script','<\\/script')}</script></body></html>`});
 if(url.pathname==='/api/meta/adaccounts')return route.fulfill({json:{accounts:[{id:'act_123',accountId:'123',name:'Example Ads',currency:'USD',timezone:'America/Los_Angeles'},{id:'act_456',accountId:'456',name:'Another Agency Account',currency:'USD',timezone:'America/Los_Angeles'}]}});
 if(req.method()==='PATCH')return route.fulfill({json:{client:{timezone:JSON.parse(req.postData()).timezone}}});
 if(url.pathname.endsWith('/wizard-draft')){draftRequests++;return route.fulfill({json:{draft:{version:1,savedAt:new Date().toISOString(),step:3,uploadSessionId:'expired-upload',platform:'META',reportType:'WEEKLY'}}});}
 if(url.pathname.endsWith('/selection')){const body=req.postDataJSON();if(Array.isArray(body.selectedAdSets))savedAdSets=body.selectedAdSets;return route.fulfill({json:{ok:true}});}
 if(url.pathname.endsWith('/sync-api')){sent=req.postDataJSON();return route.fulfill({json:{ok:true,csvText:'Campaign name,Day,Amount spent (USD)\nTest leads,2026-11-04,100',rowCount:1,metaSyncDiagnostics:{mappedResultsSum:157,rowCount:81,sampleActionTypes:['offsite_conversion.fb_pixel_schedule']},hasPreviousMonthData:false,metaAdAccountId:'act_123'}});}
 if(url.pathname.endsWith('/analyze')){analyzed=req.postData();await (++analyzeCount===1?analysisGate:manualAnalysisGate);return route.fulfill({json:{valid:true,uploadSessionId:'fixture-session',campaigns:['Test leads','Small spend','Zero spend'],selectedCampaigns:['Test leads','Small spend'],campaignSpend:{'Test leads':100,'Small spend':4,'Zero spend':0},zeroSpendCampaigns:['Zero spend'],selectedAdSets:savedAdSets,newAdSetKeys:analyzeCount>1?['Test leads\0New audience']:[],adSetGroups:[{campaignName:'Test leads',adSetNames:analyzeCount>1?['Audience A','Audience B','New audience']:['Audience A','Audience B']},{campaignName:'Small spend',adSetNames:['Only audience']},{campaignName:'Zero spend',adSetNames:['Previously active A','Previously active B']}],lowSpendCampaigns:[],headers:['Campaign name','Day','Amount spent (USD)'],dateBounds:{minIso:'2026-08-07',maxIso:'2026-11-04'},weeklyOptions:{last7:{startIso:'2026-10-29',endIso:'2026-11-04'},prev7:{startIso:'2026-10-22',endIso:'2026-10-28'},last14:{startIso:'2026-10-22',endIso:'2026-11-04'}},dateSelection:{mode:'custom',customStart:'2026-08-07',customEnd:'2026-11-04'}}});}
 if(url.pathname.endsWith('/upload-session-context')){const request=req.postDataJSON();const recent=request.dateSelection?.mode==='last7';return route.fulfill({json:{ok:true,campaigns:['Test leads','Small spend','Zero spend'],campaignSpend:{'Test leads':recent?200:100,'Small spend':recent?5:4,'Zero spend':0},selectedCampaigns:['Test leads','Small spend'],zeroSpendCampaigns:['Zero spend'],campaignSpendLabel:'Reporting-period spend',headers:['Campaign name','Day','Amount spent (USD)'],adSetGroups:[]}});}
 if(url.pathname.endsWith('/metrics'))return route.fulfill({json:{campaignObjectives:{},perCampaignSelection:{},perCampaignAvailable:{}}});
 return route.fulfill({json:{client:{monthlyBudget:null},ok:true}});
 });
 await page.goto('https://wizard.test/');
 await page.getByRole('button',{name:'Change import method',exact:true}).waitFor();
 await page.waitForFunction(()=>sessionStorage.getItem('nre.wizardDraft.example')===null);
 if(await page.evaluate(()=>window.w.step!==1 || window.w.uploadSessionId!==null || 'resumeSavedWizardDraft' in window.w))throw Error('unfinished setup was restored');

 if(await page.getByText('Manual export from Ads Manager',{exact:true}).count())throw Error('returning API user sees expanded CSV option');
 await page.getByRole('button',{name:'Select an ad account',exact:true}).click();
 const search=page.getByRole('combobox',{name:'Search ad accounts'});
 await search.fill('does not exist');await page.getByRole('status').filter({hasText:'No ad accounts match your search.'}).waitFor();
 await search.fill('another');if(await page.getByRole('option').count()!==1)throw Error('name filter failed');
 await search.fill('123');if(await page.getByRole('option').count()!==1)throw Error('ID filter failed');
 if(/USD|America\//.test(await page.getByRole('listbox',{name:'Ad accounts'}).innerText()))throw Error('currency or timezone leaked into account choices');
 await search.press('Enter');
 await page.getByRole('button',{name:'Ad account: Example Ads (123)',exact:true}).waitFor();
 await page.getByRole('button',{name:'Ad account: Example Ads (123)',exact:true}).click();
 const reopenedSearch=page.getByRole('combobox',{name:'Search ad accounts'});
 await reopenedSearch.press('ArrowDown');
 const activeId=await reopenedSearch.getAttribute('aria-activedescendant');
 if(!activeId || !(await page.locator(`[id="${activeId}"]`).innerText()).includes('Another Agency Account'))throw Error('keyboard account navigation failed');
 if(kind==='WEEKLY')await page.screenshot({path:path.join(output,`account-picker-${width}.png`),fullPage:false});
 await reopenedSearch.press('Escape');
 if(await page.getByRole('dialog',{name:'Choose ad account'}).count())throw Error('Escape did not close picker');
 await page.getByRole('button',{name:'Use America/Los_Angeles for this client'}).click();
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
 if(kind==='HISTORICAL'){
  await page.waitForFunction(()=>window.w.customStart==='2026-10-01' && window.w.customEnd==='2026-10-31');
  if(await page.getByRole('button',{name:'From month',exact:true}).count())throw Error('preset shows unnecessary calendars');
  await page.getByRole('button',{name:'Custom range',exact:true}).click();
  await page.getByRole('button',{name:'From month',exact:true}).click();
  await page.getByRole('button',{name:'August 2026',exact:true}).click();
  await page.getByRole('button',{name:'To month',exact:true}).click();
  if(!(await page.getByRole('button',{name:'December 2026',exact:true}).isDisabled()))throw Error('future month is selectable');
  await page.getByRole('button',{name:'November 2026',exact:true}).click();
  await page.waitForFunction(()=>window.w.customStart==='2026-08-01' && window.w.customEnd==='2026-11-04' && window.w.historicalMonthCount===4);
  const summary=page.locator('[aria-label="Selected reporting months"]');
  if(!(await summary.innerText()).includes('3 complete months + November to date'))throw Error('partial month is not explicit');
  if(await summary.locator('ul').isVisible())throw Error('month breakdown is not collapsed');
  await summary.locator('summary').click();
  if(await summary.getByRole('listitem').count()!==4)throw Error('month breakdown has incorrect count');
  const boxes=await summary.getByRole('listitem').evaluateAll(items=>items.map(item=>({x:item.getBoundingClientRect().x,y:item.getBoundingClientRect().y})));
  if(boxes.some((box,index)=>index>0 && (box.x!==boxes[0].x || box.y<=boxes[index-1].y)))throw Error('month breakdown is not vertical');
  await page.getByRole('button',{name:'From month',exact:true}).click();
  await page.getByRole('button',{name:'Previous year',exact:true}).click();
  await page.getByRole('button',{name:'August 2025',exact:true}).click();
  await page.waitForFunction(()=>window.w.historicalMonthCount===12 && window.w.customEnd==='2026-07-31');
  await page.getByRole('button',{name:'To month',exact:true}).click();
  await page.getByRole('button',{name:'November 2026',exact:true}).click();
  await page.waitForFunction(()=>window.w.historicalMonthCount===12 && window.w.customStart==='2025-12-01');
  await page.getByRole('button',{name:'Last 3 complete months',exact:true}).click();
  await page.waitForFunction(()=>window.w.customStart==='2026-08-01' && window.w.customEnd==='2026-10-31' && window.w.historicalMonthCount===3);
  if(await page.getByRole('button',{name:'From month',exact:true}).count())throw Error('preset did not hide custom calendars');
  if((await page.locator('body').innerText()).includes('Meta data needed:'))throw Error('redundant monthly fetch copy remains');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth))throw Error('monthly UI overflows viewport');
  await page.screenshot({path:path.join(output,`monthly-presets-${width}.png`),fullPage:true});
 }

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
 await page.getByRole('button',{name:'Analyze campaign data',exact:true}).click();
 await page.waitForFunction(()=>window.w.analyzeStatus==='loading' && !!window.w.mtdFile && !!window.w.metaSyncDiagnostics);
 const progress=page.getByRole('button',{name:'Syncing & analyzing…',exact:true});
 if(!(await progress.isDisabled()))throw Error('sync-to-analysis transition enabled duplicate imports');
 if(!(await page.getByRole('button',{name:'Change import method',exact:true}).isDisabled()))throw Error('source switch enabled while analysis pending');
 if(/Advanced: API sync diagnostics|API sync complete|Download API sync CSV|Mapped Results total|Sample actions\[\]/.test(await page.locator('body').innerText()))throw Error('support diagnostics flashed during analysis');
 releaseAnalysis();await page.waitForFunction(()=>window.w.step===2);
 const after=await page.evaluate(()=>({type:window.w.reportType,mode:window.w.dateMode,start:window.w.customStart,end:window.w.customEnd}));
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('analysis replaced selection '+JSON.stringify({before,after}));
 if('importRange' in sent)throw Error('independent source window still sent');
 if(sent.reportType!==kind)throw Error('wrong report '+JSON.stringify(sent));
 if(kind==='WEEKLY'&&(sent.dateSelection.mode!=='custom'||sent.dateSelection.customStart!=='2026-10-01'||sent.dateSelection.customEnd!=='2026-10-07'))throw Error('API lost selected custom week '+JSON.stringify(sent));
 if(!analyzed.includes(kind))throw Error('report not sent to analyze');
 await page.waitForFunction(()=>!window.w.campaignSpendLoading);
 if(!(await page.getByLabel('Small spend',{exact:true}).isChecked()))throw Error('positive low spend defaulted unchecked');
 if(await page.getByText('Last 30 days spend detected',{exact:false}).count())throw Error('obsolete spend warning still visible');
 const campaignText=await page.locator('body').innerText();
 for(const text of ['Optional ad-set slides','Campaign totals already include all ad sets','ad sets selected for separate slides','Reporting-period spend','Campaigns with no spend in this reporting period','then continue.'])if(campaignText.includes(text))throw Error('removed campaign copy remains: '+text);
 if(await page.evaluate(()=>window.w.selectedAdSets.size)!==0)throw Error('fresh import selected optional ad-set slides');
 if(['COMPARISON','DAY_BREAKDOWN'].includes(kind) && await page.getByRole('button',{name:/\d+ ad sets?[ ▲▼]/}).count())throw Error('report type offers unsupported ad-set slides');
 if(kind==='WEEKLY'){
  const parent=page.getByLabel('Test leads',{exact:true}).locator('..').locator('..');
  await parent.getByRole('button',{name:/2 ad sets/}).click();
  if(await parent.getByRole('checkbox',{name:'Audience A',exact:true}).isChecked())throw Error('multi-ad-set default is checked');
  await parent.getByRole('button',{name:'Include all ad-set slides',exact:true}).click();
  await page.waitForFunction(()=>window.w.selectedAdSets.size===2);
  await parent.getByRole('button',{name:'Exclude all',exact:true}).click();
  await page.waitForFunction(()=>window.w.selectedAdSets.size===0);
  await parent.getByRole('checkbox',{name:'Audience A',exact:true}).check();
  await page.getByLabel('Test leads',{exact:true}).uncheck();
  await page.getByLabel('Test leads',{exact:true}).check();
  await page.waitForFunction(()=>window.w.selectedAdSets.has('Test leads\0Audience A'));
  await page.screenshot({path:path.join(output,`optional-ad-sets-${width}.png`),fullPage:true});
  await page.getByLabel('Small spend',{exact:true}).uncheck();
  const zeroToggle=page.getByRole('button',{name:/Zero-spend campaigns/});
  if(!(await zeroToggle.innerText()).includes('0 included · Expand to review'))throw Error('collapsed zero-spend label incorrect');
  await zeroToggle.click();
  if((await zeroToggle.innerText()).includes('Expand to review') || (await zeroToggle.innerText()).includes('Hide campaigns'))throw Error('expanded zero-spend label has extra wording');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('expanded zero-spend rows overflow the viewport');
  await page.getByLabel('Zero spend',{exact:true}).check();
  await page.evaluate(()=>window.w.setDateMode('last7'));
  await page.waitForFunction(()=>!window.w.campaignSpendLoading && window.w.campaignSpend['Test leads']===200);
  if(await page.getByLabel('Small spend',{exact:true}).isChecked())throw Error('period refresh erased explicit exclusion');
  if(!(await page.getByLabel('Zero spend',{exact:true}).isChecked()))throw Error('period refresh erased explicit zero inclusion');
 }

 await page.getByRole('button',{name:'Continue to metrics',exact:true}).click();await page.waitForFunction(()=>window.w.step===3);
 await page.getByRole('button',{name:'Continue to generate',exact:true}).click();await page.waitForFunction(()=>window.w.step===4);
 if(errors.length)throw Error(errors.join('\n'));
 await page.evaluate(() => window.w.setStep(1));
 await page.getByRole('button',{name:'Change import method',exact:true}).click();
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
 const manualCsv='Campaign name,Ad set name,Day,Amount spent (USD),Results,Result type,Reach,Impressions\n'+Array.from({length:157},(_,i)=>'Test leads,Main,'+new Date(Date.UTC(2026,5,1+i)).toISOString().slice(0,10)+',10,2,Leads (form),100,1000').join('\n');
 await page.locator('input[type=file]').first().setInputFiles({name:'manual.csv',mimeType:'text/csv',buffer:Buffer.from(manualCsv)});
 await page.getByRole('button',{name:'Analyze campaign data',exact:true}).click();
 await page.waitForFunction(()=>window.w.analyzeStatus==='loading');
 if(!(await page.getByRole('button',{name:'Change import method',exact:true}).isDisabled()))throw Error('CSV source switch enabled during analysis');
 await page.evaluate(()=>{const transfer=new DataTransfer();transfer.items.add(new File(['replacement'],'replacement.csv',{type:'text/csv'}));document.querySelector('input[type=file]').closest('label').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));});
 if(await page.evaluate(()=>window.w.mtdFile.name)!=='manual.csv')throw Error('drop replaced CSV during analysis');
 releaseManualAnalysis();await page.waitForFunction(()=>window.w.step===2);
 if(kind==='WEEKLY'){
  await page.waitForFunction(()=>window.w.selectedAdSets.has('Test leads\0Audience A'));
  if(await page.evaluate(()=>window.w.selectedAdSets.size)!==1)throw Error('CSV import did not restore exactly the saved opt-in');
  if(await page.evaluate(()=>window.w.selectedAdSets.has('Test leads\0New audience')))throw Error('new audience defaulted selected');
  const parent=page.getByLabel('Test leads',{exact:true}).locator('..').locator('..');
  await parent.getByRole('button',{name:/3 ad sets/}).click();
  if(!(await parent.innerText()).includes('New'))throw Error('new ad set badge missing');
  await parent.getByRole('button',{name:'Exclude all',exact:true}).click();
  await page.waitForFunction(()=>window.w.selectedAdSets.size===0);
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('ad-set options overflow viewport');
 }

 await page.getByRole('button',{name:'Continue to metrics',exact:true}).click();await page.waitForFunction(()=>window.w.step===3);
 await page.getByRole('button',{name:'Continue to generate',exact:true}).click();await page.waitForFunction(()=>window.w.step===4);
 if(kind==='HISTORICAL'){
  await page.evaluate(()=>window.w.setStep(1));
  await page.getByRole('button',{name:'Previous month',exact:true}).click();
  await page.waitForFunction(()=>window.w.reportType==='MONTHLY' && window.w.historicalMonthCount===1 && window.w.customStart==='2026-10-01' && window.w.customEnd==='2026-10-31');
  if(await page.getByRole('button',{name:'From month',exact:true}).count())throw Error('CSV previous-month preset shows calendars');
  await page.getByRole('button',{name:'This month so far',exact:true}).click();
  await page.waitForFunction(()=>window.w.reportType==='MONTHLY' && window.w.customStart==='2026-11-01' && window.w.customEnd==='2026-11-04');
  await page.getByRole('button',{name:'Last 3 complete months',exact:true}).click();
  await page.waitForFunction(()=>window.w.reportType==='HISTORICAL' && window.w.historicalMonthCount===3 && window.w.customStart==='2026-08-01');
 }
 await page.reload();await page.getByRole('button',{name:'Change import method',exact:true}).waitFor();
 if(await page.evaluate(()=>window.w.dataSourceMode)!=='csv')throw Error('CSV import preference not remembered after reload');
 if(draftRequests!==0)throw Error('wizard still reads or writes unfinished setups');
 if(await page.evaluate(()=>window.w.step!==1 || window.w.uploadSessionId!==null))throw Error('reload did not start a fresh import');
 if(await page.getByText('Connected as',{exact:false}).count())throw Error('CSV user still sees API connection form');
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS',width,kind,{before,request:sent,sourceReset:'PASS'});await page.close();
}
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
