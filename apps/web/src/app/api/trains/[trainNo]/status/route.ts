import { NextRequest } from "next/server";
import { proxyTrainGet } from "../../_proxy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ trainNo: string }> }
) {
  const { trainNo } = await params;
  return proxyTrainGet(req, `/api/v1/trains/${encodeURIComponent(trainNo)}/status`);
}
