import { neon } from '@neondatabase/serverless';

export async function onRequestGet({ request, env }) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');
        const date = url.searchParams.get('date');

        if (!userId || !date) {
            return new Response(JSON.stringify({ error: 'Missing userId or date' }), { status: 400 });
        }

        const sql = neon(env.DATABASE_URL);
        const logResult = await sql`
            SELECT answers, total_score, has_class, used_slots, stars, bonus_reason
            FROM daily_logs
            WHERE user_id = ${userId} AND date = ${date}
        `;

        // 映射数据库字段到前端变量名
        const result = logResult[0] ? {
            answers: logResult[0].answers,
            score: logResult[0].total_score,
            hasClass: logResult[0].has_class,
            usedSlots: logResult[0].used_slots,
            stars: logResult[0].stars || 0,
            bonusReason: logResult[0].bonus_reason || ""
        } : null;

        return new Response(JSON.stringify({
            success: true,
            data: result
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function onRequestPost({ request, env }) {
    try {
        const sql = neon(env.DATABASE_URL);
        const body = await request.json();
        const { userId, date, answers, score, hasClass, usedSlots, stars, bonusReason } = body;

        // SQL 修复：确保所有 9 个字段都有对应的占位符
        await sql`
            INSERT INTO daily_logs (user_id, date, answers, total_score, has_class, used_slots, stars, bonus_reason, updated_at)
            VALUES (${userId}, ${date}, ${answers}, ${score}, ${hasClass}, ${usedSlots || 0}, ${stars || 0}, ${bonusReason || ""}, NOW())
            ON CONFLICT (user_id, date)
            DO UPDATE SET
                answers = EXCLUDED.answers,
                total_score = EXCLUDED.total_score,
                has_class = EXCLUDED.has_class,
                used_slots = EXCLUDED.used_slots,
                stars = EXCLUDED.stars,
                bonus_reason = EXCLUDED.bonus_reason,
                updated_at = NOW();
        `;
        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
