/**
 * Catalog of teams and the agent roster templates that staff them.
 *
 * The seed step (server/seed.ts) expands these templates into concrete Agent
 * records with generated ids. Each team is staffed with 10–20 agents to mirror
 * the "10–20 Agents" annotation in the architecture diagram.
 */

import type { AgentRole, TeamKind } from './types'

export interface AgentTemplate {
  name: string
  role: AgentRole
  skills: string[]
  model: string
}

export interface TeamTemplate {
  kind: TeamKind
  name: string
  mission: string
  /** The supervisor that fronts the team. */
  supervisor: AgentTemplate
  /** Worker agents (10–20 per team). */
  roster: AgentTemplate[]
}

const M_OPUS = 'claude-opus-4-8'
const M_SONNET = 'claude-sonnet-4-6'
const M_HAIKU = 'claude-haiku-4-5'

/** Helper to keep template authoring terse. */
function a(name: string, role: AgentRole, skills: string[], model = M_SONNET): AgentTemplate {
  return { name, role, skills, model }
}

export const TEAM_TEMPLATES: TeamTemplate[] = [
  {
    kind: 'backend',
    name: 'Backend Team',
    mission: 'Designs and implements APIs, services, business logic and persistence layers.',
    supervisor: a('Atlas', 'supervisor', ['system-design', 'api-contracts', 'coordination'], M_OPUS),
    roster: [
      a('Hermes', 'architect', ['microservices', 'event-driven', 'ddd'], M_OPUS),
      a('Vulcan', 'implementer', ['node', 'typescript', 'express']),
      a('Forge', 'implementer', ['go', 'grpc', 'concurrency']),
      a('Quill', 'implementer', ['python', 'fastapi', 'async']),
      a('Java', 'implementer', ['java', 'spring', 'jvm']),
      a('Rusty', 'implementer', ['rust', 'tokio', 'performance']),
      a('Schema', 'architect', ['rest', 'graphql', 'openapi']),
      a('Cache', 'optimizer', ['redis', 'caching', 'latency']),
      a('Queue', 'integrator', ['kafka', 'rabbitmq', 'messaging']),
      a('Auth', 'security', ['oauth2', 'jwt', 'rbac']),
      a('Migrate', 'implementer', ['sql', 'migrations', 'orm']),
      a('Probe', 'tester', ['integration-tests', 'contract-tests'], M_HAIKU),
      a('Sentinel', 'reviewer', ['code-review', 'best-practices']),
    ],
  },
  {
    kind: 'frontend',
    name: 'Frontend Team',
    mission: 'Builds responsive, accessible user interfaces and client-side state.',
    supervisor: a('Iris', 'supervisor', ['ui-architecture', 'coordination'], M_OPUS),
    roster: [
      a('Pixel', 'implementer', ['react', 'typescript', 'hooks']),
      a('Vue', 'implementer', ['vue', 'composition-api']),
      a('Svelte', 'implementer', ['svelte', 'reactivity']),
      a('Flutter', 'implementer', ['dart', 'flutter', 'mobile']),
      a('Style', 'designer', ['css', 'tailwind', 'design-systems']),
      a('Motion', 'designer', ['animation', 'framer-motion', 'gsap']),
      a('A11y', 'reviewer', ['accessibility', 'aria', 'wcag']),
      a('State', 'architect', ['redux', 'zustand', 'state-machines']),
      a('Bundle', 'optimizer', ['vite', 'webpack', 'code-splitting']),
      a('Form', 'implementer', ['forms', 'validation', 'ux']),
      a('Pixie', 'tester', ['e2e', 'playwright', 'cypress'], M_HAIKU),
      a('Render', 'optimizer', ['ssr', 'hydration', 'web-vitals']),
    ],
  },
  {
    kind: 'data',
    name: 'Data & ML Team',
    mission: 'Owns data pipelines, analytics, embeddings and machine-learning workflows.',
    supervisor: a('Oracle', 'supervisor', ['data-architecture', 'coordination'], M_OPUS),
    roster: [
      a('Pipe', 'implementer', ['etl', 'airflow', 'spark']),
      a('Frame', 'implementer', ['pandas', 'numpy', 'python']),
      a('Train', 'researcher', ['pytorch', 'training', 'ml']),
      a('Embed', 'researcher', ['embeddings', 'vector-db', 'rag']),
      a('Stream', 'implementer', ['flink', 'streaming', 'realtime']),
      a('Warehouse', 'architect', ['snowflake', 'bigquery', 'modeling']),
      a('Clean', 'implementer', ['data-quality', 'validation']),
      a('Chart', 'designer', ['visualization', 'd3', 'dashboards']),
      a('Tune', 'optimizer', ['hyperparameters', 'evaluation']),
      a('Serve', 'integrator', ['model-serving', 'inference', 'mlops']),
      a('Audit', 'reviewer', ['data-lineage', 'governance'], M_HAIKU),
    ],
  },
  {
    kind: 'devops',
    name: 'DevOps & Platform Team',
    mission: 'Automates CI/CD, infrastructure-as-code, scaling and observability.',
    supervisor: a('Titan', 'supervisor', ['platform', 'coordination'], M_OPUS),
    roster: [
      a('Helm', 'implementer', ['kubernetes', 'helm', 'containers']),
      a('Terra', 'implementer', ['terraform', 'iac', 'aws']),
      a('Pipeline', 'implementer', ['github-actions', 'ci-cd']),
      a('Docker', 'implementer', ['docker', 'images', 'registries']),
      a('Scale', 'optimizer', ['autoscaling', 'load-balancing']),
      a('Watch', 'integrator', ['prometheus', 'grafana', 'alerting']),
      a('Vault', 'security', ['secrets', 'kms', 'encryption']),
      a('Edge', 'implementer', ['cdn', 'cloudflare', 'networking']),
      a('Cost', 'optimizer', ['finops', 'cost-optimization']),
      a('Recover', 'reviewer', ['disaster-recovery', 'backups'], M_HAIKU),
    ],
  },
  {
    kind: 'security',
    name: 'Security Team',
    mission: 'Threat-models, audits and hardens the system against vulnerabilities.',
    supervisor: a('Aegis', 'supervisor', ['appsec', 'coordination'], M_OPUS),
    roster: [
      a('Scan', 'security', ['sast', 'dast', 'dependency-audit']),
      a('Pentest', 'security', ['pentest', 'owasp', 'exploit']),
      a('Crypto', 'security', ['cryptography', 'tls', 'signing']),
      a('Identity', 'security', ['iam', 'sso', 'zero-trust']),
      a('Comply', 'reviewer', ['gdpr', 'soc2', 'compliance']),
      a('Threat', 'researcher', ['threat-modeling', 'stride']),
      a('Patch', 'implementer', ['cve', 'remediation', 'hardening']),
      a('Secrets', 'validator', ['secret-detection', 'leakage'], M_HAIKU),
      a('Firewall', 'implementer', ['waf', 'network-security']),
      a('Forensic', 'reviewer', ['incident-response', 'logging']),
    ],
  },
  {
    kind: 'qa',
    name: 'QA & Testing Team',
    mission: 'Guarantees correctness through automated and exploratory testing.',
    supervisor: a('Verity', 'supervisor', ['quality-strategy', 'coordination'], M_OPUS),
    roster: [
      a('Unit', 'tester', ['unit-tests', 'jest', 'vitest'], M_HAIKU),
      a('Integ', 'tester', ['integration-tests', 'supertest']),
      a('E2E', 'tester', ['playwright', 'selenium', 'e2e']),
      a('Load', 'tester', ['k6', 'load-testing', 'performance']),
      a('Fuzz', 'tester', ['fuzzing', 'property-testing']),
      a('Regress', 'validator', ['regression', 'snapshots'], M_HAIKU),
      a('Coverage', 'reviewer', ['coverage', 'mutation-testing']),
      a('Mock', 'implementer', ['mocking', 'fixtures', 'stubs']),
      a('Accessib', 'tester', ['accessibility-testing', 'axe']),
      a('Smoke', 'validator', ['smoke-tests', 'health-checks'], M_HAIKU),
    ],
  },
  {
    kind: 'research',
    name: 'Research Team',
    mission: 'Investigates approaches, evaluates trade-offs and prototypes the unknown.',
    supervisor: a('Sage', 'supervisor', ['research-direction', 'coordination'], M_OPUS),
    roster: [
      a('Scout', 'researcher', ['literature-review', 'benchmarking']),
      a('Probe', 'researcher', ['prototyping', 'spikes']),
      a('Bench', 'researcher', ['benchmarks', 'comparison']),
      a('Trend', 'researcher', ['market-research', 'trends']),
      a('Spec', 'architect', ['rfc', 'design-docs']),
      a('Eval', 'validator', ['evaluation', 'metrics'], M_HAIKU),
      a('Synth', 'writer', ['synthesis', 'summarization']),
      a('Crit', 'reviewer', ['critique', 'red-teaming']),
      a('Algo', 'researcher', ['algorithms', 'complexity']),
      a('Patent', 'reviewer', ['ip', 'prior-art'], M_HAIKU),
    ],
  },
  {
    kind: 'design',
    name: 'Design & UX Team',
    mission: 'Crafts the product experience, visual language and interaction design.',
    supervisor: a('Muse', 'supervisor', ['design-leadership', 'coordination'], M_OPUS),
    roster: [
      a('Wire', 'designer', ['wireframes', 'flows', 'ia']),
      a('Visual', 'designer', ['visual-design', 'branding']),
      a('Token', 'designer', ['design-tokens', 'theming']),
      a('Proto', 'designer', ['prototyping', 'figma']),
      a('Research', 'researcher', ['user-research', 'interviews']),
      a('Copy', 'writer', ['ux-writing', 'microcopy']),
      a('Inclusive', 'reviewer', ['inclusive-design', 'a11y']),
      a('Motion', 'designer', ['motion-design', 'transitions']),
      a('System', 'architect', ['design-systems', 'components']),
      a('Usab', 'tester', ['usability-testing', 'heuristics'], M_HAIKU),
    ],
  },
  {
    kind: 'integration',
    name: 'Integration Team',
    mission: 'Connects external services, APIs, webhooks and third-party platforms.',
    supervisor: a('Nexus', 'supervisor', ['integration-architecture', 'coordination'], M_OPUS),
    roster: [
      a('Connect', 'integrator', ['rest-clients', 'sdk', 'oauth']),
      a('Hook', 'integrator', ['webhooks', 'events', 'callbacks']),
      a('Pay', 'integrator', ['stripe', 'payments', 'billing']),
      a('Mail', 'integrator', ['email', 'sendgrid', 'notifications']),
      a('Map', 'implementer', ['data-mapping', 'transformation']),
      a('Sync', 'implementer', ['sync', 'reconciliation', 'idempotency']),
      a('Gateway', 'architect', ['api-gateway', 'rate-limiting']),
      a('Retry', 'optimizer', ['retries', 'circuit-breaker', 'backoff']),
      a('Sandbox', 'tester', ['sandbox', 'mock-apis'], M_HAIKU),
      a('Register', 'integrator', ['provisioning', 'auto-registration']),
    ],
  },
  {
    kind: 'docs',
    name: 'Docs & DevRel Team',
    mission: 'Produces documentation, tutorials, examples and developer onboarding.',
    supervisor: a('Lexicon', 'supervisor', ['docs-strategy', 'coordination'], M_OPUS),
    roster: [
      a('Guide', 'writer', ['tutorials', 'how-tos']),
      a('Ref', 'writer', ['api-reference', 'docstrings']),
      a('Sample', 'implementer', ['code-samples', 'examples']),
      a('Onboard', 'writer', ['onboarding', 'quickstarts']),
      a('Diagram', 'designer', ['diagrams', 'mermaid', 'architecture']),
      a('Changelog', 'writer', ['changelogs', 'release-notes'], M_HAIKU),
      a('Translate', 'writer', ['i18n', 'localization']),
      a('Edit', 'reviewer', ['editing', 'style-guide']),
      a('Video', 'designer', ['screencasts', 'demos']),
      a('FAQ', 'writer', ['faq', 'troubleshooting'], M_HAIKU),
    ],
  },
]
