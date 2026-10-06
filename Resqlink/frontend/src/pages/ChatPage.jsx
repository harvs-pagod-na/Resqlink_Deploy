import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, MessageSquare, User, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import io from 'socket.io-client';
import api from '../api';
import { getSocketUrl } from '../utils/urlHelper';

let socket;

export default function ChatPage({ user }) {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socket = io(getSocketUrl(), { transports: ['websocket', 'polling'] });
    if (user?.id) {
      socket.emit('join_user_room', user.id);
    }

    socket.on('new_message', (msg) => {
      setMessages((prev) => [...prev, msg]);
      scrollToBottom();
    });

    fetchConversations();

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const res = await api.get('/chat/conversations');
      if (res.data.success) {
        setConversations(res.data.conversations);
        if (res.data.conversations.length > 0 && !activeConv) {
          handleSelectConv(res.data.conversations[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConv = async (conv) => {
    setActiveConv(conv);
    socket.emit('join_conversation', conv.id);
    try {
      const res = await api.get(`/chat/messages/${conv.id}`);
      if (res.data.success) {
        setMessages(res.data.messages);
        setTimeout(scrollToBottom, 100);
      }
    } catch (e) {}
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() || !activeConv) return;

    const recipientId = activeConv.participant1_id === user.id ? activeConv.participant2_id : activeConv.participant1_id;

    try {
      const res = await api.post('/chat/messages', {
        conversation_id: activeConv.id,
        receiver_id: recipientId,
        message_text: text,
      });

      if (res.data.success) {
        const sentMsg = res.data.message;
        socket.emit('send_message', sentMsg);
        setMessages((prev) => [...prev, sentMsg]);
        setText('');
        scrollToBottom();
      }
    } catch (err) {
      alert('Failed to send message.');
    }
  };

  const getOtherParticipant = (conv) => {
    if (conv.participant1_id === user.id) return conv.participant2;
    return conv.participant1;
  };

  return (
    <div style={{ height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column' }}>
      {!activeConv ? (
        <div>
          <h3 style={{ fontFamily: 'Outfit', fontSize: '18px', color: '#0B2545', marginBottom: '14px' }}>Messages</h3>
          {conversations.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
              <MessageSquare size={32} color="#94A3B8" style={{ margin: '0 auto 10px' }} />
              <h4 style={{ fontFamily: 'Outfit' }}>No conversations yet</h4>
              <p style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                When responders or dispatchers send incident messages, they will appear here.
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const partner = getOtherParticipant(conv);
              const profile = partner?.profile || {};
              const partnerName = profile.full_name || (profile.first_name ? `${profile.first_name} ${profile.last_name}` : partner?.email || 'User');

              return (
                <div
                  key={conv.id}
                  className="card"
                  onClick={() => handleSelectConv(conv)}
                  style={{ cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'center' }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: '#00A8E8',
                      color: '#FFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                    }}
                  >
                    {partnerName.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#0B2545' }}>{partnerName}</div>
                    <div style={{ fontSize: '12px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {conv.last_message}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Conv Header */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#FFF',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              borderRadius: '12px 12px 0 0',
            }}
          >
            <ArrowLeft size={18} cursor="pointer" onClick={() => setActiveConv(null)} color="#0B2545" />
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#0B2545' }}>
              {(() => {
                const partner = getOtherParticipant(activeConv);
                const profile = partner?.profile || {};
                return profile.full_name || (profile.first_name ? `${profile.first_name} ${profile.last_name}` : partner?.email || 'User');
              })()}
            </div>
          </div>

          {/* Messages Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', backgroundColor: '#F4F7FA' }}>
            {messages.map((m) => {
              const isMine = m.sender_id === user.id;
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: isMine ? 'flex-end' : 'flex-start',
                    marginBottom: '10px',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '75%',
                      padding: '10px 14px',
                      borderRadius: isMine ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                      backgroundColor: isMine ? '#00A8E8' : '#FFF',
                      color: isMine ? '#FFF' : '#0B2545',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                      fontSize: '13px',
                    }}
                  >
                    {m.message_text}
                    {m.attachment_url && (
                      <img
                        src={m.attachment_url}
                        alt="attachment"
                        style={{ marginTop: '6px', borderRadius: '8px', maxWidth: '100%' }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={handleSendMessage}
            style={{
              padding: '10px',
              backgroundColor: '#FFF',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              gap: '8px',
            }}
          >
            <input
              type="text"
              className="form-control"
              placeholder="Type your message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{ borderRadius: '20px' }}
            />
            <button type="submit" className="btn btn-primary" style={{ width: 'auto', borderRadius: '50%', padding: '10px' }}>
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
