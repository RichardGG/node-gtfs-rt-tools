import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import fetch from "node-fetch";
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();
const args = process.argv.slice(2);
const sql = postgres({});

const TYPE_TRIP_UPDATES = "trip-updates";
const TYPE_VEHICLE_POSITIONS = "vehicle-positions";
const TYPE_ALERTS = "alerts";

const endpointMap = {
    [TYPE_TRIP_UPDATES]: process.env.TRIP_UPDATE_URL,
    [TYPE_VEHICLE_POSITIONS]: process.env.VEHICLE_POSITIONS_URL,
    [TYPE_ALERTS]: process.env.ALERTS_URL,
};

const tableMap = {
    [TYPE_TRIP_UPDATES]: "trip_updates",
    [TYPE_VEHICLE_POSITIONS]: "vehicle_positions",
    [TYPE_ALERTS]: "alerts"
};

const getFeed = async (type) => {
    try {
        const res = await fetch(endpointMap[type]);
        if (!res.ok) {
            const error = new Error(`${res.url}: ${res.status} ${res.statusText}`);
            error.response = res;
            throw error;
        }
        const buffer = await res.arrayBuffer();
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
            new Uint8Array(buffer)
        );
        return feed;
    }
    catch (error) {
        console.log(error);
        process.exit(1);
    }
};

const saveFetch = async (type) => {
    const feed = await getFeed(type);

    // Save fetch
    const fetchResult = await sql`
        INSERT INTO fetches (type, header)
        VALUES (${type}, ${feed.header})
        RETURNING id
    `;
    const fetchId = fetchResult[0].id;

    // Save entities
    for (const entity of feed.entity) {
        await sql`
            INSERT INTO ${sql(tableMap[type])} (fetch_id, entity)
            VALUES (${fetchId}, ${entity})
        `;
    }
}

if (args[0] === "save-fetch") {
    for (const type of [TYPE_TRIP_UPDATES, TYPE_VEHICLE_POSITIONS, TYPE_ALERTS]) {
        await saveFetch(type);
    }
    process.exit(0);
} else if (args[0] === "trip-updates") {
    console.log(getFeed(TYPE_TRIP_UPDATES));
} else if (args[0] === "vehicle-positions") {
    console.log(getFeed(TYPE_VEHICLE_POSITIONS));
} else if (args[0] === "alerts") {
    console.log(getFeed(TYPE_ALERTS));
} else {
    console.log("Expected argument: save-fetch/trip-updates/vehicle-positions/alerts");
    process.exit(1);
}