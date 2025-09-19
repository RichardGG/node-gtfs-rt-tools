export async function up(sql) {
    await sql`
        CREATE TABLE agg_trip_stop_delays (
            id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
            trip_update_id INTEGER REFERENCES trip_updates(id) ON DELETE CASCADE,
            trip_update_timestamp TIMESTAMPTZ NOT NULL,
            trip_id TEXT NOT NULL,
            start_date TEXT NOT NULL,
            stop_id TEXT NOT NULL,
            stop_sequence INTEGER NOT NULL,
            estimated_arrival TIMESTAMPTZ NULL,
            estimated_departure TIMESTAMPTZ NULL,
            arrival_delay_seconds INTEGER NULL,
            departure_delay_seconds INTEGER NULL
        );
    `;

    await sql`CREATE INDEX idx_agg_trip_stop_delays_trip 
        ON agg_trip_stop_delays (trip_id)`;
    await sql`CREATE INDEX idx_agg_trip_stop_delays_stop 
        ON agg_trip_stop_delays (stop_id)`;
    await sql`CREATE INDEX idx_agg_trip_stop_delays_trip_stop_seq 
        ON agg_trip_stop_delays (trip_id, stop_sequence);`;

    await sql`ALTER TABLE trip_updates ADD COLUMN last_processed_at TIMESTAMPTZ;`;
}

export async function down(sql) {
    await sql`DROP TABLE agg_trip_stop_delays`;
    await sql`ALTER TABLE trip_updates DROP COLUMN last_processed_at;`;
}