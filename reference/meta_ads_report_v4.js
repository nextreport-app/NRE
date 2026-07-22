/**
 * ============================================================================
 * META ADS REPORT GENERATOR — V4.1
 * ============================================================================
 * SLIDE ORDER:
 *   1. Cover
 *   2..N. Campaign-level summary slides (one per unique campaign name,
 *          showing combined totals of all ad sets in that campaign)
 *   N+1..M. Individual ad set slides (one per CSV row, grouped by campaign)
 *   Last-1. Period overview slide (10-column table, splits by objective type)
 *   Last.   Metric Abbreviation Guide (Legend)
 *
 * KEY BEHAVIOURS:
 * - Auto-detects column names — no hardcoding
 * - Auto-detects date format (Indian DD-MM-YY vs US MM-DD-YY)
 * - Never mixes results of different types (leads ≠ landing page views)
 * - Handles paused campaigns gracefully
 * - Groq primary AI, Gemini fallback
 * ============================================================================
 */

// ─────────────────────────── CONFIG ──────────────────────────────────────────
const TEMPLATE_FILE_ID      = '1rvswVUcNpfUC_Kpsnl9ZogLMCiyaRwyE0-JmWmerQ0Q';
const CSV_TAB               = 'Weekly CSV';
const PERIOD_TAB            = 'Period CSV';     // previous FULL month — paste ONCE at month start
const MTD_TAB               = 'MTD CSV';        // current month to date — paste every run
const MTD_DAILY_TAB         = 'MTD Daily CSV';  // OPTIONAL: single day-by-day download (Jul 1-13 daily) — auto-splits into Weekly + MTD
const BUDGETS_TAB           = 'Budgets';        // one cell: A1="Monthly Budget ($)", B1=number
const GROQ_API_KEY          = 'PASTE_YOUR_GROQ_KEY_HERE';
const GEMINI_API_KEY        = 'PASTE_YOUR_GEMINI_KEY_HERE';
const REPORT_TIMEZONE       = 'America/Chicago'; // change per client: 'Asia/Kolkata' | 'America/New_York' | 'Europe/London' | 'Australia/Sydney'
const CURRENCY_SYMBOL       = '$';               // change per client: '₹' | '$' | '£' | 'A$' | 'C$'
// ─────────────────────────────────────────────────────────────────────────────


// ============================================================================
// COLUMN AUTO-DETECTION
// ============================================================================

const COLUMN_KEYWORDS = {
  campaign_name: ['campaign name', 'campaign'],
  ad_set_name:   ['ad set name', 'adset name', 'ad group name', 'ad group'],
  result_type:   ['result type', 'objective', 'conversion type'],
  results:       ['results', 'conversions', 'leads', 'clicks total'],
  spend:         ['amount spent', 'spend', 'cost', 'spent'],
  reach:         ['reach'],
  impressions:   ['impressions'],
  ctr:           ['ctr', 'click-through rate', 'click through rate'],
  cpc:           ['cpc', 'cost per click', 'cost per link click'],
  cpr:           ['cost per result', 'cost per conversion', 'cost per lead', 'cpl', 'cpa'],
  link_clicks:   ['link clicks', 'clicks (all)', 'clicks (link)'],
  frequency:     ['frequency', 'ad frequency', 'avg. frequency'],
  date_start:    ['reporting starts', 'date start', 'start date', 'from date'],
  date_end:      ['reporting ends', 'date end', 'end date', 'to date'],
};

/**
 * OPTIONAL SINGLE-DOWNLOAD WORKFLOW
 * Instead of downloading Weekly CSV + MTD CSV separately, you can download
 * ONE day-by-day CSV covering the full month (e.g. Jul 1-13 with Daily breakdown)
 * and paste it into the "MTD Daily CSV" tab. This function auto-splits it:
 *   - weeklyRows: rows where date_end falls within the last 7 days
 *   - mtdRows:    ALL rows aggregated (the full month period)
 *
 * In Meta Ads Manager: Reporting → set date Jul 1-13 → Time Increment = Daily → Export
 */
function splitMTDDaily_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MTD_DAILY_TAB);
  if (!sheet) return null;

  const { rows } = readTabWithAutoMap_(MTD_DAILY_TAB);
  if (rows.length === 0) return null;

  // The "Reporting starts/ends" columns both hold the export date (same for all rows).
  // The actual date of each row is in the "Day" column (col C in this sheet).
  // We read it from row._raw directly since it may not map to a standard keyword.
  function getRowDate(row) {
    var raw = row._raw || {};
    // Try common names for the "day" column in Meta daily exports
    return raw['Day'] || raw['day'] || raw['Date'] || raw['date'] || row.date_start || '';
  }

  // Find latest date in dataset
  var latestTs = null;
  rows.forEach(function(row) {
    var d = parseDate_(getRowDate(row));
    if (!d) return;
    var ts = Date.UTC(d.year, d.month - 1, d.day);
    if (latestTs === null || ts > latestTs) latestTs = ts;
  });
  if (latestTs === null) return null;

  // ALWAYS cap at YESTERDAY — today's data is incomplete (day still running)
  // Even if the CSV contains today's rows, exclude them from weekly and MTD
  var todayStartTs = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00Z').getTime();
  var yesterdayTs  = todayStartTs - 24 * 60 * 60 * 1000;
  if (latestTs > yesterdayTs) {
    latestTs = yesterdayTs;
    Logger.log('Latest date capped at yesterday — today\'s incomplete data excluded.');
  }

  // Filter out today's rows so they don't appear in either weekly or MTD
  var validRows = rows.filter(function(row) {
    var d = parseDate_(getRowDate(row));
    if (!d) return false;
    var ts = Date.UTC(d.year, d.month - 1, d.day);
    return ts <= yesterdayTs;
  });
  if (validRows.length === 0) return null;

  var weekStartTs = latestTs - 6 * 24 * 60 * 60 * 1000; // 7 days ending yesterday

  // Aggregate daily rows into one per campaign+adset.
  // CRITICAL: Do NOT include result_type in the group key.
  // Meta exports empty result_type on days with 0 results, so the same ad set
  // would otherwise split into two groups — one with empty type (0-result days)
  // and one with "Leads (form)" (days with results). This corrupts all metrics.
  function aggregate(rowsToAgg) {
    var groups = {};
    rowsToAgg.forEach(function(row) {
      // Group by campaign + adset ONLY — never by result_type
      var key = [row.campaign_name, row.ad_set_name].join('|||');
      if (!groups[key]) {
        groups[key] = {
          campaign_name: row.campaign_name || '',
          ad_set_name:   row.ad_set_name   || '',
          result_type:   '',  // filled below from whichever rows have a non-empty value
          spend: 0, reach: 0, impressions: 0, results: 0, link_clicks: 0,
          ctrs: [], cpcs: [], freqs: [],
          earliest_date: '', latest_date: ''
        };
      }
      var g = groups[key];
      // Pick up result_type from rows that actually have one (non-empty)
      if (row.result_type && row.result_type.trim()) {
        g.result_type = row.result_type.trim();
      }
      g.spend       += parseCellNum_(row.spend);
      g.reach       += parseCellNum_(row.reach);
      g.impressions += parseCellNum_(row.impressions);
      g.results     += parseCellNum_(row.results);
      g.link_clicks += parseCellNum_(row.link_clicks || '0');
      var ctr  = parseCellNum_(row.ctr);
      var freq = parseCellNum_(row.frequency);
      var cpc_raw = parseCellNum_(row.cpc);
      if (ctr     > 0) g.ctrs.push(ctr);
      if (freq    > 0) g.freqs.push(freq);
      if (cpc_raw > 0) g.cpcs.push(cpc_raw);

      var rowDate = getRowDate(row);
      if (rowDate) {
        if (!g.earliest_date || rowDate < g.earliest_date) g.earliest_date = rowDate;
        if (!g.latest_date   || rowDate > g.latest_date)   g.latest_date   = rowDate;
      }
    });

    return Object.keys(groups).map(function(key) {
      var g   = groups[key];
      var ctr = g.ctrs.length  ? g.ctrs.reduce(function(a,b){return a+b;},0)  / g.ctrs.length  : 0;
      var frq = g.freqs.length ? g.freqs.reduce(function(a,b){return a+b;},0) / g.freqs.length : 0;
      // CPC: average the platform-calculated daily CPC values from CSV column 'CPC (all)'
      // This is more reliable than spend/link_clicks which gives 0 when link_clicks column is empty
      var cpc = g.cpcs.length > 0
        ? g.cpcs.reduce(function(a,b){return a+b;},0) / g.cpcs.length
        : (g.link_clicks > 0 ? g.spend / g.link_clicks : 0);

      var { resultLabel } = getResultLabels_(g.result_type);
      var cpr = 0;
      if (resultLabel === 'REACH') {
        cpr = g.reach > 0 ? (g.spend * 1000) / g.reach : 0;
      } else {
        cpr = g.results > 0 ? g.spend / g.results : 0;
      }

      // DATA-FIRST objective detection — never trust result_type column alone.
      // Priority: Purchases > Leads > LPV > Link Clicks > Reach
      // (Meta sometimes exports "Reach" as result_type for Traffic campaigns)
      var actualResultType = g.result_type;
      var actualResults    = g.results;
      var actualCpr        = cpr;

      // Only override if current detection looks suspicious
      if (resultLabel === 'REACH' && g.link_clicks > 0 &&
          Math.abs(g.results - g.reach) <= Math.max(g.reach * 0.03, 5)) {
        // Reach count = result count → Reach used as proxy for Traffic campaign
        actualResultType = 'Link click';
        actualResults    = g.link_clicks;
        actualCpr        = g.link_clicks > 0 ? g.spend / g.link_clicks : 0;
        Logger.log('Objective corrected: ' + g.campaign_name +
          ' result_type="' + g.result_type + '" → Link click (Reach-as-proxy detected)');
      } else if (resultLabel === 'RESULTS' && g.link_clicks > 0 && g.results === 0) {
        // No result type set but link clicks exist → Traffic
        actualResultType = 'Link click';
        actualResults    = g.link_clicks;
        actualCpr        = g.link_clicks > 0 ? g.spend / g.link_clicks : 0;
        Logger.log('Objective inferred: ' + g.campaign_name + ' → Link click (from link_clicks data)');
      }

      return {
        campaign_name: g.campaign_name,
        ad_set_name:   g.ad_set_name,
        result_type:   actualResultType,
        spend:         String(g.spend),
        reach:         String(g.reach),
        impressions:   String(g.impressions),
        results:       String(actualResults),
        link_clicks:   String(g.link_clicks),
        ctr:           String(ctr),
        cpc:           String(cpc),
        cpr:           String(actualCpr),
        frequency:     String(frq),
        date_start:    g.earliest_date,
        date_end:      g.latest_date
      };
    });
  }

  // Split: weekly = last 7 days (ending yesterday); MTD = all valid days (excluding today)
  var weeklyRaw = validRows.filter(function(row) {
    var d = parseDate_(getRowDate(row));
    if (!d) return false;
    var ts = Date.UTC(d.year, d.month - 1, d.day);
    return ts >= weekStartTs && ts <= latestTs;
  });

  var weeklyAgg = aggregate(weeklyRaw);
  var mtdAgg    = aggregate(validRows);  // MTD = all rows up to and including yesterday

  Logger.log('MTD Daily: ' + rows.length + ' raw rows → ' + validRows.length + ' valid (today excluded)' +
    ' → weekly ' + weeklyAgg.length + ' agg rows (dates: ' +
    (weeklyAgg[0] ? weeklyAgg[0].date_start + ' to ' + weeklyAgg[0].date_end : 'none') + ')' +
    ', MTD ' + mtdAgg.length + ' agg rows (dates: ' +
    (mtdAgg[0] ? mtdAgg[0].date_start + ' to ' + mtdAgg[0].date_end : 'none') + ')');
  return { weeklyRows: weeklyAgg, mtdRows: mtdAgg };
}

