import { Suspense } from "react";
import { SearchApp } from "@/components/search-app";

export const metadata = { title: "Hanap · HanapMeme" };

export default function SearchPage() {
  return (
    <Suspense>
      <SearchApp />
    </Suspense>
  );
}
