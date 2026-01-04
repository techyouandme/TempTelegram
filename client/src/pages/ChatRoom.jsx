import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import EmojiPicker from 'emoji-picker-react';
import DOMPurify from 'dompurify';
const ENDPOINT = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const MessageContent = ({ text, onLongPressStart, onLongPressEnd }) => {
    const [expanded, setExpanded] = React.useState(false);
    const LIMIT = 500; // Character limit for "Read more"

    const shouldTruncate = text.length > LIMIT;
    const displayText = shouldTruncate && !expanded ? text.slice(0, LIMIT) + '...' : text;

    return (
        <div className="flex flex-col items-start">
            <div
                className="text-sm font-mono leading-relaxed whitespace-pre-wrap break-words w-full"
                onMouseDown={onLongPressStart}
                onMouseUp={onLongPressEnd}
                onTouchStart={onLongPressStart}
                onTouchEnd={onLongPressEnd}
            >
                {displayText}
            </div>
            {shouldTruncate && (
                <button
                    onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                    className="text-[10px] text-sky-400 font-bold mt-1 hover:underline self-end"
                >
                    {expanded ? "Read less" : "Read more"}
                </button>
            )}
        </div>
    );
};

function ChatRoom() {
    const { roomCode } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [socket, setSocket] = useState(null);

    const [messages, setMessages] = useState([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [users, setUsers] = useState([]); // List of user names
    const [myUsername, setMyUsername] = useState('');
    const [info, setInfo] = useState(''); // Connection status or errors

    const password = location.state?.password || null;
    const messagesEndRef = useRef(null);

    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const longPressTimer = useRef(null);

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleLongPressStart = (text) => {
        longPressTimer.current = setTimeout(() => {
            navigator.clipboard.writeText(text);
            setInfo('Message copied!');
            setTimeout(() => setInfo(''), 2000);
        }, 600);
    };

    const handleLongPressEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    // Cancel long press if user drags (intending to select text)
    const handleMove = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const onEmojiClick = (emojiObject) => {
        setCurrentMessage(prev => prev + emojiObject.emoji);
        // maintain focus on input is hard with react state updates, but good enough for now
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        // Initialize Socket
        const newSocket = io(ENDPOINT);
        setSocket(newSocket);

        // Join Room
        newSocket.emit('join_room', { roomCode, password });

        newSocket.on('error', (err) => {
            setInfo(`Error: ${err}`);
            if (err === 'Room does not exist' || err === 'Incorrect password' || err === 'Password required') {
                alert(err);
                navigate('/');
            }
        });

        newSocket.on('joined', (data) => {
            setMessages(data.messages);
            setMyUsername(data.username);
            setUsers(data.users);
        });

        newSocket.on('receive_message', (message) => {
            setMessages((prev) => [...prev, message]);
        });

        newSocket.on('room_users', (userList) => {
            setUsers(userList);
        });

        // System messages for join/leave
        newSocket.on('user_joined', ({ username }) => {
            setMessages(prev => [...prev, { id: Date.now(), text: `${username} joined the chat`, type: 'system' }]);
        });

        newSocket.on('user_left', ({ username }) => {
            setMessages(prev => [...prev, { id: Date.now(), text: `${username} left the chat`, type: 'system' }]);
        });

        newSocket.on('chat_cleared', () => {
            setMessages([]);
            setShowMenu(false);
        });

        return () => {
            newSocket.disconnect();
        };
    }, [roomCode, navigate, password]);

    const handleClearChat = () => {
        if (confirm('Are you sure you want to clear the chat for everyone?')) {
            if (socket) {
                console.log('Emitting clear_chat for room:', roomCode);
                socket.emit('clear_chat', { roomCode });
            } else {
                console.log('Socket not connected');
            }
        }
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (currentMessage.trim() && socket) {
            // Client-side sanitization just in case
            const cleanText = DOMPurify.sanitize(currentMessage.trim());
            socket.emit('send_message', { roomCode, text: cleanText });
            setCurrentMessage('');
            // Reset textarea height manually if needed, or let React state handle value reset
            // Just ensure new input starts small
            const textarea = document.querySelector('textarea');
            if (textarea) textarea.style.height = 'auto';
        }
    };

    const copyRoomCode = () => {
        navigator.clipboard.writeText(roomCode);
        setInfo('Code copied!');
        setTimeout(() => setInfo(''), 2000);
    };

    return (
        <div className="flex flex-col h-screen bg-[#0e1621] text-white font-sans overflow-hidden">

            {/* Header */}
            <div className="flex-none px-4 py-3 bg-[#17212b] border-b border-[#0e1621] flex justify-between items-center shadow-md z-10 relative">
                {/* Left Side: Back & Room Info */}
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                    </button>
                    <div>
                        <div className="flex items-center gap-2 cursor-pointer" onClick={copyRoomCode}>
                            <h1 className="font-bold text-lg tracking-wide">{roomCode}</h1>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100">
                                <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                                <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
                            </svg>
                        </div>
                        <p className="text-xs text-sky-400">{users.length} members online</p>
                    </div>
                </div>

                {/* Right Side: Menu */}
                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-700/50"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                        </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {showMenu && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setShowMenu(false)}
                            />
                            <div className="absolute right-0 top-10 w-48 bg-[#17212b] border border-[#0e1621] rounded-lg shadow-xl z-20 py-1">
                                <button
                                    onClick={handleClearChat}
                                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-[#2b5278]/20 flex items-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                    </svg>
                                    Clear Chat History
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {info && <div className="absolute top-14 left-1/2 -translate-x-1/2 text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full z-10">{info}</div>}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#0e1621] custom-scrollbar">
                {messages.map((msg, idx) => {
                    if (msg.type === 'system') {
                        return (
                            <div key={msg.id || idx} className="flex justify-center my-3">
                                <span className="bg-[#182533] text-xs text-slate-400 px-3 py-1 rounded-full opacity-70">
                                    {msg.text}
                                </span>
                            </div>
                        );
                    }

                    const isMe = msg.sender === myUsername;

                    return (
                        <div key={msg.id || idx} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] px-4 py-2 rounded-2xl relative shadow-sm ${isMe
                                ? 'bg-[#2b5278] text-white rounded-br-none'
                                : 'bg-[#182533] text-white rounded-bl-none'
                                }`}>
                                {/* Sender Name (only if not me) */}
                                {!isMe && (
                                    <p className="text-[10px] font-bold text-[#64b5f6] mb-1 leading-none">{msg.sender}</p>
                                )}

                                {/* Message Content with Read More/Less */}
                                <MessageContent
                                    text={msg.text}
                                    onLongPressStart={() => handleLongPressStart(msg.text)}
                                    onLongPressEnd={handleLongPressEnd}
                                />

                                <div className={`text-[10px] mt-1 text-right opacity-60 ${isMe ? 'text-blue-100' : 'text-slate-400'}`}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex-none p-4 bg-[#17212b] relative">
                {showEmojiPicker && (
                    <div className="absolute bottom-20 left-4 z-20 shadow-xl rounded-xl overflow-hidden">
                        <EmojiPicker
                            onEmojiClick={onEmojiClick}
                            theme="dark"
                            searchDisabled
                            width={300}
                            height={400}
                        />
                    </div>
                )}
                <form onSubmit={sendMessage} className="flex gap-2 max-w-4xl mx-auto items-center">
                    <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="p-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm6.75 0c0 .414-.168.75-.375.75S15 10.164 15 9.75 15.168 9 15.375 9s.375.336.375.75z" />
                        </svg>
                    </button>
                    <textarea
                        className="flex-1 bg-[#242f3d] text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#2b5278] placeholder-slate-500 transition-shadow resize-none custom-scrollbar"
                        placeholder="Write a message..."
                        rows={1}
                        value={currentMessage}
                        onChange={(e) => {
                            setCurrentMessage(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage(e);
                            }
                        }}
                        style={{ height: 'auto', maxHeight: '120px' }}
                    />
                    <button
                        type="submit"
                        className={`p-3 rounded-full transition-transform active:scale-95 ${currentMessage.trim() ? 'bg-[#5288c1] text-white shadow-lg' : 'bg-[#2b5278]/50 text-slate-400 cursor-default'
                            }`}
                        disabled={!currentMessage.trim()}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 rotate-[-45deg] translate-x-0.5 -translate-y-0.5">
                            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    );
}

export default ChatRoom;
