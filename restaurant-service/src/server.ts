import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import restaurantRoutes from './routes/restaurantRoutes';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/restaurants', restaurantRoutes);

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Restaurant service running on port ${PORT}`);
});
