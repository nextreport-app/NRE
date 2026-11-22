# Agency report designs (Beta)

Account settings → Agency report designs. Client Manage → Report design selects the style for future Meta reports. Agency name/logo/white-label controls remain in the existing Branding section.

## Supported workflow

1. Download the Dark or Light starter. Use the same base when uploading.
2. Restyle artwork (PNG/JPEG), fills and borders. Keep the four starter slides, report text, placeholders, data-box positions and table sizes. The canvas remains the starter's widescreen size. Existing arbitrary agency decks need adaptation; this release does not infer or map arbitrary slide layouts. Generated sections and data fonts keep the standard readable layout and palette. Use the Light starter for light designs.
3. Upload a named `.pptx` up to 4 MB. Validation checks structure, fields, geometry, bounded ZIP expansion, images and unsupported content. Embedded fonts and notes are removed; report text remains portable Arial. No native Office renderer or external design service is required in production.
4. Download the generated sample report and open it in PowerPoint or Google Slides. It uses synthetic data, two campaign objectives, the budget cover, charts and tables; it is not a client report and does not consume a report credit or trigger emails/webhooks. Check readability before checking the review box and approving the immutable design.
5. On each client's Manage page, select the approved design and save. The normal report wizard is unchanged. Existing clients use the dedicated Report design control rather than a second competing template dropdown in Client settings. New clients can still start with the built-in Dark/Light style.

Customization affects the PPTX and its imported Google Slides copy. Browser reports retain the responsive report layout and existing agency branding; this does not promise identical browser/PowerPoint layouts. Custom uploads are Meta-only; GA4 dashboards and deferred report platforms are not reinterpreted through these templates.

## Versioning, retention and access

- Each upload is an immutable version with its own private template/sample files and SHA-256 digest. Approval requires the current digest and explicit owner review. Only approved, active, owned templates can be assigned to owned clients.
- Report admission snapshots both the asset ID and Dark/Light variant. Workers and subsequent supported PPTX editor regenerations use that saved asset, even if the client changes designs or the library entry is archived. Legacy edit regeneration uses the original archive palette. Missing or altered saved bytes fail explicitly rather than silently switching layouts. Scheduled drafts use the same admission/rendering path.
- Archiving detaches the design from clients for future reports, leaving their matching built-in base style. Files remain available while existing reports refer to them. Unused designs can be removed; both private files enter the existing durable blob-deletion queue. An archived design can be removed after its last report expires or is deleted. There is a library limit of ten saved versions, including retained archived versions.
- Upload reservations, client assignment, archive/remove and report admission share the existing short database mutex. Partially failed uploads wait for both storage operations before cleanup. Stale upload reservations can be removed after 15 minutes; live uploads cannot be removed mid-write. Report-backed assets have a restrictive foreign key. A future account-deletion implementation must remove client reports before removing their template assets.
- Template/sample downloads are owner-only. Generated sample downloads reuse the tested range-capable PPTX delivery path. List/settings endpoints stay separate from the heavier upload/sample renderer. No public template URLs or cross-user access are exposed.

## Deployment and acceptance

Apply migration `20261122000600_agency_templates` through the normal build. Existing clients/reports keep their built-in choices until an owner explicitly selects a custom design. Existing Blob storage and verified active-account requirements apply to uploads. Agency designs are not enabled automatically for Express Text or any other client.

Automated coverage checks Dark/Light validation and sample package contents, no remaining data placeholders, preserved style changes, ownership/approval, quotas, upload cleanup, immutable report snapshots, archival retention, checksum failures and regeneration palette selection. Isolated desktop/mobile UI checks use mocked endpoints; they do not upload real files or change production designs. Native PowerPoint/Google Slides visual acceptance and a real private-Blob upload remain part of the owner's final review, because connected production storage/Office sessions were unavailable here. Before rollout, restyle a starter in the agency's actual PowerPoint version, upload it, inspect the sample, then test weekly/monthly/compare/daily/breakdown exports for that client's design.

This completes the compatible-starter design workflow, not unrestricted import of any agency deck. One-time layout adaptation or a future mapping/editor workflow is needed for existing decks with different structure.
