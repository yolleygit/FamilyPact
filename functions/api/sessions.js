import { neon } from '@neondatabase/serverless';

export async function onRequest(context) {
    const { request, env } = context;
    const sql = neon(env.DATABASE_URL);

    // --- 管理员后门：清理历史数据 ---
    if (request.method === 'DELETE') {
        try {
            console.log("🧹 正在执行历史数据清理 (1月27日及以前)...");

            // 1. 清理 daily_logs (<= 2026-01-27)
            const r1 = await sql`DELETE FROM daily_logs WHERE date <= '2026-01-27'`;

            // 2. 清理 user_sessions (北京时间 2026-01-27 24:00 之前，即 UTC 2026-01-27 16:00:00 之前)
            const r2 = await sql`DELETE FROM user_sessions WHERE created_at < '2026-01-27 16:00:00'`;

            return new Response(JSON.stringify({
                success: true,
                msg: "1月27日及以前的历史数据已清理完成",
                details: { logsDeleted: true, sessionsDeleted: true }
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
    }

    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    try {
        const body = await request.json();
        const { userId, score, role, familyId } = body;
        const sql = neon(env.DATABASE_URL);

        // 调试模式：捕获原始参数
        const debugParams = { userId, score, userIdType: typeof userId };
        let insertErrorMsg = null;

        if (!userId) throw new Error("Missing userId");

        // 修正：支持 UUID (String)，不再强制转为 Number
        const uid = userId;
        const currentScore = Number(score) || 0;

        // 核心修正：强制使用北京时间 (UTC+8) 来判定 "今天"
        // 解决 0点-8点 期间会被算作前一天的问题
        const now = new Date();
        const utc8Date = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const todayStr = utc8Date.toISOString().split('T')[0];

        // --- 核心操作：写入记录 ---
        try {
            await sql`
                INSERT INTO user_sessions (user_id, score_at_login)
                VALUES (${uid}, ${currentScore})
            `;
        } catch (err) {
            console.error("Insert Failed:", err);
            insertErrorMsg = err.message || "Unknown DB Error";
        }

        // --- 逻辑分支 ---
        let responseData = { success: true, message: "", debug_params: debugParams };
        if (insertErrorMsg) {
            responseData.insert_error = insertErrorMsg; // 将错误暴露给前端
        }

        if (role === 'parent') {
            // [父母视角]：看看崽子们今天都登了几次
            // 1. 查该家庭的所有孩子
            const children = await sql`SELECT id, name FROM users WHERE family_id = ${familyId} AND role = 'child'`;

            if (children.length > 0) {
                const childIds = children.map(c => c.id);
                // 2. 查这些孩子今天的记录
                // 注意：Neon/Postgres 的 ANY 写法
                const logs = await sql`
                    SELECT user_id 
                    FROM user_sessions 
                    WHERE user_id = ANY(${childIds}) 
                    AND created_at >= ${todayStr}::date
                `;

                // 3. 聚合数据
                const summary = children.map(child => {
                    // ID 都是字符串，直接比较即可
                    const count = logs.filter(l => l.user_id === child.id).length;
                    return count > 0 ? `${child.name}${count}次` : null;
                }).filter(Boolean);

                const msg = summary.length > 0 ? `活跃: ${summary.join(', ')}` : "今日暂无活跃";
                responseData.mode = 'parent';
                responseData.title = "家庭概况";
                responseData.desc = msg;
            } else {
                responseData.mode = 'parent';
                responseData.title = "欢迎管理员";
                responseData.desc = "暂无孩子数据";
            }

        } else {
            // [孩子视角]：看自己的积分变化
            // 定义 10后 小学生流行与搞笑段子库 (30+条)
            const quotes = [
                "要是懒惰能发电，你早就照亮全世界了💡",
                "今天也是被自己帅醒的一天😎",
                "学习使我快乐（只要别让我考试）📚",
                "你的潜力就像牙膏，挤挤总是有的🦷",
                "只要我跑得够快，烦恼就追不上我🏃",
                "虽然辛苦，但我还是会选择那种滚烫的人生🔥",
                "生活原本沉闷，但跑起来就有风🌬️",
                "我在减肥，但我对好吃的说：下次一定🍔",
                "作业写完了吗？没写完看什么积分👀",
                "不管是劫是缘，此时此刻，我得先去睡个觉💤",
                "在这个年纪，我承受了这个年纪不该有的帅气😏",
                "哪里跌倒，就在哪里……躺一会儿🛏️",
                "间歇性踌躇满志，持续性混吃等死🤣",
                "我不是胖，我只是热胀冷缩🧊",
                "好看的皮囊千篇一律，有趣的灵魂二百多斤⚖️",
                "虽然我不会做饭，但我会吃饭啊🍚",
                "只要我不尴尬，尴尬的就是别人🫣",
                "别低头，皇冠会掉；别流泪，坏人会笑👑",
                "我太难了，但我还没放弃💪",
                "人生就像打电话，不是你先挂，就是我先挂📞",
                "我这就去学习，别催了，再催就不学了😤",
                "努力不一定成功，但不努力一定很舒服（开玩笑的，快去努力）！",
                "今天的不开心就止于此吧，明天依旧光芒万丈✨",
                "与其抱怨，不如抱我（开玩笑的，抱书去）📚",
                "退一步海阔天空，忍一时越想越气😤",
                "我就是我，是不一样的烟火，是颜色不一样的烧烤🍖",
                "你若安好，便是晴天（霹雳）⚡",
                "确认过眼神，你是要去写作业的人📝",
                "奥利给！干就完了！🔥",
                "在这个年纪，睡得好比什么都重要💤",
                "现在的努力，是为了以后能躺平🛏️",
                "保持冷静，继续你的表演🎬",
                "作业是用来写的，不是用来抄的（大概吧）✍️",
                "春眠不觉晓，处处蚊子咬，夜来巴掌声，蚊子死多少🦟",
                "日照香炉生紫烟，遥看烤鸭挂前川，口水直流三千尺，一摸口袋没带钱🍗",
                "床前明月光，疑是地上霜，举头望明月，低头思故乡（的红烧肉）🍖",
                "千山鸟飞绝，万径人踪灭，孤舟蓑笠翁，独钓寒江雪（冻死宝宝了）🥶",
                "锄禾日当午，汗滴禾下土，谁知盘中餐，来块烤白薯🍠",
                "清明时节雨纷纷，路上行人欲断魂，借问酒家何处有，牧童遥指肯德基🍟",
                "少小离家老大回，乡音无改鬓毛衰，儿童相见不相识，笑问胖子你是谁🐷",
                "天苍苍，野茫茫，风吹草低见牛羊，还有一只大灰狼🐺",
                "枯藤老树昏鸦，空调WiFi西瓜，葛优同款沙发，夕阳西下，我就往那一趴🛌",
                "垂死病中惊坐起，笑问客从何处来（原来是外卖到了）🥡"
            ];
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

            const records = await sql`
                SELECT score_at_login, created_at 
                FROM user_sessions 
                WHERE user_id = ${uid} 
                ORDER BY created_at DESC 
                LIMIT 20
            `;

            const todayRecords = records.filter(r =>
                new Date(r.created_at).toISOString().split('T')[0] === todayStr
            );

            // 本次是 records[0]，上次是 records[1]
            const lastSession = records[1];
            const diff = lastSession ? (currentScore - lastSession.score_at_login) : 0;

            let lastLoginTime = '首次登录';
            let title = "";
            let desc = "";

            if (todayRecords.length === 1) {
                // 只有1条记录，说明是今天的第一次
                title = `恭喜！刚来就躺赚 ${currentScore} 积分💰`;
                desc = randomQuote;
            } else {
                if (lastSession) {
                    // UTC+8 强制转换
                    const d = new Date(lastSession.created_at);
                    const utc8Date = new Date(d.getTime() + 8 * 60 * 60 * 1000);
                    // Cloudflare Workers 默认往往是 UTC0，所以手动 +8H 最稳
                    // 注意：如果 neon 数据库返回的时间已经是带时区的，这里需要小心处理。
                    // 最稳妥的方式是用 Intl.DateTimeFormat
                    const timeStr = new Intl.DateTimeFormat('zh-CN', {
                        timeZone: 'Asia/Shanghai',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    }).format(d);

                    lastLoginTime = timeStr;
                }
                const diffText = diff >= 0 ? `+${diff}` : diff;
                const diffEmoji = diff >= 0 ? "📈" : "📉";

                title = `今日第 ${todayRecords.length} 次登录 ${diffEmoji} ${diffText}`;
                desc = `上次 ${lastLoginTime} • ${randomQuote}`;
            }

            responseData.mode = 'child';
            responseData.title = title;
            responseData.desc = desc;
        }

        return new Response(JSON.stringify(responseData), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message, stack: e.stack }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
