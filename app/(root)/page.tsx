import Link from "next/link";
import Image from "next/image";
import { currentUser } from "@clerk/nextjs/server";

import { Button } from "@/components/ui/button";
import InterviewCard from "@/components/InterviewCard";
import { SparklesCore } from "@/components/ui/sparkles";
import {WavyBackground} from "@/components/ui/wavy-background";
import {
  getInterviewsByUserId,
  getLatestInterviews,
} from "@/lib/actions/general.action";
import { CometCard } from "@/components/ui/comet-card";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
async function Home() {
  const clerkUser = await currentUser();
  const userId = clerkUser?.id;

  // Fetch user's own interviews and all interviews from other users
  const [userInterviews, allInterviews] = await Promise.all([
    userId ? getInterviewsByUserId(userId) : Promise.resolve(null),
    userId ? getLatestInterviews({ userId }) : Promise.resolve(null),
  ]);

  const hasUserInterviews = userInterviews && userInterviews.length > 0;
  const hasAllInterviews = allInterviews && allInterviews.length > 0;
const words = `Master interview performance with AI-driven practice sessions`;
  return (
    <>
    <WavyBackground 
      className="mx-auto my-auto"
      containerClassName="h-full"
      speed="fast"
      waveWidth={40}
       colors={["#E9E3DF", "#ed5b23","#465C88","#E43636","#739EC9"]}
    >
      {/* <WavyBackground 
      className="mx-auto my-auto"
      containerClassName="h-full"
      // colors={["#dddfff", "#6156d3ff", "#189d9bff", "#26b46bff", "#15192fff"]}
      waveWidth={1}
      backgroundFill="transparent"
      blur={10}
      speed="slow"
      waveOpacity={0.3}
    > */}
      <section className="card-cta relative z-10 text-black">

        <div className="flex flex-col gap-6 max-w-lg ">    
          <TextGenerateEffect words={words} duration={1}/>
          <p className="text-lg text-black ">
            Simulate real interview questions, receive immediate data-backed feedback, and improve reliably
          </p>

          <Button asChild className="btn-primary max-sm:w-full">
            <Link href="/interview">Create Interview</Link>
          </Button>
        </div>

        <Image
          src="/fox_on_computer.png"
          alt="robo-dude"
          width={350}
          height={300}
          className="max-sm:hidden"
        />
        
      </section>
      </WavyBackground>
      <div className="w-full absolute inset-0 h-screen z-0">
        <SparklesCore
          id="tsparticlesfullpage"
          background="transparent"
          minSize={0.6}
          maxSize={1.4}
          particleDensity={10}
          className="w-full h-full"
          particleColor="#FFFFFF"
          speed={5}
        />
      </div>
     

      <section className="flex flex-col gap-6 mt-8 relative z-10">
        <h2>Your Interviews</h2>

        <div className="interviews-section">
          
          {hasUserInterviews ? (
            userInterviews?.map((interview) => (
              <CometCard key={interview.id} rotateDepth={5} translateDepth={5}>
              <InterviewCard
                key={interview.id}
                userId={userId}
                interviewId={interview.id}
                role={interview.role}
                type={interview.type}
                techstack={interview.techstack}
                createdAt={interview.createdAt}
              />
              </CometCard>
            ))
          ) : (
            <p>You haven&apos;t taken any interviews yet</p>
          )}
          
        </div>
      </section>

      <section className="flex flex-col gap-6 mt-8 relative z-10">
        <h2>Take Interviews</h2>

        <div className="interviews-section">
          {hasAllInterviews ? (
            allInterviews?.map((interview) => (
              <CometCard key={interview.id} rotateDepth={5} translateDepth={5}>
              <InterviewCard
                key={interview.id}
                userId={userId}
                interviewId={interview.id}
                role={interview.role}
                type={interview.type}
                techstack={interview.techstack}
                createdAt={interview.createdAt}
              />
              </CometCard>
            ))
          ) : (
            <p>There are no interviews available</p>
          )}
        </div>
      </section>
    </>
  );
}

export default Home;
