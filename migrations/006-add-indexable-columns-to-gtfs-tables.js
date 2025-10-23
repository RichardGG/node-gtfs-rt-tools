// TODO make the indexes here more efficient
// routes route_id
// trips route_id trip_id
// stop_times trip_id stop_sequence

export async function up(sql) {
  await sql`ALTER TABLE routes ADD COLUMN route_id text;`;
  await sql`UPDATE routes SET route_id = entity->>'route_id';`;
  await sql`CREATE INDEX idx_routes_route_id ON routes(route_id);`;

  await sql`ALTER TABLE trips ADD COLUMN route_id text;`;
  await sql`ALTER TABLE trips ADD COLUMN trip_id text;`;
  await sql`CREATE INDEX idx_trips_route_id ON trips(route_id);`;
  await sql`CREATE INDEX idx_trips_trip_id ON trips(trip_id);`;
  await sql`UPDATE trips SET route_id = entity->>'route_id', trip_id = entity->>'trip_id';`;

  await sql`ALTER TABLE stop_times ADD COLUMN trip_id text;`;
  await sql`ALTER TABLE stop_times ADD COLUMN stop_id text;`;
  await sql`ALTER TABLE stop_times ADD COLUMN stop_sequence integer;`;
  await sql`CREATE INDEX idx_stop_times_stop_sequence ON stop_times(stop_sequence);`;
  await sql`CREATE INDEX idx_stop_times_trip_id ON stop_times(trip_id);`;
  await sql`CREATE INDEX idx_stop_times_stop_id ON stop_times(stop_id);`;
  await sql`UPDATE stop_times SET trip_id = entity->>'trip_id', stop_id = entity->>'stop_id', stop_sequence = (entity->>'stop_sequence')::integer;`;

  await sql`CREATE INDEX idx_trip_segments_geom_route_id_from_stop_id ON trip_segments_geom(route_id, from_stop_id);`;
  await sql`CREATE INDEX idx_trip_segments_geom_route_id_to_stop_id ON trip_segments_geom(route_id, to_stop_id);`;
}

export async function down(sql) {
  await sql`ALTER TABLE routes DROP COLUMN route_id;`;
  await sql`ALTER TABLE trips DROP COLUMN route_id;`;
  await sql`ALTER TABLE trips DROP COLUMN trip_id;`;
  await sql`ALTER TABLE stop_times DROP COLUMN trip_id;`;
  await sql`ALTER TABLE stop_times DROP COLUMN stop_id;`;
  await sql`ALTER TABLE stop_times DROP COLUMN stop_sequence;`;
}
