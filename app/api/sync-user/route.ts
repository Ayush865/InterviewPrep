import { currentUser } from '@clerk/nextjs/server';
import { createUser, getUserById } from '@/lib/db-queries';
import { NextResponse } from 'next/server';

/**
 * Manual user sync endpoint
 * Call this endpoint after logging in to manually sync your Clerk user to MySQL
 */
export async function POST() {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if user already exists
    const existingUser = await getUserById(user.id);

    if (existingUser) {
      return NextResponse.json({
        message: 'User already exists in database',
        user: existingUser,
      });
    }

    // Get primary email
    const primaryEmail = user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId
    );

    if (!primaryEmail) {
      return NextResponse.json({ error: 'No primary email found' }, { status: 400 });
    }

    // Create user
    const name =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.lastName || user.username || 'User';

    const newUser = await createUser({
      id: user.id,
      email: primaryEmail.emailAddress,
      name: name,
    });

    return NextResponse.json({
      message: 'User synced successfully',
      user: newUser,
    });
  } catch (error: any) {
    console.error('Error syncing user:', error);
    return NextResponse.json(
      { error: 'Failed to sync user', details: error.message },
      { status: 500 }
    );
  }
}
