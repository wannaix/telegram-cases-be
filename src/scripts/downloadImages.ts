import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const images = [
  { name: 'ton-case.png', url: 'https://cryptologos.cc/logos/toncoin-ton-logo.png?v=032' },
  { name: 'btc-case.png', url: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png?v=032' },
  { name: 'eth-case.png', url: 'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=032' },
  { name: 'doge-case.png', url: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png?v=032' },
  { name: 'shib-case.png', url: 'https://cryptologos.cc/logos/shiba-inu-shib-logo.png?v=032' },
  { name: 'not-case.png', url: 'https://cryptologos.cc/logos/notcoin-not-logo.png?v=032' },
  { name: 'pepe-case.png', url: 'https://cryptologos.cc/logos/pepe-pepe-logo.png?v=032' },
  { name: 'usdt-case.png', url: 'https://cryptologos.cc/logos/tether-usdt-logo.png?v=032' },
  { name: 'sol-case.png', url: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=032' },
  { name: 'ada-case.png', url: 'https://cryptologos.cc/logos/cardano-ada-logo.png?v=032' },
  { name: 'bnb-case.png', url: 'https://cryptologos.cc/logos/bnb-bnb-logo.png?v=032' },
];
const uploadsDir = path.join(process.cwd(), 'uploads', 'cases');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
function downloadImage(url: string, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const filePath = path.join(uploadsDir, filename);
    const file = fs.createWriteStream(filePath);
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`✓ Downloaded ${filename}`);
        resolve();
      });
      file.on('error', (err) => {
        fs.unlink(filePath, () => {}); 
        reject(err);
      });
    }).on('error', reject);
  });
}
async function downloadAllImages() {
  console.log('Starting image download...\n');
  for (const image of images) {
    try {
      await downloadImage(image.url, image.name);
    } catch (error) {
      console.error(`✗ Failed to download ${image.name}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }
  console.log('\nImage download completed!');
}
downloadAllImages().catch(console.error);