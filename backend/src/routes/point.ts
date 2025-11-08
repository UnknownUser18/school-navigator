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

async function getStairs() {
  return await executeQuery('SELECT stairs.id AS id, down_stair_id, up_stair_id, x_coordinate, y_coordinate, description, floor_number FROM stairs JOIN points p on p.id = stairs.id')
}

router.get('/all', async (_req, res) => {
  let packet;
  try {
    const rooms = await getRooms();
    const exits = await getExits();
    const stairs = await getStairs();

    packet = new OKPacket('Points fetched successfully', {
      rooms,
      exits,
      stairs,
    });
  } catch (error) {
    logger.error('Error fetching points', error);
    packet = new ErrorPacket('Failed to fetch points', 500);
  } finally {
    sendPacket(packet!, res);
  }
});

export default router;