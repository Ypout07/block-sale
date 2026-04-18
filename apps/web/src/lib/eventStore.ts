import fs from 'fs';
import path from 'path';

export type EventState = {
  eventId: string;
  remainingTickets: number;
  isSoldOut: boolean;
};

const DB_PATH = path.join(process.cwd(), 'events_db.json');

// Initialize with some default states for the demo
const INITIAL_STATES: EventState[] = [
  { eventId: "12", remainingTickets: 1, isSoldOut: false }, // Post Malone has 1 left
];

function readDb(): EventState[] {
  try {
    if (!fs.existsSync(DB_PATH)) {
      writeDb(INITIAL_STATES);
      return INITIAL_STATES;
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return INITIAL_STATES;
  }
}

function writeDb(states: EventState[]) {
  fs.writeFileSync(DB_PATH, JSON.stringify(states, null, 2));
}

export function getEventState(eventId: string): EventState {
  const states = readDb();
  let state = states.find(s => s.eventId === eventId);
  if (!state) {
    state = { eventId, remainingTickets: 10, isSoldOut: false };
  }
  return state;
}

export function decrementTickets(eventId: string) {
  const states = readDb();
  const state = states.find(s => s.eventId === eventId);
  if (state) {
    state.remainingTickets = Math.max(0, state.remainingTickets - 1);
    if (state.remainingTickets === 0) {
      state.isSoldOut = true;
    }
    writeDb(states);
  } else {
    states.push({ eventId, remainingTickets: 9, isSoldOut: false });
    writeDb(states);
  }
}

export function incrementTickets(eventId: string) {
  const states = readDb();
  const state = states.find(s => s.eventId === eventId);
  if (state) {
    state.remainingTickets += 1;
    state.isSoldOut = false;
    writeDb(states);
  }
}
