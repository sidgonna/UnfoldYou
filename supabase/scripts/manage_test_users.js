
// ============================================================
// Manage Test Users Script
// Usage:
//   node supabase/scripts/manage_test_users.js create <email> <password> [options]
//   node supabase/scripts/manage_test_users.js delete <email>
//   node supabase/scripts/manage_test_users.js delete-all
//
// Options for create:
//   --no-profile   Skip creating profile/shadow/love-soul (user will land on onboarding)
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

// Helpers
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const ADJECTIVES = ['Mystic', 'Silent', 'Wandering', 'Hidden', 'Cosmic', 'Velvet', 'Lunar', 'Solar', 'Neon', 'Digital'];
const NOUNS = ['Traveler', 'Dreamer', 'Shadow', 'Whisper', 'Echo', 'Signal', 'Glitch', 'Vibe', 'Soul', 'Pilot'];

async function createTestUser(email, password, skipProfile = false) {
  console.log(`\nCreating test user: ${email}...`);

  // 1. Create Auth User
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { is_test_user: true }
  });

  if (authError) {
    if (authError.message.includes('already registered')) {
        // Try to update password instead
        console.log('User already exists. Updating password...');
        // Need to find ID first
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const existing = users.find(u => u.email === email);
        if (existing) {
             const { error: updError } = await supabase.auth.admin.updateUserById(existing.id, { password });
             if (updError) {
                 console.error('❌ Failed to update password:', updError.message);
                 return;
             }
             console.log('✅ Password updated.');
             // If we want to ensure profile exists, we can continue...
             authData.user = existing;
        }
    } else {
        console.error('❌ Failed to create user:', authError.message);
        return;
    }
  }

  const userId = authData.user.id;
  console.log(`✅ Auth user created/updated (ID: ${userId})`);

  if (skipProfile) {
    console.log('Creating profile skipped (--no-profile). User will start at Onboarding.');
    return;
  }

  // 2. Create Profile (Real)
  // We use upsert to handle existing users
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    name: 'Test User',
    dob: '1995-01-01',
    gender: 'Non-binary',
    location_city: 'Cyber City',
    location_country: 'Digital Realm',
    intent: 'something_real',
    voice_note_url: null, // Allow user to upload their own during onboarding/testing
    habits: ['Morning Coffee', 'Night Owl', 'Art Lover'],
    height_cm: 175,
    profile_picture_url: null, // Allow user to upload their own
    onboarding_complete: true,
    updated_at: new Date().toISOString()
  });

  if (profileError) console.error('⚠️ Failed to create Profile:', profileError.message);
  else console.log('✅ Public Profile created.');

  // 3. Create Shadow Profile
  const shadowName = `${getRandom(ADJECTIVES)} ${getRandom(NOUNS)} ${Math.floor(Math.random() * 100)}`;
  const { error: shadowError } = await supabase.from('shadow_profiles').upsert({
    id: userId,
    shadow_name: shadowName,
    avatar_id: `avatar_0${Math.floor(Math.random() * 5) + 1}`, // avatar_01 to avatar_05
    bio: 'Just a test user wandering through the void.',
    social_energy: getRandom(['introvert', 'extrovert', 'ambivert']),
    interests: ['Testing', 'Coding', 'Coffee'],
    pronouns: 'they/them',
    updated_at: new Date().toISOString()
  });

  if (shadowError) console.error('⚠️ Failed to create Shadow Profile:', shadowError.message);
  else console.log(`✅ Shadow Profile created: ${shadowName}`);

  // 4. Create Love Soul (Optional but good for completeness)
  const { error: loveError } = await supabase.from('love_soul').upsert({
    id: userId,
    q1_overwhelmed: 'Take a deep breath',
    q2_seen_appreciated: 'Small acts of kindness',
    q3_disagreement: 'Talk it out calmly',
    q_final_love: 'Understanding',
    attachment_style: 'secure',
    love_language: 'quality_time',
    conflict_style: 'collaborative',
    updated_at: new Date().toISOString()
  });

  if (loveError) console.error('⚠️ Failed to create Love Soul:', loveError.message);
  else console.log('✅ Love Soul profile created.');

  console.log('\n🎉 User ready! Login with:');
  console.log(`   Email: ${email}`);
  console.log(`   Pass:  ${password}`);
}

async function deleteUser(email) {
  console.log(`\nDeleting user: ${email}...`);
  
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error listing users:', error.message);
    return;
  }

  const user = users.find(u => u.email === email);
  if (!user) {
    console.error('User not found.');
    return;
  }

  const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
  if (delError) console.error('❌ Failed to delete:', delError.message);
  else console.log('✅ User deleted.');
}

async function deleteAllTestUsers() {
  console.log('\n🗑️  Deleting ALL test users...');
  
  // Fetch all users (pagination might be needed for large sets, but fine for dev)
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error listing users:', error.message);
    return;
  }

  // Filter for test users - MODIFIED to delete ALL users for cleanup
  const testUsers = users; 
  /*
  const testUsers = users.filter(u => 
    (u.email && u.email.startsWith('test')) || 
    (u.email && u.email.endsWith('@example.com')) ||
    (u.email && u.email.endsWith('@yopmail.com')) ||
    (u.user_metadata && u.user_metadata.is_test_user)
  );
  */

  if (testUsers.length === 0) {
    console.log('No test users found to delete.');
    return;
  }

  console.log(`Found ${testUsers.length} test users. Deleting...`);

  let count = 0;
  for (const user of testUsers) {
    const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
    if (delError) {
      console.error(`❌ Failed to delete ${user.email}:`, delError.message);
    } else {
      console.log(`✅ Deleted ${user.email}`);
      count++;
    }
  }

  console.log(`\n✨ Deleted ${count} test users.`);
}


// Main CLI logic
const command = process.argv[2];
const args = process.argv.slice(3);

(async () => {
    try {
        if (command === 'create') {
            const email = args[0];
            const password = args[1];
            if (!email || !password) {
                console.log('Usage: node manage_test_users.js create <email> <password> [--no-profile]');
                return;
            }
            const skipProfile = args.includes('--no-profile');
            await createTestUser(email, password, skipProfile);
        } else if (command === 'delete') {
            const email = args[0];
            if (!email) {
                console.log('Usage: node manage_test_users.js delete <email>');
                return;
            }
            await deleteUser(email);
        } else if (command === 'delete-all') {
            await deleteAllTestUsers();
        } else {
            console.log('Unknown command.');
            console.log('Available commands: create, delete, delete-all');
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
})();
