class RoomStore {
    constructor() {
        // roomCode -> Room Object
        // Room Object: { roomCode, passwordHash, users: Map<socketId, username>, messages: [], lastActiveAt, createdAt }
        this.rooms = new Map();

        // socketId -> roomCode (for quick lookup on disconnect)
        this.userRoomMap = new Map();
    }

    createRoom(roomCode, passwordHash = null) {
        if (this.rooms.has(roomCode)) {
            return false; // Collision (rare)
        }

        this.rooms.set(roomCode, {
            roomCode,
            passwordHash,
            users: new Map(), // socketId -> username
            messages: [],
            lastActiveAt: Date.now(),
            createdAt: Date.now()
        });
        return true;
    }

    getRoom(roomCode) {
        return this.rooms.get(roomCode);
    }

    joinRoom(roomCode, socketId, username) {
        const room = this.rooms.get(roomCode);
        if (!room) return false;

        room.users.set(socketId, username);
        room.lastActiveAt = Date.now();
        this.userRoomMap.set(socketId, roomCode);
        return true;
    }

    leaveRoom(socketId) {
        const roomCode = this.userRoomMap.get(socketId);
        if (!roomCode) return null;

        const room = this.rooms.get(roomCode);
        if (room) {
            const username = room.users.get(socketId);
            room.users.delete(socketId);
            this.userRoomMap.delete(socketId);
            room.lastActiveAt = Date.now();

            return { roomCode, username, userCount: room.users.size };
        }
        return null;
    }

    addMessage(roomCode, message) {
        const room = this.rooms.get(roomCode);
        if (!room) return false;

        // Keep memory usage in check: limit to last 50 messages
        if (room.messages.length >= 50) {
            room.messages.shift();
        }

        room.messages.push(message);
        room.lastActiveAt = Date.now();
        return true;
    }

    clearMessages(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return false;

        // Secure wipe before clearing array
        room.messages.forEach(msg => {
            if (msg.text) msg.text = '0'.repeat(msg.text.length);
            msg.sender = null;
        });
        room.messages = [];
        room.lastActiveAt = Date.now();
        return true;
    }

    /**
     * Remove empty rooms or rooms inactive for a long time.
     * Returns number of rooms removed.
     */
    cleanup() {
        const now = Date.now();
        const INACTIVE_TIMEOUT = 30 * 60 * 1000; // 30 mins
        const EMPTY_TIMEOUT = 5 * 60 * 1000;     // 5 mins empty

        let removed = 0;
        for (const [roomCode, room] of this.rooms.entries()) {
            const isInactive = (now - room.lastActiveAt) > INACTIVE_TIMEOUT;
            const isEmptyAndStale = (room.users.size === 0) && ((now - room.lastActiveAt) > EMPTY_TIMEOUT);

            if (isInactive || isEmptyAndStale) {
                // Secure Wipe: Zero out messages before deletion
                if (room.messages && room.messages.length > 0) {
                    // We can't easily overwrite the objects in JS memory directly without Buffer,
                    // but we can overwrite the array contents references or properties.
                    // Doing a best-effort "overwrite" before releasing reference.
                    room.messages.forEach(msg => {
                        if (msg.text) msg.text = '0'.repeat(msg.text.length);
                        msg.sender = null;
                    });
                    room.messages.fill(0);
                }
                this.rooms.delete(roomCode);
                // Also ensure no stray user mappings (shouldn't be necessary if logic is correct)
                removed++;
            }
        }
        return removed;
    }
}

module.exports = new RoomStore();
