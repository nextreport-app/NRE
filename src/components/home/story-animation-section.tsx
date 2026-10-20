"use client";

import Link from "next/link";
import { NextReportStoryAnimation } from "@/components/home/nextreport-story-animation";

/** Homepage — quick animated “what we do” loop (no video file). */
export function StoryAnimationSection() {
  return (
    <section className="border-y border-navy-border bg-[#0f2239]/40 px-6 py-16 sm:py-20">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-14">
        <div className="max-w-lg text-center lg:text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-orange">60-second story</p>
          <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">From CSV chaos to client-ready deck</h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-secondary sm:text-base">
            NextReport turns your Meta Ads Reporting export into branded slides with the right KPIs — upload once, walk
            through the wizard, share. This loop is the whole product in four beats (auto-plays; pause anytime).
          </p>
          <p className="mt-6 text-sm">
            <Link href="/how-it-works" className="font-medium text-accent-orange hover:underline">
              Full walkthrough & video →
            </Link>
          </p>
        </div>
        <NextReportStoryAnimation className="lg:shrink-0" />
      </div>
    </section>
  );
}