function buildColumnMap_(tabName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tabName);
  if (!sheet) throw new Error('No tab named "' + tabName + '"');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach(header => {
    if (!header) return;
    const h = String(header).toLowerCase().trim();
    Object.entries(COLUMN_KEYWORDS).forEach(([metric, keywords]) => {
      if (!map[metric] && keywords.some(kw => h.includes(kw))) map[metric] = header;
    });
  });
  Logger.log('Column map for "' + tabName + '": ' + JSON.stringify(map));
  return map;
}

function readTabWithAutoMap_(tabName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tabName);
  if (!sheet) throw new Error('No tab named "' + tabName + '"');
  const data = sheet.getDataRange().getDisplayValues();
  if (data.length < 1) return { colMap: {}, rows: [] };
  const headers = data[0];
  const colMap  = buildColumnMap_(tabName);
  const headerIndex = {};
  headers.forEach((h, i) => { if (h) headerIndex[String(h)] = i; });
  const rows = data.slice(1)
    .filter(row => row.some(cell => cell !== '' && cell !== null))
    .map(row => {
      const obj = { _raw: {} };
      headers.forEach((h, i) => { if (h) obj._raw[h] = row[i]; });
      Object.entries(colMap).forEach(([metric, header]) => {
        obj[metric] = row[headerIndex[header]] || '';
      });
      return obj;
    });
  return { colMap, rows };
}


// ============================================================================
// DATE AUTO-DETECTION
// ============================================================================

function parseDate_(rawValue) {
  if (!rawValue || rawValue === '') return null;
  if (rawValue instanceof Date) {
    const ist = new Date(rawValue.getTime() + 5.5 * 60 * 60 * 1000);
    return { day: ist.getUTCDate(), month: ist.getUTCMonth() + 1, year: ist.getUTCFullYear() };
  }
  if (typeof rawValue === 'number') {
    const d   = new Date(Math.round((rawValue - 25569) * 86400 * 1000));
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    return { day: ist.getUTCDate(), month: ist.getUTCMonth() + 1, year: ist.getUTCFullYear() };
  }
  const nums = String(rawValue).match(/\d+/g);
  if (!nums || nums.length < 3) return null;
  const n0 = parseInt(nums[0], 10), n1 = parseInt(nums[1], 10);
  let   n2 = parseInt(nums[2], 10);
  if (n2 < 100) n2 += 2000;
  if (n0 > 12) return { day: n0, month: n1, year: n2 };
  if (n1 > 12) return { day: n1, month: n0, year: n2 };
  return { day: n0, month: n1, year: n2 }; // assume Indian DD-MM-YY
}

function formatDateUS_(rawValue) {
  const d = parseDate_(rawValue);
  if (!d) return String(rawValue);
  return String(d.month).padStart(2,'0') + '/' + String(d.day).padStart(2,'0') + '/' + d.year;
}

function getMonthLabel_(rawValue) {
  const d = parseDate_(rawValue);
  if (!d) return 'This Period';
  const dt = new Date(Date.UTC(d.year, d.month - 1, d.day, 12, 0, 0));
  return Utilities.formatDate(dt, REPORT_TIMEZONE, 'MMMM yyyy');
}

/**
 * Returns a compact date range label for the Campaign Overview table.
 * Same month: "June 1-30" or "July 1-9"
 * Cross-month: "June 28 - July 4"
 * Indian DD-MM-YY format is handled automatically via parseDate_().
 */
function getDateRangeShortLabel_(rawStart, rawEnd) {
  const s = parseDate_(rawStart);
  const e = parseDate_(rawEnd);
  if (!s) return 'N/A';
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  const sm = MONTHS[s.month - 1];
  if (!e) return sm + ' ' + s.day;
  const em = MONTHS[e.month - 1];
  // Always show full range: "Jul 13 - Jul 19" (even same month)
  if (s.day === e.day && s.month === e.month && s.year === e.year)
    return sm + ' ' + s.day;
  return sm + ' ' + s.day + ' - ' + em + ' ' + e.day;
}


// ============================================================================
// RESULT TYPE LABELS
// ============================================================================

// Groups rows by result type, calculates total count and average CPR per group.
// Used by campaign summary slides, fillPeriodSlide_, and fillMTDRow_.
function getResultGroups_(rows) {
  const groups = {};
  rows.forEach(function(row) {
    var labels = getResultLabels_(row.result_type || '');
    var label  = labels.resultLabel;
    var cost   = labels.costLabel;
    if (!groups[label]) groups[label] = { costLabel: cost, count: 0, totalSpend: 0 };
    groups[label].count      += parseCellNum_(row.results);
    groups[label].totalSpend += parseCellNum_(row.spend);
  });
  return Object.entries(groups)
    .map(function(entry) {
      var label = entry[0];
      var g     = entry[1];
      var rawCpr = g.count > 0 ? g.totalSpend / g.count : 0;
      // REACH: cost per 1K reach = (spend / reach_count) x 1000
      var adjCpr = label === 'REACH' ? rawCpr * 1000 : rawCpr;
      return { label: label, costLabel: g.costLabel, count: g.count, avgCpr: adjCpr };
    })
    .sort(function(a, b) { return b.count - a.count; });
}

// Returns resultLabel, costLabel, resultValue, cprValue for a CAMPAIGN SUMMARY
// (aggregates all ad set rows for the campaign)
function getGroupedResultDisplay_(campRows) {
  const allGroups = getResultGroups_(campRows);
  const REACH_LABELS = ['REACH'];
  const groups = allGroups.filter(function(g) { return !REACH_LABELS.includes(g.label); });
  const g1 = groups[0] || allGroups[0] || { label:'RESULTS', costLabel:'COST PER RESULT', count:0, avgCpr:0 };
  return {
    resultLabel: g1.label,
    costLabel:   g1.costLabel,
    resultValue: g1.count > 0 ? fmtNumber_(g1.count) : '0',
    cprValue:    g1.avgCpr  > 0 ? fmtCurrency2dp_(g1.avgCpr) : '—',
  };
}

// Returns resultLabel, costLabel, resultValue, cprValue for a SINGLE AD SET ROW
function getSingleRowResultDisplay_(row) {
  var labels  = getResultLabels_(row.result_type || '');
  var results = parseCellNum_(row.results);
  var cpr     = parseCellNum_(row.cpr);
  return {
    resultLabel: labels.resultLabel,
    costLabel:   labels.costLabel,
    resultValue: results > 0 ? fmtNumber_(results) : '0',
    cprValue:    cpr > 0 ? fmtCurrency2dp_(cpr) : '—',
  };
}

function getResultLabels_(resultType) {
  // Comprehensive objective detection — covers every Meta/Google export variant
  const rt = (resultType || '').toLowerCase().trim();

  // Purchase / eCommerce (highest priority)
  if (/purchase|buy|checkout|transaction|order|sale/.test(rt))
    return { resultLabel: 'PURCHASES', costLabel: 'COST PER PURCHASE' };

  // Leads — form, instant, native, website
  if (/lead|form|sign.?up|registration|subscribe/.test(rt))
    return { resultLabel: 'LEADS', costLabel: 'COST PER LEAD' };

  // Landing page views
  if (/landing.?page|lpv|page.?view/.test(rt))
    return { resultLabel: 'LANDING PAGE VIEWS', costLabel: 'COST PER LPV' };

  // Link clicks / Traffic
  if (/link.?click|outbound|click/.test(rt))
    return { resultLabel: 'CLICKS', costLabel: 'COST PER CLICK' };

  // Reach / Awareness
  if (/reach|awareness|impression/.test(rt))
    return { resultLabel: 'REACH', costLabel: 'COST PER 1K REACH' };

  // Video views
  if (/video|view|watch|thruplay/.test(rt))
    return { resultLabel: 'VIDEO VIEWS', costLabel: 'COST PER VIEW' };

  // App installs
  if (/app|install|mobile/.test(rt))
    return { resultLabel: 'APP INSTALLS', costLabel: 'COST PER INSTALL' };

  // Conversions (generic)
  if (/conv|action/.test(rt))
    return { resultLabel: 'CONVERSIONS', costLabel: 'COST PER CONV' };

  // Default
  return { resultLabel: 'RESULTS', costLabel: 'COST PER RESULT' };
}


// Detect true objective from DATA VALUES — never trust result_type column alone.
// Meta sometimes puts "Reach" as result_type for Traffic campaigns.
// This function looks at actual metric counts to determine what really happened.
function detectObjectiveFromData_(row) {
  var purchases  = parseCellNum_(row.purchases  || row.website_purchases || '0');
  var leads      = parseCellNum_(row.leads || row.meta_leads || row.website_leads || row.results_leads || '0');
  var lpv        = parseCellNum_(row.landing_page_views || row.lpv || '0');
  var linkClicks = parseCellNum_(row.link_clicks || '0');
  var results    = parseCellNum_(row.results || '0');
  var reach      = parseCellNum_(row.reach   || '0');
  var rt         = (row.result_type || '').toLowerCase().trim();

  // Priority: Purchases > Leads > LPV > Link Clicks > Reach
  if (purchases  > 0) return 'Purchase';
  if (leads      > 0) return 'Lead';
  if (lpv        > 0) return 'Landing page view';
  if (linkClicks > 0 && (!reach || Math.abs(results - reach) > Math.max(reach * 0.05, 5)))
    return 'Link click';

  // If results ≈ reach and no other conversion signal → true Reach campaign
  if (reach > 0 && Math.abs(results - reach) <= Math.max(reach * 0.05, 5))
    return 'Reach';

  // Fall back to what Meta says in the result_type column
  return rt || 'Link click';
}

function fmtCurrency_(v)   { return CURRENCY_SYMBOL + Math.round(parseCellNum_(v)).toLocaleString('en-US'); }
function fmtCurrency2dp_(v){ return CURRENCY_SYMBOL + parseCellNum_(v).toFixed(2); }
function fmtNumber_(v)     { return Math.round(parseCellNum_(v)).toLocaleString('en-US'); }
function fmtPercent_(v)    { return parseCellNum_(v).toFixed(2) + '%'; }
function parseCellNum_(v)  {
  if (!v || String(v).trim() === '') return 0;
  return parseFloat(String(v).replace(/[,$%\s]/g,'')) || 0;
}


// ============================================================================
// MAIN
// ============================================================================

