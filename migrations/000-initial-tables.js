export async function up(sql) {
    await sql`
        CREATE TABLE fetches (
            id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
            type text NOT NULL,
            header jsonb NOT NULL,
            fetched_at timestamp NOT NULL DEFAULT now()
        )
    `;

    await sql`
        CREATE TABLE trip_updates (
            id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
            fetch_id integer REFERENCES fetches(id) ON DELETE CASCADE,
            entity jsonb NOT NULL
        )
    `;

    await sql`
        CREATE TABLE vehicle_positions (
            id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
            fetch_id integer REFERENCES fetches(id) ON DELETE CASCADE,
            entity jsonb NOT NULL
        )
    `;

    await sql`
        CREATE TABLE alerts (
            id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
            fetch_id integer REFERENCES fetches(id) ON DELETE CASCADE,
            entity jsonb NOT NULL
        )
    `;
}

export async function down(sql) {
    await sql`DROP TABLE trip_updates`;
    await sql`DROP TABLE vehicle_positions`;
    await sql`DROP TABLE alerts`;
    await sql`DROP TABLE fetches`;
}