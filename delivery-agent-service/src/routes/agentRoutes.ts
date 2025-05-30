import { Router, Request, Response, RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const router = Router();

/**
 * Get all available delivery agents
 * GET /agents
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const agents = await prisma.deliveryAgent.findMany({
      where: { isAvailable: true },
    });
    res.json(agents);
  } catch (error) {
    console.error('Error fetching delivery agents:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get all agents (regardless of availability)
 * GET /agents/all
 */
router.get('/all', async (_req: Request, res: Response) => {
  try {
    const agents = await prisma.deliveryAgent.findMany();
    res.json(agents);
  } catch (error) {
    console.error('Error fetching all agents:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get agent by ID
 * GET /agents/:id
 */
export const getAgentById: RequestHandler = async (req, res) => {
  const { id } = req.params;

  try {
    const agent = await prisma.deliveryAgent.findUnique({
      where: { id },
    });

    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    res.status(200).json(agent);
  } catch (error: any) {
    console.error('❌ Error fetching agent by ID:', error.message || error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Assign an available delivery agent (safe transaction)
 * POST /agents/assign
 */
router.post('/assign', async (_req: Request, res: Response) => {
  try {
    const assignedAgent = await prisma.$transaction(async (tx) => {
      const agent = await tx.deliveryAgent.findFirst({
        where: { isAvailable: true },
        orderBy: { createdAt: 'asc' },
      });

      if (!agent) throw new Error('No available agents');

      const updated = await tx.deliveryAgent.updateMany({
        where: { id: agent.id, isAvailable: true },
        data: { isAvailable: false },
      });

      if (updated.count === 0) throw new Error('Agent just got assigned');

      return agent;
    });

    res.status(200).json({ assignedAgent });
  } catch (error: any) {
    console.error('Error assigning delivery agent:', error.message || error);
    res.status(404).json({ error: error.message || 'Failed to assign agent' });
  }
});

/**
 * Mark an agent as available again
 * POST /agents/:id/available
 */
router.post('/:id/available', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const updatedAgent = await prisma.deliveryAgent.update({
      where: { id },
      data: { isAvailable: true },
    });

    res.status(200).json(updatedAgent);
  } catch (error) {
    console.error('Error updating agent status:', error);
    res.status(500).json({ error: 'Error updating agent status' });
  }
});

/**
 * Create a new delivery agent
 * POST /agents/create
 */
router.post('/create', async (req: Request, res: Response) => {
  const { name, phoneNumber } = req.body;

  if (!name || !phoneNumber) {
    res.status(400).json({ error: 'Name and phoneNumber are required' });
    return;
  }

  try {
    const agent = await prisma.deliveryAgent.create({
      data: {
        name,
        phoneNumber,
        isAvailable: true,
      },
    });

    res.status(201).json(agent);
  } catch (error: any) {
    console.error('Error creating agent:', error.message || error);
    res.status(500).json({ error: 'Error creating agent' });
  }
});

/**
 * Update order status via order microservice
 * PATCH /agents/:agentId/orders/:orderId/status
 */
export const updateOrderStatusByAgent: RequestHandler = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (!status) {
    res.status(400).json({ error: 'Missing status in request body' });
    return;
  }

  try {
    // Replace with your actual order service URL
    const orderServiceUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:3004/api/orders';

    // Call the order microservice's update order status endpoint
    const response = await axios.patch(`${orderServiceUrl}/${orderId}/status`, { status });

    // Forward the response from order service to the client
    res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('❌ Error updating order status via order service:', error.message || error);

    if (error.response) {
      // Forward the error response from order service
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
router.patch('/:agentId/orders/:orderId/status', updateOrderStatusByAgent);

export default router;
