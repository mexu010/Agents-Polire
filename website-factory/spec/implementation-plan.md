# Factory implementation plan

Approved objective: implement the complete Factory specification in spec/factory.md. This separate project does not modify the POLIRE agency website.

## Shared architecture and ownership

Node 24, TypeScript, builtin node:sqlite, AJV 2020 JSON schemas, official OpenAI SDK, React server rendering, Playwright and Lighthouse. All ESM local imports use .js extensions. npm lockfile is owned by coordinator.

1. Infrastructure owner: src/config.ts, src/store.ts, src/provider.ts, infrastructure tests. Persist atomic budgets, attempts, generic stage artifacts, jobs, approvals. Official SDK usage and bounded retries.
2. Renderer owner: src/renderer.tsx, src/preview.ts, src/browser-tests.ts, renderer tests. Safe declarative rendering and actual browser checks, protected preview access and manual export support.
3. Agent owner: src/agents.ts, src/scoring.ts, src/fixtures.ts, prompts/, agent tests. Seven prompt modules, validation and semantic grounding; fixture outputs distinctly marked. Deterministic scoring per spec.
4. Coordinator: src/contracts.ts, src/crawler.ts, src/orchestrator.ts, src/cli.ts, eval runner, integration tests, README and final verification.

All owners write meaningful tests before implementation, run them, and report remaining gaps. Shared interfaces below are binding; notify coordinator before incompatible changes. Do not touch files owned by others.

## Interface contract

Dynamic schema-shaped values use JsonObject = Record<string, any> ONLY at validated JSON boundary, not unconstrained model outputs. contracts.ts exports validate(name:string, value:unknown): JsonObject, schemaFor(name:string): object, hash(value:unknown): string, id():string, now():string, type AgentName='scout'|'audit'|'qualifier'|'strategist'|'builder'|'qa'|'sales'. Contracts file supplied.

Config: export loadConfig(file?:string):FactoryConfig; defaultConfig():FactoryConfig; FactoryConfig properties dataDir:string, mode:'fixture'|'live', models: Record<AgentName,{provider:'openai'|'anthropic',model:string,reasoning_effort:'low'|'medium',max_input_tokens:number,max_output_tokens:number}>, budgets:{leadMicroUsd:number|null,runMicroUsd:number|null,dayMicroUsd:number|null}, escalation:{enabled:boolean}, campaign:JsonObject, offer:JsonObject, agency:JsonObject|null, autoGenerate:boolean, prices:Record<string,Price>, limits:{maxDispatches:number,maxOutputRepairs:number,maxUpgrades:number,maxSiteRepairs:number}, and crawler/preview settings as needed (notify coordinator). default mode fixture, no paid defaults. Runtime roles exact spec models. Operator configuration values validated.

Store: class Store {constructor(dataDir:string); db publicly accessible node:sqlite DatabaseSync; close(); get(kind:string,id:string):any|null; put(kind:string,id:string,value:unknown):void; list(kind:string):any[]; transaction<T>(fn:()=>T):T; } Generic records are sufficient for orchestration if real normalized budget/attempt tables also supplied. Add budget methods and document signatures to coordinator. All put writes atomic; concurrency fencing designed in orchestrator. No commits without coordinator request.

Provider: class ModelProvider {constructor(config:FactoryConfig,store:Store); invoke(args:{agent:AgentName,input:JsonObject,runId:string,leadId:string,stepId:string,modelOverride?:string,repair?:{reason:string},images?:Array<{path:string,evidence_id:string}>}):Promise<JsonObject>; doctor():Promise<JsonObject>; } invoke returns validated ModelOutput, uses prompts from agents.ts via exported promptFor(agent). No fixture dispatch inside provider; fixture mode handled orchestrator. Global dispatch+repair+upgrade counters in persisted step records/attempt table; expose details. doctor live budget scope not bypassed.

Agents: promptFor(agent):string; processAgentOutput(agent,output,input):JsonObject returns registered/derived result after validate+semantic checks. process scout produces Profile plus pages/assets; audit produces AuditResult; qualifier produces Qualification; strategist produces Brief; builder produces SiteSpec; qa produces QAResult; sales produces draft content only. IDs through contracts.id. Export fixtureInput():JsonObject seed/campaign/source data and fixtureOutput(agent,input):JsonObject conforms schema. Export buildAgentInput(agent, context:JsonObject):JsonObject if useful; coordinate context. Do not put fixture behavior in production output validators. Export scoreQualification(profile,audit,qualifierData,campaign,offer,template):JsonObject. Exact schema field names from contracts.

Renderer: renderSite({siteSpec:JsonObject,profile:JsonObject,assets:JsonObject[],outputDir:string,mode:'fixture'|'live'}):Promise<{artifactDir:string,manifest:JsonObject,hash:string,build:JsonObject}>; render deterministic complete HTML for each page using React; hardwired noindex/no submission. Preview: startPreview({artifactDir:string,token:string,port?:number,expiresAt?:string}):Promise<{url:string,close:()=>Promise<void>}>. Protected local server; user URL must permit actual viewer. Browser: runBrowserTests({artifactDir:string,siteSpec:JsonObject,profile:JsonObject,outputDir:string}):Promise<{results:JsonObject[],requiredChecks:JsonObject[],evidence:JsonObject[],images:Array<{path:string,evidence_id:string}>,build:JsonObject}>. Actual Playwright at 375/768/1440, metadata all actual. QA-model checks separate from runtime checks, never auto-pass visual checks. Use Chrome channel if bundled chromium unavailable, document browser install.

Crawler coordinator: collect(url, options) returns profile source bundle with evidence, images, crawl_pages, technology_observations, metrics; safe network egress proxy for browsers, robots and hard bounds.

## Progress

- Repository and schema imported. Implementation in progress.
- Live test URL/budget requested asynchronously; no secret requested in chat.
