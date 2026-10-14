import { MetaV1PromisePanel } from "@/components/meta-v1-promise-panel";

export function V1PromiseSection() {
  return (
    <section className="bg-navy px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <MetaV1PromisePanel variant="marketing" />
      </div>
    </section>
  );
}
