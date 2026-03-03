import { Suspense } from "react";
import HomeClient from "./HomeClient";

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-950 text-white">Loading...</div>}>
      <HomeClient />
    </Suspense>
  );
}
