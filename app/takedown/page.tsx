import { Suspense } from "react";
import { TakedownForm } from "@/components/takedown-form";

export default function Takedown() {
  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-20 sm:px-12">
      <h1 className="display text-[clamp(56px,12vw,170px)] uppercase text-hot">Take<span className="outline-text">down</span></h1>
      <p className="mt-6 max-w-xl text-lg font-medium">
        The image is hidden right away, everywhere: the website, the API, and MCP. No questions asked.
      </p>
      <Suspense>
        <TakedownForm />
      </Suspense>
    </div>
  );
}
