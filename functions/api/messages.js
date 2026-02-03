import { neon } from '@neondatabase/serverless';

export async function onRequestGet({ request, env }) {
    try {
        const url = new URL(request.url);
        const familyId = url.searchParams.get('familyId');
        const userId = url.searchParams.get('userId');
        const role = url.searchParams.get('role');

        if (!familyId || !userId || !role) {
            return new Response(JSON.stringify({ error: 'Family ID, User ID, and Role required' }), { status: 400 });
        }

        const sql = neon(env.DATABASE_URL);

        const messages = await sql`
            SELECT m.*, u.name as sender_name, u.avatar as sender_avatar, u.role as sender_role
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.family_id = ${familyId}
            AND (
                m.type = 'notice'
                OR m.sender_id = ${userId}
                OR (m.type = 'feedback' AND (
                    (${role} = 'parent' AND (m.recipient_id = ${userId} OR m.recipient_id IS NULL))
                    OR (${role} = 'child' AND m.recipient_id = ${userId})
                ))
            )
            ORDER BY m.created_at ASC
            LIMIT 100
        `;

        return new Response(JSON.stringify({ success: true, messages }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json();
        const { familyId, senderId, content, type, recipientId } = body;

        if (!familyId || !senderId || !content || !type) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
        }

        const sql = neon(env.DATABASE_URL);

        await sql`
            INSERT INTO messages (family_id, sender_id, content, type, recipient_id)
            VALUES (${familyId}, ${senderId}, ${content}, ${type}, ${recipientId || null})
        `;

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

// DELETE: 清空公告 或 删除单条消息
export async function onRequestDelete({ request, env }) {
    try {
        const url = new URL(request.url);
        const familyId = url.searchParams.get('familyId');
        const messageId = url.searchParams.get('messageId'); // 可选：删除单条
        const type = url.searchParams.get('type'); // 可选：批量删除某类型 (notice/feedback)
        const childId = url.searchParams.get('childId'); // 可选：只删除与指定孩子相关的消息

        if (!familyId) {
            return new Response(JSON.stringify({ error: 'Family ID required' }), { status: 400 });
        }

        const sql = neon(env.DATABASE_URL);

        if (messageId) {
            // 删除单条消息
            await sql`DELETE FROM messages WHERE id = ${messageId} AND family_id = ${familyId}`;
        } else if (type && childId) {
            // 私信清空：必须指定 userId (当前操作者)，确保只删除与操作者相关的对话
            const userId = url.searchParams.get('userId');
            if (!userId) {
                return new Response(JSON.stringify({ error: 'User ID required for clearing private messages' }), { status: 400 });
            }

            // 只有 (我发给孩子 OR 孩子发给我) 的消息才会被删除
            await sql`DELETE FROM messages 
                      WHERE family_id = ${familyId} 
                      AND type = ${type}
                      AND (
                          (sender_id = ${userId} AND recipient_id = ${childId})
                          OR (sender_id = ${childId} AND recipient_id = ${userId})
                      )`;
        } else if (type) {
            // 批量删除某类型（所有）
            await sql`DELETE FROM messages WHERE family_id = ${familyId} AND type = ${type}`;
        } else {
            return new Response(JSON.stringify({ error: 'messageId or type required' }), { status: 400 });
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
