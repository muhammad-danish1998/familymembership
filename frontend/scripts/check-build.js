import fs from 'fs';
import path from 'path';

let dataSource = process.env.VITE_DATA_SOURCE;

if (!dataSource) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/^VITE_DATA_SOURCE\s*=\s*(.*)$/m);
      if (match) {
        dataSource = match[1].trim();
      }
    }
  } catch {
    // Ignore read errors
  }
}

if (dataSource === 'mock') {
  console.error('\n❌ ERROR: Production build (`npm run build`) is not allowed when VITE_DATA_SOURCE is "mock".');
  console.error('👉 To build for production with Supabase, set VITE_DATA_SOURCE=supabase in your environment.');
  console.error('👉 To build a demo/preview version using mock data, run `npm run build:demo` instead.\n');
  process.exit(1);
}
