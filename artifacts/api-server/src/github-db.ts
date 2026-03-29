// GitHub-backed JSON database for Vercel deployment
// Stores all app data as JSON files in a private GitHub repository.
// No external database service required beyond GitHub.

const TOKEN = () => process.env.GITHUB_TOKEN ?? "";
const OWNER = () => process.env.GITHUB_DB_OWNER ?? "";
const REPO  = () => process.env.GITHUB_DB_REPO ?? "";

export type User = {
  id: number;
  username: string;
  passwordHash: string | null;
  createdAt: string;
};

export type Trip = {
  id: number;
  name: string;
  destination: string;
  description: string | null;
  startDate: string;
  endDate: string;
  inviteCode: string;
  creatorId: number;
  createdAt: string;
};

export type TripMember = {
  id: number;
  tripId: number;
  userId: number;
  role: "member" | "admin";
  joinedAt: string;
};

export type AppEvent = {
  id: number;
  tripId: number;
  type: string;
  title: string;
  location: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  transportData: Record<string, unknown> | null;
  lodgingData: Record<string, unknown> | null;
  restaurationData: Record<string, unknown> | null;
  activiteData: Record<string, unknown> | null;
  pricePerPerson: number | null;
  priceType: string | null;
  forAll: boolean;
  participantIds: number[] | null;
  creatorId: number;
  createdAt: string;
};

export type ChatMessage = {
  id: number;
  tripId: number;
  userId: number;
  username: string;
  content: string;
  createdAt: string;
};

function apiUrl(path: string) {
  return `https://api.github.com/repos/${OWNER()}/${REPO()}/contents/${path}`;
}

function headers() {
  return {
    Authorization: `token ${TOKEN()}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    "User-Agent": "ready2go-app/1.0",
  };
}

function genId(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 999);
}

async function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function readFile<T>(path: string): Promise<{ data: T; sha: string } | null> {
  const r = await fetch(apiUrl(path), { headers: headers() });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub read ${path}: ${r.status}`);
  const d = (await r.json()) as { content: string; sha: string };
  const raw = Buffer.from(d.content.replace(/\s/g, ""), "base64").toString("utf-8");
  return { data: JSON.parse(raw) as T, sha: d.sha };
}

