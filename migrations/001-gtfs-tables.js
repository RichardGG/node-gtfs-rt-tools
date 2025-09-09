const types = [
    'agency',
    'calendar_dates',
    'calendar',
    'feed_info',
    'routes',
    'shapes',
    'stop_times',
    'stops',
    'trips'
];

export async function up(sql) {   
    for (const type of types) {
        console.log(`Creating table ${type}`);
        await sql`
            CREATE TABLE ${sql(type)} (
                id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                fetch_id integer REFERENCES fetches(id) ON DELETE CASCADE,
                entity jsonb NOT NULL
            )
        `;
    }
}

export async function down(sql) {
    for (const type of types) {
        await sql`DROP TABLE ${sql(type)}`;
    }
}