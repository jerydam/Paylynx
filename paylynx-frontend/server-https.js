const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // Listen on all network interfaces
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Check if certificates exist
const certPath = path.join(__dirname, '.cert');
const keyPath = path.join(certPath, 'localhost-key.pem');
const certFilePath = path.join(certPath, 'localhost.pem');

let httpsOptions;

try {
  if (fs.existsSync(keyPath) && fs.existsSync(certFilePath)) {
    httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certFilePath),
    };
    console.log('✅ SSL certificates found');
  } else {
    console.error('\n❌ SSL certificates not found at:');
    console.error(`   ${certPath}\n`);
    console.log('📝 To generate certificates, run these commands:\n');
    console.log('   # Install mkcert first:');
    console.log('   brew install mkcert              # macOS');
    console.log('   choco install mkcert             # Windows');
    console.log('   # Then run:');
    console.log('   mkcert -install');
    console.log('   mkdir -p .cert');
    console.log('   mkcert -key-file .cert/localhost-key.pem -cert-file .cert/localhost.pem localhost 192.168.1.110 127.0.0.1');
    console.log('\n💡 Or use ngrok for instant HTTPS (RECOMMENDED):');
    console.log('   npm install -g ngrok');
    console.log('   npm run dev       # in terminal 1');
    console.log('   ngrok http 3000   # in terminal 2');
    console.log('   # Then use the ngrok HTTPS URL!\n');
    process.exit(1);
  }
} catch (err) {
  console.error('❌ Error reading SSL certificates:', err);
  process.exit(1);
}

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log('\n🚀 HTTPS Server ready!\n');
      console.log('   📱 Open on your phone:');
      console.log(`      https://192.168.1.110:${port}\n`);
      console.log('   💻 Or locally:');
      console.log(`      https://localhost:${port}\n`);
      console.log('✅ Privy embedded wallets will work with HTTPS!\n');
      console.log('⚠️  You may need to accept the security warning on first visit.\n');
    });
});
