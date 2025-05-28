import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
import userRoutes from './routes/userRoutes';
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/users', userRoutes);
const PORT = Number(process.env.PORT) || 3001;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`User service running on http://${HOST}:${PORT}`);
});
