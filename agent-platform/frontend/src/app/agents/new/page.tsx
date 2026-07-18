"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { CreateAgentStudio } from "@/components/create/CreateAgentStudio";

export default function NewAgentPage() {
  const router = useRouter();
  return (
    <main className="app-backdrop min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 text-sm text-content-muted hover:text-content">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Logo />
          <span className="ml-2 hidden text-sm text-content-subtle sm:block">/ Hire a worker</span>
        </div>
      </header>
      <div className="px-4 py-8">
        <div className="mx-auto mb-8 max-w-5xl">
          <p className="eyebrow">New worker</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-content sm:text-3xl">
            Bring a worker to life
          </h1>
          <p className="mt-1 text-sm text-content-muted">
            Give them a face, a role and a starting set of tools. They&apos;ll get better with every job.
          </p>
        </div>
        <CreateAgentStudio onCreated={(agent) => router.push(`/agents/${agent.id}`)} />
      </div>
    </main>
  );
}
