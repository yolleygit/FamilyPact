import { neon } from '@neondatabase/serverless';

export async function onRequest(context) {
    const { request, env } = context;
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    try {
        const { userId, pin } = await request.json();
        const sql = neon(env.DATABASE_URL);

        const user = await sql`SELECT pin FROM users WHERE id = ${userId}`;

        if (user.length > 0 && user[0].pin === pin) {
            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            return new Response(JSON.stringify({ success: false, message: 'PIN码错误' }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
