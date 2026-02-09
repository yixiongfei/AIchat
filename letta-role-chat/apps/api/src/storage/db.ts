import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// ✅ 启动时校验必需的数据库环境变量
const REQUIRED_DB_VARS = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'] as const;
const missing = REQUIRED_DB_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ 缺少必需的数据库环境变量: ${missing.join(', ')}`);
  console.error('请在 apps/api/.env 中配置，参考 .env.example');
  process.exit(1);
}

// ✅ 所有数据库配置从环境变量读取，不再硬编码默认值
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


export default pool;

export const initDb = async () => {
  const connection = await pool.getConnection();
  try {
    // 创建 agents 表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        persona TEXT,
        human TEXT,
        agent_id VARCHAR(255) UNIQUE,
        avatar VARCHAR(255) DEFAULT NULL,
        voice VARCHAR(255) DEFAULT 'ja-JP-MayuNeural',
        speed FLOAT DEFAULT 1.0,
        pitch VARCHAR(50) DEFAULT '15',
        style VARCHAR(100) DEFAULT 'chat',
        created_at BIGINT
      )
    `);

    // 创建 chats 表 (新增)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id VARCHAR(255) PRIMARY KEY,
        agent_id VARCHAR(255) NOT NULL,
        letta_conversation_id VARCHAR(255),
        title VARCHAR(255) DEFAULT '新对话',
        created_at BIGINT,
        updated_at BIGINT,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
        INDEX idx_agent_updated (agent_id, updated_at DESC),
        INDEX idx_letta_conversation (letta_conversation_id)
      )
    `);

    // 创建 messages 表 (添加 chat_id 外键)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(255) PRIMARY KEY,
        agent_id VARCHAR(255),
        chat_id VARCHAR(255),
        role ENUM('user', 'assistant') NOT NULL,
        content TEXT NOT NULL,
        timestamp BIGINT,
        images LONGTEXT,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
        INDEX idx_chat_timestamp (chat_id, timestamp)
      )
    `);

    // 迁移：检查并添加 chat_id 列（如果不存在）
    try {
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'chat_id'
      `);
      if ((columns as any[]).length === 0) {
        console.log('Migrating: Adding chat_id column to messages table...');
        await connection.query(`ALTER TABLE messages ADD COLUMN chat_id VARCHAR(255) AFTER agent_id`);
        await connection.query(`ALTER TABLE messages ADD INDEX idx_chat_timestamp (chat_id, timestamp)`);
        console.log('Migration complete: chat_id column added');
      }
    } catch (migrationError) {
      console.error('Migration error (chat_id):', migrationError);
    }
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  } finally {
    connection.release();
  }
};
