// Estimates of data size

// ~2MB per fetch
// 500 fetches = 1GB

// 24*12 = fetch every 5 minutes = 288 fetches per day
// > ~0.5GB per day
// > ~15GB per month
// > ~180GB per year

// TODO look into rendering route shapes eg https://github.com/blinktaginc/gtfs-to-geojson?tab=readme-ov-file

// TODO consider getting trip data from
// https://www.data.qld.gov.au/dataset/translink-origin-destination-trips-2022-onwards
// Currently not updated and only has data from paper tickets and go cards, not smart ticketing (CC)

// TODO consider Service capacity data
// https://www.data.qld.gov.au/dataset/service_capacity_tracker_dashboard

const fetchGTFS = async () => {
    // TODO consider caching the contents in db
    const res = await fetch("https://gtfsrt.api.translink.com.au/GTFS/SEQ_GTFS.zip");
    if (!res.ok) {
        const error = new Error(`${res.url}: ${res.status} ${res.statusText}`);
        error.response = res;
        throw error;
    }
    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer);
};