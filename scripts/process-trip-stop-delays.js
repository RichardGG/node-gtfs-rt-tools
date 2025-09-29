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

const processStopTimeUpdate = async (stopTimeUpdate, tripUpdate, tripUpdateId) => {
    const delays = await sql`
        SELECT * FROM agg_trip_stop_delays
        WHERE trip_id = ${tripUpdate.trip.tripId}
        AND start_date = ${tripUpdate.trip.startDate}
        AND stop_id = ${stopTimeUpdate.stopId}
        AND stop_sequence = ${stopTimeUpdate.stopSequence}
    `;

    const timestamp = tripUpdate.timestamp && new Date(tripUpdate.timestamp * 1000);
    const arrivalTime = stopTimeUpdate.arrival?.time && new Date(stopTimeUpdate.arrival.time * 1000);
    const departureTime = stopTimeUpdate.departure?.time && new Date(stopTimeUpdate.departure.time * 1000);

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
                ${tripUpdateId ?? null},
                ${timestamp ?? null},
                ${tripUpdate.trip.tripId ?? null},
                ${tripUpdate.trip.startDate ?? null},
                ${stopTimeUpdate.stopId ?? null},
                ${stopTimeUpdate.stopSequence ?? null},
                ${arrivalTime ?? null},
                ${departureTime ?? null},
                ${stopTimeUpdate.arrival?.delay ?? null},
                ${stopTimeUpdate.departure?.delay ?? null}
            )
        `;
        return;
    }

    const delay = delays[0];
    if (delay.trip_update_timestamp >= tripUpdate.timestamp) {
        // Already have a more recent update
        return;
    }

    await sql`
        UPDATE agg_trip_stop_delays
        SET trip_update_id = ${tripUpdateId},
            trip_update_timestamp = ${timestamp},
            estimated_arrival = ${arrivalTime},
            estimated_departure = ${departureTime},
            arrival_delay_seconds = ${stopTimeUpdate.arrival?.delay},
            departure_delay_seconds = ${stopTimeUpdate.departure?.delay}
    `;
}

const processBatch = async () => {
    const fetchResult = await sql`
        SELECT * FROM trip_updates
        WHERE last_processed_at < '2025-09-18 00:00:00+00' OR last_processed_at IS NULL
        ORDER BY id
        LIMIT 5000
    `;

    console.log(`Processing ${fetchResult.length} trip updates`);

    for (const row of fetchResult) {
        const tripUpdate = row.entity.tripUpdate;

        if (! tripUpdate.stopTimeUpdate) {
            await markAsProcessed(row.id);
            continue;
        }

        for (const stopTimeUpdate of tripUpdate.stopTimeUpdate) {
            await processStopTimeUpdate(stopTimeUpdate, tripUpdate, row.id);
        }

        await markAsProcessed(row.id);
    }
    return fetchResult;
}

let count = 1;
while (count > 0) {
    const results = await processBatch();
    count = results.length;
    console.log(`Processed ${count} trip updates`);
}
process.exit(0);