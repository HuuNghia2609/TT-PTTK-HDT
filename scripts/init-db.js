/**
 * Khởi tạo CSDL NPK trên SQL Server:
 *   npm run db:init       -> tạo database + bảng (01_schema.sql) + nạp dữ liệu mẫu (02_seed.sql)
 *   npm run db:seed       -> chỉ nạp lại dữ liệu mẫu (02_seed.sql)
 */
const path = require('path');
const { runSqlFile, SERVER, AUTH } = require('../db');

(async () => {
  const seedOnly = process.argv.includes('--seed-only');
  const dir = path.join(__dirname, '..', 'database');
  console.log(`[DB] Server: ${SERVER}  |  Auth: ${AUTH}`);
  try {
    if (!seedOnly) {
      console.log('[DB] Đang chạy 01_schema.sql (tạo database NPK + bảng)...');
      await runSqlFile(path.join(dir, '01_schema.sql'), 'master');
    }
    console.log('[DB] Đang chạy 02_seed.sql (nạp dữ liệu mẫu)...');
    const results = await runSqlFile(path.join(dir, '02_seed.sql'), 'master');
    const counts = results[results.length - 1] || [];
    console.table(counts);
    console.log('[DB] Hoàn tất! Chạy "npm start" rồi mở http://localhost:' + (process.env.PORT || 3000));
    process.exit(0);
  } catch (err) {
    console.error('[DB] LỖI:', err.message);
    process.exit(1);
  }
})();
