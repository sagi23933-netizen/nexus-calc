/**
 * Tools & APIs registry catalog.
 *
 * Mirrors the "Tools & APIs" node in the architecture diagram. The platform
 * can "auto-configure" the providers marked autoConfigurable — modeled as a
 * guided, simulated registration flow (we never store real credentials).
 */

import type { ToolCategory, ToolDef } from './types'

type Seed = Omit<ToolDef, 'status'> & { status?: ToolDef['status'] }

function tool(
  id: string,
  name: string,
  category: ToolCategory,
  description: string,
  requiredSecrets: string[],
  autoConfigurable: boolean,
  docsUrl: string,
): Seed {
  return { id, name, category, description, requiredSecrets, autoConfigurable, docsUrl }
}

export const TOOL_CATALOG: Seed[] = [
  // LLM providers
  tool('anthropic', 'Anthropic Claude', 'llm', 'Frontier LLM for reasoning, code generation and agents.', ['ANTHROPIC_API_KEY'], true, 'https://docs.anthropic.com'),
  tool('openai', 'OpenAI', 'llm', 'GPT family models and embeddings.', ['OPENAI_API_KEY'], true, 'https://platform.openai.com/docs'),
  tool('google-ai', 'Google Gemini', 'llm', 'Multimodal LLMs and embeddings.', ['GOOGLE_API_KEY'], true, 'https://ai.google.dev'),
  tool('groq', 'Groq', 'llm', 'Ultra low-latency inference for open models.', ['GROQ_API_KEY'], true, 'https://console.groq.com/docs'),
  tool('huggingface', 'Hugging Face', 'llm', 'Open model hub and inference endpoints.', ['HF_TOKEN'], true, 'https://huggingface.co/docs'),

  // Cloud platforms
  tool('aws', 'Amazon Web Services', 'cloud', 'Compute, storage and managed services.', ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'], true, 'https://docs.aws.amazon.com'),
  tool('gcp', 'Google Cloud', 'cloud', 'Cloud compute, BigQuery and AI platform.', ['GOOGLE_APPLICATION_CREDENTIALS'], true, 'https://cloud.google.com/docs'),
  tool('azure', 'Microsoft Azure', 'cloud', 'Enterprise cloud and AI services.', ['AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET'], true, 'https://learn.microsoft.com/azure'),
  tool('vercel', 'Vercel', 'cloud', 'Frontend hosting and serverless functions.', ['VERCEL_TOKEN'], true, 'https://vercel.com/docs'),
  tool('cloudflare', 'Cloudflare', 'cloud', 'Edge network, Workers and R2 storage.', ['CLOUDFLARE_API_TOKEN'], true, 'https://developers.cloudflare.com'),
  tool('fly', 'Fly.io', 'cloud', 'Run app servers close to users globally.', ['FLY_API_TOKEN'], true, 'https://fly.io/docs'),
  tool('railway', 'Railway', 'cloud', 'Instant app + database deployments.', ['RAILWAY_TOKEN'], true, 'https://docs.railway.app'),

  // Databases
  tool('postgres', 'PostgreSQL', 'database', 'Relational database for transactional data.', ['DATABASE_URL'], true, 'https://www.postgresql.org/docs'),
  tool('mongodb', 'MongoDB Atlas', 'database', 'Document database, fully managed.', ['MONGODB_URI'], true, 'https://www.mongodb.com/docs'),
  tool('redis', 'Redis', 'database', 'In-memory cache and message broker.', ['REDIS_URL'], true, 'https://redis.io/docs'),
  tool('supabase', 'Supabase', 'database', 'Postgres + auth + storage backend.', ['SUPABASE_URL', 'SUPABASE_KEY'], true, 'https://supabase.com/docs'),
  tool('pinecone', 'Pinecone', 'database', 'Managed vector database for RAG.', ['PINECONE_API_KEY'], true, 'https://docs.pinecone.io'),
  tool('planetscale', 'PlanetScale', 'database', 'Serverless MySQL platform.', ['PLANETSCALE_TOKEN'], true, 'https://planetscale.com/docs'),

  // Payments
  tool('stripe', 'Stripe', 'payments', 'Online payments, billing and subscriptions.', ['STRIPE_SECRET_KEY'], true, 'https://stripe.com/docs'),
  tool('paypal', 'PayPal', 'payments', 'Global payments and checkout.', ['PAYPAL_CLIENT_ID', 'PAYPAL_SECRET'], true, 'https://developer.paypal.com'),
  tool('lemonsqueezy', 'Lemon Squeezy', 'payments', 'Merchant-of-record SaaS billing.', ['LEMONSQUEEZY_API_KEY'], true, 'https://docs.lemonsqueezy.com'),

  // Auth
  tool('auth0', 'Auth0', 'auth', 'Authentication and authorization as a service.', ['AUTH0_DOMAIN', 'AUTH0_CLIENT_SECRET'], true, 'https://auth0.com/docs'),
  tool('clerk', 'Clerk', 'auth', 'Drop-in user management and auth UI.', ['CLERK_SECRET_KEY'], true, 'https://clerk.com/docs'),
  tool('firebase-auth', 'Firebase Auth', 'auth', 'Google identity platform.', ['FIREBASE_API_KEY'], true, 'https://firebase.google.com/docs/auth'),

  // Messaging / notifications
  tool('sendgrid', 'SendGrid', 'messaging', 'Transactional and marketing email.', ['SENDGRID_API_KEY'], true, 'https://docs.sendgrid.com'),
  tool('twilio', 'Twilio', 'messaging', 'SMS, voice and WhatsApp APIs.', ['TWILIO_AUTH_TOKEN'], true, 'https://www.twilio.com/docs'),
  tool('slack', 'Slack', 'messaging', 'Team messaging and incident alerts.', ['SLACK_BOT_TOKEN'], true, 'https://api.slack.com'),
  tool('resend', 'Resend', 'messaging', 'Developer-first email API.', ['RESEND_API_KEY'], true, 'https://resend.com/docs'),

  // Dev tools
  tool('github', 'GitHub', 'devtools', 'Source hosting, CI and releases.', ['GITHUB_TOKEN'], true, 'https://docs.github.com'),
  tool('gitlab', 'GitLab', 'devtools', 'DevOps platform and CI/CD.', ['GITLAB_TOKEN'], true, 'https://docs.gitlab.com'),
  tool('sentry', 'Sentry', 'devtools', 'Error monitoring and tracing.', ['SENTRY_DSN'], true, 'https://docs.sentry.io'),
  tool('docker-hub', 'Docker Hub', 'devtools', 'Container image registry.', ['DOCKERHUB_TOKEN'], true, 'https://docs.docker.com'),

  // Storage
  tool('s3', 'Amazon S3', 'storage', 'Object storage for files and assets.', ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'], true, 'https://docs.aws.amazon.com/s3'),
  tool('r2', 'Cloudflare R2', 'storage', 'Zero-egress object storage.', ['R2_ACCESS_KEY', 'R2_SECRET_KEY'], true, 'https://developers.cloudflare.com/r2'),

  // Analytics
  tool('posthog', 'PostHog', 'analytics', 'Product analytics and feature flags.', ['POSTHOG_API_KEY'], true, 'https://posthog.com/docs'),
  tool('segment', 'Segment', 'analytics', 'Customer data pipeline.', ['SEGMENT_WRITE_KEY'], true, 'https://segment.com/docs'),
]