function generateWeeklyReport() {
  const accountName = SpreadsheetApp.getActiveSpreadsheet().getName();

  // ── Read Weekly CSV (or auto-split from MTD Daily CSV if present) ──────────
  // If "MTD Daily CSV" tab exists, one download covers both weekly and MTD.
  // Otherwise falls back to reading "Weekly CSV" and "MTD CSV" separately.
  var splitResult = splitMTDDaily_();
  var weeklyRows, mtdRowsFromDaily;
  if (splitResult) {
    Logger.log('Using MTD Daily CSV — auto-split into weekly and MTD');
    weeklyRows = splitResult.weeklyRows;
    mtdRowsFromDaily = splitResult.mtdRows;
  } else {
    const { rows } = readTabWithAutoMap_(CSV_TAB);
    weeklyRows = rows;
    mtdRowsFromDaily = null;
  }

  const isPaused = weeklyRows.length === 0;

  // Calculate the GLOBAL weekly date range from ALL campaigns combined
  // (use this for DATE_RANGE on every slide so all slides show the same period,
  // even if one campaign started mid-week)
  var globalWeekStart = '', globalWeekEnd = '';
  if (!isPaused) {
    weeklyRows.forEach(function(r) {
      if (r.date_start && (!globalWeekStart || r.date_start < globalWeekStart)) globalWeekStart = r.date_start;
      if (r.date_end   && (!globalWeekEnd   || r.date_end   > globalWeekEnd))   globalWeekEnd   = r.date_end;
    });
    Logger.log('Global weekly period: ' + globalWeekStart + ' to ' + globalWeekEnd);
  }
  var globalWeekDateRange = (globalWeekStart && globalWeekEnd)
    ? getDateRangeShortLabel_(globalWeekStart, globalWeekEnd)
    : '';

  Logger.log('Weekly CSV: ' + weeklyRows.length + ' row(s)');
  weeklyRows.forEach((r, i) =>
    Logger.log('  ' + (i+1) + ': "' + r.campaign_name + '" / "' + r.ad_set_name +
               '" / ' + r.result_type)
  );

  // Create report file — name uses the GLOBAL weekly period (not per-campaign dates)
  const fileStartDate = globalWeekStart
    ? formatDateUS_(globalWeekStart)
    : (weeklyRows[0] ? formatDateUS_(weeklyRows[0].date_start) : 'unknown');
  const fileEndDate = globalWeekEnd
    ? formatDateUS_(globalWeekEnd)
    : (weeklyRows[0] ? formatDateUS_(weeklyRows[0].date_end)   : 'unknown');
  const fileDateRange = fileStartDate && fileEndDate ? fileStartDate + ' to ' + fileEndDate : 'Date range unavailable';
  const reportsFolder = getReportsFolder_(accountName);
  const newFile = DriveApp.getFileById(TEMPLATE_FILE_ID)
    .makeCopy('Meta Ads Report - ' + fileDateRange.replace(/[\s\/]/g, '_'), reportsFolder);
  Logger.log('File created: ' + newFile.getUrl());

  // Fill cover tags
  let pres = SlidesApp.openById(newFile.getId());
  pres.replaceAllText('{{ACCOUNT_NAME}}', accountName);
  pres.replaceAllText('{{REPORT_DATE}}',
    Utilities.formatDate(new Date(), REPORT_TIMEZONE, 'MM-dd-yyyy'));
  pres.replaceAllText('{{DATE_RANGE}}', globalWeekDateRange || fileDateRange);
  pres.saveAndClose();

  // Remove Period, Legend, and generic template campaign slide before appending
  // so campaign slides land right after Cover
  const presPrep = SlidesApp.openById(newFile.getId());
  const removeIds = [];
  presPrep.getSlides().forEach(slide => {
    const text = getAllSlideText_(slide);
    if (text.includes('CAMPAIGN OVERVIEW') || text.includes('METRIC ABBREVIATION') ||
        text.includes('{{METRIC_SPEND}}') || text.includes('{{CAMPAIGN_NAME}}')) {
      removeIds.push(slide.getObjectId());
    }
  });
  presPrep.getSlides().forEach(slide => {
    if (removeIds.includes(slide.getObjectId())) slide.remove();
  });
  presPrep.saveAndClose();

  // Sort rows by campaign name so all ad sets of the same campaign stay together
  if (!isPaused) {
    weeklyRows.sort((a, b) =>
      String(a.campaign_name||'').localeCompare(String(b.campaign_name||''))
    );
  }

  // Fill health score badge and budget utilization on the cover slide
  if (!isPaused) {
    fillCoverExtras_(newFile.getId(), weeklyRows, mtdRowsFromDaily);
  } else {
    const p = SlidesApp.openById(newFile.getId());
    p.replaceAllText('{{ACCOUNT_HEALTH_BADGE}}', '⚙️ Campaigns Paused');
    p.replaceAllText('{{BUDGET_SUMMARY}}', '');
    p.saveAndClose();
  }

  // Group rows by campaign name
  const campaignGroups = {}; // { "Campaign A": [row1, row2], "Campaign B": [row3] }
  weeklyRows.forEach(row => {
    const name = String(row.campaign_name || 'Unknown Campaign').trim();
    if (!campaignGroups[name]) campaignGroups[name] = [];
    campaignGroups[name].push(row);
  });
  const campaignNames = Object.keys(campaignGroups).sort();

  const newSlideInfo = [];
  const tempFileIds  = [];
  const mainPres     = SlidesApp.openById(newFile.getId());

  // ── PHASE A1: Campaign summary slides ─────────────────────────────────────
  Logger.log('Building ' + campaignNames.length + ' campaign summary slides...');
  campaignNames.forEach(campaignName => {
    const campRows = campaignGroups[campaignName];
    Logger.log('  Campaign: "' + campaignName + '" (' + campRows.length + ' ad sets)');

    // Aggregate metrics across all ad sets of this campaign
    let totalSpend = 0, totalReach = 0, totalImpr = 0;
    const ctrs = [], cpcs = [];
    campRows.forEach(row => {
      totalSpend += parseCellNum_(row.spend);
      totalReach += parseCellNum_(row.reach);
      totalImpr  += parseCellNum_(row.impressions);
      const ctr = parseCellNum_(row.ctr);
      const cpc = parseCellNum_(row.cpc);
      if (ctr > 0) ctrs.push(ctr);
      if (cpc > 0) cpcs.push(cpc);
    });
    const avgCtr = ctrs.length ? ctrs.reduce((a,b)=>a+b,0)/ctrs.length : 0;
    const avgCpc = cpcs.length ? cpcs.reduce((a,b)=>a+b,0)/cpcs.length : 0;
    const { resultLabel, costLabel, resultValue, cprValue } =
      getGroupedResultDisplay_(campRows);

    const tempFile  = DriveApp.getFileById(TEMPLATE_FILE_ID)
      .makeCopy('_tmp_camp_' + Date.now());
    tempFileIds.push(tempFile.getId());
    const tempPres  = SlidesApp.openById(tempFile.getId());

    let targetIdx = -1;
    tempPres.getSlides().forEach((slide, i) => {
      if (targetIdx === -1 && getAllSlideText_(slide).includes('{{METRIC_SPEND}}'))
        targetIdx = i;
    });

    if (targetIdx !== -1) {
      // Only label as COMBINED when there are actually multiple ad sets.
      // Just show the campaign name — no need for the 'combined' label
      const heading = campaignName;

      // Average frequency across ad sets (impressions/reach, or direct from CSV)
      let totalFreq = 0, freqRows = 0;
      campRows.forEach(row => {
        const f = parseCellNum_(row.frequency) ||
          (parseCellNum_(row.reach) > 0 ? parseCellNum_(row.impressions)/parseCellNum_(row.reach) : 0);
        if (f > 0) { totalFreq += f; freqRows++; }
      });
      const avgFreq = freqRows > 0 ? totalFreq / freqRows : 0;

      let totalResults = 0;
      campRows.forEach(r => { totalResults += parseCellNum_(r.results); });

      tempPres.replaceAllText('{{CAMPAIGN_NAME}}',     heading);
      tempPres.replaceAllText('{{RESULT_LABEL}}',      resultLabel);
      tempPres.replaceAllText('{{COST_LABEL}}',        costLabel);
      tempPres.replaceAllText('{{METRIC_SPEND}}',      fmtCurrency_(totalSpend));
      tempPres.replaceAllText('{{METRIC_REACH}}',      fmtNumber_(totalReach));
      tempPres.replaceAllText('{{METRIC_IMPRESSIONS}}',fmtNumber_(totalImpr));
      tempPres.replaceAllText('{{METRIC_RESULTS}}',    resultValue);
      tempPres.replaceAllText('{{METRIC_CTR}}',        (avgCtr > 0 ? fmtPercent_(avgCtr) : '—'));
      tempPres.replaceAllText('{{METRIC_CPR}}',        cprValue);
      tempPres.replaceAllText('{{METRIC_CPC}}',        (avgCpc > 0 ? fmtCurrency2dp_(avgCpc) : '—'));
      // Frequency shown as a secondary line under the date range
      var freqLine = avgFreq > 0
        ? '\nFreq: ' + avgFreq.toFixed(1) + 'x avg' + (avgFreq > 3.5 ? ' ⚠️ High' : '')
        : '';
      // Use global weekly date range so all slides show the same reporting period
      var displayDateRange = globalWeekDateRange || dateRange;
      tempPres.replaceAllText('{{DATE_RANGE}}', displayDateRange + freqLine);
      // AI tags filled in Phase B
      tempPres.saveAndClose();

      const tempPres2 = SlidesApp.openById(tempFile.getId());
      const slide     = tempPres2.getSlides()[targetIdx];
      const appended  = mainPres.appendSlide(slide);
      shrinkTitle_(appended, campaignName);
      newSlideInfo.push({
        slideId: appended.getObjectId(),
        campaignName,
        adSetName: '',
        isCampaignSummary: true,
        campRows,
        resultLabel, costLabel,
        totalSpend, totalReach, totalImpr, avgCtr, avgCpc,
        avgFreq,                // Priority 2: frequency for AI context
        isPaused: false,
      });
      Logger.log('  → Campaign summary slide appended');
    }
  });

  // ── PHASE A2: Individual ad set slides ────────────────────────────────────
  // Only build individual ad set slides for campaigns with 2+ ad sets.
  // If a campaign has only 1 ad set, the campaign summary slide already
  // covers that data identically — showing it again would be pure duplication.
  Logger.log('Building individual ad set slides (multi-adset campaigns only)...');
  weeklyRows.forEach((row, idx) => {
    if (isPaused) return;
    const campaignName    = String(row.campaign_name || 'Campaign').trim();
    const adSetName       = String(row.ad_set_name   || '').trim();
    const campAdSetCount  = campaignGroups[campaignName]?.length || 0;

    if (campAdSetCount <= 1) {
      Logger.log('  Skipping "' + campaignName + '" — single ad set, campaign slide already covers it');
      return;
    }
    const { resultLabel, costLabel, resultValue, cprValue } =
      getSingleRowResultDisplay_(row);

    Logger.log('  Ad set: "' + campaignName + ' / ' + adSetName + '"');

    const tempFile  = DriveApp.getFileById(TEMPLATE_FILE_ID)
      .makeCopy('_tmp_adset_' + idx + '_' + Date.now());
    tempFileIds.push(tempFile.getId());
    const tempPres  = SlidesApp.openById(tempFile.getId());

    let targetIdx = -1;
    tempPres.getSlides().forEach((slide, i) => {
      if (targetIdx === -1 && getAllSlideText_(slide).includes('{{METRIC_SPEND}}'))
        targetIdx = i;
    });

    if (targetIdx !== -1) {
      // Ad set slides: show ad set name with '(Ad Set)' label for clarity
      const heading = adSetName ? adSetName + ' (Ad Set)' : campaignName;

      // Frequency for this specific ad set row
      const rowFreq = parseCellNum_(row.frequency) ||
        (parseCellNum_(row.reach) > 0 ? parseCellNum_(row.impressions)/parseCellNum_(row.reach) : 0);

      const rowSpend   = parseCellNum_(row.spend);
      const rowReach   = parseCellNum_(row.reach);
      const rowImpr    = parseCellNum_(row.impressions);
      const rowResults = parseCellNum_(row.results);
      const rowCtr     = parseCellNum_(row.ctr);
      const rowCpc     = parseCellNum_(row.cpc);

      tempPres.replaceAllText('{{CAMPAIGN_NAME}}',     heading);
      tempPres.replaceAllText('{{RESULT_LABEL}}',      resultLabel);
      tempPres.replaceAllText('{{COST_LABEL}}',        costLabel);
      tempPres.replaceAllText('{{METRIC_SPEND}}',      fmtCurrency_(rowSpend));
      tempPres.replaceAllText('{{METRIC_REACH}}',      fmtNumber_(rowReach));
      tempPres.replaceAllText('{{METRIC_IMPRESSIONS}}',fmtNumber_(rowImpr));
      tempPres.replaceAllText('{{METRIC_RESULTS}}',    resultValue);
      tempPres.replaceAllText('{{METRIC_CTR}}',        (rowCtr > 0 ? fmtPercent_(rowCtr) : '—'));
      tempPres.replaceAllText('{{METRIC_CPR}}',        cprValue);
      tempPres.replaceAllText('{{METRIC_CPC}}',        (rowCpc > 0 ? fmtCurrency2dp_(rowCpc) : '—'));
      var adSetFreqLine = rowFreq > 0
        ? '\nFreq: ' + rowFreq.toFixed(1) + 'x avg' + (rowFreq > 3.5 ? ' ⚠️ High' : '')
        : '';
      var displayDateRangeAS = globalWeekDateRange || dateRange;
      tempPres.replaceAllText('{{DATE_RANGE}}', displayDateRangeAS + adSetFreqLine);
      tempPres.saveAndClose();

      const tempPres2 = SlidesApp.openById(tempFile.getId());
      const slide     = tempPres2.getSlides()[targetIdx];
      const appended  = mainPres.appendSlide(slide);
      if (adSetName) shrinkAdSetName_(appended, adSetName + ' (Ad Set)');
      newSlideInfo.push({
        slideId: appended.getObjectId(),
        campaignName, adSetName,
        isCampaignSummary: false,
        row, resultLabel, costLabel,
        rowFreq,            // Priority 2: frequency for AI context
        isPaused: false,
      });
    }
  });

  // Handle fully paused case
  if (isPaused) {
    const tempFile  = DriveApp.getFileById(TEMPLATE_FILE_ID).makeCopy('_tmp_paused_' + Date.now());
    tempFileIds.push(tempFile.getId());
    const tempPres  = SlidesApp.openById(tempFile.getId());
    let targetIdx   = -1;
    tempPres.getSlides().forEach((slide, i) => {
      if (targetIdx === -1 && getAllSlideText_(slide).includes('{{METRIC_SPEND}}'))
        targetIdx = i;
    });
    if (targetIdx !== -1) {
      const PAUSED_MSG =
        'Campaigns for ' + accountName + ' were paused during the selected reporting ' +
        'period and did not generate impressions, spend, or results. ' +
        'No action has been taken on the account during this period.';
      tempPres.replaceAllText('{{CAMPAIGN_NAME}}',     'All Campaigns — Paused');
      tempPres.replaceAllText('{{RESULT_LABEL}}',      'RESULTS');
      tempPres.replaceAllText('{{COST_LABEL}}',        'COST PER RESULT');
      ['{{METRIC_SPEND}}','{{METRIC_REACH}}','{{METRIC_IMPRESSIONS}}',
       '{{METRIC_RESULTS}}'].forEach(t => tempPres.replaceAllText(t, '0'));
      ['{{METRIC_CTR}}','{{METRIC_CPR}}','{{METRIC_CPC}}'].forEach(t =>
        tempPres.replaceAllText(t, '—'));
      tempPres.replaceAllText('{{DATE_RANGE}}', dateRange);
      tempPres.replaceAllText('{{CAMPAIGN_SUMMARY}}',  PAUSED_MSG);
      tempPres.replaceAllText('{{KEY_INSIGHTS}}',
        'Campaigns paused — no data recorded for this period. Awaiting instructions to resume.');
      tempPres.saveAndClose();
      const tp2 = SlidesApp.openById(tempFile.getId());
      mainPres.appendSlide(tp2.getSlides()[targetIdx]);
    }
  }

  mainPres.saveAndClose();

  // ── Performance chart slide (MTD data) ───────────────────────────────────
  // Uses mtdRowsFromDaily directly — the MTD Daily CSV split already contains
  // all month-to-date aggregated rows. No separate MTD CSV tab needed.
  if (!isPaused) {
    const chartRows  = mtdRowsFromDaily && mtdRowsFromDaily.length > 0
      ? mtdRowsFromDaily : weeklyRows;
    const chartLabel = mtdRowsFromDaily && mtdRowsFromDaily.length > 0 ? 'MTD' : 'Weekly';
    const chartGroups = {};
    chartRows.forEach(function(row) {
      var nm = String(row.campaign_name || '').trim();
      if (!chartGroups[nm]) chartGroups[nm] = [];
      chartGroups[nm].push(row);
    });
    Logger.log('Chart slide using ' + chartLabel + ' data: ' + chartRows.length + ' rows, ' + Object.keys(chartGroups).length + ' campaigns');
    addVisualScorecardSlide_(newFile.getId(), Object.keys(chartGroups).sort(), chartGroups, chartLabel);
  }

  // Re-append Period and Legend at the very end
  const tempFinal      = DriveApp.getFileById(TEMPLATE_FILE_ID).makeCopy('_tmp_final_' + Date.now());
  tempFileIds.push(tempFinal.getId());
  const tempFinalPres  = SlidesApp.openById(tempFinal.getId());
  tempFinalPres.saveAndClose();
  const tfp2           = SlidesApp.openById(tempFinal.getId());
  const presEnd        = SlidesApp.openById(newFile.getId());
  tfp2.getSlides().forEach(slide => {
    const text = getAllSlideText_(slide);
    if (text.includes('CAMPAIGN OVERVIEW') || text.includes('METRIC ABBREVIATION')) {
      presEnd.appendSlide(slide);
      Logger.log('Re-appended: ' + text.substring(0,35).trim());
    }
  });
  presEnd.saveAndClose();

  // Trash temp files
  tempFileIds.forEach(id => { try { DriveApp.getFileById(id).setTrashed(true); } catch(e) {} });

  Logger.log('Phase A done.');
  fillPeriodSlide_(newFile.getId());
  // For MTD row: use daily-split MTD data if available, else MTD CSV tab
  fillMTDRow_(newFile.getId(), mtdRowsFromDaily);
  Logger.log('Period and MTD slides filled.');

  // PHASE B: AI writing
  newSlideInfo.filter(i => !i.isPaused).forEach(info => {
    try {
      writeInsights_(newFile.getId(), info);
      Logger.log('AI done: ' + info.campaignName + (info.isCampaignSummary ? ' (campaign)' : ' (ad set)'));
    } catch(e) {
      Logger.log('AI skipped for "' + info.campaignName + '": ' + e.message.substring(0,80));
    }
  });

  // Apply Poppins font to all text on all slides
  applyFontsToPresentation_(newFile.getId());
  // Restore heading sizes that Poppins application may have changed
  restoreHeadingFonts_(newFile.getId());
  fixProseFormatting_(newFile.getId());

  Logger.log('Complete: ' + newFile.getUrl());
  return newFile.getUrl();
}


