import { neon } from '@neondatabase/serverless';

export async function onRequestPost({ request, env }) {
    try {
        if (!env.DATABASE_URL) {
            return new Response(JSON.stringify({ error: 'DATABASE_URL is not defined in environment' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const sql = neon(env.DATABASE_URL);

        let body;
        try {
            body = await request.json();
        } catch (e) {
            return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const { familyCode } = body;
        if (!familyCode) {
            return new Response(JSON.stringify({ error: 'Family code required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const family = await sql`
      SELECT id FROM families WHERE family_code = ${familyCode.trim()}
    `;

        if (family.length === 0) {
            return new Response(JSON.stringify({ error: '无效的家庭码' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const users = await sql`
      SELECT id, name, role, avatar, (pin IS NOT NULL) as has_pin
      FROM users 
      WHERE family_id = ${family[0].id}
      ORDER BY role DESC, id ASC
    `;

        return new Response(JSON.stringify({
            success: true,
            familyId: family[0].id, // 明确返回 id
            users,
            familyCode: familyCode
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: 'Database Error: ' + error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
