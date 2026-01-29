import { neon } from '@neondatabase/serverless';

export async function onRequestGet({ request, env }) {
    const sql = neon(env.DATABASE_URL);
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const start = url.searchParams.get('start'); // ISO Date string eg: 2026-01-26
    const end = url.searchParams.get('end');

    if (!userId || !start || !end) {
        return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400 });
    }

    try {
        const logs = await sql`
      SELECT date::text, total_score as "totalScore"
      FROM daily_logs 
      WHERE user_id = ${userId} 
      AND date >= ${start} 
      AND date <= ${end}
      ORDER BY date ASC
    `;

        return new Response(JSON.stringify({
            success: true,
            logs: logs
        }));
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
