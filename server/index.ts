import express from 'express';
import cors from 'cors';
import { dataService } from './data-service';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get('/api/avalanche-data', async (req, res) => {
    try {
        const data = await dataService.getAvalancheData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch avalanche data' });
    }
});

app.get('/api/regions', async (req, res) => {
    try {
        const data = await dataService.getRegions();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch regions data' });
    }
});

app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    await dataService.initialize();
});