async function writeFile(path: string, data: unknown, sha?: string): Promise<void> {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");
  const body: Record<string, unknown> = { message: `db: ${path}`, content };
  if (sha) body.sha = sha;
  const r = await fetch(apiUrl(path), {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw Object.assign(new Error(`GitHub write ${path}: ${r.status}`), { status: r.status, body: e });
  }
}

async function modifyArr<T>(path: string, fn: (arr: T[]) => T[], retries = 4): Promise<T[]> {
  for (let i = 0; i < retries; i++) {
    const result = await readFile<T[]>(path);
    const arr = result?.data ?? [];
    const sha = result?.sha;
    const updated = fn([...arr]);
    try {
      await writeFile(path, updated, sha);
      return updated;
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (i >= retries - 1 || status !== 409) throw err;
      await sleep(250 * (i + 1));
    }
  }
  return [];
}

async function readArr<T>(path: string): Promise<T[]> {
  const r = await readFile<T[]>(path);
  return r?.data ?? [];
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUsers(): Promise<User[]> {
  return readArr<User>("data/users.json");
}

export async function getUserById(id: number): Promise<User | null> {
  const users = await getUsers();
  return users.find((u) => u.id === id) ?? null;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const users = await getUsers();
  return users.find((u) => u.username.toLowerCase() === username.toLowerCase()) ?? null;
}

export async function createUser(data: { username: string; passwordHash: string }): Promise<User> {
  const user: User = { id: genId(), ...data, createdAt: new Date().toISOString() };
  await modifyArr<User>("data/users.json", (arr) => [...arr, user]);
  return user;
}

export async function updateUser(id: number, patch: Partial<User>): Promise<User | null> {
  let found: User | null = null;
  await modifyArr<User>("data/users.json", (arr) =>
    arr.map((u) => {
      if (u.id === id) { found = { ...u, ...patch }; return found; }
      return u;
    })
  );
  return found;
}

// ─── Trips ────────────────────────────────────────────────────────────────────

export async function getTrips(): Promise<Trip[]> {
  return readArr<Trip>("data/trips.json");
}

export async function getTripById(id: number): Promise<Trip | null> {
  const trips = await getTrips();
  return trips.find((t) => t.id === id) ?? null;
}

export async function getTripByInviteCode(code: string): Promise<Trip | null> {
  const trips = await getTrips();
  return trips.find((t) => t.inviteCode === code.toUpperCase()) ?? null;
}

export async function createTrip(data: Omit<Trip, "id" | "createdAt">): Promise<Trip> {
  const trip: Trip = { id: genId(), ...data, createdAt: new Date().toISOString() };
  await modifyArr<Trip>("data/trips.json", (arr) => [...arr, trip]);
  return trip;
}

export async function updateTrip(id: number, patch: Partial<Trip>): Promise<Trip | null> {
  let found: Trip | null = null;
  await modifyArr<Trip>("data/trips.json", (arr) =>
    arr.map((t) => {
      if (t.id === id) { found = { ...t, ...patch }; return found; }
      return t;
    })
  );
  return found;
}

export async function deleteTrip(id: number): Promise<void> {
  await modifyArr<Trip>("data/trips.json", (arr) => arr.filter((t) => t.id !== id));
  await modifyArr<TripMember>("data/members.json", (arr) => arr.filter((m) => m.tripId !== id));
  await modifyArr<AppEvent>("data/events.json", (arr) => arr.filter((e) => e.tripId !== id));
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function getMembers(): Promise<TripMember[]> {
  return readArr<TripMember>("data/members.json");
}

export async function getTripMembers(tripId: number): Promise<TripMember[]> {
  const all = await getMembers();
  return all.filter((m) => m.tripId === tripId);
}

export async function isMember(tripId: number, userId: number): Promise<boolean> {
  const all = await getMembers();
  return all.some((m) => m.tripId === tripId && m.userId === userId);
}

export async function addMember(data: Omit<TripMember, "id" | "joinedAt" | "role"> & { role?: "member" | "admin" }): Promise<TripMember> {
  const { role: _unused, ...rest } = data;
  const member: TripMember = { id: genId(), ...rest, role: data.role ?? "member", joinedAt: new Date().toISOString() };
  await modifyArr<TripMember>("data/members.json", (arr) => [...arr, member]);
  return member;
}

export async function updateMemberRole(tripId: number, userId: number, role: "member" | "admin"): Promise<TripMember | null> {
  let found: TripMember | null = null;
  await modifyArr<TripMember>("data/members.json", (arr) =>
    arr.map((m) => {
      if (m.tripId === tripId && m.userId === userId) {
        found = { ...m, role };
        return found;
      }
      return m;
    })
  );
  return found;
}

export async function getAdminCount(tripId: number): Promise<number> {
  const members = await getTripMembers(tripId);
  return members.filter((m) => m.role === "admin").length;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function getEvents(): Promise<AppEvent[]> {
  return readArr<AppEvent>("data/events.json");
}

export async function getEventsByTripId(tripId: number): Promise<AppEvent[]> {
  const all = await getEvents();
  return all.filter((e) => e.tripId === tripId);
}

export async function getEventById(id: number): Promise<AppEvent | null> {
  const all = await getEvents();
  return all.find((e) => e.id === id) ?? null;
}

export async function createEvent(data: Omit<AppEvent, "id" | "createdAt">): Promise<AppEvent> {
  const event: AppEvent = { id: genId(), ...data, createdAt: new Date().toISOString() };
  await modifyArr<AppEvent>("data/events.json", (arr) => [...arr, event]);
  return event;
}

export async function updateEvent(id: number, patch: Partial<AppEvent>): Promise<AppEvent | null> {
  let found: AppEvent | null = null;
  await modifyArr<AppEvent>("data/events.json", (arr) =>
    arr.map((e) => {
      if (e.id === id) { found = { ...e, ...patch }; return found; }
      return e;
    })
  );
  return found;
}

export async function deleteEvent(id: number): Promise<void> {
  await modifyArr<AppEvent>("data/events.json", (arr) => arr.filter((e) => e.id !== id));
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function getChatMessages(tripId: number): Promise<ChatMessage[]> {
  return readArr<ChatMessage>(`data/chat_${tripId}.json`);
}

export async function addChatMessage(data: Omit<ChatMessage, "id" | "createdAt">): Promise<ChatMessage> {
  const msg: ChatMessage = { id: genId(), ...data, createdAt: new Date().toISOString() };
  await modifyArr<ChatMessage>(`data/chat_${data.tripId}.json`, (arr) => [...arr, msg]);
  return msg;
}
