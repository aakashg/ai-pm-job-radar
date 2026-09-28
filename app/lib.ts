import radar from '../data/radar.json';

export type Row = {
  company: string;
  title: string;
  location: string | null;
  url: string;
  payLow: number | null;
  payHigh: number | null;
  remote: boolean;
  bucket: string | null;
  roleKind: string | null;
  aiScope: string | null;
  seniority: string | null;
  mlRequired: number | null;
};

export type Radar = {
  fetchedAt: string;
  labeledAt: string | null;
  model: string | null;
  headline: string | null;
  boards: number;
  rows: Row[];
};

export const data = radar as Radar;

// Order is the order the filter chips appear in.
export const BUCKETS: { id: string; label: string; hint: string }[] = [
  { id: 'ai_pm_no_ml_required', label: 'AI PM, no ML needed', hint: 'The product is AI, and ML experience is not a must-have' },
  { id: 'ai_pm_ml_required', label: 'AI PM, ML needed', hint: 'The product is AI, and hands-on ML experience is a must-have' },
  { id: 'pm_non_ai', label: 'PM, not AI', hint: 'A real product manager role on a product that is not AI' },
  { id: 'not_pm', label: 'Not a PM role', hint: 'Product marketing, design, engineering, sales and similar' },
  { id: 'review', label: 'Needs review', hint: 'Jev was not confident enough to place it' },
];

export const COMPANY: Record<string, string> = {
  anthropic: 'Anthropic', databricks: 'Databricks', scaleai: 'Scale AI', xai: 'xAI', stripe: 'Stripe',
  figma: 'Figma', airbnb: 'Airbnb', robinhood: 'Robinhood', datadog: 'Datadog', instacart: 'Instacart',
  pinterest: 'Pinterest', dropbox: 'Dropbox', cloudflare: 'Cloudflare', coinbase: 'Coinbase', brex: 'Brex',
  gleanwork: 'Glean', asana: 'Asana', duolingo: 'Duolingo', lyft: 'Lyft', openai: 'OpenAI', notion: 'Notion',
  ramp: 'Ramp', linear: 'Linear', cursor: 'Cursor', perplexity: 'Perplexity', elevenlabs: 'ElevenLabs',
  harvey: 'Harvey', cohere: 'Cohere', replit: 'Replit', supabase: 'Supabase', deepgram: 'Deepgram',
  sierra: 'Sierra', decagon: 'Decagon', writer: 'Writer', lovable: 'Lovable', palantir: 'Palantir',
};

export const companyName = (slug: string) => COMPANY[slug] ?? slug;

export function pay(r: Row) {
  const k = (n: number) => `$${Math.round(n / 1000)}K`;
  if (r.payLow && r.payHigh && r.payHigh !== r.payLow) return `${k(r.payLow)}–${k(r.payHigh)}`;
  if (r.payLow) return k(r.payLow);
  return '—';
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
