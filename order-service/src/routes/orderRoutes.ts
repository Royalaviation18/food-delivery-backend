import { Router, RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Create new order
router.post('/', async (req, res) => {
  try {
    const { userId, restaurantId, items } = req.body;

    const order = await prisma.order.create({
      data: { userId, restaurantId, items }
    });

    res.status(201).json(order);
  } catch (error: any) {
    console.error("❌ Error creating order:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Rate an order
router.post('/:id/rate', async (req, res) => {
  try {
    const { userRating, agentRating } = req.body;

    const updatedOrder = await prisma.order.update({
      where: { id: req.params.id },
      data: { userRating, agentRating }
    });

    res.json(updatedOrder);
  } catch (error: any) {
    console.error("❌ Error updating rating:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Assign delivery agent to order
const assignDeliveryAgent: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { deliveryAgentId } = req.body;

  if (!deliveryAgentId) {
    res.status(400).json({ error: 'Missing deliveryAgentId in request body' });
    return;
  }

  try {
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { deliveryAgentId }
    });

    res.status(200).json(updatedOrder);
  } catch (error: any) {
    console.error("❌ Error assigning delivery agent:", error.message || error);
    res.status(500).json({ error: "Internal server error" });
  }
};
router.patch('/:id/assign-agent', assignDeliveryAgent);

// Update delivery status
const updateOrderStatus: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    res.status(400).json({ error: 'Missing status in request body' });
    return;
  }

  try {
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status }
    });

    res.status(200).json(updatedOrder);
  } catch (error: any) {
    console.error("❌ Error updating order status:", error.message || error);
    res.status(500).json({ error: "Internal server error" });
  }
};
router.patch('/:id/status', updateOrderStatus);

// Get all orders
router.get('/', async (_req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(orders);
  } catch (error: any) {
    console.error("❌ Error fetching orders:", error.message || error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get order by ID
const getOrderById: RequestHandler = async (req, res) => {
  const { id } = req.params;

  try {
    const order = await prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.status(200).json(order);
  } catch (error: any) {
    console.error("❌ Error fetching order by ID:", error.message || error);
    res.status(500).json({ error: "Internal server error" });
  }
};
router.get('/:id', getOrderById);

// Generic update endpoint for orders (can update multiple fields)
const updateOrder: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  try {
    // Update the order with any fields passed in the request body
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json(updatedOrder);
  } catch (error: any) {
    console.error("❌ Error updating order:", error.message || error);
    if (error.code === 'P2025') { // Prisma record not found error
      res.status(404).json({ error: "Order not found" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

router.patch('/:id', updateOrder);



export default router;
