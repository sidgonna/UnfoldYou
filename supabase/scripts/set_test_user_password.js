
// ============================================================
// Utility: Set Test User Password (Zero-Dependency)
// Usage: node supabase/scripts/set_test_user_password.js <email> <password>
// ============================================================

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Manually parse .env.local because 'dotenv' might not be installed
const envPath = path.resolve(__dirname, '../../.env.local');
const envVars = {};

try {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, ''); // Remove quotes
      if (key && val && !key.startsWith('#')) {
        envVars[key] = val;
      }
    }
  });
} catch (err) {
  console.log('Note: .env.local file not found or readable at:', envPath);
}

// 2. Load Supabase Client
const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing configuration.');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setPassword() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.log('USAGE: node supabase/scripts/set_test_user_password.js <email> <password>');
    console.log('Example: node supabase/scripts/set_test_user_password.js test@unfold.com mypassword123');
    process.exit(1);
  }

  console.log(`\n🔑 Setting password for user: ${email}...`);

  // 3. Get user ID by email via Admin API
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('❌ Error listing users:', listError.message);
    process.exit(1);
  }

  const user = users.find(u => u.email === email);

  if (!user) {
    console.error(`❌ User with email "${email}" not found.`);
    console.log('👉 Please allow the user to sign up in the app first (via email flow), then run this script.');
    process.exit(1);
  }

  // 4. Update user with password
  const { data, error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: password }
  );

  if (updateError) {
    console.error('❌ Error setting password:', updateError.message);
    process.exit(1);
  }

  console.log('✅ Success! You can now use "Developer Login" with these credentials.');
  console.log('   Go to the Login screen -> Click "Developer Login" (bottom link)');
}

setPassword();
