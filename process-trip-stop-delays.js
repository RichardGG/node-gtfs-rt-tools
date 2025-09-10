import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();
const sql = postgres({});

const markAsProcessed = async (id) => {
    await sql`
        UPDATE trip_updates
        SET last_processed_at = now()
        WHERE id = ${id}
    `;
}

const processBatch = async () => {
    const fetchResult = await sql`
        SELECT * FROM trip_updates
        WHERE last_processed_at IS NULL
        ORDER BY id
        LIMIT 100
    `;
    for (const row of fetchResult) {
        const tripUpdate = row.entity;
        // Find the next stop time update (lowest stop_sequence)
        const nextStopTimeUpdate = tripUpdate.stopTimeUpdate.reduce((prev, curr) => {
            if (!prev) return curr;
            if (curr.stopSequence < prev.stopSequence) return curr;
            return prev;
        });

        const delays = await sql`
            SELECT * FROM agg_trip_stop_delays
            WHERE trip_id = ${tripUpdate.trip.tripId}
            AND start_date = ${tripUpdate.trip.startDate}
            AND stop_id = ${nextStopTimeUpdate.stopId}
            AND stop_sequence = ${nextStopTimeUpdate.stopSequence}
        `;

        if (delays.length === 0) {
            await sql`
                INSERT INTO agg_trip_stop_delays (
                    trip_update_id,
                    trip_update_timestamp,
                    trip_id,
                    start_date,
                    stop_id,
                    stop_sequence,
                    estimated_arrival,
                    estimated_departure,
                    delay_seconds,
                ) VALUES (
                    ${row.id},
                    ${tripUpdate.timestamp},
                    ${tripUpdate.trip.tripId},
                    ${tripUpdate.trip.startDate},
                    ${nextStopTimeUpdate.stopId},
                    ${nextStopTimeUpdate.stopSequence},
                    ${nextStopTimeUpdate.arrival.time},
                    ${nextStopTimeUpdate.departure.time},
                    ${nextStopTimeUpdate.arrival.delay},
                )
            `;
            await markAsProcessed(row.id);
            continue;
        }

        const delay = delays[0];
        if (delay.trip_update_timestamp >= tripUpdate.timestamp) {
            // Already have a more recent update
            await markAsProcessed(row.id);
            continue;
        }

        await sql`
            UPDATE agg_trip_stop_delays
            SET trip_update_id = ${row.id},
                estimated_arrival = ${nextStopTimeUpdate.arrival.time},
                estimated_departure = ${nextStopTimeUpdate.departure.time},
                delay_seconds = ${nextStopTimeUpdate.arrival.delay},
        `;
        await markAsProcessed(row.id);
    }
    return fetchResult;
}

await processBatch()
process.exit(0);