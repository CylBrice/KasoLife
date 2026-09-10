import type { Metadata } from "next";
import VipShowClient from "./vip-show-client";

export const metadata: Metadata = { title: "VIP Show — KasoLife" };

export default function VipShowPage() {
  return <VipShowClient />;
}
