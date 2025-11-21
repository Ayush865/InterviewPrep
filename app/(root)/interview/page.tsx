import Agent from "@/components/Agent";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getUserPremiumStatus } from "@/lib/actions/premium.action";
import { getInterviewsByUserId } from "@/lib/actions/general.action";

const Page = async () => {
  const clerkUser = await currentUser();

  // Check premium limits for interview generation
  if (clerkUser?.id) {
    const [isPremium, userInterviews] = await Promise.all([
      getUserPremiumStatus(clerkUser.id),
      getInterviewsByUserId(clerkUser.id),
    ]);

    const interviewCount = userInterviews?.length || 0;
    const limitReached = !isPremium && interviewCount >= 1;

    if (limitReached) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <h2 className="text-2xl font-bold text-white">Free Plan Limit Reached</h2>
          <p className="text-gray-400 text-center max-w-md">
            You have already generated 1 interview. Upgrade to Premium to generate unlimited interviews.
          </p>
          <div className="flex gap-4">
            <Link href="/" className="px-4 py-2 bg-dark-300 rounded-lg text-white hover:bg-dark-400 transition-colors">
              Go Home
            </Link>
            <button className="px-4 py-2 bg-slate-purple rounded-lg text-white hover:bg-cream hover:text-black transition-colors">
              Upgrade to Premium
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <>
      <div className="flex items-center gap-4 mb-1 ml-1 text-lg justify-center">
        {/* <Button asChild className="btn-secondary">
          <Link href="/">←</Link>
        </Button> */}
        <h3>Interview generation</h3>
      </div>

      <Agent
        userName={clerkUser?.firstName || clerkUser?.username || "User"}
        userId={clerkUser?.id}
        userImage={clerkUser?.imageUrl}
        type="generate"
      />
    </>
  );
};

export default Page;