// ============================================================================
// PERIOD SLIDE — 10-column table with per-objective breakdown
// ============================================================================

function fillPeriodSlide_(presId) {
  // If period tab is blank (campaign didn't run previous month), skip period row
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PERIOD_TAB);
    if (!sheet || sheet.getLastRow() < 2) {
      Logger.log('Period CSV tab is empty — filling period row with dashes only.');
      const p = SlidesApp.openById(presId);
      // Fill value cells with — but LEAVE result LABEL tags unfilled
      // fillMTDRow_ will fill the label tags from MTD data so columns are properly headed
      ['{{PERIOD_MONTH}}','{{PERIOD_SPEND}}','{{PERIOD_REACH}}','{{PERIOD_IMPRESSIONS}}',
       '{{PERIOD_CTR}}','{{PERIOD_CPC}}','{{PERIOD_RESULT1}}','{{PERIOD_CPR1}}',
       '{{PERIOD_RESULT2}}','{{PERIOD_CPR2}}'].forEach(tag => p.replaceAllText(tag, '—'));
      p.saveAndClose();
      return;
    }
  } catch(e) {
    Logger.log('Period tab check failed: ' + e.message + ' — skipping period row.');
    return;
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PERIOD_TAB);
  if (!sheet) { Logger.log('No Period CSV tab'); return; }

  const { rows } = readTabWithAutoMap_(PERIOD_TAB);

  const emptyFill = () => {
    const p = SlidesApp.openById(presId);
    p.replaceAllText('{{PERIOD_MONTH}}',          'No Data');
    p.replaceAllText('{{PERIOD_SPEND}}',          '$0');
    p.replaceAllText('{{PERIOD_REACH}}',          '0');
    p.replaceAllText('{{PERIOD_IMPRESSIONS}}',    '0');
    p.replaceAllText('{{PERIOD_CTR}}',            '—');
    p.replaceAllText('{{PERIOD_CPC}}',            '—');
    ['1','2'].forEach(n => {
      p.replaceAllText('{{PERIOD_RESULT' + n + '_LABEL}}', n === '1' ? 'RESULTS' : '');
      p.replaceAllText('{{PERIOD_CPR'    + n + '_LABEL}}', n === '1' ? 'CPR'     : '');
      p.replaceAllText('{{PERIOD_RESULT' + n + '}}',       '0');
      p.replaceAllText('{{PERIOD_CPR'    + n + '}}',       '—');
    });
    p.saveAndClose();
  };

  if (rows.length === 0) { emptyFill(); return; }

  // Aggregate shared metrics
  let totalSpend = 0, totalReach = 0, totalImpr = 0;
  const ctrs = [], cpcs = [];
  let rawStart = '', rawEnd = '';
  rows.forEach(row => {
    totalSpend += parseCellNum_(row.spend);
    totalReach += parseCellNum_(row.reach);
    totalImpr  += parseCellNum_(row.impressions);
    const ctr = parseCellNum_(row.ctr);
    const cpc = parseCellNum_(row.cpc);
    if (ctr > 0) ctrs.push(ctr);
    if (cpc > 0) cpcs.push(cpc);
    // Track MINIMUM date across all rows (not just first row)
    if (!rawStart || (row.date_start && row.date_start < rawStart)) rawStart = row.date_start;
    if (!rawEnd   || (row.date_end   && row.date_end   > rawEnd))   rawEnd   = row.date_end;
  });
  const avgCtr = ctrs.length ? ctrs.reduce((a,b)=>a+b,0)/ctrs.length : 0;
  const avgCpc = cpcs.length ? cpcs.reduce((a,b)=>a+b,0)/cpcs.length : 0;

  const REACH_LABELS = ['REACH', 'REACH (TOTAL)'];
  const allGroups    = getResultGroups_(rows);
  const groups       = allGroups.filter(g => !REACH_LABELS.includes(g.label));

  // "June 1-30" or "July 1-9" instead of just "June 2026"
  const monthLabel = rawStart ? getDateRangeShortLabel_(rawStart, rawEnd) : 'This Period';
  Logger.log('Period label: ' + monthLabel);
  Logger.log('All result groups: ' + JSON.stringify(allGroups.map(g => g.label + ':' + g.count)));
  Logger.log('Non-reach groups for cols 7-10: ' + JSON.stringify(groups.map(g => g.label + ':' + g.count)));

  // Use first two non-reach groups for the two result column pairs
  const g1 = groups[0] || allGroups[0] || { label: 'RESULTS', costLabel: 'CPR', count: 0, avgCpr: 0 };
  const g2 = groups[1] || null;

  const pres = SlidesApp.openById(presId);
  pres.replaceAllText('{{PERIOD_MONTH}}',        monthLabel);
  pres.replaceAllText('{{PERIOD_SPEND}}',        fmtCurrency_(totalSpend));
  pres.replaceAllText('{{PERIOD_REACH}}',        fmtNumber_(totalReach));
  pres.replaceAllText('{{PERIOD_IMPRESSIONS}}',  fmtNumber_(totalImpr));
  pres.replaceAllText('{{PERIOD_CTR}}',          avgCtr > 0 ? fmtPercent_(avgCtr) : '—');
  pres.replaceAllText('{{PERIOD_CPC}}',          avgCpc > 0 ? fmtCurrency2dp_(avgCpc) : '—');
  pres.replaceAllText('{{PERIOD_RESULT1}}',      fmtNumber_(g1.count));
  pres.replaceAllText('{{PERIOD_CPR1}}',         g1.avgCpr > 0 ? fmtCurrency2dp_(g1.avgCpr) : '—');
  pres.replaceAllText('{{PERIOD_RESULT2}}',      g2 ? fmtNumber_(g2.count) : '—');
  pres.replaceAllText('{{PERIOD_CPR2}}',         g2 ? (g2.avgCpr > 0 ? fmtCurrency2dp_(g2.avgCpr) : '—') : '—');
  pres.saveAndClose();

  // Set column header labels directly in table cells (more reliable than replaceAllText for tables)
  var cprShort = function(label) {
    return label.replace('LANDING PAGE VIEWS','LPV').replace('FORM LEADS','CPL')
                .replace('WEB LEADS','CPL').replace('CLICKS','CPC').replace('RESULTS','CPR');
  };
  fillTableHeaderLabels_(presId, g1.label, cprShort(g1.label),
    g2 ? g2.label : '—', g2 ? cprShort(g2.label) : '—');
}


