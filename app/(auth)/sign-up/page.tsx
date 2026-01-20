import { SignUp } from "@clerk/nextjs";

const Page = () => {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignUp 
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
