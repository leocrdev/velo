import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Cache agressivo - config muda apenas em redeploy
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');

  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    supabaseProjectId: process.env.SUPABASE_PROJECT_ID,
  });
}
