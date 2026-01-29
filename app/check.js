const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_6m5OtdIfjWav@ep-spring-shape-a1208q8m-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');
sql`SELECT count(*) FROM daily_logs WHERE date <= '2026-01-27'`.then(r => {
    console.log('REMAINING_COUNT:' + r[0].count);
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
