const crypto = require('crypto');

function generateRoomCode(length = 6) {
    // Generate random bytes and convert to hex
    return crypto.randomBytes(4).toString('hex').slice(0, length).toUpperCase();
}

function generateUsername() {
    const adjectives = ['Silent', 'Fast', 'Clever', 'Brave', 'Happy', 'Cool', 'Lazy', 'Wise', 'Neon', 'Cyber'];
    const nouns = ['Fox', 'Eagle', 'Bear', 'Tiger', 'Wolf', 'Owl', 'Cat', 'Dog', 'Ninja', 'Ghost'];

    const adj = adjectives[crypto.randomInt(adjectives.length)];
    const noun = nouns[crypto.randomInt(nouns.length)];
    const num = crypto.randomInt(1000000); // 0 to 999999

    return `${adj}${noun}${num}`;
}

module.exports = { generateRoomCode, generateUsername };
