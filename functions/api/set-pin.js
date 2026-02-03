import { neon } from '@neondatabase/serverless';

export async function onRequest(context) {
    const { request, env } = context;
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    try {
        const { userId, pin } = await request.json();
        const sql = neon(env.DATABASE_URL);

        await sql`UPDATE users SET pin = ${pin} WHERE id = ${userId}`;

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
