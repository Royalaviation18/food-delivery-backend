import express from 'express';
import cors from 'cors';
import orderRoutes from './routes/orderRoutes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/orders', orderRoutes);

export default app;
