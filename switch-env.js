import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
const targetMode = process.argv[2]; // 'test' or 'prod'

if (!['test', 'prod'].includes(targetMode)) {
    console.log('Usage: node switch-env.js [test|prod]');
    process.exit(1);
}

const testEmail = 'jeromekjerome@gmail.com';
const prodEmail = 'ALB@bluestonelawfirm.com';

try {
    let content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    let updated = false;

    const newLines = lines.map(line => {
        if (line.includes('NOTIFICATION_EMAIL=')) {
            updated = true;
            if (targetMode === 'test') {
                return `NOTIFICATION_EMAIL="${testEmail}"`;
            } else {
                return `NOTIFICATION_EMAIL="${prodEmail}"`;
            }
        }
        return line;
    });

    // If the variable wasn't found (unlikely but possible), append it
    if (!updated) {
        newLines.push(`NOTIFICATION_EMAIL="${targetMode === 'test' ? testEmail : prodEmail}"`);
    }

    fs.writeFileSync(envPath, newLines.join('\n'));
    console.log(`✅ Environment switched to: ${targetMode.toUpperCase()}`);
    console.log(`📧 NOTIFICATION_EMAIL is now: ${targetMode === 'test' ? testEmail : prodEmail}`);
    console.log(`\n🚀 Note: Please restart your server to apply changes.`);

} catch (err) {
    console.error('❌ Error updating .env file:', err.message);
}