// ============================================================================
// AI INSIGHTS
// ============================================================================

function writeInsights_(presId, info) {
  let spend, reach, impr, ctr, cpc, results, cpr;
  let ctx, resultsNum, hasResults;

  if (info.isCampaignSummary) {
    // Campaign summary — use aggregated metrics
    const { campRows } = info;
    let totalResults = 0;
    campRows.forEach(r => { totalResults += parseCellNum_(r.results); });
    spend   = fmtCurrency_(info.totalSpend);
    reach   = fmtNumber_(info.totalReach);
    impr    = fmtNumber_(info.totalImpr);
    ctr     = info.avgCtr > 0 ? fmtPercent_(info.avgCtr) : '—';
    cpc     = info.avgCpc > 0 ? fmtCurrency2dp_(info.avgCpc) : '—';
    results = fmtNumber_(totalResults);
    var rawCprNum = resultsNum > 0 ? info.totalSpend / resultsNum : 0;
    cpr = (info.resultLabel === 'REACH' ? rawCprNum * 1000 : rawCprNum) > 0
      ? fmtCurrency2dp_(info.resultLabel === 'REACH' ? rawCprNum * 1000 : rawCprNum) : '—';
    ctx     = info.campaignName + ' (combined ' + campRows.length + ' ad sets)';
    resultsNum = totalResults;
    hasResults = resultsNum > 0;
  } else {
    const row = info.row;
    spend   = fmtCurrency_(row.spend);
    reach   = fmtNumber_(row.reach);
    impr    = fmtNumber_(row.impressions);
    ctr     = fmtPercent_(row.ctr);
    cpc     = fmtCurrency2dp_(row.cpc);
    results = fmtNumber_(row.results);
    cpr     = fmtCurrency2dp_(row.cpr);
    ctx     = info.campaignName + (info.adSetName ? ' / ' + info.adSetName : '');
    resultsNum = parseCellNum_(row.results);
    hasResults = resultsNum > 0;
  }

  // Priority 2: Frequency context
  const freq     = info.avgFreq || info.rowFreq || 0;
  const freqNote = freq > 0
    ? ' Ad frequency: ' + freq.toFixed(1) + ' impressions per person.' +
      (freq > 3.5 ? ' High frequency — audience may be experiencing creative fatigue.' : '')
    : '';

  // Priority 1: WoW context
  const summaryPrompt = hasResults
    ? 'Write a campaign performance summary for a Meta Ads weekly client report. ' +
      'Write a single concise paragraph (under 65 words) that covers ALL of these metrics naturally: ' +
      'Ad Spend, Reach, ' + info.resultLabel + ' count, ' + info.costLabel + ', CTR, and CPC. ' +
      'Write it as a real account manager would — professional, confident, metric-rich. ' +
      'No bullets, no headings. Use all the numbers given. ' +
      'Campaign: ' + ctx + '. Spend: ' + spend + ', Reach: ' + reach +
      ', ' + info.resultLabel + ': ' + results + ', ' + info.costLabel + ': ' + cpr +
      ', CTR: ' + ctr + ', CPC: ' + cpc + '.' + freqNote +
      ' Output only the 2 paragraphs.'
    : 'Write a campaign performance summary for Meta Ads weekly report where results are 0. ' +
      'Write EXACTLY 2 short paragraphs, each 1-2 sentences. Total under 50 words. ' +
      'Paragraph 1: acknowledge reach and impressions generated. ' +
      'Paragraph 2: frame as awareness/learning phase, one next action. ' +
      'No bullets. NEVER use "outstanding", "exceptional". ' +
      'Campaign: ' + ctx + '. Spend: ' + spend + ', Reach: ' + reach +
      ', CTR: ' + ctr + ', CPC: ' + cpc + ', Results: 0, Cost per Result: N/A.' + freqNote + ' Output only the 2 paragraphs.';


  // Priority 3: Key Insights now includes recommended Next Steps in same paragraph
  const insightPrompt =
    'Write the Key Insights & Next Strategy section for a Meta Ads weekly report. ' +
    'Write the Key Insights & Next Strategy section for a Meta Ads weekly report. ' +
    'Write a single flowing paragraph of 4-5 sentences with NO bullets, NO dashes, NO line breaks. ' +
    'Cover: 2 key performance insights from this week (cite actual numbers), then 2 specific strategy actions for next week. ' +
    'Sound like a senior account manager. Natural, confident, metric-driven. Under 90 words.' +
    (freq > 3.5 ? ' Mention high frequency as a creative refresh signal.' : '') +
    ' Sentences 4-5: exactly 2 specific recommended actions for NEXT week (what to test, adjust, or prioritise). ' +
    'Sound like a real account manager. Use actual numbers. Under 100 words. ' +
    (hasResults ? '' : 'Results are 0 — do not frame this positively. ') +
    'Campaign: ' + ctx + '. Spend: ' + spend + ', Reach: ' + reach +
    ', CTR: ' + ctr + ', CPC: ' + cpc + ', ' + info.resultLabel + ': ' + results + '.' + freqNote +
    ' Output only the paragraph, nothing else.';

  const rawSummary = callAI_(summaryPrompt);
  const rawInsight = callAI_(insightPrompt);

    // 220-char hard cap prevents overlap with KEY INSIGHTS heading
  let summary = rawSummary.trim();
  if (summary.length > 220) {
    const cut = summary.lastIndexOf('.', 220);
    summary = cut > 60 ? summary.substring(0, cut + 1) : summary.substring(0, 220).trim() + '.';
  }

  // Clean any stray leading bullet symbol
  // Cap insights to prevent overflow below the KEY INSIGHTS box
  let rawIns = rawInsight.trim().replace(/^[-•*]\s*/, '');
  if (rawIns.length > 320) {
    const iCut = rawIns.lastIndexOf('.', 320);
    rawIns = iCut > 80 ? rawIns.substring(0, iCut + 1) : rawIns.substring(0, 320).trim() + '.';
  }
  const insights = rawIns || 'Insights not available.';

  const p = SlidesApp.openById(presId);
  const slide = p.getSlides().find(s => s.getObjectId() === info.slideId);
  if (slide) {
    // Place text using replaceInSlide_ which recurses into groups (CAMPAIGN_SUMMARY is inside a group)
    replaceInSlide_(slide, '{{CAMPAIGN_SUMMARY}}', summary);
    replaceInSlide_(slide, '{{KEY_INSIGHTS}}',     insights);
    // Now un-bold and resize the prose text boxes (also recurse into groups)
    applyProseStyleInElements_(slide.getPageElements(), summary, insights);
  }
  p.saveAndClose();
}

function replaceInSlide_(slide, search, replace) {
  replaceInElements_(slide.getPageElements(), search, String(replace));
}
function replaceInElements_(elements, search, replace) {
  elements.forEach(el => {
    try {
      const type = el.getPageElementType();
      if (type === SlidesApp.PageElementType.SHAPE)
        el.asShape().getText().replaceAllText(search, replace);
      else if (type === SlidesApp.PageElementType.TABLE) {
        const t = el.asTable();
        for (let r=0;r<t.getNumRows();r++)
          for (let c=0;c<t.getNumColumns();c++)
            t.getCell(r,c).getText().replaceAllText(search, replace);
      } else if (type === SlidesApp.PageElementType.GROUP)
        replaceInElements_(el.asGroup().getChildren(), search, replace);
    } catch(e) {}
  });
}


// ============================================================================
// MTD ROW FILLER — current month to date (row 3 in Campaign Overview table)
// ============================================================================

