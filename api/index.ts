import app from "../artifacts/api-server/src/app";

const handler = async (req: any, res: any) => {
  return (app as any)(req, res);
};

export default handler;
