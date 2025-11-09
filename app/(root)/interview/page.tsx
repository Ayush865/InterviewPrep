import Agent from "@/components/Agent";
import { currentUser } from "@clerk/nextjs/server";

const Page = async () => {
  const clerkUser = await currentUser();

  return (
    <>
      <h3>Interview generation</h3>

      <Agent
        userName={clerkUser?.firstName || clerkUser?.username || "User"}
        userId={clerkUser?.id}
        type="generate"
      />
    </>
  );
};

export default Page;
