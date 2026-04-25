// analytics.js

function createAnalytics() {
  const store = {};

  function ensure(userId) {
    if (!store[userId]) {
      store[userId] = {
        joins: 0,
        messages: 0,
        presenceReplies: 0,
        rooms: {},
        lastActive: Date.now(),
        createdAt: Date.now(),
        disconnectedAt: null
      };
    }
    return store[userId];
  }

  return {
    trackJoin(userId, roomId) {
      const u = ensure(userId);
      u.joins += 1;
      u.rooms[roomId] = (u.rooms[roomId] || 0) + 1;
      u.lastActive = Date.now();
    },

    trackMessage(userId) {
      const u = ensure(userId);
      u.messages += 1;
      u.lastActive = Date.now();
    },

    trackPresenceReply(userId) {
      const u = ensure(userId);
      u.presenceReplies += 1;
      u.lastActive = Date.now();
    },

    trackDisconnect(userId) {
      const u = ensure(userId);
      u.disconnectedAt = Date.now();
      u.lastActive = Date.now();
    },

    getStats() {
      return {
        totalUsers: Object.keys(store).length,
        users: store
      };
    }
  };
}

module.exports = createAnalytics;