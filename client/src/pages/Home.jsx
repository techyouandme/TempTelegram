import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ENDPOINT = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

function Home() {
    const [activeTab, setActiveTab] = useState('create'); // 'create' or 'join'
    const [roomCode, setRoomCode] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Helper to hash password
    const hashPassword = async (pwd) => {
        if (!pwd) return null;
        const msgBuffer = new TextEncoder().encode(pwd);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const pwdHash = await hashPassword(password);
            const res = await fetch(`${ENDPOINT}/api/rooms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pwdHash })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to create room');

            // Navigate (store raw password or hashed? User might need it again? 
            // Actually, if we just hashed it, the server expects the hash. 
            // But if the server compares hash(hash), then we need to match protocols.
            // The server does `bcrypt.hash(password, 10)`. 
            // So if we send a SHA-256 hash, the server stores bcrypt(SHA-256).
            // When joining, we must send SHA-256 again.
            navigate(`/chat/${data.roomCode}`, { state: { password: pwdHash } });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const pwdHash = await hashPassword(password);
            const res = await fetch(`${ENDPOINT}/api/rooms/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomCode, password: pwdHash })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to join room');

            navigate(`/chat/${data.roomCode}`, { state: { password: pwdHash } });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-md bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-700">

                {/* Header */}
                <div className="p-8 text-center bg-gradient-to-br from-indigo-600 to-violet-700">
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Temp Telegram</h1>
                    <p className="text-indigo-100 opacity-90 text-sm">Anonymous, encrypted, ephemeral chat.</p>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-700">
                    <button
                        onClick={() => { setActiveTab('create'); setError(''); }}
                        className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'create' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800' : 'text-slate-400 hover:text-slate-200 bg-slate-800/50'}`}
                    >
                        Create Room
                    </button>
                    <button
                        onClick={() => { setActiveTab('join'); setError(''); }}
                        className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'join' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800' : 'text-slate-400 hover:text-slate-200 bg-slate-800/50'}`}
                    >
                        Join Room
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-900/50 border border-red-800 text-red-200 rounded-lg text-sm text-center">
                            {error}
                        </div>
                    )}

                    {activeTab === 'create' ? (
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Optional Password</label>
                                <input
                                    type="password"
                                    placeholder="Leave empty for public"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-200 placeholder-slate-600 transition-all"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-lg shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Creating...' : '🚀 Create Instant Room'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleJoin} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Room Code</label>
                                <input
                                    type="text"
                                    placeholder="e.g. A1B2C3"
                                    value={roomCode}
                                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-200 placeholder-slate-600 transition-all uppercase tracking-widest font-mono"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Password</label>
                                <input
                                    type="password"
                                    placeholder="If required"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-200 placeholder-slate-600 transition-all"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white font-semibold rounded-lg shadow-lg shadow-violet-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Joining...' : 'Enter Room →'}
                            </button>
                        </form>
                    )}
                </div>

                <div className="p-4 border-t border-slate-700 bg-slate-800/50 text-center">
                    <p className="text-xs text-slate-500">Messages are stored in RAM and wiped on server restart.</p>
                </div>
            </div>
        </div>
    );
}

export default Home;
