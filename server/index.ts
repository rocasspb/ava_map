import express from 'express';
import cors from 'cors';
import { dataService } from './data-service';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get('/api/avalanche-data', async (_req, res) => {
    try {
        const data = await dataService.getAvalancheData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch avalanche data' });
    }
});

app.get('/api/regions', async (_req, res) => {
    try {
        const data = await dataService.getRegions();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch regions data' });
    }
});

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, '../dist')));

// Catch-all route to serve index.html for non-API requests (SPA support)
app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const server = app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    await dataService.initialize();
    console.log('Server is listening?', server.listening);
});

server.on('error', (e) => console.error('SERVER ERROR:', e));
server.on('close', () => console.log('SERVER CLOSED'));
