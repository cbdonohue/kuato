import { redirect } from "next/navigation";

export default function DebugPage() {
  redirect("/?tab=mock");
}
