# Output acceptance status — 15 November 2026

The agreed outputs are PowerPoint (.pptx), Google Slides and browser view. PDF is out of scope and is not a required product feature or acceptance upload. Internal rendering used during engineering inspection does not change that output scope.

The user confirms that the downloaded PPT opens correctly in Microsoft PowerPoint. The provided Google Slides link reports a completed save/conversion from the user's side; the environment proxy prevented independent inspection. Google Slides and browser-view opening/layout can be confirmed by the user directly without exporting a PDF or providing credentials.

The latest supplied API source export covers November 1–13 only. Its ad-set/day keys match the manual export for the overlapping period, and nonblank result quantities agree. Two rows preserve the distinction between a blank manual Results cell and an API zero. A small delivery difference is already present in the source snapshots rather than introduced by PowerPoint arithmetic. This does not establish the cause of the source difference or certify October parity.

October's previously observed one-lead difference remains open because no October API rows were supplied. The next required evidence is an October 1–31 API source CSV and a fresh Ads Manager day-wise CSV for the same account/period, captured close in time. No new report generation is required to obtain the API source: Monthly → October → Sync & analyze → Source data → Download synced CSV.

The offline comparison reader now accepts an explicit `Result type` alongside a separate `Result indicator`, preserving the latter as provider metadata. It continues to reject genuine duplicate headers and does not silently fill blank types or equate different result labels.
