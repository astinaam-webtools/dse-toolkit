import { execSync } from 'child_process';

console.log('🚀 Starting Android Sync Process...');

try {
  // 1. Build the web project
  console.log('\n📦 Building web assets...');
  execSync('npm run build', { stdio: 'inherit' });

  // 2. Sync with Capacitor
  console.log('\n🔄 Syncing with Android...');
  execSync('npx cap sync android', { stdio: 'inherit' });

  console.log('\n✅ Android project updated successfully!');
  console.log('👉 Run "npx cap open android" to open in Android Studio.');
} catch (error) {
  console.error('\n❌ Error during sync:', error.message);
  process.exit(1);
}
