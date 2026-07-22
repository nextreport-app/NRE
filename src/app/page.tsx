import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <p className="mb-3 text-sm font-medium tracking-wide text-indigo-400">
        NEXTREPORT ENGINE — NRE v1
      </p>
      <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
        The next report you send will be fast, smooth, and done before you
        know it.
      </h1>
      <p className="mt-5 max-w-xl text-base text-slate-400">
        Upload your Meta Ads CSV. NextReport auto-detects every column,
        recognises the real campaign objective from the data, and generates a
        fully branded PowerPoint report in minutes.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/signup"
          className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-slate-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-900"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
