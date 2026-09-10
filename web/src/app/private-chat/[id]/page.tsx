import type { Metadata } from "next";
import PrivateChatClient from "./private-chat-client";

export const metadata: Metadata = { title: "Private Chat — KasoLife" };

export default function PrivateChatPage() {
  return <PrivateChatClient />;
}
