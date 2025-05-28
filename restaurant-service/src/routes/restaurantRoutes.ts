import { Router, Request, Response, RequestHandler } from 'express';
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

// PUT /api/restaurants/:id
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, isOnline, openingHour, closingHour } = req.body;

  try {
    const updatedRestaurant = await prisma.restaurant.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(typeof isOnline === 'boolean' && { isOnline }),
        ...(openingHour !== undefined && { openingHour }),
        ...(closingHour !== undefined && { closingHour }),
      },
    });

    res.json(updatedRestaurant);
  } catch (error) {
    console.error('Error updating restaurant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/restaurants/orders/:orderId/accept
export const acceptOrder: RequestHandler = async (req, res) => {
  const { orderId } = req.params;

  try {
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

    const agentResponse = await axios.post<AssignedAgentResponse>(DELIVERY_AGENT_SERVICE_URL);
    const assignedAgent = agentResponse.data.assignedAgent;

    if (!assignedAgent?.id) {
      res.status(400).json({ error: 'No delivery agents available' });
      return;
    }

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
    console.error('❌ Error accepting order:', error.message || error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
router.post('/orders/:orderId/accept', acceptOrder);


// POST /api/restaurants/:restaurantId/menu
router.post('/:restaurantId/menu', async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const { name, price, available } = req.body;

  try {
    const menuItem = await prisma.menuItem.create({
      data: {
        name,
        price,
        available,
        restaurantId,
      },
    });

    res.status(201).json(menuItem);
  } catch (error) {
    console.error('Error adding menu item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/restaurants/menu/:menuItemId
router.put('/menu/:menuItemId', async (req: Request, res: Response) => {
  const { menuItemId } = req.params;
  const { name, price, available } = req.body;

  try {
    const updatedMenuItem = await prisma.menuItem.update({
      where: { id: menuItemId },
      data: {
        ...(name && { name }),
        ...(price !== undefined && { price }),
        ...(available !== undefined && { available }),
      },
    });

    res.json(updatedMenuItem);
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/restaurants/menu/:menuItemId
router.delete('/menu/:menuItemId', async (req: Request, res: Response) => {
  const { menuItemId } = req.params;

  try {
    await prisma.menuItem.delete({
      where: { id: menuItemId },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
