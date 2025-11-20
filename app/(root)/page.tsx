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
  getTotalInterviewCount,
} from "@/lib/actions/general.action";
import { CometCard } from "@/components/ui/comet-card";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import ShinyText from '@/components/ShinyText';
 import CountUp from '@/components/CountUp'
 import { Carousel, Card } from "@/components/ui/apple-cards-carousel";
async function Home() {
  const clerkUser = await currentUser();
  const userId = clerkUser?.id;

  // Log the userId for debugging
  // console.log("Dashboard - Logged in user ID:", userId);
  // console.log("Dashboard - Full Clerk user:", {
  //   id: clerkUser?.id,
  //   email: clerkUser?.emailAddresses?.[0]?.emailAddress,
  //   firstName: clerkUser?.firstName,
  //   username: clerkUser?.username,
  // });

  // Fetch user's own interviews and all interviews from other users
  const [userInterviews, allInterviews, totalInterviewCount] = await Promise.all([
    userId ? getInterviewsByUserId(userId) : Promise.resolve(null),
    userId ? getLatestInterviews({ userId, limit: 10 }) : Promise.resolve(null),
    getTotalInterviewCount(),
  ]);

  // Filter out user's interviews from the "Take Interviews" section
  const userInterviewIds = new Set(userInterviews?.map(interview => interview.id) || []);
  const filteredAllInterviews = allInterviews?.filter(interview => !userInterviewIds.has(interview.id)) || null;

  const hasUserInterviews = userInterviews && userInterviews.length > 0;
  const hasAllInterviews = filteredAllInterviews && filteredAllInterviews.length > 0;
const words = `Master interview performance with AI-driven practice sessions`;

  return (
    <>
    <WavyBackground 
      className="mx-auto my-auto"
      containerClassName="h-auto"
      speed="slow"
      waveWidth={50}
       colors={["#E9E3DF", "#ed5b23","#434bb6","#E43636","#739EC9"]}
       blur={10}
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
      <section className="card-cta relative z-10 text-white py-4">

        <div className="flex flex-col gap-6 max-w-lg ">    
          <TextGenerateEffect words={words} duration={1}/>
          <p className="text-lg text-white ">
            Simulate real interview questions, receive immediate data-backed feedback, and improve reliably
          </p>

          <Button asChild className="btn-primary-generate max-sm:w-full">
            <Link href="/interview">Generate Interview</Link>
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
     
      {/* Stats Section */}
      {/* <div className="flex items-center justify-center mt-4 relative z-10">
        <div className="card-cta backdrop-blur-sm border border-orange/30 px-4 py-3 rounded-2xl">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full">
              <span className="text-4xl">🎯</span>
            </div>
            <div>
              <p className="text-4xl font-bold text-orange">
               
                <CountUp
                  from={0}
                  to={totalInterviewCount}
                  separator=","
                  direction="up"
                  duration={1}
                  className="count-up-text"
                />
                
              </p>
              <p className="text-light-100 text-sm">
                interviews created by our community so far
              </p>
            </div>
          </div>
        </div>
      </div> */}

      <section className="flex flex-col gap-6 mt-8 relative z-10">
        <h2>Your Interviews</h2>

        <div className="interviews-section">
          
          {hasUserInterviews ? (
            userInterviews?.map((interview) => (
              <CometCard key={interview.id} rotateDepth={5} translateDepth={5} className="interview-card-wrapper" >
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
            filteredAllInterviews?.map((interview) => (
              <CometCard key={interview.id} rotateDepth={5} translateDepth={5} className="w-[360px] interview-card-wrapper ">
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

      {/* Footer */}
      <footer className="absolute z-10 mt-16 py-6 border-t border-white/10 w-full">
        <div className="flex items-center justify-center">
          <p className="text-light-100 text-base">
            Made with <span className="text-red-500 animate-pulse">❤️</span> by{" "}
            <span className="font-semibold text-orange">Ayush Prakash</span>
          </p>
        </div>
      </footer>
      </WavyBackground>
    </>
  );
}

export default Home;
