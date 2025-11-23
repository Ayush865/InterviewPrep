"use client";

/**
 * NOTE: This component previously used Firebase Auth.
 *
 * After migrating to MySQL and using Clerk for authentication,
 * you should use Clerk's built-in components instead:
 *
 * For Sign In page: <SignIn />
 * For Sign Up page: <SignUp />
 *
 * Import from: '@clerk/nextjs'
 *
 * Example:
 * import { SignIn } from '@clerk/nextjs'
 *
 * export default function SignInPage() {
 *   return <SignIn />
 * }
 *
 * See Clerk documentation: https://clerk.com/docs/components/authentication/sign-in
 *
 * This file can be deleted once you've migrated to Clerk's components.
 */

import Link from "next/link";
import Image from "next/image";

const AuthForm = ({ type }: { type: FormType }) => {
  return (
    <div className="card-border lg:min-w-[566px]">
      <div className="flex flex-col gap-6 card py-14 px-10">
        <div className="flex flex-row gap-2 justify-center">
          <Image src="/logo.svg" alt="logo" height={32} width={38} />
          <h2 className="text-primary-100">PrepWise</h2>
        </div>

        <h3>Practice job interviews with AI</h3>

        <div className="w-full space-y-6 mt-4">
          <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Migration Notice:</strong> This auth form has been replaced with Clerk authentication.
              Please use Clerk's built-in components for sign-in and sign-up.
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
              See the Clerk documentation for implementation details.
            </p>
          </div>

          <Link
            href="https://clerk.com/docs"
            target="_blank"
            className="block text-center btn"
          >
            View Clerk Documentation
          </Link>
        </div>

        <p className="text-center">
          {type === "sign-in" ? "No account yet?" : "Have an account already?"}
          <Link
            href={type !== "sign-in" ? "/sign-in" : "/sign-up"}
            className="font-bold text-user-primary ml-1"
          >
            {type !== "sign-in" ? "Sign In" : "Sign Up"}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AuthForm;
