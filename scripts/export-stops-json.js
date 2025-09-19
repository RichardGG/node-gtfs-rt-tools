import dotenv from 'dotenv';
import postgres from 'postgres';
import fs from 'fs';

dotenv.config();
const sql = postgres({});

const processBatch = async () => {
    const fetchResult = await sql`
        SELECT * FROM stops
    `;
    fs.writeFileSync('temp_json/stops.json', JSON.stringify(fetchResult, null, 2));
    return fetchResult;
}

await processBatch()
process.exit(0);