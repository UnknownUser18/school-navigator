import { Router } from "express";
import { executeQuery } from "../config/database";
import { ErrorPacket, OKPacket, sendPacket } from "./index";
import logger from "../config/console";

const router = Router({
  caseSensitive : true,
  strict        : true,
});

async function getRooms() {
  return await executeQuery('SELECT rooms.id AS id, room_number, x_coordinate, y_coordinate, description, floor_number FROM rooms JOIN points p on rooms.id = p.id')
}

async function getExits() {
  return await executeQuery('SELECT exits.id AS id, exit_name, isEmergency, x_coordinate, y_coordinate, description, floor_number FROM exits JOIN points p on p.id = exits.id')
}

async function getConnectors() {
  return await executeQuery('SELECT connections.id AS id, down_connection_id, up_connection_id, x_coordinate, y_coordinate, description, floor_number FROM connections JOIN points p on p.id = connections.id')
}

router.get('/all', async (_req, res) => {
  let packet;
  try {
    const rooms = await getRooms();
    const exits = await getExits();
    const connections = await getConnectors();

    packet = new OKPacket('Points fetched successfully', {
      rooms,
      exits,
      connections : connections,
    });
  } catch (error) {
    logger.error('Error fetching points', error);
    packet = new ErrorPacket('Failed to fetch points', 500);
  } finally {
    sendPacket(packet!, res);
  }
});

export default router;