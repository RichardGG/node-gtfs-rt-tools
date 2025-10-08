import dotenv from 'dotenv';
import postgres from 'postgres';
import fs from 'fs';

dotenv.config();
const sql = postgres({});

const processBatch = async () => {
    const fetchResult = await sql`
        SELECT
            entity->'route_id' as route_id,
            avg_delay,
            max_delay,
            stop_id,
            stop_sequence,
            trip_id
        FROM "trips"
        INNER JOIN (
            SELECT
                stop_id,
                stop_sequence,
                trip_id,
                (avg(arrival_delay_seconds) / 60)::NUMERIC(10,2) as avg_delay,
                max(arrival_delay_seconds) as max_delay
            FROM agg_trip_stop_delays
            GROUP BY stop_id, stop_sequence, trip_id
        ) as averages
        ON averages.trip_id = entity->>'trip_id'
    `;
    fs.writeFileSync('temp_json/delays.json', JSON.stringify(fetchResult, null, 2));

    // TODO export monthly/daily averages
    // TODO export all delays? look at size first
    // Average max delay per day

    return fetchResult;
}

await processBatch()
process.exit(0);