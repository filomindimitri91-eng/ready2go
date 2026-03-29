import { ensureSchema } from "../lib/db/src/migrate";
import app from "../artifacts/api-server/src/app";

let ready = false;

const handler = async (req: any, res: any) => {
  if (!ready) {
    await ensureSchema().catch(() => {});
    ready = true;
  }
  return (app as any)(req, res);
};

export default handler;
