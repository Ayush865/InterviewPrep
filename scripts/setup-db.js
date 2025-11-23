/**
 * scripts/setup-db.js
 *
 * Database setup script for the Vapi cloning system.
 * Initializes the MySQL database with required tables.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function setupDatabase() {
  console.log('🔧 Setting up Vapi Clone System database...\n');

  // Load environment variables
  require('dotenv').config({ path: '.env.local' });

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ ERROR: DATABASE_URL not found in environment variables');
    console.error('   Please add DATABASE_URL to your .env.local file');
    process.exit(1);
  }

  // Parse connection string
  const match = databaseUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);

  if (!match) {
    console.error('❌ ERROR: Invalid DATABASE_URL format');
    console.error('   Expected: mysql://user:password@host:port/database');
    process.exit(1);
  }

  const [, user, password, host, port, database] = match;

  console.log(`📍 Connecting to: ${host}:${port}/${database}`);
  console.log(`👤 User: ${user}\n`);

  let connection;

  try {
    // Create connection
    connection = await mysql.createConnection({
      host,
      port: parseInt(port, 10),
      user,
      password,
      database,
      multipleStatements: true
    });

    console.log('✅ Connected to MySQL database\n');

    // Read schema file
    const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    console.log('📝 Executing schema...');

    // Execute schema
    await connection.query(schema);

    console.log('✅ Schema executed successfully\n');

    // Verify tables
    const [tables] = await connection.query('SHOW TABLES');
    console.log('📋 Created tables:');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`   ✓ ${tableName}`);
    });

    console.log('\n🎉 Database setup complete!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run generate-key');
    console.log('2. Add MASTER_KEY to .env.local');
    console.log('3. Update template files in data/');
    console.log('4. Run: npm run dev');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);

    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   Check your database credentials');
    } else if (error.code === 'ENOTFOUND') {
      console.error('   Check your database host');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   Database server is not reachable');
    }

    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Disconnected from database');
    }
  }
}

// Run setup
setupDatabase().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
