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
        WHERE last_processed_at < '2025-09-18 00:00:00+00' OR last_processed_at IS NULL
        ORDER BY id
        LIMIT 1000
    `;
    for (const row of fetchResult) {
        // TODO consider processing all stops, in case of update delays missing a stop
        const tripUpdate = row.entity.tripUpdate;
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

        const timestamp = tripUpdate.timestamp && new Date(tripUpdate.timestamp * 1000);
        const arrivalTime = nextStopTimeUpdate.arrival?.time && new Date(nextStopTimeUpdate.arrival.time * 1000);
        const departureTime = nextStopTimeUpdate.departure?.time && new Date(nextStopTimeUpdate.departure.time * 1000);

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
                    arrival_delay_seconds,
                    departure_delay_seconds
                ) VALUES (
                    ${row.id ?? null},
                    ${timestamp ?? null},
                    ${tripUpdate.trip.tripId ?? null},
                    ${tripUpdate.trip.startDate ?? null},
                    ${nextStopTimeUpdate.stopId ?? null},
                    ${nextStopTimeUpdate.stopSequence ?? null},
                    ${arrivalTime ?? null},
                    ${departureTime ?? null},
                    ${nextStopTimeUpdate.arrival?.delay ?? null},
                    ${nextStopTimeUpdate.departure?.delay ?? null}
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
                trip_update_timestamp = ${timestamp},
                estimated_arrival = ${arrivalTime},
                estimated_departure = ${departureTime},
                arrival_delay_seconds = ${nextStopTimeUpdate.arrival?.delay},
                departure_delay_seconds = ${nextStopTimeUpdate.departure?.delay}
        `;
        await markAsProcessed(row.id);
    }
    return fetchResult;
}

await processBatch()
process.exit(0);