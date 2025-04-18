import { useState, useEffect, useRef } from 'react';
import './App.css';
import { useAuthentication, useAccessToken } from './auth/auth-hooks';
import LoginButton from './components/LoginButton';
import UserProfile from './components/UserProfile';
import ProtectedRoute from './components/ProtectedRoute';

const API_URL = 'http://localhost:8000';

function App() {
  const { isAuthenticated, isLoading, user } = useAuthentication();
  const { getToken } = useAccessToken();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  // Fetch conversations on initial load and auth change
  useEffect(() => {
    if (isAuthenticated) {
      fetchConversations();
    }
  }, [isAuthenticated]);

  // Scroll to bottom of messages when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      // Get auth token if user is authenticated
      const headers = {};
      if (isAuthenticated) {
        const token = await getToken();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      const res = await fetch(`${API_URL}/api/conversations`, {
        headers
      });
      if (!res.ok) {
        throw new Error('Failed to fetch conversations');
      }
      const data = await res.json();
      setConversations(data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setError('Failed to load conversations');
    }
  };

  const selectConversation = async (conversationId) => {
    try {
      // Get auth token if user is authenticated
      const headers = {};
      if (isAuthenticated) {
        const token = await getToken();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      const res = await fetch(`${API_URL}/api/conversations/${conversationId}`, {
        headers
      });
      if (!res.ok) {
        throw new Error('Failed to fetch conversation');
      }
      const data = await res.json();
      setActiveConversation(data);
      setMessages(data.messages);
      setError('');
    } catch (error) {
      console.error('Error selecting conversation:', error);
      setError('Failed to load conversation');
    }
  };

  const createNewConversation = () => {
    setActiveConversation(null);
    setMessages([]);
    setError('');
  };

  const deleteConversation = async (conversationId) => {
    try {
      // Get auth token if user is authenticated
      const headers = {};
      if (isAuthenticated) {
        const token = await getToken();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      const res = await fetch(`${API_URL}/api/conversations/${conversationId}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) {
        throw new Error('Failed to delete conversation');
      }
      await fetchConversations();
      if (activeConversation && activeConversation.id === conversationId) {
        createNewConversation();
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      setError('Failed to delete conversation');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setError('');
    
    // Add user message to UI immediately
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
      sources: []
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Prepare request payload
    const payload = {
      message: userMessage.content,
    };

    // If we have an active conversation, include its ID
    if (activeConversation) {
      payload.conversation_id = activeConversation.id;
    }

    try {
      // Get auth token if user is authenticated
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (isAuthenticated) {
        const token = await getToken();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to get answer');
      }
      
      const data = await res.json();
      
      // Add sources to the message object
      const assistantMessage = {
        ...data.message,
        sources: data.sources || []
      };
      
      // If this is a new conversation, set it as active
      if (!activeConversation) {
        setActiveConversation({ 
          id: data.conversation_id, 
          messages: [userMessage, assistantMessage] 
        });
        await fetchConversations();  // Refresh the conversation list
      } else {
        // Update the existing conversation
        setActiveConversation(prev => ({
          ...prev,
          messages: [...prev.messages, assistantMessage]
        }));
      }
      
      // Add assistant message to UI
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      setError(error.message || 'Sorry, there was an error processing your message.');
    } finally {
      setLoading(false);
    }
  };

  // Format timestamp for display
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Extract sources from message content
  const extractSources = (content) => {
    // Simple regex to detect URLs in the message
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = content.match(urlRegex);
    
    if (!urls) return null;
    
    // Remove duplicates
    return [...new Set(urls)];
  };

  // Render sidebar with auth condition
  const renderSidebar = () => (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Conversations</h2>
        <div className="sidebar-actions">
          {isAuthenticated ? (
            <button className="new-chat-btn" onClick={createNewConversation}>
              + New Chat
            </button>
          ) : null}
        </div>
      </div>
      
      {isAuthenticated ? (
        <div className="conversation-list">
          {conversations.map(conv => (
            <div 
              key={conv.id} 
              className={`conversation-item ${activeConversation && activeConversation.id === conv.id ? 'active' : ''}`}
            >
              <div 
                className="conversation-title"
                onClick={() => selectConversation(conv.id)}
              >
                {conv.messages.length > 0 
                  ? conv.messages[0].content.substring(0, 30) + '...' 
                  : 'New conversation'}
                <span className="conversation-time">
                  {new Date(conv.updated_at).toLocaleDateString()}
                </span>
              </div>
              <button 
                className="delete-btn"
                onClick={() => deleteConversation(conv.id)}
                title="Delete conversation"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="sidebar-auth-message">
          <p>Sign in to save your conversations and access them later</p>
        </div>
      )}
    </aside>
  );

  return (
    <div className="chat-app">
      {renderSidebar()}
      
      <main className="chat-main">
        <header className="chat-header">
          <h1>Polish Law for Foreigners</h1>
          <p className="subtitle">Ask questions about Polish law</p>
          
          <div className="auth-controls">
            {isLoading ? (
              <div className="auth-loading-small">Loading...</div>
            ) : isAuthenticated ? (
              <UserProfile />
            ) : (
              <LoginButton />
            )}
          </div>
        </header>
        
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="welcome-message">
              <h2>Welcome to Polish Law Assistant</h2>
              <p>How can I help you with Polish legal questions today?</p>
              {!isAuthenticated && (
                <div className="welcome-auth-prompt">
                  <p>Sign in to save your conversations</p>
                  <LoginButton />
                </div>
              )}
            </div>
          ) : (
            messages.map(msg => {
              // Get sources from the message object or extract from content if not available
              const sources = msg.sources && msg.sources.length > 0 
                ? msg.sources 
                : (msg.role === 'assistant' ? extractSources(msg.content) : null);
              
              return (
                <div key={msg.id} className={`message ${msg.role}`}>
                  <div className="message-content">
                    {msg.content}
                  </div>
                  <div className="message-footer">
                    <div className="message-time">{formatTime(msg.timestamp)}</div>
                    {sources && sources.length > 0 && (
                      <div className="message-sources">
                        <span className="sources-label">Sources</span>
                        <div className="sources-tooltip">
                          <ul>
                            {sources.map((source, index) => (
                              <li key={index}>
                                <a href={source} target="_blank" rel="noopener noreferrer">
                                  {source}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          
          {loading && (
            <div className="message assistant loading">
              <div className="loading-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        <form onSubmit={handleSubmit} className="message-form">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="message-input"
            disabled={loading}
          />
          <button type="submit" className="send-button" disabled={loading || !input.trim()}>
            Send
          </button>
        </form>
      </main>
    </div>
  );
}

export default App;
