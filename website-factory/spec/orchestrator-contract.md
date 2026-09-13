# Orchestrator/CLI contract for next Sol implementation task

User requires full running factory, not documentation. User permits one live lead https://polireagency.vercel.app with TOTAL USD 2 including startup probes. Original www URL has TLS failure; non-www was actually fetched HTTP200. No secret in chat; .env prepared/gitignored, possibly user edits later. Keep TLS checks. Live qualification can correctly stop; do not invent problems to force Builder.

Implement src/orchestrator.ts exporting class Factory:
- constructor(config:FactoryConfig, store:Store, options?:{provider?:ModelProvider})
- runLead(website:string, opts?:{stopAfter?:AgentName;runId?:string;experimental?:boolean}):Promise<JsonObject>
- resume(runId:string, expectedRevision?:number):Promise<JsonObject>
- show(runId:string):JsonObject
- approvePreview(runId:string, expectedHash:string):JsonObject
- draftSales(runId:string):Promise<JsonObject>
- setContact(runId:string,status:'approved'|'unknown'|'blocked',reason:string):JsonObject
- approveOutreach(runId:string,expectedHash:string):JsonObject
- exportDraft(runId:string,kind:'internal'|'ready'):Promise<JsonObject>
- pause(runId:string):void; cancel(runId:string):void; deleteLead(leadId:string):Promise<void>

runLead persists job/context after every completed stage; no model approval. End at preview waiting approval, qualification stop, or meaningful blocker. Fixture explicit mode accepts deterministic fixture agent outputs but actual renderer/browser tests; visual QA fixture may use expected fixture judgments clearly marked simulated. Human approvals stay manual even fixture except a separate demo command may explicitly simulate operator actions, visibly labelled. Validated outputs processed by agents.ts, same production validators; no bypass of actual renderer/browser failures.

Context shape from agent owner soon: seed,campaign,offer,agency,template,crawl,profile,audit,qualification,brief,siteSpec,qa,browser,approvedAssets.

A cache key hashes projected input + schema + prompt + model config + relevant policy + fixture/live marker. Store final steps in kind steps. If same exact seed/config rerun reuses records/artifacts; never resets budget counter to create unbounded repeats. Dirty dependencies invalidate affected stages + approvals. Step claim fencing required in SQLite (Store.db available); revision-checked operator updates transactions.

Budget tracking doc/infra agent owns implementation. Provider invokes per agent within persisted limits. Runtime context model inputs MUST validate Input schema; files referenced in images map to actual attachment bytes provider.

CLI belongs same implementation task, src/cli.ts via commander. Commands planned spec/factory.md 7.18. At minimum demo, doctor, run --domain --mode [--stop-after] [--budget-usd], show, resume, preview open/approve, sales draft, contact set, outreach approve, export, pause/cancel/delete, lead import, eval run/review/report. No SMTP or send APIs. Mode flag explicit live, no paid default. .env loaded from project root plus config path with no output of secrets. Default user-specific live config budget 2 USD; any CLI budget >2 requires explicitly new operator config, do not silently exceed. All doctor probes share an overall/day 2 USD account.

External preview optional: do not invent deployment. Local full fixture E2E allowed simulated external context labelled fixture; live ready export requires actual externally authenticated preview and exact manifest verification. Implement an explicit attach/verify external preview command or deliver static protected-host integration as configuration; otherwise clear needs_input, never claim customer reachable from localhost.

Tests must exercise valid/invalid approvals, contact blocks, stale artifact hashes, cached rerun, resume, missing key, CLI fixture invocation, actual Playwright demo render. Persist usage/mode in report. README commands runnable exact.
