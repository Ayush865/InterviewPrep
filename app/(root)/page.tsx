import Link from "next/link";
import Image from "next/image";
import { currentUser } from "@clerk/nextjs/server";
import {
  AudioLines,
  FileText,
  BarChart3,
  Building2,
  ArrowRight,
  Plus,
} from "lucide-react";

// Force dynamic rendering to always fetch fresh data
export const dynamic = "force-dynamic";

import InterviewCard from "@/components/InterviewCard";
import Reveal from "@/components/motion/Reveal";
import Pagination from "@/components/Pagination";
import GenerateInterviewButton from "@/components/GenerateInterviewButton";
import ResumeUploadSection from "@/components/resume/ResumeUploadSection";
import CountUp from "@/components/CountUp";
import {
  getUserInterviewsPage,
  getDiscoverInterviewsPage,
  getFeedbackSummaries,
  getTotalInterviewCount,
} from "@/lib/actions/general.action";
import { getUserEntitlements } from "@/lib/actions/premium.action";
import { getResumeByUserId } from "@/lib/actions/resume.action";

const PAGE_SIZE = 6;

const features = [
  {
    icon: AudioLines,
    title: "Voice-first interviews",
    description:
      "Talk to a realistic AI interviewer in real time — no scripts, no multiple choice. Just you and the conversation.",
  },
  {
    icon: FileText,
    title: "Tailored to your resume",
    description:
      "Upload your resume once and every session adapts to your actual experience, role, and tech stack.",
  },
  {
    icon: Building2,
    title: "Company-specific prep",
    description:
      "Target a company and practice with questions shaped by its interview style and expectations.",
  },
  {
    icon: BarChart3,
    title: "Data-backed feedback",
    description:
      "Get scored across communication, technical depth, and problem solving — with concrete areas to improve.",
  },
];

const steps = [
  {
    step: "01",
    title: "Describe the interview",
    description:
      "Fill out a short form or simply talk to our AI hiring manager about the role you're targeting.",
  },
  {
    step: "02",
    title: "Take the interview",
    description:
      "Answer questions out loud in a realistic voice conversation, just like the real thing.",
  },
  {
    step: "03",
    title: "Improve with feedback",
    description:
      "Review your scores and a detailed assessment, then iterate until you're confident.",
  },
];

