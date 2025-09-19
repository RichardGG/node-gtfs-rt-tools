var map = L.map('map').setView([-28, 153.38], 13);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

const response = await fetch('/temp_json/stops.json');

const stops = await response.json();

const randomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

for (const stop of stops) {
    const lat = stop.entity.stop_lat;
    const lon = stop.entity.stop_lon;
    L.circleMarker([lat, lon], {fillOpacity: 1, color: randomColor()}).addTo(map)
        .bindPopup(`Stop ID: ${stop.entity.stop_id}<br>Stop Name: ${stop.entity.stop_name}`);
}