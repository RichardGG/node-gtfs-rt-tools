export async function up(sql) {
  await sql`
        CREATE TABLE gtfs_fetches (
            id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
            type text NOT NULL,
            hash text NOT NULL,
            content jsonb NOT NULL,
            fetched_at timestamp NOT NULL DEFAULT now()
        )
    `;
}

export async function down(sql) {
  await sql`DROP TABLE gtfs_fetches`;
}