function parsePage(value: string | undefined): number {
  const parsed = parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

async function LandingPage() {
  const totalInterviewCount = await getTotalInterviewCount();

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="hero-glow -mx-6 px-6">
        <Reveal className="mx-auto flex max-w-3xl flex-col items-center pb-24 pt-28 text-center max-sm:pb-16 max-sm:pt-20">
          <span className="eyebrow">AI-powered interview practice</span>
          <h1 className="display mt-5 text-5xl leading-[1.08] sm:text-6xl">
            Interview like it&apos;s the real thing.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-soft">
            Practice live voice interviews with an AI interviewer, get instant
            data-backed feedback, and walk into your next interview prepared.
          </p>
          <div className="mt-9 flex items-center gap-3 max-sm:flex-col max-sm:w-full">
            <Link href="/sign-up" className="btn-cta max-sm:w-full">
              Start practicing free
            </Link>
            <Link href="/sign-in" className="btn-quiet max-sm:w-full">
              Sign in
            </Link>
          </div>
          {totalInterviewCount > 0 && (
            <p className="mt-10 text-sm text-faint">
              <span className="font-semibold text-strong">
                <CountUp
                  from={0}
                  to={totalInterviewCount}
                  separator=","
                  direction="up"
                  duration={1}
                  className="count-up-text"
                />
              </span>{" "}
              interviews created by the community
            </p>
          )}
        </Reveal>
      </section>

      {/* Features */}
      <section className="py-20 max-sm:py-14" aria-labelledby="features-heading">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 id="features-heading" className="display text-3xl sm:text-4xl">
            Everything you need to prepare.
          </h2>
          <p className="mt-4 text-soft">
            One focused tool for realistic practice — not another question bank.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, description }, index) => (
            <Reveal key={title} delay={index * 0.07} className="panel p-7">
              <div className="flex size-11 items-center justify-center rounded-xl border border-hairline bg-raise">
                <Icon className="size-5 text-accent" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-strong">
                {title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-soft">
                {description}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 max-sm:py-14" aria-labelledby="steps-heading">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 id="steps-heading" className="display text-3xl sm:text-4xl">
            Three steps to your best interview.
          </h2>
        </Reveal>

        <ol className="mt-12 grid list-none grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map(({ step, title, description }, index) => (
            <li key={step}>
              <Reveal delay={index * 0.09} className="panel h-full p-7">
                <span className="text-sm font-semibold tracking-widest text-accent">
                  {step}
                </span>
                <h3 className="mt-4 text-lg font-semibold tracking-tight text-strong">
                  {title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-soft">
                  {description}
                </p>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      {/* Final CTA */}
      <section className="pb-24 pt-8 max-sm:pb-16">
        <Reveal className="panel flex flex-col items-center gap-6 overflow-hidden px-8 py-14 text-center">
          <Image
            src="/fox_on_computer.png"
            alt="Hired Fox mascot practicing at a computer"
            width={160}
            height={137}
            className="h-auto w-36"
          />
          <h2 className="display text-3xl sm:text-4xl">
            Your next offer starts with practice.
          </h2>
          <p className="max-w-md text-soft">
            Create your first mock interview in under a minute. Free to start.
          </p>
          <Link href="/sign-up" className="btn-accent">
            Get started
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Reveal>
      </section>
    </div>
  );
}

async function Dashboard({
  userId,
  firstName,
  myPage,
  discoverPage,
}: {
  userId: string;
  firstName: string | null;
  myPage: number;
  discoverPage: number;
}) {
  // One round of parallel queries for everything the dashboard needs
  const [myInterviewsResult, discoverResult, entitlements, resume] =
    await Promise.all([
      getUserInterviewsPage(userId, myPage, PAGE_SIZE),
      getDiscoverInterviewsPage(userId, discoverPage, PAGE_SIZE),
      getUserEntitlements(userId),
      getResumeByUserId(userId),
    ]);

  const { interviews: myInterviews, total: myTotal } = myInterviewsResult;
  const { interviews: discoverInterviews, total: discoverTotal } =
    discoverResult;

  // Batch feedback lookup for all visible cards (one query, not one per card)
  const visibleIds = [
    ...myInterviews.map((interview) => interview.id),
    ...discoverInterviews.map((interview) => interview.id),
  ];
  const feedbackById = await getFeedbackSummaries(userId, visibleIds);

  const myTotalPages = Math.ceil(myTotal / PAGE_SIZE);
  const discoverTotalPages = Math.ceil(discoverTotal / PAGE_SIZE);

  const cardProps = {
    canPractice: entitlements.canPractice,
    plan: entitlements.plan,
  };

  return (
    <div className="flex flex-col gap-16 pb-24 pt-12 max-sm:gap-12 max-sm:pt-8">
      {/* Dashboard header */}
      <section className="flex items-end justify-between gap-6 max-sm:flex-col max-sm:items-start">
        <div>
          <h1 className="display text-3xl sm:text-4xl">
            {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
          </h1>
          <p className="mt-2 text-soft">
            Pick up where you left off, or start a new practice session.
          </p>
        </div>
        <GenerateInterviewButton
          canGenerate={entitlements.canGenerateForm}
          plan={entitlements.plan}
        />
      </section>

      {/* Resume */}
      <section aria-labelledby="resume-heading">
        <h2 id="resume-heading" className="display text-xl">
          Your resume
        </h2>
        <p className="mt-1 text-sm text-faint">
          Used to tailor interview questions to your background.
        </p>
        <div className="mt-4 max-w-md">
          <ResumeUploadSection userId={userId} initialResume={resume} />
        </div>
      </section>

      {/* Your interviews */}
      <section id="your-interviews" aria-labelledby="my-interviews-heading">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="my-interviews-heading" className="display text-xl">
              Your interviews
            </h2>
            <p className="mt-1 text-sm text-faint">
              Interviews you created or completed.
            </p>
          </div>
          {myTotal > 0 && (
            <span className="text-sm text-faint">{myTotal} total</span>
          )}
        </div>

        {myInterviews.length > 0 ? (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myInterviews.map((interview) => (
                <InterviewCard
                  key={interview.id}
                  interviewId={interview.id}
                  role={interview.role}
                  type={interview.type}
                  techstack={interview.techstack}
                  createdAt={interview.createdAt}
                  coverImage={interview.coverImage}
                  isTaken={interview.isTaken}
                  feedback={feedbackById[interview.id] ?? null}
                  {...cardProps}
                />
              ))}
            </div>
            {myTotalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  page={myPage}
                  totalPages={myTotalPages}
                  hrefForPage={(p) =>
                    `/?my=${p}&discover=${discoverPage}#your-interviews`
                  }
                />
              </div>
            )}
          </>
        ) : (
          <div className="panel mt-6 flex flex-col items-center gap-4 px-8 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full border border-hairline bg-raise">
              <Plus className="size-5 text-soft" aria-hidden="true" />
            </div>
            <div>
              <p className="font-medium text-strong">No interviews yet</p>
              <p className="mt-1 text-sm text-faint">
                Generate your first interview to start practicing.
              </p>
            </div>
            <Link href="/interview" className="btn-quiet !h-10 text-sm">
              Create an interview
            </Link>
          </div>
        )}
      </section>

      {/* Discover */}
      <section id="discover" aria-labelledby="discover-heading">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="discover-heading" className="display text-xl">
              Discover interviews
            </h2>
            <p className="mt-1 text-sm text-faint">
              Interviews created by the community, ready to take.
            </p>
          </div>
          {discoverTotal > 0 && (
            <span className="text-sm text-faint">
              {discoverTotal} available
            </span>
          )}
        </div>

        {discoverInterviews.length > 0 ? (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {discoverInterviews.map((interview) => (
                <InterviewCard
                  key={interview.id}
                  interviewId={interview.id}
                  role={interview.role}
                  type={interview.type}
                  techstack={interview.techstack}
                  createdAt={interview.createdAt}
                  coverImage={interview.coverImage}
                  feedback={feedbackById[interview.id] ?? null}
                  {...cardProps}
                />
              ))}
            </div>
            {discoverTotalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  page={discoverPage}
                  totalPages={discoverTotalPages}
                  hrefForPage={(p) => `/?my=${myPage}&discover=${p}#discover`}
                />
              </div>
            )}
          </>
        ) : (
          <div className="panel mt-6 px-8 py-12 text-center">
            <p className="text-sm text-faint">
              No new community interviews right now. Check back soon.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

async function Home({
  searchParams,
}: {
  searchParams: Promise<{ my?: string; discover?: string }>;
}) {
  const [clerkUser, params] = await Promise.all([currentUser(), searchParams]);

  if (!clerkUser?.id) {
    return <LandingPage />;
  }

  return (
    <Dashboard
      userId={clerkUser.id}
      firstName={clerkUser.firstName}
      myPage={parsePage(params.my)}
      discoverPage={parsePage(params.discover)}
    />
  );
}

export default Home;