function fillMTDRow_(presId, preloadedRows) {
  const fillEmpty = function() {
    const p = SlidesApp.openById(presId);
    ['{{MTD_MONTH}}','{{MTD_SPEND}}','{{MTD_REACH}}','{{MTD_IMPRESSIONS}}',
     '{{MTD_CTR}}','{{MTD_CPC}}','{{MTD_RESULT1}}','{{MTD_CPR1}}',
     '{{MTD_RESULT2}}','{{MTD_CPR2}}'].forEach(function(tag) { p.replaceAllText(tag, '—'); });
    p.saveAndClose();
  };

  // Use preloaded rows from MTD Daily split, or read MTD CSV tab
  var rows;
  if (preloadedRows && preloadedRows.length > 0) {
    rows = preloadedRows;
    Logger.log('MTD row using pre-split rows: ' + rows.length);
  } else {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MTD_TAB);
    if (!sheet) { Logger.log('No MTD tab — MTD row dashes.'); fillEmpty(); return; }
    const readResult = readTabWithAutoMap_(MTD_TAB);
    rows = readResult.rows;
    if (rows.length === 0) { Logger.log('MTD tab empty — MTD row dashes.'); fillEmpty(); return; }
  }

  let totalSpend = 0, totalReach = 0, totalImpr = 0;
  const ctrs = [], cpcs = [];
  let rawStart = '', rawEnd = '';
  rows.forEach(function(row) {
    totalSpend += parseCellNum_(row.spend);
    totalReach += parseCellNum_(row.reach);
    totalImpr  += parseCellNum_(row.impressions);
    const ctr   = parseCellNum_(row.ctr);
    const cpc   = parseCellNum_(row.cpc);
    if (ctr > 0) ctrs.push(ctr);
    if (cpc > 0) cpcs.push(cpc);
    // Track MINIMUM date across all rows (not just first row)
    if (!rawStart || (row.date_start && row.date_start < rawStart)) rawStart = row.date_start;
    if (!rawEnd   || (row.date_end   && row.date_end   > rawEnd))   rawEnd   = row.date_end;
  });
  const avgCtr = ctrs.length ? ctrs.reduce((a,b)=>a+b,0)/ctrs.length : 0;
  const avgCpc = cpcs.length ? cpcs.reduce((a,b)=>a+b,0)/cpcs.length : 0;

  const REACH_LABELS = ['REACH','REACH (TOTAL)'];
  const allGroups    = getResultGroups_(rows);
  const groups       = allGroups.filter(function(g) { return !REACH_LABELS.includes(g.label); });
  const g1 = groups[0] || allGroups[0] || { label:'RESULTS', costLabel:'CPR', count:0, avgCpr:0 };
  const g2 = groups[1] || null;

  const dateLabel  = rawStart ? getDateRangeShortLabel_(rawStart, rawEnd) : 'This Month';
  const monthLabel = dateLabel + ' MTD';
  Logger.log('MTD label: ' + monthLabel);

  const pres = SlidesApp.openById(presId);
  pres.replaceAllText('{{MTD_MONTH}}',       monthLabel);
  pres.replaceAllText('{{MTD_SPEND}}',       fmtCurrency_(totalSpend));
  pres.replaceAllText('{{MTD_REACH}}',       fmtNumber_(totalReach));
  pres.replaceAllText('{{MTD_IMPRESSIONS}}', fmtNumber_(totalImpr));
  pres.replaceAllText('{{MTD_CTR}}',         avgCtr > 0 ? fmtPercent_(avgCtr) : '—');
  pres.replaceAllText('{{MTD_CPC}}',         avgCpc > 0 ? fmtCurrency2dp_(avgCpc) : '—');
  pres.replaceAllText('{{MTD_RESULT1}}',     fmtNumber_(g1.count));
  pres.replaceAllText('{{MTD_CPR1}}',        g1.avgCpr > 0 ? fmtCurrency2dp_(g1.avgCpr) : '—');
  pres.replaceAllText('{{MTD_RESULT2}}',     g2 ? fmtNumber_(g2.count) : '—');
  pres.replaceAllText('{{MTD_CPR2}}',        g2 ? (g2.avgCpr > 0 ? fmtCurrency2dp_(g2.avgCpr) : '—') : '—');
  pres.saveAndClose();  // close BEFORE fillTableHeaderLabels_ opens the same file

  // Set column header labels directly in table cells — must run AFTER pres.saveAndClose()
  // because fillTableHeaderLabels_ opens its own handle to the same presentation
  var cprShortLabel = function(label) {
    return label.replace('LANDING PAGE VIEWS','LPV')
                .replace('FORM LEADS','CPL')
                .replace('WEB LEADS','CPL')
                .replace('CLICKS','CPC')
                .replace('RESULTS','CPR');
  };
  Logger.log('fillMTDRow_: g1=' + g1.label + ' count=' + g1.count +
             (g2 ? ', g2=' + g2.label + ' count=' + g2.count : ', g2=null'));
  fillTableHeaderLabels_(presId,
    g1.label,
    cprShortLabel(g1.label),
    g2 ? g2.label : '—',
    g2 ? cprShortLabel(g2.label) : '—'
  );
}

function callAI_(prompt) {
  if (GROQ_API_KEY && GROQ_API_KEY !== 'PASTE_YOUR_GROQ_KEY_HERE') {
    try { return callGroq_(prompt); }
    catch(e) { Logger.log('Groq failed: ' + e.message.substring(0,60)); }
  }
  if (GEMINI_API_KEY && GEMINI_API_KEY !== 'PASTE_YOUR_GEMINI_KEY_HERE') {
    try { return callGemini_(prompt); }
    catch(e) { Logger.log('Gemini failed: ' + e.message.substring(0,60)); }
  }
  return '[AI unavailable — check API keys]';
}
function callGroq_(prompt) {
  const r = JSON.parse(UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions',{
    method:'post', contentType:'application/json',
    headers:{'Authorization':'Bearer '+GROQ_API_KEY},
    payload:JSON.stringify({
      model:'llama-3.3-70b-versatile',  // larger model — better instruction following, no truncation
      max_tokens:500,                    // increased from 300 — gives full sentences room to complete
      temperature:0.4,
      messages:[{role:'user',content:prompt}]
    }),
    muteHttpExceptions:true
  }).getContentText());
  if (r.error) throw new Error(r.error.message);
  return r.choices[0].message.content.trim();
}
function callGemini_(prompt) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    'gemini-2.5-flash:generateContent?key=' + GEMINI_API_KEY;
  const r = JSON.parse(UrlFetchApp.fetch(url,{
    method:'post', contentType:'application/json',
    payload:JSON.stringify({contents:[{parts:[{text:prompt}]}]}),
    muteHttpExceptions:true
  }).getContentText());
  if (r.error) throw new Error(r.error.message);
  return r.candidates[0].content.parts[0].text.trim();
}


// ============================================================================
// HELPERS
// ============================================================================

function getAllSlideText_(slide) {
  return getAllElementsText_(slide.getPageElements());
}
function getAllElementsText_(elements) {
  let text = '';
  elements.forEach(el => {
    try {
      const type = el.getPageElementType();
      if (type === SlidesApp.PageElementType.SHAPE)
        text += ' ' + el.asShape().getText().asString();
      else if (type === SlidesApp.PageElementType.TABLE) {
        const t = el.asTable();
        for (let r=0;r<t.getNumRows();r++)
          for (let c=0;c<t.getNumColumns();c++)
            text += ' ' + t.getCell(r,c).getText().asString();
      } else if (type === SlidesApp.PageElementType.GROUP)
        text += getAllElementsText_(el.asGroup().getChildren());
    } catch(e) {}
  });
  return text;
}

function shrinkTitle_(slide, campaignName) {
  slide.getPageElements().forEach(el => {
    try {
      if (el.getPageElementType() !== SlidesApp.PageElementType.SHAPE) return;
      const tr = el.asShape().getText();
      if (!tr.asString().includes(campaignName)) return;
      const paras = tr.getParagraphs();
      const subText = paras.slice(1).map(p => p.getRange().asString()).join('');
      const sz = subText.length > 70 ? 14 : subText.length > 50 ? 16
               : subText.length > 35 ? 18 : 20;
      paras.forEach((p, i) => { if (i > 0) p.getRange().getTextStyle().setFontSize(sz); });
    } catch(e) {}
  });
}

/**
 * Calculates an Account Health Score (0-100) from weekly campaign data.
 * Score is used to generate a client-friendly badge on the cover slide.
 * When score < 50, we show "Active Optimization Phase" instead of the number
 * so poor weeks are never embarrassing to share with clients.
 */
function calculateAccountHealth_(weeklyRows) {
  if (!weeklyRows || weeklyRows.length === 0) return { score: 0, badge: '⚙️ Active Optimization Phase — improvements underway' };

  // Aggregate across all campaigns
  let totalResults = 0, totalSpend = 0;
  const ctrs = [], freqs = [];
  let prevResults = 0, prevSpend = 0, prevCprs = [];

  weeklyRows.forEach(row => {
    totalResults += parseCellNum_(row.results);
    totalSpend   += parseCellNum_(row.spend);
    const ctr = parseCellNum_(row.ctr);
    if (ctr > 0) ctrs.push(ctr);
    const freq = parseCellNum_(row.frequency) ||
      (parseCellNum_(row.reach) > 0 ? parseCellNum_(row.impressions)/parseCellNum_(row.reach) : 0);
    if (freq > 0) freqs.push(freq);

    // WoW data
    const prev = null; // WoW removed
    if (prev) { prevResults += prev.results; prevSpend += prev.spend; }
    const cpr = parseCellNum_(row.cpr);
    if (cpr > 0) prevCprs.push(cpr);
  });

  const avgCtr  = ctrs.length  ? ctrs.reduce((a,b)=>a+b,0)/ctrs.length   : 0;
  const avgFreq = freqs.length ? freqs.reduce((a,b)=>a+b,0)/freqs.length : 0;
  const currentCpr = totalResults > 0 ? totalSpend / totalResults : 0;
  const prevCpr    = prevResults  > 0 ? prevSpend  / prevResults  : 0;
  const hasWoW     = prevResults > 0 || prevSpend > 0;

  let score = 0;

  // 1. Results delivery (35 pts)
  if (totalResults > 0) {
    if (hasWoW && totalResults > prevResults) score += 35;
    else if (hasWoW && totalResults < prevResults) score += 15;
    else score += 25; // has results, no WoW comparison
  } else {
    score += 5; // paused or zero results
  }

  // 2. CTR engagement (25 pts)
  if      (avgCtr >= 3.0) score += 25;
  else if (avgCtr >= 2.0) score += 20;
  else if (avgCtr >= 1.0) score += 13;
  else if (avgCtr >= 0.5) score += 6;
  else if (avgCtr  > 0)   score += 2;

  // 3. Audience frequency health (20 pts)
  if      (avgFreq === 0)    score += 14; // no frequency data — neutral
  else if (avgFreq < 2.0)   score += 20;
  else if (avgFreq < 2.5)   score += 17;
  else if (avgFreq < 3.5)   score += 12;
  else if (avgFreq < 5.0)   score += 5;
  // else freq >= 5 → 0 pts

  // 4. Cost efficiency WoW (20 pts)
  if (!hasWoW)                             score += 12; // no comparison data — neutral
  else if (prevCpr > 0 && currentCpr > 0 && currentCpr < prevCpr) score += 20; // CPR improved
  else if (prevCpr > 0 && currentCpr > 0 && currentCpr > prevCpr) score += 5;  // CPR worsened
  else                                     score += 12;

  score = Math.min(100, Math.max(0, score));

  // Generate client-safe badge text
  // Show actual score number only when ≥ 70 — below that it can look bad to clients
  let badge;
  if      (score >= 80) badge = '🟢 Weekly Performance Score: ' + score + '/100 — Excellent';
  else if (score >= 70) badge = '🟢 Weekly Performance Score: ' + score + '/100 — Good';
  else if (score >= 50) badge = '🟡 Campaigns On Track — performing as expected this week';
  else                  badge = '⚙️ Campaigns under active optimisation this week';

  Logger.log('Account Health Score: ' + score + '/100 → "' + badge + '"');
  return { score, badge };
}

/**
 * Reads the monthly budget from the "Budgets" tab (B1 cell).
 * Returns null if the tab doesn't exist or is empty.
 */
function readMonthlyBudget_() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BUDGETS_TAB);
    if (!sheet) return null;
    const val = sheet.getRange('B1').getValue();
    const budget = parseFloat(String(val).replace(/[,$\s]/g,''));
    return isNaN(budget) || budget <= 0 ? null : budget;
  } catch(e) {
    Logger.log('Budget read skipped: ' + e.message);
    return null;
  }
}

/**
 * Fills the health badge and budget summary on the cover slide.
 * Called immediately after the standard cover tags are filled.
 */
