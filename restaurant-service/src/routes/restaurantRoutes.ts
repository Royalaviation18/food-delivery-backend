import { Router, RequestHandler, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const router = Router();
const prisma = new PrismaClient();

// External service URLs
const DELIVERY_AGENT_SERVICE_URL = 'http://localhost:3003/agents/assign';
const ORDER_SERVICE_BASE_URL = 'http://localhost:3004/api/orders';

// Interfaces
interface AssignedAgent {
  id: string;
  phoneNumber?: string;
  isAvailable?: boolean;
}

interface AssignedAgentResponse {
  assignedAgent: AssignedAgent;
}

interface Order {
  id: string;
  restaurantId: string;
  status: string;
  // add other fields as necessary
}

// GET /api/restaurants?currentHour=XX
router.get('/', async (req: Request, res: Response) => {
  try {
    const currentHour = parseInt(req.query.currentHour as string);
    let filter = {};

    if (!isNaN(currentHour)) {
      filter = {
        isOnline: true,
        openingHour: { lte: currentHour },
        closingHour: { gte: currentHour },
      };
    }

    const restaurants = await prisma.restaurant.findMany({ where: filter });
    res.json(restaurants);
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/restaurants
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, isOnline, openingHour, closingHour } = req.body;

    const newRestaurant = await prisma.restaurant.create({
      data: { name, isOnline, openingHour, closingHour },
    });

    res.status(201).json(newRestaurant);
  } catch (error) {
    console.error('Error creating restaurant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/restaurants/orders/:orderId/accept
const acceptOrder: RequestHandler = async (req, res) => {
  const { orderId } = req.params;

  try {
    // Fetch order details from order-service
    const orderResponse = await axios.get<Order>(`${ORDER_SERVICE_BASE_URL}/${orderId}`);
    const order = orderResponse.data;

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (order.status !== 'PLACED' && order.status !== 'pending') {
      res.status(400).json({ error: 'Order not in pending/placed state' });
      return;
    }

    // Assign a delivery agent via delivery-agent-service
    const agentResponse = await axios.post<AssignedAgentResponse>(DELIVERY_AGENT_SERVICE_URL);
    const assignedAgent = agentResponse.data.assignedAgent;

    if (!assignedAgent || !assignedAgent.id) {
      res.status(400).json({ error: 'No delivery agents available' });
      return;
    }

    // Update order status and assign delivery agent in order-service
    const updatedOrderResponse = await axios.patch(`${ORDER_SERVICE_BASE_URL}/${orderId}`, {
      status: 'accepted',
      deliveryAgentId: assignedAgent.id,
    });

    res.status(200).json({
      message: 'Order accepted',
      order: updatedOrderResponse.data,
      assignedAgent,
    });
  } catch (error: any) {
    console.error('Error accepting order:', error.message || error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.post('/orders/:orderId/accept', acceptOrder);

export default router;
