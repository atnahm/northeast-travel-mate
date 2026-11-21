import { NextRequest } from "next/server";
import { proxyTrainGet } from "../_proxy";

export async function GET(req: NextRequest) {
  return proxyTrainGet(req, "/api/v1/trains/stations");
}
