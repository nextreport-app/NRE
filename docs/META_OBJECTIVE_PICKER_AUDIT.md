# Meta objective picker coverage

Audited against the uploaded `All Known Meta Obectives_Conversion Location_Performance Goal_Conversion Event.xlsx`. Its single worksheet matches the stored reference exactly: 106 performance-goal rows and 192 continuation event rows. Events appearing beside a performance goal are stored on that goal row; they are not missing event entries.

The wizard chooses a **primary reporting result**, not merely a Meta campaign category. Awareness, Traffic, Engagement, Leads, App promotion, Sales and Catalogue sales can each produce several different primary results. The picker therefore offers specific results such as purchases, website leads, reach and link clicks. Search also indexes campaign categories, conversion locations, performance goals, events and CSV aliases.

Gaps corrected:

- Contacts and Trials Started were supported by the engine but absent from manual selection.
- ThruPlays and 2-second video views were absent as distinct selections. Generic Video Views no longer implies that it also means ThruPlays.
- Donations used the noncanonical `donations` key instead of the dictionary's `donate` key. The visible name remains DONATIONS.
- New dictionary entries are appended automatically while preserving the existing order and leaving RESULTS last. Existing unknown detected labels remain available through the Campaigns step's current-option fallback.

All 43 dictionary objectives are covered by the 44 distinct picker choices (including existing generic/legacy choices). Coverage tests assert unique keys and labels and a selectable mapping for every reference row. This confirms coverage of the supplied workbook and current engine catalog, rather than claiming knowledge of every future or account-specific Meta event/custom conversion.

The search panel expands within the objective card to avoid clipping inside the existing details container. It supports keyboard navigation/selection, focus return on Escape, Tab/outside-click dismissal, selected-state indicators and no-match feedback. The change does not alter automatic detection or metric calculations, or expose API imports in the report wizard.
