import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
const router = Router();
const prisma = new PrismaClient();
const RESTAURANT_SERVICE_URL = process.env.RESTAURANT_SERVICE_URL || 'http://localhost:3002';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3004'; // new: order-service base URL
// Get all online restaurants available at the current hour (via restaurant-service)
router.get('/restaurants', async (req, res) => {
    try {
        const currentHour = req.query.currentHour ? parseInt(req.query.currentHour) : new Date().getHours();
        const response = await axios.get(`${RESTAURANT_SERVICE_URL}/api/restaurants?currentHour=${currentHour}`);
        res.json(response.data);
    }
    catch (error) {
        console.error('Error fetching restaurants:', error.message || error);
        res.status(500).json({ error: 'Unable to fetch restaurants' });
    }
});
// Place an order via order-service
router.post('/orders', async (req, res) => {
    try {
        // Forward the order request to order-service
        const response = await axios.post(`${ORDER_SERVICE_URL}/api/orders`, req.body);
        res.status(response.status).json(response.data);
    }
    catch (error) {
        console.error('Error placing order via order-service:', error.response?.data || error.message || error);
        const status = error.response?.status || 500;
        const message = error.response?.data?.error || 'Internal server error';
        res.status(status).json({ error: message });
    }
});
// Rate an order via order-service
router.post('/orders/:id/rate', async (req, res) => {
    const orderId = req.params.id;
    try {
        const response = await axios.post(`${ORDER_SERVICE_URL}/api/orders/${orderId}/rate`, req.body);
        res.status(response.status).json(response.data);
    }
    catch (error) {
        console.error('Error rating order via order-service:', error.response?.data || error.message || error);
        const status = error.response?.status || 500;
        const message = error.response?.data?.error || 'Internal server error';
        res.status(status).json({ error: message });
    }
});
// Fetch a user's order history via order-service
router.get('/orders/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const response = await axios.get(`${ORDER_SERVICE_URL}/api/orders/${userId}`);
        res.json(response.data);
    }
    catch (error) {
        console.error('Error fetching user orders via order-service:', error.response?.data || error.message || error);
        const status = error.response?.status || 500;
        const message = error.response?.data?.error || 'Failed to fetch orders';
        res.status(status).json({ error: message });
    }
});
// Create a new user
router.post('/createUser', async (req, res) => {
    const { name, email } = req.body;
    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
    }
    try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists with this email' });
        }
        const user = await prisma.user.create({
            data: {
                name,
                email,
            },
        });
        res.status(201).json(user);
    }
    catch (error) {
        console.error('Error creating user:', error.message || error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all users
router.get('/allUsers', async (_req, res) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.json(users);
    }
    catch (error) {
        console.error('Error fetching users:', error.message || error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
// Get a user by ID
router.get('/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const user = await prisma.user.findUnique({
            where: { id },
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    }
    catch (error) {
        console.error('Error fetching user:', error.message || error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});
// Get order by ID via order-service
router.get('/order/:orderId', async (req, res) => {
    const { orderId } = req.params;
    try {
        const response = await axios.get(`${ORDER_SERVICE_URL}/api/order/${orderId}`);
        res.json(response.data);
    }
    catch (error) {
        console.error('Error fetching order via order-service:', error.response?.data || error.message || error);
        const status = error.response?.status || 500;
        const message = error.response?.data?.error || 'Failed to fetch order';
        res.status(status).json({ error: message });
    }
});
export default router;
