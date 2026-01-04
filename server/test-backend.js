const io = require('socket.io-client');
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';
const SOCKET_URL = 'http://localhost:3001';

async function testFlow() {
    console.log('--- Starting System Test ---');

    // 1. Create Room
    console.log('\n[1] Creating Room...');
    const createRes = await fetch(`${BASE_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'mypassexample' })
    });
    const createData = await createRes.json();
    const roomCode = createData.roomCode;
    console.log(`> Room Created: ${roomCode}`);

    if (!roomCode) throw new Error('Failed to create room');

    // 2. Connector A (Creator)
    console.log('\n[2] User A Connecting...');
    const socketA = io(SOCKET_URL);

    await new Promise(resolve => {
        socketA.emit('join_room', { roomCode, password: 'mypassexample' });
        socketA.on('joined', (data) => {
            console.log(`> User A Joined as ${data.username}`);
            resolve();
        });
    });

    // 3. Connector B (Joiner)
    console.log('\n[3] User B Connecting...');
    const socketB = io(SOCKET_URL);
    await new Promise(resolve => {
        socketB.emit('join_room', { roomCode, password: 'mypassexample' });
        socketB.on('joined', (data) => {
            console.log(`> User B Joined as ${data.username}`);
            resolve();
        });
    });

    // 4. Messaging
    console.log('\n[4] Testing Messaging...');

    // A sends to Room
    socketA.emit('send_message', { roomCode, text: 'Hello from A' });

    // B should receive
    const msgReceived = await new Promise(resolve => {
        socketB.on('receive_message', (msg) => {
            console.log(`> User B received: "${msg.text}" from ${msg.sender}`);
            if (msg.text === 'Hello from A') resolve(true);
        });
    });

    if (msgReceived) console.log('> Messaging Verified Success');

    //Cleanup
    socketA.disconnect();
    socketB.disconnect();
    console.log('\n--- Test Passed ---');
    process.exit(0);
}

testFlow().catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
});
