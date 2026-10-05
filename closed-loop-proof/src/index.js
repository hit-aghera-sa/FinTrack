import express from 'express';
import { PORT } from '../config/settings.js';
import { router } from './routes/health.js';
const app = express();
app.use('/', router);
app.listen(PORT, () => console.log(`expense-tracker listening on ${PORT}`));
