const express = require('express');
const fetch = require('node-fetch'); // already installed
const path = require('path');

const app = express();
const PORT = 5500;

// Serve static files from current folder
app.use(express.static(path.join(__dirname)));
app.get(/^\/geoserver\/(.*)$/, async (req, res) => {
    try {
        // req.params[0] will capture everything after /geoserver/
        const targetUrl = `http://localhost:8080/geoserver/${req.params[0]}?${req.url.split('?')[1]}`;
        const response = await fetch(targetUrl);
        const contentType = response.headers.get('content-type');
        res.setHeader('Content-Type', contentType);
        response.body.pipe(res);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching GeoServer data');
    }
});


app.listen(PORT, () => {
    console.log(`App running at http://127.0.0.1:${PORT}`);
});
