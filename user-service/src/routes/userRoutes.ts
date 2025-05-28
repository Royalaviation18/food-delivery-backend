import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const router = Router();
const prisma = new PrismaClient();

const RESTAURANT_SERVICE_URL = process.env.RESTAURANT_SERVICE_URL || 'http://localhost:3002';

// Types
interface OrderRequestBody {
  userId: string;
  restaurantId: string;
  items: string[];
}

interface RateRequestBody {
  userRating: number;
  agentRating: number;
}

// Get all online restaurants available at the current hour (via restaurant-service)
router.get('/restaurants', async (req: Request, res: Response) => {
  try {
    const currentHour = req.query.currentHour ? parseInt(req.query.currentHour as string) : new Date().getHours();
    const response = await axios.get(`${RESTAURANT_SERVICE_URL}/api/restaurants?currentHour=${currentHour}`);
    res.json(response.data);
  } catch (error: any) {
    console.error('Error fetching restaurants:', error.message || error);
    res.status(500).json({ error: 'Unable to fetch restaurants' });
  }
});

// Place an order only if restaurant is online and open
router.post('/orders', async (req: Request<{}, {}, OrderRequestBody>, res: Response) => {
  const { userId, restaurantId, items } = req.body;

  if (!userId || !restaurantId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid order data' });
  }

  try {
    const currentHour = new Date().getHours();
    const restaurantResponse = await axios.get(`${RESTAURANT_SERVICE_URL}/api/restaurants?currentHour=${currentHour}`);
    const availableRestaurants = restaurantResponse.data as {id: string}[];

    const isRestaurantAvailable = availableRestaurants.some((r: any) => r.id === restaurantId);

    if (!isRestaurantAvailable) {
      return res.status(400).json({ error: 'Restaurant is not available at this hour' });
    }

    const order = await prisma.order.create({
      data: {
        userId,
        restaurantId,
        items,
        status: 'PLACED',
      },
    });

    res.status(201).json(order);
  } catch (error: any) {
    console.error('Error placing order:', error.message || error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rate an order and agent
router.post('/orders/:id/rate', async (req: Request<{ id: string }, {}, RateRequestBody>, res: Response) => {
  const orderId = req.params.id;
  const { userRating, agentRating } = req.body;

  if (userRating == null || agentRating == null) {
    return res.status(400).json({ error: 'Both ratings are required' });
  }

  try {
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        userRating,
        agentRating,
      },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Error rating order:', error.message || error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch a user's order history
router.get('/orders/:userId', async (req: Request<{ userId: string }>, res: Response) => {
  const { userId } = req.params;

  try {
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders);
  } catch (error: any) {
    console.error('Error fetching user orders:', error.message || error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Create a new user
router.post('/createUser', async (req: Request, res: Response) => {
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
  } catch (error: any) {
    console.error('Error creating user:', error.message || error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users
router.get('/allUsers', async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error: any) {
    console.error('Error fetching users:', error.message || error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get a user by ID
router.get('/users/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error: any) {
    console.error('Error fetching user:', error.message || error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Get order by ID
router.get('/order/:orderId', async (req: Request<{ orderId: string }>, res: Response) => {
  const { orderId } = req.params;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error: any) {
    console.error('Error fetching order:', error.message || error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

export default router;
