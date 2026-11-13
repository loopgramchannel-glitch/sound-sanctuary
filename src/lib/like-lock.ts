/** Only signed-in viewers may like or dislike (like YouTube). */
export const canVote = (ready: boolean, user: unknown) => ready && !!user;
