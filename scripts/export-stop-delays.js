import dotenv from 'dotenv';
import postgres from 'postgres';
import fs from 'fs';

dotenv.config();
const sql = postgres({});

const processBatch = async () => {
    const fetchResult = await sql`
        SELECT
            entity->'route_id' as route_id,
            avg_arr_delay,
            avg_dep_delay,
            start_date,
            trip_id,
            stop_id,
            stop_sequence
        FROM "trips"
        INNER JOIN (
            SELECT
                start_date,
                trip_id,
                stop_id,
                stop_sequence,
                (avg(arrival_delay_seconds) / 60)::NUMERIC(10,2) as avg_arr_delay,
                (avg(departure_delay_seconds) / 60)::NUMERIC(10,2) as avg_dep_delay
            FROM agg_trip_stop_delays
            GROUP BY start_date, trip_id, stop_id, stop_sequence
        ) as averages
        ON averages.trip_id = entity->>'trip_id'
    `;
    fs.writeFileSync('temp_json/delays.json', JSON.stringify(fetchResult, null, 2));
    return fetchResult;
}

await processBatch()
process.exit(0);