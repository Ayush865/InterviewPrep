import Agent from "@/components/Agent";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const Page = async () => {
  const clerkUser = await currentUser();

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
