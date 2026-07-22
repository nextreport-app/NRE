import { ClientForm } from "@/components/client-form";

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-xl font-semibold text-white">New client</h1>
      <ClientForm />
    </div>
  );
}
