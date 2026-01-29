import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_6m5OtdIfjWav@ep-spring-shape-a1208q8m-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function run() {
    try {
        console.log('Cleaning logs...');
        const r1 = await sql`DELETE FROM daily_logs WHERE date <= '2026-01-27'`;
        console.log('Cleaned daily_logs');

        console.log('Cleaning sessions...');
        const r2 = await sql`DELETE FROM user_sessions WHERE created_at < '2026-01-27 16:00:00'`;
        console.log('Cleaned user_sessions');
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
