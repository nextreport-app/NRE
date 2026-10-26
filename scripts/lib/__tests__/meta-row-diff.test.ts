import { describe, expect, it } from "vitest";
import { csvEvidence, diffRows, insightEvidence } from "../meta-row-diff";

const header = 'Campaign name,Ad set name,Day,Result type,Results,Amount spent (USD),Cost per result';
const csv = (rows: string[]) => [header, ...rows].join('\n');
const example = 'Campaign A,Set A,2026-10-01,website submission,2,20,10';

describe('offline Meta row evidence diff', () => {
  it('exposes cancelling daily errors despite equal period totals', () => {
    const manual = csvEvidence(csv([example, example.replace('10-01', '10-02')]));
    const api = csvEvidence(csv([
      'Campaign A,Set A,2026-10-01,website submission,1,20,20',
      'Campaign A,Set A,2026-10-02,website submission,3,20,6.6666667',
    ]));
    const diff = diffRows(manual, api);
    expect(diff.manualTotals.resultsByType).toEqual(diff.apiTotals.resultsByType);
    expect(diff.summary.different).toBe(2);
    expect(diff.rows[0].differences.find(d => d.field === 'results')?.delta).toBe(-1);
  });

  it('does not silently discard duplicates, missing days, or name-case changes', () => {
    const manual = csvEvidence(csv([example, example, example.replace('10-01', '10-02')]));
    const api = csvEvidence(csv([example, example.replace('Campaign A', 'campaign a')]));
    expect(diffRows(manual, api).summary).toEqual({ equal: 0, different: 0, 'manual-only': 1, 'api-only': 1, ambiguous: 1 });
  });

  it('preserves blank versus zero Results and CPR', () => {
    const manual = csvEvidence(csv(['Campaign A,Set A,2026-10-01,,,20,']));
    const api = csvEvidence(csv(['Campaign A,Set A,2026-10-01,,0,20,0']));
    expect(diffRows(manual, api).rows[0].differences.map(d => d.field)).toEqual(['results', 'cpr']);
  });

  it('keeps exact Results separate from Results (initial), and handles quoted names', () => {
    const rows = csvEvidence(csv(['"A, B",Set A,01-10-2026,website submission,2,20,10']).replace('Cost per result\n', 'Cost per result,Results (initial)\n') + ',99');
    expect(rows[0]).toMatchObject({ campaign: 'A, B', day: '2026-10-01', results: 2 });
    expect(() => csvEvidence(csv([example]).replace('Results,', 'Results,Results,').replace(',2,20', ',2,2,20'))).toThrow('exactly one Results');
  });

  it('rejects malformed metrics, invalid dates, and multi-day totals', () => {
    expect(() => csvEvidence(csv([example.replace(',2,20', ',oops,20')]))).toThrow('Invalid Results');
    expect(() => csvEvidence(csv([example.replace('2026-10-01', '2026-02-30')]))).toThrow('Invalid daily date');
    expect(() => csvEvidence(csv([example]).replace('Day,', 'Reporting starts,Reporting ends,').replace('2026-10-01,', '2026-10-01,2026-10-02,'))).toThrow('spans multiple days');
  });

  it('runs the actual mapper on raw Insights and retains its selected action', () => {
    const input = [{ campaign_name: 'Website Leads', adset_name: 'Set A', date_start: '2026-10-01', date_end: '2026-10-01', spend: '20',
      actions: [{ action_type: 'offsite_conversion.fb_pixel_lead', value: '2' }],
      results: [{ indicator: 'actions:offsite_conversion.fb_pixel_lead', values: [{ value: '2' }] }],
      cost_per_result: [{ indicator: 'actions:offsite_conversion.fb_pixel_lead', values: [{ value: '10' }] }],
    }];
    const mapped = insightEvidence(input);
    expect(mapped.rows[0]).toMatchObject({ resultType: 'website submission', results: 2, cpr: 10 });
    expect(mapped.decisions[0]).toMatchObject({ selected: { action_type: 'offsite_conversion.fb_pixel_lead', value: '2' } });
    expect(() => insightEvidence({ data: input, paging: { next: 'more' } })).toThrow('all pages');
  });
});
