import dotenv from 'dotenv';
import postgres from 'postgres';
import { parse } from "csv-parse";
import fs from 'fs';

dotenv.config();
const args = process.argv.slice(2);
const sql = postgres({});

const importCsv = async (type) => {
    const fetchResult = await sql`
        INSERT INTO fetches (type, header)
        VALUES (${'import_csv_' + type}, ${'imported from CSV'})
        RETURNING id
    `;
    const fetchId = fetchResult[0].id;

    const parser = parse({ delimiter: ",", columns: true });

    parser.on("readable", async () => {
        let record;
        while (record = parser.read()) {
            await sql`
                INSERT INTO ${sql(type)} (fetch_id, entity)
                VALUES (${fetchId}, ${record})
            `;
        }
    });
    
    parser.on("error", (err) => {
        console.error(err.message);
    });

    // Import the CSV file temp_gtfs/${type}.txt
    await fs.createReadStream(`temp_gtfs/${type}.txt`).pipe(parser);
    return new Promise((resolve) => {
        parser.on("end", resolve);
    });
}

if (args[0]) {
    await importCsv(args[0]);
    process.exit(0);
} else {
    console.log("Expected argument: agency|calendar|calendar_dates|feed_info|routes|shapes|stop_times|stops|trips");
}