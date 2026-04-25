getStats() {

  let totalJoins = 0;
  let totalMessages = 0;
  let totalPresence = 0;

  for (const userId in store) {
    const u = store[userId];

    totalJoins += u.joins || 0;
    totalMessages += u.messages || 0;
    totalPresence += u.presenceReplies || 0;
  }

  return {
    totalUsers: Object.keys(store).length,
    totals: {
      joins: totalJoins,
      messages: totalMessages,
      presenceReplies: totalPresence
    },
    users: store
  };
}