function fillCoverExtras_(presId, weeklyRows, preloadedMtdRows) {
  const { badge } = calculateAccountHealth_(weeklyRows);

  // Budget utilization using MTD spend vs monthly budget
  let budgetLine = '';
  const monthlyBudget = readMonthlyBudget_();
  if (monthlyBudget) {
    // Calculate MTD spend from MTD CSV
    let mtdSpend = 0;
    if (preloadedMtdRows && preloadedMtdRows.length > 0) {
      preloadedMtdRows.forEach(r => { mtdSpend += parseCellNum_(r.spend); });
      Logger.log('Budget MTD spend: $' + mtdSpend.toFixed(2));
    } else {
      try {
        const { rows: mtdRows } = readTabWithAutoMap_(MTD_TAB);
        mtdRows.forEach(r => { mtdSpend += parseCellNum_(r.spend); });
      } catch(e) {
        weeklyRows.forEach(r => { mtdSpend += parseCellNum_(r.spend); });
      }
    }

    // Days remaining in current month
    const now      = new Date();
    const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = lastDay - now.getDate();
    const pctUsed  = (mtdSpend / monthlyBudget * 100).toFixed(1);

    budgetLine = 'Monthly Budget: $' + mtdSpend.toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:0}) +
      ' of $' + monthlyBudget.toLocaleString('en-US') +
      ' used (' + pctUsed + '%) — ' + daysLeft + ' days remaining';
  }

  const pres = SlidesApp.openById(presId);
  pres.replaceAllText('{{ACCOUNT_HEALTH_BADGE}}', badge);
  pres.replaceAllText('{{BUDGET_SUMMARY}}',       budgetLine);
  pres.saveAndClose();
  Logger.log('Cover extras filled. Budget line: ' + (budgetLine || 'hidden (no Budgets tab)'));
}


/**
 * Draws a performance chart slide NATIVELY using Google Slides shapes.
 * No external API, no QuickChart, no network calls — guaranteed to work.
 * Creates two horizontal bar sections: Ad Spend and Results per campaign.
 */
function addVisualScorecardSlide_(presId, campaignNames, campaignGroups, periodLabel) {
  if (!campaignNames || campaignNames.length === 0) return;
  Logger.log('=== Chart slide: ' + (periodLabel||'MTD') + ', ' + campaignNames.length + ' campaigns ===');
  try {
    var label = periodLabel || 'MTD';

    // ── Aggregate MTD metrics per campaign ───────────────────────────────────
    var totalAllSpend = 0;
    var TYPE_COLOR = {
      'LEADS': '#f6ad55', 'FORM LEADS': '#f6ad55', 'WEB LEADS': '#fc8181',
      'CLICKS': '#63b3ed', 'REACH': '#68d391', 'LPV': '#b794f4', 'CONV': '#76e4f7',
    };
    var campData = campaignNames.map(function(name) {
      var rows    = campaignGroups[name] || [];
      var spend   = rows.reduce(function(s,r){return s+parseCellNum_(r.spend);},0);
      var results = rows.reduce(function(s,r){return s+parseCellNum_(r.results);},0);
      var ctrs    = rows.map(function(r){return parseCellNum_(r.ctr);}).filter(function(v){return v>0;});
      var avgCtr  = ctrs.length ? ctrs.reduce(function(a,b){return a+b;},0)/ctrs.length : 0;
      var rt      = rows[0] ? (rows[0].result_type||'') : '';
      var lbs     = getResultLabels_(rt);
      var rawCpr  = results > 0 ? spend / results : 0;
      var cpr     = lbs.resultLabel === 'REACH' ? rawCpr * 1000 : rawCpr;
      totalAllSpend += spend;
      return { name:name, spend:spend, results:results, cpr:cpr, avgCtr:avgCtr,
               resLabel:lbs.resultLabel, cprLabel:lbs.costLabel };
    });

    // ── Slide setup ──────────────────────────────────────────────────────────
    var pres      = SlidesApp.openById(presId);
    var allSlides = pres.getSlides();
    // Duplicate last slide (safe) then cover everything with a dark rectangle
    var slide     = allSlides[allSlides.length - 1].duplicate();
    var W = pres.getPageWidth();    // ~960 pts
    var H = pres.getPageHeight();   // ~540 pts
    Logger.log('W=' + W + ' H=' + H);

    // COVER all existing template content with full-slide dark rectangle
    try {
      var bg = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, 0, 0, W, H);
      bg.getFill().setSolidFill('#080f1e');
      try { bg.getBorder().setTransparent(); } catch(be) {}
      Logger.log('Background cover applied');
    } catch(bge) { Logger.log('BG error: ' + bge.message); }

    // ── TITLE ────────────────────────────────────────────────────────────────
    try {
      var ttl = slide.insertTextBox('MTD CAMPAIGN PERFORMANCE', 0, 8, W, 34);
      ttl.getText().getTextStyle().setFontSize(28).setBold(true).setForegroundColor('#ffffff');
      ttl.getText().getParagraphs()[0].getRange().getParagraphStyle()
        .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
    } catch(te) { Logger.log('Title: ' + te.message); }

    try {
      var sub = slide.insertTextBox(
        'Total MTD Spend:  ' + CURRENCY_SYMBOL + Math.round(totalAllSpend).toLocaleString('en-US')
        + '     ·     ' + campData.filter(function(d){return d.spend>0;}).length + ' Active Campaign' +
        (campData.filter(function(d){return d.spend>0;}).length === 1 ? '' : 's'),
        0, 44, W, 24);
      sub.getText().getTextStyle().setFontSize(18).setBold(false).setForegroundColor('#ffffff');
      sub.getText().getParagraphs()[0].getRange().getParagraphStyle()
        .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
      sub.getText().getParagraphs()[0].getRange().getParagraphStyle()
        .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
    } catch(se) {}

    // ── CIRCULAR CAMPAIGN VISUALS ─────────────────────────────────────────────
    // One circle per campaign, arranged horizontally
    var n        = campData.length;
    var MARGIN   = 20;
    var COL_W    = Math.floor((W - MARGIN * (n+1)) / n);
    var CIRCLE_D = Math.min(COL_W - 20, 200);       // diameter of outer circle
    var INNER_D  = Math.round(CIRCLE_D * 0.70);     // inner dark circle = 30% ring width
    var CIRC_Y   = 158;                              // circle top — properly centers content in slide

    campData.forEach(function(d, ci) {
      var col    = TYPE_COLOR[d.resLabel] || '#a0aec0';
      var COL_X  = MARGIN + ci * (COL_W + MARGIN);
      var cx     = COL_X + Math.floor(COL_W / 2);  // column center x
      var circX  = cx - Math.floor(CIRCLE_D / 2);  // circle top-left x

      // Campaign name ABOVE circle
      try {
        // Use actual campaign name — clients need to recognise their own campaign
        var displayName = d.name.length > 40 ? d.name.substring(0,40)+'…' : d.name;
        var nBox = slide.insertTextBox(displayName, COL_X, CIRC_Y - 36, COL_W, 28);
        nBox.getText().getTextStyle().setFontSize(14).setBold(false).setForegroundColor('#ffffff');
        nBox.getText().getParagraphs()[0].getRange().getParagraphStyle()
          .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
        nBox.getText().getParagraphs()[0].getRange().getParagraphStyle()
          .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
      } catch(ne) {}

      var circTopY = CIRC_Y + 18;

      // ── OUTER COLORED CIRCLE (ring) ──────────────────────────────────────
      try {
        var outer = slide.insertShape(SlidesApp.ShapeType.ELLIPSE,
          circX, circTopY, CIRCLE_D, CIRCLE_D);
        outer.getFill().setSolidFill(col);
        try { outer.getBorder().setTransparent(); } catch(be) {}
        Logger.log('Outer circle ci='+ci+' x='+circX+' y='+circTopY+' d='+CIRCLE_D);
      } catch(oe) { Logger.log('Outer '+ci+': '+oe.message); }

      // ── INNER DARK CIRCLE (creates donut ring effect) ───────────────────
      var innerOffset = Math.floor((CIRCLE_D - INNER_D) / 2);
      try {
        var inner = slide.insertShape(SlidesApp.ShapeType.ELLIPSE,
          circX + innerOffset, circTopY + innerOffset, INNER_D, INNER_D);
        inner.getFill().setSolidFill('#080f1e');
        try { inner.getBorder().setTransparent(); } catch(be) {}
      } catch(ie) { Logger.log('Inner '+ci+': '+ie.message); }

      // ── SPEND AMOUNT (centered in donut hole) ────────────────────────────
      var centerY  = circTopY + Math.floor(CIRCLE_D / 2);
      var textBoxW = INNER_D - 10;
      var textBoxX = cx - Math.floor(textBoxW / 2);

      try {
        var sv = slide.insertTextBox(
          CURRENCY_SYMBOL + Math.round(d.spend).toLocaleString('en-US'),
          textBoxX, centerY - 22, textBoxW, 24);
        sv.getText().getTextStyle()
          .setFontSize(n <= 2 ? 20 : 16).setBold(true).setForegroundColor('#ffffff');
        sv.getText().getParagraphs()[0].getRange().getParagraphStyle()
          .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
      } catch(sve) { Logger.log('Spend '+ci+': '+sve.message); }

      try {
        var sl = slide.insertTextBox('AD SPEND', textBoxX, centerY + 4, textBoxW, 12);
        sl.getText().getTextStyle().setFontSize(11).setForegroundColor('#7ab0cc');
        sl.getText().getParagraphs()[0].getRange().getParagraphStyle()
          .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
      } catch(sle) {}

      // ── METRICS BELOW CIRCLE ─────────────────────────────────────────────
      var belowY  = circTopY + CIRCLE_D + 10;
      var belowW  = COL_W;
      var belowX  = COL_X;

      // Divider line
      try {
        var divY = belowY;
        var div  = slide.insertShape(SlidesApp.ShapeType.RECTANGLE,
          cx - 30, divY, 60, 1);
        div.getFill().setSolidFill(col);
        try { div.getBorder().setTransparent(); } catch(be) {}
      } catch(de) {}

      // Results
      try {
        var rv = slide.insertTextBox(
          fmtNumber_(d.results),
          belowX, belowY + 6, belowW, 28);
        rv.getText().getTextStyle()
          .setFontSize(n <= 2 ? 28 : 24).setBold(true).setForegroundColor('#ffffff');
        rv.getText().getParagraphs()[0].getRange().getParagraphStyle()
          .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
      } catch(rve) { Logger.log('Results '+ci+': '+rve.message); }

      try {
        var rl = slide.insertTextBox(d.resLabel, belowX, belowY + 36, belowW, 12);
        rl.getText().getTextStyle().setFontSize(11).setForegroundColor('#7ab0cc');
        rl.getText().getParagraphs()[0].getRange().getParagraphStyle()
          .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
      } catch(rle) {}

      // CPR
      var cprTxt   = d.cpr > 0 ? CURRENCY_SYMBOL + d.cpr.toFixed(2) : '—';
      // Keep 'COST PER X' for non-reach labels; only shorten 'COST PER 1K REACH' → 'CP 1K REACH'
      var cprShort = d.cprLabel.replace('COST PER 1K ', 'CP 1K ');
      try {
        var cv = slide.insertTextBox(cprTxt, belowX, belowY + 52, belowW, 24);
        cv.getText().getTextStyle()
          .setFontSize(n <= 2 ? 20 : 17).setBold(true).setForegroundColor('#ffffff');
        cv.getText().getParagraphs()[0].getRange().getParagraphStyle()
          .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
      } catch(cve) { Logger.log('CPR '+ci+': '+cve.message); }

      try {
        var cl = slide.insertTextBox(cprShort, belowX, belowY + 76, belowW, 12);
        cl.getText().getTextStyle().setFontSize(11).setForegroundColor('#7ab0cc');
        cl.getText().getParagraphs()[0].getRange().getParagraphStyle()
          .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
      } catch(cle) {}
    });

    // ── SPEND PROPORTION BAR at very bottom ──────────────────────────────────
    try {
      var barY  = H - 12;
      var barOff = 0;
      campData.forEach(function(d) {
        var pct  = totalAllSpend > 0 ? d.spend / totalAllSpend : 1/campData.length;
        var segW = Math.max(Math.round(W * pct), 2);
        var col  = TYPE_COLOR[d.resLabel] || '#a0aec0';
        var seg  = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, barOff, barY, segW, 8);
        seg.getFill().setSolidFill(col);
        try { seg.getBorder().setTransparent(); } catch(be) {}
        barOff += segW;
      });
    } catch(bare) {}

    pres.saveAndClose();
    Logger.log('=== Chart slide saved (' + n + ' circles) ===');
  } catch(outer) {
    Logger.log('=== Chart FAILED: ' + outer.message + ' ===');
  }
}
// ============================================================================
// FONT FAMILY — applies Poppins to ALL text on ALL slides
// Called at the very end of generateWeeklyReport after everything is done.
// Poppins: modern, clean, highly readable at small sizes, premium look.
// ============================================================================

