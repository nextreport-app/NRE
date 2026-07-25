-- Store the EXCLUDED campaign set instead of the selected one, so a brand
-- new campaign in a later upload defaults to selected (it's simply absent
-- from this list) rather than needing to be re-discovered as "new".
ALTER TABLE "Client" RENAME COLUMN "lastSelectedCampaigns" TO "lastDeselectedCampaigns";

-- Any previously-saved value was in the old "selected" format, which can't
-- be safely reinterpreted as "deselected" — we never stored the full
-- campaign list from that upload, so there's no way to compute the correct
-- excluded set from it. Clear it so the next upload just defaults to
-- "everything selected" instead of silently inverting a saved choice.
UPDATE "Client" SET "lastDeselectedCampaigns" = NULL WHERE "lastDeselectedCampaigns" IS NOT NULL;
