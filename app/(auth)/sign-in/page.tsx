import { SignIn } from "@clerk/nextjs";

const Page = () => {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignIn 
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-dark-200 border border-light-800",
          },
        }}
      />
    </div>
  );
};

export default Page;