function applyFontsToPresentation_(presId) {
  try {
    var FONT  = 'Poppins';
    var pres  = SlidesApp.openById(presId);
    var count = 0;
    pres.getSlides().forEach(function(slide) {
      count += applyFontToElements_(slide.getPageElements(), FONT);
    });
    pres.saveAndClose();
    Logger.log('Poppins applied to ' + count + ' text elements across all slides.');
  } catch(e) {
    Logger.log('Font apply failed (non-fatal): ' + e.message);
  }
}

function applyFontToElements_(elements, font) {
  var count = 0;
  elements.forEach(function(el) {
    try {
      var type = el.getPageElementType();
      if (type === SlidesApp.PageElementType.SHAPE) {
        try {
          el.asShape().getText().getTextStyle().setFontFamily(font);
          count++;
        } catch(se) {}
      } else if (type === SlidesApp.PageElementType.TABLE) {
        var t = el.asTable();
        for (var r = 0; r < t.getNumRows(); r++) {
          for (var c = 0; c < t.getNumColumns(); c++) {
            try { t.getCell(r, c).getText().getTextStyle().setFontFamily(font); count++; } catch(ce) {}
          }
        }
      } else if (type === SlidesApp.PageElementType.GROUP) {
        count += applyFontToElements_(el.asGroup().getChildren(), font);
      }
    } catch(e) {}
  });
  return count;
}


function shrinkAdSetName_(slide, adSetName) {
  // Sets the ad set name paragraph to 18pt Poppins
  // The shape contains "YOUR WEEKLY PERFORMANCE REPORT\n[adSetName]"
  // so we must target the specific paragraph, not the whole shape
  slide.getPageElements().forEach(function(el) {
    try {
      if (el.getPageElementType() !== SlidesApp.PageElementType.SHAPE) return;
      var str = el.asShape().getText().asString();
      if (!str || !str.includes(adSetName.trim())) return;
      var paras = el.asShape().getText().getParagraphs();
      paras.forEach(function(para) {
        if (para.getRange().asString().trim() === adSetName.trim()) {
          para.getRange().getTextStyle().setFontSize(18);
        }
      });
    } catch(e) {}
  });
}

// ============================================================================
// RESTORE HEADING FONTS after applyFontsToPresentation_ and writeInsights_
// Ensures all slide headings stay at: 28pt (top line) / 18pt (campaign name)
// ============================================================================
function restoreHeadingFonts_(presId) {
  try {
    var pres = SlidesApp.openById(presId);
    pres.getSlides().forEach(function(slide) {
      slide.getPageElements().forEach(function(el) {
        try {
          if (el.getPageElementType() !== SlidesApp.PageElementType.SHAPE) return;
          var tf  = el.asShape().getText();
          var str = tf.asString();
          if (str.indexOf('YOUR WEEKLY PERFORMANCE REPORT') === -1) return;
          // This is the heading shape — restore correct sizes per paragraph
          var paras = tf.getParagraphs();
          paras.forEach(function(para, pi) {
            var ps  = para.getRange().asString().trim();
            var ts  = para.getRange().getTextStyle();
            if (ps === 'YOUR WEEKLY PERFORMANCE REPORT' || pi === 0) {
              ts.setFontSize(28); ts.setBold(true);
            } else if (ps.length > 0) {
              // Campaign / ad set name line
              ts.setFontSize(18);
            }
          });
        } catch(e) {}
      });
    });
    pres.saveAndClose();
    Logger.log('Heading fonts restored on all slides.');
  } catch(e) {
    Logger.log('restoreHeadingFonts_ failed: ' + e.message);
  }
}

// ============================================================================
// FIX PROSE FORMATTING — makes all AI-written text 13pt non-bold
// Runs as a final pass after ALL slides are complete, catching every slide.
// ============================================================================
function fixProseFormatting_(presId) {
  // Campaign Summary and Key Insights must be Poppins 13pt non-bold.
  // We use two methods simultaneously for reliability:
  //   1. tf.getRange(0, len) targets the entire text by index
  //   2. per-paragraph as a backup
  // Threshold: >50 chars (catches even short summaries) and not the slide heading.
  try {
    var pres  = SlidesApp.openById(presId);
    var total = 0;
    pres.getSlides().forEach(function(slide) {
      // Skip the chart slide entirely to preserve its 18pt subtitle and other sizing
      var isChartSlide = slide.getPageElements().some(function(e) {
        try {
          return e.getPageElementType() === SlidesApp.PageElementType.SHAPE &&
                 e.asShape().getText().asString().indexOf('MTD CAMPAIGN PERFORMANCE') !== -1;
        } catch(ec) { return false; }
      });
      if (isChartSlide) return;

      slide.getPageElements().forEach(function(el) {
        try {
          if (el.getPageElementType() !== SlidesApp.PageElementType.SHAPE) return;
          var tf  = el.asShape().getText();
          var txt = tf.asString();
          if (!txt || txt.length < 50) return;
          if (txt.indexOf('YOUR WEEKLY PERFORMANCE REPORT') !== -1) return;
          var len = txt.length;
          // Method 1: entire text range by index
          try { tf.getRange(0, len).getTextStyle().setBold(false).setFontSize(13); } catch(m1) {}
          // Method 2: each paragraph individually (belt + suspenders)
          tf.getParagraphs().forEach(function(para) {
            try { para.getRange().getTextStyle().setBold(false).setFontSize(13); } catch(pe) {}
          });
          total++;
        } catch(e) {}
      });
    });
    pres.saveAndClose();
    Logger.log('fixProseFormatting_: ' + total + ' boxes → 13pt non-bold.');
  } catch(e) {
    Logger.log('fixProseFormatting_ FAILED: ' + e.message);
  }
}

// Writes text into a tagged placeholder with explicit formatting.
// Uses clear() + appendText() instead of replaceAllText() so the new text
// never inherits the placeholder's bold/size formatting.
function writeTextWithStyle_(slide, tag, text, fontSize, isBold) {
  slide.getPageElements().forEach(function(el) {
    try {
      if (el.getPageElementType() !== SlidesApp.PageElementType.SHAPE) return;
      var tf = el.asShape().getText();
      if (tf.asString().indexOf(tag) === -1) return;
      tf.clear();
      tf.appendText(text);
      var ts = tf.getTextStyle();
      ts.setFontSize(fontSize);
      ts.setBold(isBold);
    } catch(e) { Logger.log('writeTextWithStyle_ ' + tag + ': ' + e.message); }
  });
}

// Recursively finds the shapes containing the summary and insights text
// and applies 13pt non-bold using getRuns() — the most reliable run-level method.
// Must recurse into GROUP shapes since CAMPAIGN_SUMMARY lives inside one.
function applyProseStyleInElements_(elements, summary, insights) {
  var checkTexts = [summary.trim().substring(0, 40), insights.trim().substring(0, 40)];
  elements.forEach(function(el) {
    try {
      var type = el.getPageElementType();
      if (type === SlidesApp.PageElementType.SHAPE) {
        var tf  = el.asShape().getText();
        var txt = tf.asString().trim();
        // Only target the Campaign Summary and Key Insights text boxes
        var isMatch = checkTexts.some(function(check) {
          return check.length > 10 && txt.indexOf(check) !== -1;
        });
        if (!isMatch) return;
        // Style each individual run — most reliable way to override inherited formatting
        var runs = tf.getRuns();
        if (runs && runs.length > 0) {
          runs.forEach(function(run) {
            try { run.getTextStyle().setBold(false).setFontSize(13); } catch(re) {}
          });
        }
        // Also apply to each paragraph as belt-and-suspenders
        tf.getParagraphs().forEach(function(para) {
          try { para.getRange().getTextStyle().setBold(false).setFontSize(13); } catch(pe) {}
        });
      } else if (type === SlidesApp.PageElementType.GROUP) {
        // Recurse into groups — CAMPAIGN_SUMMARY text box is inside a group
        applyProseStyleInElements_(el.asGroup().getChildren(), summary, insights);
      }
    } catch(e) {}
  });
}


// Directly sets table header label cells by matching placeholder text.
// More reliable than replaceAllText which can fail when a tag is split
// across multiple text runs inside a table cell.
function fillTableHeaderLabels_(presId, g1Label, g1CprLabel, g2Label, g2CprLabel) {
  try {
    var pres = SlidesApp.openById(presId);
    var found = { r1:0, c1:0, r2:0, c2:0 };
    pres.getSlides().forEach(function(slide) {
      slide.getPageElements().forEach(function(el) {
        try {
          if (el.getPageElementType() !== SlidesApp.PageElementType.TABLE) return;
          var t = el.asTable();
          for (var r = 0; r < t.getNumRows(); r++) {
            for (var c = 0; c < t.getNumColumns(); c++) {
              try {
                var cell = t.getCell(r, c);
                var txt  = cell.getText().asString().trim();
                if (txt.indexOf('PERIOD_RESULT1_LABEL') !== -1) {
                  cell.getText().setText(g1Label);
                  found.r1++;
                  Logger.log('Set PERIOD_RESULT1_LABEL[' + r + ',' + c + '] = ' + g1Label);
                } else if (txt.indexOf('PERIOD_CPR1_LABEL') !== -1) {
                  cell.getText().setText(g1CprLabel);
                  found.c1++;
                } else if (txt.indexOf('PERIOD_RESULT2_LABEL') !== -1) {
                  cell.getText().setText(g2Label);
                  found.r2++;
                } else if (txt.indexOf('PERIOD_CPR2_LABEL') !== -1) {
                  cell.getText().setText(g2CprLabel);
                  found.c2++;
                }
              } catch(ce) {}
            }
          }
        } catch(e) {}
      });
    });
    pres.saveAndClose();
    Logger.log('fillTableHeaderLabels_: found=' + JSON.stringify(found));
  } catch(e) {
    Logger.log('fillTableHeaderLabels_ failed: ' + e.message);
  }
}


function getReportsFolder_(accountName) {
  const it = DriveApp.searchFolders(
    "title contains '" + accountName.replace(/'/g,"\\'") +
    "' and mimeType='application/vnd.google-apps.folder' and trashed=false"
  );
  const matches = [];
  while (it.hasNext()) {
    const f = it.next();
    if (f.getName().indexOf(accountName + ' (') === 0) matches.push(f);
  }
  if (matches.length === 0)
    throw new Error('No Drive folder starting with "' + accountName + ' (". Check Sheet name.');
  if (matches.length > 1)
    throw new Error('Multiple folders match "' + accountName + '" — rename one.');
  const sub = matches[0].getFoldersByName('Reports');
  if (!sub.hasNext())
    throw new Error('"' + matches[0].getName() + '" has no Reports subfolder.');
  return sub.next();
}
